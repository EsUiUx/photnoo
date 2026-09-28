import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AcceptInviteInput, LoginInput, PasswordResetConfirmInput } from '@photnoo/shared';
import { TrialDefaults } from '@photnoo/shared';
import { AuditService } from '../audit/audit.service';
import { hmac, randomToken, safeEqual, sha256, sixDigitCode } from '../common/crypto';
import { ENV, type Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, passwordProblem, verifyPassword } from './passwords';
import { TokensService } from './tokens.service';

export type RequestMeta = { ip?: string | null; userAgent?: string | null };
export type SessionTokens = { accessToken: string; refreshToken: string; csrfToken: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_CODE_MINUTES = 10;
const RESET_MAX_ATTEMPTS = 5;
const RESET_MAX_PER_HOUR = 3;
/** Two tabs refreshing at once: the loser gets a plain 401 instead of a family revoke. */
const REFRESH_RACE_GRACE_MS = 30_000;

const invalidCredentials = () =>
  new UnauthorizedException({ code: 'invalid_credentials', message: 'Email or password is incorrect.' });
const sessionExpired = () =>
  new UnauthorizedException({ code: 'session_expired', message: 'Your session has ended. Please log in.' });

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---------- Invites ----------

  async getInvite(token: string): Promise<{ name: string; email: string }> {
    const application = await this.findValidInvite(token);
    return { name: application.name, email: application.email };
  }

  /** PRD P-02: create the account from a single-use invite, then log the photographer in. */
  async acceptInvite(input: AcceptInviteInput, meta: RequestMeta): Promise<SessionTokens> {
    const application = await this.findValidInvite(input.token);
    const problem = passwordProblem(input.password, application.email);
    if (problem) throw weakPassword(problem);

    const taken = await this.prisma.client.photographer.findFirst({
      where: { OR: [{ email: application.email }, { phone: application.phone }] },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException({ code: 'account_exists', message: 'An account already exists. Please log in.' });
    }

    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    const photographer = await this.prisma.client.$transaction(async (tx) => {
      // Claim the invite atomically so a double submit cannot create two accounts.
      const claimed = await tx.application.updateMany({
        where: { id: application.id, inviteUsedAt: null },
        data: { inviteUsedAt: now },
      });
      if (claimed.count !== 1) throw inviteInvalid();

      const created = await tx.photographer.create({
        data: {
          name: application.name,
          studioName: application.studioName,
          email: application.email,
          phone: application.phone,
          city: application.city,
          passwordHash,
          termsAcceptedAt: now,
          applicationId: application.id,
        },
      });

      await tx.subscription.create({
        data: application.grantTrial
          ? {
              photographerId: created.id,
              state: 'trial',
              cycleStart: now,
              cycleEnd: new Date(now.getTime() + TrialDefaults.days * DAY_MS),
              allowanceBytes: BigInt(TrialDefaults.allowanceBytes),
            }
          : {
              photographerId: created.id,
              state: 'pending_payment',
              cycleStart: now,
              cycleEnd: now,
              allowanceBytes: 0n,
            },
      });

      await this.audit.record(
        {
          actorType: 'photographer',
          actorId: created.id,
          action: 'account.created',
          targetType: 'photographer',
          targetId: created.id,
          ip: meta.ip,
          data: { trial: application.grantTrial },
        },
        tx,
      );
      return created;
    });

    return this.createSession(photographer.id, meta);
  }

  private async findValidInvite(token: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { inviteTokenHash: sha256(token) },
    });
    if (
      !application ||
      application.status !== 'approved' ||
      application.inviteUsedAt ||
      !application.inviteExpiresAt ||
      application.inviteExpiresAt < new Date()
    ) {
      throw inviteInvalid();
    }
    return application;
  }

  // ---------- Login and sessions ----------

  /** PRD P-03: 5 failed attempts lock the account for 15 minutes. */
  async login(input: LoginInput, meta: RequestMeta): Promise<SessionTokens> {
    const photographer = await this.prisma.client.photographer.findUnique({ where: { email: input.email } });

    if (photographer?.lockedUntil && photographer.lockedUntil > new Date()) {
      throw new HttpException(
        { code: 'account_locked', message: `Too many attempts. Try again in ${LOCK_MINUTES} minutes.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = await verifyPassword(photographer?.passwordHash ?? null, input.password);
    if (!photographer || !ok) {
      if (photographer) await this.recordFailedLogin(photographer.id, photographer.failedLogins, meta);
      throw invalidCredentials();
    }

    if (photographer.status !== 'active') {
      throw new ForbiddenException({
        code: 'account_suspended',
        message: 'This account is suspended. Contact Photnoo support.',
      });
    }

    await this.prisma.client.photographer.update({
      where: { id: photographer.id },
      data: { failedLogins: 0, lockedUntil: null },
    });
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographer.id,
      action: 'auth.login',
      targetType: 'photographer',
      targetId: photographer.id,
      ip: meta.ip,
      data: { userAgent: meta.userAgent ?? null },
    });
    return this.createSession(photographer.id, meta);
  }

  private async recordFailedLogin(photographerId: string, previousFailures: number, meta: RequestMeta) {
    const failures = previousFailures + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await this.prisma.client.photographer.update({
      where: { id: photographerId },
      data: lock
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLogins: failures },
    });
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: lock ? 'auth.locked' : 'auth.login_failed',
      targetType: 'photographer',
      targetId: photographerId,
      ip: meta.ip,
    });
  }

  /**
   * Rotate the refresh token. Presenting an already-rotated token means it was stolen or replayed,
   * so the whole login family is revoked (PRD section 10).
   */
  async refresh(refreshToken: string | undefined, meta: RequestMeta): Promise<SessionTokens> {
    if (!refreshToken) throw sessionExpired();
    const session = await this.prisma.client.session.findUnique({
      where: { refreshHash: sha256(refreshToken) },
      include: { photographer: { select: { status: true } } },
    });
    if (!session) throw sessionExpired();

    if (session.revokedAt) {
      const raced = session.replacedById && Date.now() - session.revokedAt.getTime() < REFRESH_RACE_GRACE_MS;
      if (session.replacedById && !raced) {
        await this.prisma.client.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.record({
          actorType: 'system',
          action: 'auth.refresh_reuse',
          targetType: 'photographer',
          targetId: session.photographerId,
          ip: meta.ip,
          data: { familyId: session.familyId },
        });
      }
      throw sessionExpired();
    }
    if (session.expiresAt < new Date() || session.photographer.status !== 'active') throw sessionExpired();

    const next = await this.createSession(session.photographerId, meta, session.familyId);
    const claimed = await this.prisma.client.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedById: next.sessionId, lastUsedAt: new Date() },
    });
    if (claimed.count !== 1) {
      // Another request rotated this token first; drop the one we just made.
      await this.prisma.client.session.update({ where: { id: next.sessionId }, data: { revokedAt: new Date() } });
      throw sessionExpired();
    }
    return next;
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.client.session.updateMany({
      where: { refreshHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(photographerId: string, meta: RequestMeta): Promise<void> {
    await this.revokeAllSessions(photographerId);
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: 'auth.logout_all',
      targetType: 'photographer',
      targetId: photographerId,
      ip: meta.ip,
    });
  }

  private revokeAllSessions(photographerId: string) {
    return this.prisma.client.session.updateMany({
      where: { photographerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(
    photographerId: string,
    meta: RequestMeta,
    familyId: string = randomUUID(),
  ): Promise<SessionTokens & { sessionId: string }> {
    const refreshToken = randomToken();
    const session = await this.prisma.client.session.create({
      data: {
        photographerId,
        familyId,
        refreshHash: sha256(refreshToken),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
      },
    });
    const accessToken = await this.tokens.signAccess({ photographerId, sessionId: session.id });
    return { accessToken, refreshToken, csrfToken: randomToken(24), sessionId: session.id };
  }

  // ---------- Password reset ----------

  /** Always succeeds from the caller's view, so the endpoint cannot be used to find accounts. */
  async requestPasswordReset(email: string): Promise<void> {
    const photographer = await this.prisma.client.photographer.findUnique({ where: { email } });
    if (!photographer || photographer.status === 'deleted') return;

    const recent = await this.prisma.client.passwordResetCode.count({
      where: { photographerId: photographer.id, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
    });
    if (recent >= RESET_MAX_PER_HOUR) return;

    const code = sixDigitCode();
    await this.prisma.client.passwordResetCode.create({
      data: {
        photographerId: photographer.id,
        codeHash: this.hashResetCode(photographer.id, code),
        expiresAt: new Date(Date.now() + RESET_CODE_MINUTES * 60_000),
      },
    });
    await this.mail.send(templates.resetCode(photographer.email, code, photographer.locale));
  }

  async confirmPasswordReset(input: PasswordResetConfirmInput, meta: RequestMeta): Promise<void> {
    const invalid = () =>
      new BadRequestException({ code: 'reset_invalid', message: 'The code is wrong or has expired.' });

    const photographer = await this.prisma.client.photographer.findUnique({ where: { email: input.email } });
    if (!photographer) throw invalid();

    const record = await this.prisma.client.passwordResetCode.findFirst({
      where: { photographerId: photographer.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.attempts >= RESET_MAX_ATTEMPTS) throw invalid();

    if (!safeEqual(record.codeHash, this.hashResetCode(photographer.id, input.code))) {
      await this.prisma.client.passwordResetCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid();
    }

    const problem = passwordProblem(input.newPassword, photographer.email);
    if (problem) throw weakPassword(problem);
    const passwordHash = await hashPassword(input.newPassword);

    await this.prisma.client.$transaction(async (tx) => {
      await tx.passwordResetCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.photographer.update({
        where: { id: photographer.id },
        data: { passwordHash, failedLogins: 0, lockedUntil: null },
      });
      // A reset ends every existing login.
      await tx.session.updateMany({
        where: { photographerId: photographer.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: 'photographer',
          actorId: photographer.id,
          action: 'auth.password_reset',
          targetType: 'photographer',
          targetId: photographer.id,
          ip: meta.ip,
        },
        tx,
      );
    });
  }

  private hashResetCode(photographerId: string, code: string): string {
    return hmac(this.env.JWT_ACCESS_SECRET, `reset:${photographerId}:${code}`);
  }
}

function inviteInvalid() {
  return new GoneException({
    code: 'invite_invalid',
    message: 'This invite link has expired or was already used.',
  });
}

function weakPassword(message: string) {
  return new BadRequestException({
    code: 'validation_failed',
    message,
    fields: [{ path: 'password', message }],
  });
}
