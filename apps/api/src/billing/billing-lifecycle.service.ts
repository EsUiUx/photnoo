import { Injectable, Logger } from '@nestjs/common';
import { addCycle, AllowanceWarnings, BillingRules, cycleAllowanceBytes, daysBetween } from '@photnoo/shared';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 100;

function day(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Cairo' }).format(date);
}

function gb(bytes: bigint): string {
  return `${(Number(bytes) / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * Time-driven billing (PRD B-02, B-05, B-08), run by the worker with the lifecycle job:
 * roll paid cycles over, soft-lock unpaid ones at cycle end, mark 30-day soft locks Dormant,
 * and send each reminder once per cycle. Every step is idempotent.
 */
@Injectable()
export class BillingLifecycleService {
  private readonly logger = new Logger(BillingLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async tick(now = new Date()): Promise<Record<string, number>> {
    const result = {
      rolledOver: await this.rollOver(now),
      softLocked: await this.softLock(now),
      dormant: await this.markDormant(now),
      reminders: await this.remind(now),
    };
    if (Object.values(result).some((n) => n > 0)) this.logger.log({ ...result }, 'Billing run');
    return result;
  }

  /** Paid renewals start their new cycle at the old cycle end, with a fresh allowance. */
  async rollOver(now: Date): Promise<number> {
    const due = await this.prisma.client.subscription.findMany({
      where: { state: 'active', cycleEnd: { lte: now }, renewalPaidAt: { not: null } },
      include: { plan: true, nextPlan: true },
      take: BATCH,
    });
    for (const subscription of due) {
      const plan = subscription.nextPlan ?? subscription.plan;
      if (!plan) continue;
      const paid = await this.prisma.client.payment.findFirst({
        where: { subscriptionId: subscription.id, kind: 'renewal', status: 'approved' },
        orderBy: { decidedAt: 'desc' },
      });
      await this.prisma.client.$transaction([
        this.prisma.client.subscription.updateMany({
          where: { id: subscription.id, cycleEnd: subscription.cycleEnd, renewalPaidAt: { not: null } },
          data: {
            planId: plan.id,
            priceEgp: paid?.amountEgp ?? plan.priceEgp,
            cycleStart: subscription.cycleEnd,
            cycleEnd: addCycle(subscription.cycleEnd, plan.cycle),
            allowanceBytes: cycleAllowanceBytes(plan.allowanceBytes, plan.cycle),
            usedBytes: 0n,
            nextPlanId: null,
            renewalPaidAt: null,
          },
        }),
        this.prisma.client.usageEvent.create({
          data: { photographerId: subscription.photographerId, type: 'cycle_reset', bytes: subscription.usedBytes },
        }),
      ]);
    }
    return due.length;
  }

  /** B-08: unpaid at cycle end (or trial over): login and galleries stay, uploads and new galleries stop. */
  async softLock(now: Date): Promise<number> {
    const due = await this.prisma.client.subscription.findMany({
      where: { state: { in: ['active', 'trial'] }, cycleEnd: { lte: now }, renewalPaidAt: null },
      include: { photographer: { select: { email: true } } },
      take: BATCH,
    });
    for (const subscription of due) {
      const locked = await this.prisma.client.subscription.updateMany({
        where: { id: subscription.id, state: subscription.state, renewalPaidAt: null },
        data: { state: 'soft_locked' },
      });
      if (locked.count === 1) await this.mail.send(templates.softLocked(subscription.photographer.email));
    }
    return due.length;
  }

  async markDormant(now: Date): Promise<number> {
    const marked = await this.prisma.client.subscription.updateMany({
      where: { state: 'soft_locked', cycleEnd: { lte: new Date(now.getTime() - BillingRules.dormantAfterDays * DAY_MS) } },
      data: { state: 'dormant' },
    });
    return marked.count;
  }

  /** B-05: 45, 15, 7 and 0 days before the cycle ends. Only the closest reminder is sent. */
  async remind(now: Date): Promise<number> {
    const horizon = new Date(now.getTime() + (Math.max(...BillingRules.reminderDays) + 1) * DAY_MS);
    const candidates = await this.prisma.client.subscription.findMany({
      where: { state: { in: ['active', 'trial'] }, renewalPaidAt: null, cycleEnd: { gt: now, lte: horizon } },
      include: { photographer: { select: { email: true } } },
      take: BATCH * 5,
    });
    let sent = 0;
    for (const subscription of candidates) {
      const left = daysBetween(now, subscription.cycleEnd) - 1; // "0 days" = the last day
      const due = BillingRules.reminderDays.filter((d) => left <= d);
      if (due.length === 0) continue;
      const closest = Math.min(...due);
      const fresh = await this.claim(subscription.id, subscription.cycleEnd, due.map((d) => `renewal_${d}`));
      if (!fresh.includes(`renewal_${closest}`)) continue;
      await this.mail.send(
        templates.renewalReminder(subscription.photographer.email, closest, day(subscription.cycleEnd), subscription.state === 'trial'),
      );
      sent += 1;
    }
    return sent;
  }

  /** B-02: called after each completed upload; emails once per threshold per cycle. */
  async checkAllowance(subscriptionId: string): Promise<void> {
    const subscription = await this.prisma.client.subscription.findUnique({
      where: { id: subscriptionId },
      include: { photographer: { select: { email: true } } },
    });
    if (!subscription || subscription.allowanceBytes <= 0n) return;
    const ratio = Number(subscription.usedBytes) / Number(subscription.allowanceBytes);
    const crossed = AllowanceWarnings.filter((threshold) => ratio >= threshold);
    if (crossed.length === 0) return;
    const kinds = crossed.map((t) => `allowance_${Math.round(t * 100)}`);
    const fresh = await this.claim(subscription.id, subscription.cycleEnd, kinds);
    const highest = kinds[kinds.length - 1]!;
    if (!fresh.includes(highest)) return;
    await this.mail.send(
      templates.allowanceWarning(
        subscription.photographer.email,
        Math.round(crossed[crossed.length - 1]! * 100),
        gb(subscription.usedBytes),
        gb(subscription.allowanceBytes),
      ),
    );
  }

  /** Records notices; returns the kinds that were not sent before in this cycle. */
  private async claim(subscriptionId: string, cycleEnd: Date, kinds: string[]): Promise<string[]> {
    const fresh: string[] = [];
    for (const kind of kinds) {
      const created = await this.prisma.client.billingNotice.createMany({
        data: [{ subscriptionId, kind, cycleEnd }],
        skipDuplicates: true,
      });
      if (created.count === 1) fresh.push(kind);
    }
    return fresh;
  }
}
