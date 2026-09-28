import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ApplicationInput } from '@photnoo/shared';
import { AuditService } from '../audit/audit.service';
import { randomToken, sha256 } from '../common/crypto';
import { ENV, type Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';

const INVITE_DAYS = 7;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * PRD P-01. The response is identical whether or not the email is already known, so the form
   * cannot be used to discover who has an account.
   */
  async apply(input: ApplicationInput): Promise<void> {
    const [existingAccount, pending] = await Promise.all([
      this.prisma.client.photographer.findFirst({
        where: { OR: [{ email: input.email }, { phone: input.phone }] },
        select: { id: true },
      }),
      this.prisma.client.application.findFirst({
        where: { status: 'pending', OR: [{ email: input.email }, { phone: input.phone }] },
        select: { id: true },
      }),
    ]);
    if (existingAccount || pending) return;

    await this.prisma.client.application.create({ data: input });
    await this.mail.send(templates.applicationReceived(input.email, input.name));
  }

  /** Approve an application and email a single-use invite. Returns the invite URL. */
  async approve(
    applicationId: string,
    options: { grantTrial: boolean; decidedById?: string },
  ): Promise<string> {
    const application = await this.prisma.client.application.findUnique({ where: { id: applicationId } });
    if (!application) throw new NotFoundException({ code: 'not_found', message: 'Application not found.' });
    if (application.status !== 'pending') {
      throw new BadRequestException({ code: 'already_decided', message: 'This application was already decided.' });
    }

    // PRD B-09: one trial per person, matched on email and phone across past applications.
    if (options.grantTrial) {
      const earlier = await this.prisma.client.application.count({
        where: {
          id: { not: application.id },
          status: 'approved',
          grantTrial: true,
          OR: [{ email: application.email }, { phone: application.phone }],
        },
      });
      if (earlier > 0) {
        throw new BadRequestException({ code: 'trial_already_used', message: 'This person already had a trial. Approve without one.' });
      }
    }

    const token = randomToken();
    await this.prisma.client.application.update({
      where: { id: applicationId },
      data: {
        status: 'approved',
        grantTrial: options.grantTrial,
        decidedById: options.decidedById ?? null,
        decidedAt: new Date(),
        inviteTokenHash: sha256(token),
        inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    await this.audit.record({
      actorType: options.decidedById ? 'admin' : 'system',
      actorId: options.decidedById ?? null,
      action: 'application.approved',
      targetType: 'application',
      targetId: applicationId,
      data: { grantTrial: options.grantTrial },
    });

    const inviteUrl = `${this.env.WEB_ORIGIN}/invite/${token}`;
    await this.mail.send(templates.invite(application.email, application.name, inviteUrl));
    return inviteUrl;
  }

  async reject(applicationId: string, reason: string, decidedById?: string): Promise<void> {
    const updated = await this.prisma.client.application.updateMany({
      where: { id: applicationId, status: 'pending' },
      data: { status: 'rejected', decisionReason: reason, decidedById: decidedById ?? null, decidedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw new BadRequestException({ code: 'already_decided', message: 'Application not pending.' });
    }
    await this.audit.record({
      actorType: decidedById ? 'admin' : 'system',
      actorId: decidedById ?? null,
      action: 'application.rejected',
      targetType: 'application',
      targetId: applicationId,
      reason,
    });
  }
}
