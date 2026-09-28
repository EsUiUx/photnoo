import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addCycle,
  BillingRules,
  cycleAllowanceBytes,
  daysBetween,
  invoiceNumber,
  type PaymentProofInput,
  paymentReference,
  prorateUpgrade,
} from '@photnoo/shared';
import type { Payment, Plan, Prisma, Subscription } from '@photnoo/db';
import { AuditService } from '../audit/audit.service';
import { ENV, type Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { templates } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';
import { renderInvoicePdf } from './invoice-pdf';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = ['awaiting_proof', 'pending'] as const;
const PROOF_TYPES = { jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' } as const;
const SIGNED_TTL_SECONDS = 300;

export type SubscriptionWithPlans = Subscription & { plan: Plan | null; nextPlan: Plan | null };
export type OfferAction = 'subscribe' | 'renew' | 'upgrade' | 'switch' | 'scheduled' | 'current' | 'unavailable';
export type Offer = { action: OfferAction; amountEgp?: number; availableFrom?: Date; reason?: string };
export type ProofFile = { buffer: Buffer; originalname: string; size: number };

export const egp = (value: Prisma.Decimal | null | undefined): number => (value ? Number(value.toString()) : 0);
export const planLabel = (plan: Pick<Plan, 'tier'>): string => plan.tier.replace(/(\d)([A-Z])/, '$1 $2');

export function planJson(plan: Plan) {
  return {
    id: plan.id,
    tier: plan.tier,
    label: planLabel(plan),
    cycle: plan.cycle,
    priceEgp: egp(plan.priceEgp),
    annualAllowanceBytes: plan.allowanceBytes.toString(),
    cycleAllowanceBytes: cycleAllowanceBytes(plan.allowanceBytes, plan.cycle).toString(),
  };
}

export function paymentJson(payment: Payment & { plan: Plan; invoice?: { id: string; number: number } | null }) {
  return {
    id: payment.id,
    reference: payment.reference,
    kind: payment.kind,
    status: payment.status,
    plan: planJson(payment.plan),
    amountEgp: egp(payment.amountEgp),
    declaredAmountEgp: payment.declaredAmountEgp ? egp(payment.declaredAmountEgp) : null,
    method: payment.method,
    hasProof: Boolean(payment.proofKey),
    proofName: payment.proofName,
    rejectReason: payment.rejectReason,
    createdAt: payment.createdAt,
    submittedAt: payment.submittedAt,
    decidedAt: payment.decidedAt,
    invoice: payment.invoice ? { id: payment.invoice.id, number: invoiceNumber(payment.invoice.number) } : null,
  };
}

function sniffProof(head: Buffer): keyof typeof PROOF_TYPES | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head.subarray(0, 8).toString('latin1') === '\x89PNG\r\n\x1a\n') return 'png';
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  return null;
}

/**
 * Plans, manual payments and invoices (PRD B-01 to B-09, A-02). A photographer has one
 * Subscription row that moves through trial → active → soft_locked → dormant; each paid cycle
 * is a Payment with an Invoice. Money decisions (what can be bought now and for how much) are
 * made here only, and the web shows them as offers.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---------- reads ----------

  async subscription(photographerId: string): Promise<SubscriptionWithPlans> {
    const subscription = await this.prisma.client.subscription.findFirst({
      where: { photographerId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true, nextPlan: true },
    });
    if (!subscription) throw new NotFoundException({ code: 'not_found', message: 'No subscription.' });
    return subscription;
  }

  /** Plans on sale now, smallest first, annual before monthly. */
  catalog(now = new Date()) {
    return this.prisma.client.plan.findMany({
      where: { activeFrom: { lte: now }, OR: [{ activeTo: null }, { activeTo: { gt: now } }] },
      orderBy: [{ allowanceBytes: 'asc' }, { cycle: 'asc' }],
    });
  }

  async overview(photographerId: string, now = new Date()) {
    const [subscription, plans, payments] = await Promise.all([
      this.subscription(photographerId),
      this.catalog(now),
      this.prisma.client.payment.findMany({
        where: { photographerId, status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { plan: true, invoice: { select: { id: true, number: true } } },
      }),
    ]);
    const open = payments.find((p) => (OPEN_STATUSES as readonly string[]).includes(p.status));

    return {
      subscription: subscriptionJson(subscription, now),
      plans: plans.map((plan) => ({ ...planJson(plan), offer: this.offer(subscription, plan, now) })),
      openPayment: open ? paymentJson(open) : null,
      payments: payments.filter((p) => p !== open).map(paymentJson),
      paymentDetails: this.paymentDetails(),
    };
  }

  /** Where to send money. A method without details is not offered. */
  paymentDetails() {
    const env = this.env;
    return {
      instapay: env.PAY_INSTAPAY_HANDLE ? { handle: env.PAY_INSTAPAY_HANDLE } : null,
      vodafone_cash: env.PAY_VODAFONE_CASH_NUMBER ? { number: env.PAY_VODAFONE_CASH_NUMBER } : null,
      bank_transfer: env.PAY_BANK_ACCOUNT_NUMBER
        ? {
            bank: env.PAY_BANK_NAME ?? null,
            accountName: env.PAY_BANK_ACCOUNT_NAME ?? null,
            accountNumber: env.PAY_BANK_ACCOUNT_NUMBER,
            iban: env.PAY_BANK_IBAN ?? null,
          }
        : null,
    };
  }

  /**
   * What the photographer can do with one plan right now:
   * - no paid cycle running (trial, never paid, lapsed): subscribe at the full price;
   * - the plan they will renew into: renew, from 45 days before the cycle ends;
   * - a bigger plan on the same cycle: upgrade now, prorated (B-06);
   * - anything else: switch at the next renewal, no payment now (B-07).
   */
  offer(subscription: SubscriptionWithPlans, plan: Plan, now = new Date()): Offer {
    if (subscription.state === 'suspended') return { action: 'unavailable', reason: 'suspended' };
    const price = egp(plan.priceEgp);
    const current = subscription.plan;
    const paid = subscription.state === 'active' && current && subscription.cycleEnd > now;
    if (!paid || !current) return { action: 'subscribe', amountEgp: price };

    const renewTarget = subscription.nextPlanId ?? current.id;
    if (plan.id === renewTarget) {
      const opensAt = new Date(subscription.cycleEnd.getTime() - BillingRules.renewalOpensDays * DAY_MS);
      if (subscription.renewalPaidAt) return { action: plan.id === current.id ? 'current' : 'scheduled', reason: 'renewal_paid' };
      if (now >= opensAt) return { action: 'renew', amountEgp: price };
      return { action: plan.id === current.id ? 'current' : 'scheduled', availableFrom: opensAt };
    }
    // The current plan while a switch is scheduled: choosing it cancels the switch.
    if (plan.id === current.id) return { action: 'switch', reason: 'keep_current' };
    if (plan.cycle === current.cycle && plan.allowanceBytes > current.allowanceBytes) {
      if (subscription.renewalPaidAt) return { action: 'unavailable', reason: 'renewal_paid' };
      const amount = prorateUpgrade({
        newPriceEgp: price,
        oldPriceEgp: egp(subscription.priceEgp ?? current.priceEgp),
        cycleStart: subscription.cycleStart,
        cycleEnd: subscription.cycleEnd,
        now,
      });
      if (amount <= 0) return { action: 'switch' };
      return { action: 'upgrade', amountEgp: amount };
    }
    if (subscription.renewalPaidAt) return { action: 'unavailable', reason: 'renewal_paid' };
    return { action: 'switch' };
  }

  // ---------- photographer actions ----------

  /** B-03: opens a manual payment with a unique reference. One open payment at a time. */
  async checkout(photographerId: string, planId: string, now = new Date()) {
    const [subscription, plan, open] = await Promise.all([
      this.subscription(photographerId),
      this.planOnSale(planId, now),
      this.prisma.client.payment.findFirst({ where: { photographerId, status: { in: [...OPEN_STATUSES] } } }),
    ]);
    if (open) throw new ConflictException({ code: 'payment_open', message: 'Finish or cancel your open payment first.' });

    const offer = this.offer(subscription, plan, now);
    const kind = offer.action === 'subscribe' ? 'new' : offer.action === 'renew' ? 'renewal' : offer.action === 'upgrade' ? 'upgrade' : null;
    if (!kind || offer.amountEgp === undefined) {
      throw new ConflictException({ code: 'not_available', message: 'This plan cannot be bought right now.', details: { offer } });
    }

    for (let attempt = 0; ; attempt += 1) {
      try {
        const payment = await this.prisma.client.payment.create({
          data: {
            photographerId,
            subscriptionId: subscription.id,
            planId: plan.id,
            kind,
            amountEgp: offer.amountEgp,
            reference: paymentReference(randomBytes(6)),
          },
          include: { plan: true },
        });
        await this.audit.record({
          actorType: 'photographer',
          actorId: photographerId,
          action: 'billing.checkout',
          targetType: 'payment',
          targetId: payment.id,
          data: { kind, planId: plan.id, amountEgp: offer.amountEgp },
        });
        return paymentJson(payment);
      } catch (err) {
        // A reference collision is astronomically rare; try a fresh one.
        if ((err as { code?: string }).code !== 'P2002' || attempt >= 4) throw err;
      }
    }
  }

  /** B-03: proof of payment (image or PDF ≤ 10 MB), method and amount. Can be replaced while pending. */
  async submitProof(photographerId: string, paymentId: string, file: ProofFile | undefined, input: PaymentProofInput) {
    const payment = await this.openPayment(photographerId, paymentId);
    if (!file) throw new BadRequestException({ code: 'proof_required', message: 'Attach the payment receipt.' });
    if (file.size > BillingRules.proofMaxBytes) {
      throw new HttpException({ code: 'proof_too_large', message: 'The receipt must be 10 MB or smaller.' }, HttpStatus.PAYLOAD_TOO_LARGE);
    }
    const type = sniffProof(file.buffer.subarray(0, 16));
    if (!type) {
      throw new HttpException(
        { code: 'unsupported_proof', message: 'Upload a JPG, PNG or PDF receipt.' },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const key = `billing/${photographerId}/payments/${payment.id}/proof-${Date.now()}.${type === 'jpeg' ? 'jpg' : type}`;
    await this.storage.putObject(key, file.buffer, PROOF_TYPES[type]);
    const updated = await this.prisma.client.payment.update({
      where: { id: payment.id },
      data: {
        status: 'pending',
        method: input.method,
        declaredAmountEgp: input.declaredAmountEgp,
        proofKey: key,
        proofName: file.originalname.slice(0, 200),
        proofMime: PROOF_TYPES[type],
        submittedAt: new Date(),
      },
      include: { plan: true },
    });
    if (payment.proofKey) await this.storage.deleteObjects([payment.proofKey]).catch(() => undefined);
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: 'billing.proof_submitted',
      targetType: 'payment',
      targetId: payment.id,
      data: { method: input.method, declaredAmountEgp: input.declaredAmountEgp },
    });
    return paymentJson(updated);
  }

  async cancel(photographerId: string, paymentId: string) {
    const payment = await this.openPayment(photographerId, paymentId);
    const cancelled = await this.prisma.client.payment.updateMany({
      where: { id: payment.id, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'cancelled', decidedAt: new Date() },
    });
    if (cancelled.count !== 1) throw new ConflictException({ code: 'payment_decided', message: 'This payment was already reviewed.' });
    if (payment.proofKey) await this.storage.deleteObjects([payment.proofKey]).catch(() => undefined);
  }

  /** B-07: downgrades and cycle changes start at the next renewal. `null` keeps the current plan. */
  async setNextPlan(photographerId: string, planId: string | null, now = new Date()) {
    const subscription = await this.subscription(photographerId);
    const current = subscription.plan;
    if (subscription.state !== 'active' || !current || subscription.cycleEnd <= now) {
      throw new ConflictException({ code: 'no_active_plan', message: 'Choose a plan first.' });
    }
    if (subscription.renewalPaidAt) {
      throw new ConflictException({ code: 'renewal_paid', message: 'Your next cycle is already paid.' });
    }
    let nextPlanId: string | null = null;
    if (planId && planId !== current.id) {
      const plan = await this.planOnSale(planId, now);
      const action = this.offer(subscription, plan, now).action;
      if (!['switch', 'scheduled', 'renew'].includes(action)) {
        throw new ConflictException({ code: 'not_available', message: 'Upgrade to this plan instead.' });
      }
      nextPlanId = plan.id;
    }
    await this.prisma.client.subscription.update({ where: { id: subscription.id }, data: { nextPlanId } });
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: 'billing.next_plan',
      targetType: 'subscription',
      targetId: subscription.id,
      data: { nextPlanId },
    });
  }

  async proofUrl(photographerId: string, paymentId: string) {
    const payment = await this.prisma.client.payment.findFirst({ where: { id: paymentId, photographerId } });
    if (!payment?.proofKey) throw new NotFoundException({ code: 'not_found', message: 'No receipt uploaded.' });
    return { url: await this.storage.signDownload(payment.proofKey, SIGNED_TTL_SECONDS, payment.proofName ?? undefined) };
  }

  async invoiceUrl(photographerId: string, invoiceId: string) {
    const invoice = await this.prisma.client.invoice.findFirst({ where: { id: invoiceId, photographerId } });
    if (!invoice) throw new NotFoundException({ code: 'not_found', message: 'Invoice not found.' });
    const key = invoice.pdfKey ?? (await this.renderInvoice(invoice.id));
    return { url: await this.storage.signDownload(key, SIGNED_TTL_SECONDS, `${invoiceNumber(invoice.number)}.pdf`) };
  }

  // ---------- review (admin; CLI until the admin app exists) ----------

  /**
   * A-02: approving applies the payment and issues the invoice in one transaction.
   * - new: a cycle starts now with a fresh allowance;
   * - renewal paid early: the next cycle is booked and starts at the current cycle end;
   * - renewal paid late: the cycle restarts from the old end if the proof arrived in time,
   *   otherwise from now;
   * - upgrade: the bigger allowance applies now, the renewal date stays.
   */
  async approve(paymentId: string, options: { adminId?: string; ip?: string | null; now?: Date } = {}) {
    const now = options.now ?? new Date();
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: paymentId },
      include: { plan: true, subscription: { include: { plan: true, nextPlan: true } } },
    });
    if (!payment) throw new NotFoundException({ code: 'not_found', message: 'Payment not found.' });
    if (payment.status !== 'pending') {
      throw new ConflictException({ code: 'not_pending', message: 'Only payments with a receipt can be approved.' });
    }
    const subscription = payment.subscription;
    const plan = payment.plan;
    const allowance = cycleAllowanceBytes(plan.allowanceBytes, plan.cycle);
    const running = subscription.state === 'active' && subscription.cycleEnd > now;

    let update: Prisma.SubscriptionUpdateInput;
    let period: { start: Date; end: Date };
    let resetUsage = false;
    if (payment.kind === 'upgrade') {
      if (!running) throw new ConflictException({ code: 'payment_stale', message: 'The cycle this upgrade was for has ended.' });
      update = { plan: { connect: { id: plan.id } }, priceEgp: plan.priceEgp, allowanceBytes: allowance, nextPlan: { disconnect: true } };
      period = { start: now, end: subscription.cycleEnd };
    } else if (payment.kind === 'renewal' && running) {
      update = { renewalPaidAt: now, nextPlan: { connect: { id: plan.id } } };
      period = { start: subscription.cycleEnd, end: addCycle(subscription.cycleEnd, plan.cycle) };
    } else {
      let start = now;
      if (payment.kind === 'renewal' && payment.submittedAt && payment.submittedAt <= subscription.cycleEnd) {
        start = subscription.cycleEnd;
        if (addCycle(start, plan.cycle) <= now) start = now;
      }
      period = { start, end: addCycle(start, plan.cycle) };
      resetUsage = true;
      update = {
        state: 'active',
        plan: { connect: { id: plan.id } },
        priceEgp: plan.priceEgp,
        cycleStart: period.start,
        cycleEnd: period.end,
        allowanceBytes: allowance,
        usedBytes: 0n,
        nextPlan: { disconnect: true },
        renewalPaidAt: null,
      };
    }

    const invoice = await this.prisma.client.$transaction(async (tx) => {
      const decided = await tx.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'approved', approvedById: options.adminId ?? null, decidedAt: now },
      });
      if (decided.count !== 1) throw new ConflictException({ code: 'not_pending', message: 'This payment was already reviewed.' });
      await tx.subscription.update({ where: { id: subscription.id }, data: update });
      if (resetUsage) {
        await tx.usageEvent.create({ data: { photographerId: payment.photographerId, type: 'cycle_reset', bytes: subscription.usedBytes } });
      }
      const total = egp(payment.amountEgp);
      const vat = Math.round(total * (BillingRules.vatRate / (1 + BillingRules.vatRate)) * 100) / 100;
      const created = await tx.invoice.create({
        data: {
          photographerId: payment.photographerId,
          paymentId: payment.id,
          totalEgp: total,
          vatEgp: vat,
          periodStart: period.start,
          periodEnd: period.end,
        },
      });
      await this.audit.record(
        {
          actorType: options.adminId ? 'admin' : 'system',
          actorId: options.adminId ?? null,
          action: 'payment.approved',
          targetType: 'payment',
          targetId: payment.id,
          ip: options.ip ?? null,
          data: { kind: payment.kind, planId: plan.id, invoice: created.number, periodStart: period.start, periodEnd: period.end },
        },
        tx,
      );
      return created;
    });

    await this.renderInvoice(invoice.id).catch(() => undefined); // retried on first download
    const photographer = await this.prisma.client.photographer.findUniqueOrThrow({ where: { id: payment.photographerId } });
    await this.mail.send(
      templates.paymentApproved(photographer.email, payment.reference, planLabel(plan), day(period.end), invoiceNumber(invoice.number)),
    );
    await this.notifications.notify(payment.photographerId, {
      type: 'payment_approved',
      dedupeKey: `payment:${payment.id}`,
      data: { reference: payment.reference, plan: planLabel(plan), amountEgp: egp(payment.amountEgp), periodEnd: period.end.toISOString() },
    });
    return invoice;
  }

  async reject(paymentId: string, reason: string, adminId?: string, ip?: string | null) {
    const payment = await this.prisma.client.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ code: 'not_found', message: 'Payment not found.' });
    const decided = await this.prisma.client.payment.updateMany({
      where: { id: paymentId, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'rejected', rejectReason: reason, approvedById: adminId ?? null, decidedAt: new Date() },
    });
    if (decided.count !== 1) throw new ConflictException({ code: 'not_pending', message: 'This payment was already reviewed.' });
    await this.audit.record({
      actorType: adminId ? 'admin' : 'system',
      actorId: adminId ?? null,
      action: 'payment.rejected',
      targetType: 'payment',
      targetId: paymentId,
      reason,
      ip: ip ?? null,
    });
    const photographer = await this.prisma.client.photographer.findUniqueOrThrow({ where: { id: payment.photographerId } });
    await this.mail.send(templates.paymentRejected(photographer.email, payment.reference, reason));
    await this.notifications.notify(payment.photographerId, {
      type: 'payment_rejected',
      dedupeKey: `payment:${payment.id}`,
      data: { reference: payment.reference, reason, amountEgp: egp(payment.amountEgp) },
    });
  }

  // ---------- helpers ----------

  private async planOnSale(planId: string, now: Date) {
    const plan = await this.prisma.client.plan.findFirst({
      where: { id: planId, activeFrom: { lte: now }, OR: [{ activeTo: null }, { activeTo: { gt: now } }] },
    });
    if (!plan) throw new NotFoundException({ code: 'plan_not_found', message: 'This plan is not available.' });
    return plan;
  }

  private async openPayment(photographerId: string, paymentId: string) {
    const payment = await this.prisma.client.payment.findFirst({ where: { id: paymentId, photographerId } });
    if (!payment) throw new NotFoundException({ code: 'not_found', message: 'Payment not found.' });
    if (!(OPEN_STATUSES as readonly string[]).includes(payment.status)) {
      throw new ConflictException({ code: 'payment_decided', message: 'This payment was already reviewed.' });
    }
    return payment;
  }

  /** Draws the PDF once and stores it; invoices never change after issue. */
  private async renderInvoice(invoiceId: string): Promise<string> {
    const invoice = await this.prisma.client.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { payment: { include: { plan: true } } },
    });
    const photographer = await this.prisma.client.photographer.findUniqueOrThrow({ where: { id: invoice.photographerId } });
    const plan = invoice.payment.plan;
    const kind = { new: 'plan', renewal: 'plan renewal', upgrade: 'upgrade (prorated)' }[invoice.payment.kind];

    const pdf = await renderInvoicePdf({
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      seller: {
        name: this.env.COMPANY_NAME,
        address: this.env.COMPANY_ADDRESS,
        email: this.env.COMPANY_EMAIL,
        taxId: this.env.COMPANY_TAX_ID,
        commercialRegister: this.env.COMPANY_COMMERCIAL_REGISTER,
      },
      buyer: { name: photographer.name, studioName: photographer.studioName, email: photographer.email, phone: photographer.phone },
      line: { description: `Photnoo ${planLabel(plan)} ${plan.cycle} ${kind}`, periodStart: invoice.periodStart, periodEnd: invoice.periodEnd },
      reference: invoice.payment.reference,
      method: (invoice.payment.method ?? 'manual').replace('_', ' '),
      totalEgp: egp(invoice.totalEgp),
      vatEgp: egp(invoice.vatEgp),
      vatRate: BillingRules.vatRate,
    });
    const key = `billing/${invoice.photographerId}/invoices/${invoiceNumber(invoice.number)}.pdf`;
    await this.storage.putObject(key, pdf, 'application/pdf');
    await this.prisma.client.invoice.update({ where: { id: invoice.id }, data: { pdfKey: key } });
    return key;
  }
}

function day(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Cairo' }).format(date);
}

export function subscriptionJson(subscription: SubscriptionWithPlans, now = new Date()) {
  return {
    id: subscription.id,
    state: subscription.state,
    plan: subscription.plan ? planJson(subscription.plan) : null,
    nextPlan: subscription.nextPlan ? planJson(subscription.nextPlan) : null,
    priceEgp: subscription.priceEgp ? egp(subscription.priceEgp) : null,
    cycleStart: subscription.cycleStart,
    cycleEnd: subscription.cycleEnd,
    // Whole days left, rounded down: 10 days and 3 hours reads as "10 days".
    daysLeft: Math.max(0, Math.floor((subscription.cycleEnd.getTime() - now.getTime()) / DAY_MS)),
    renewalPaid: Boolean(subscription.renewalPaidAt),
    allowanceBytes: subscription.allowanceBytes.toString(),
    usedBytes: subscription.usedBytes.toString(),
    dormantAt:
      subscription.state === 'soft_locked'
        ? new Date(subscription.cycleEnd.getTime() + BillingRules.dormantAfterDays * DAY_MS)
        : null,
  };
}
