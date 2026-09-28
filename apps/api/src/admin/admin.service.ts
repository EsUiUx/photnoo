import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { addCycle, cycleAllowanceBytes, invoiceNumber, type SwitchKey, SwitchKeys, TrialDefaults } from '@photnoo/shared';
import type { Prisma } from '@photnoo/db';
import { ApplicationsService } from '../applications/applications.service';
import { AuditService } from '../audit/audit.service';
import { AccessCheckService } from '../auth/access-check.service';
import { BillingService, egp, paymentJson, planJson, subscriptionJson } from '../billing/billing.service';
import { FlagsService } from '../flags/flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';
import type { AdminPrincipal } from './admin-auth.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 50;
/** A-07 content access for a stated abuse case is short-lived and logged. */
const CASE_VIEW_TTL_SECONDS = 15 * 60;

/** Start of today and of this month in Cairo, as UTC instants. */
function cairoStarts(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  // Offset between Cairo wall time and UTC right now (2 or 3 hours).
  const wall = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!);
  const offset = Math.round((wall - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())) / 3_600_000) * 3_600_000;
  const day = new Date(Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!) - offset);
  const month = new Date(Date.UTC(+parts.year!, +parts.month! - 1, 1) - offset);
  return { day, month };
}

const bytes = (value: bigint | null | undefined) => (value ?? 0n).toString();

/**
 * Staff console (PRD A-01 to A-09). Admins see metadata only, never photos; the one exception
 * is a Super Admin opening a logged, 15-minute view for a stated abuse case (A-07). Every
 * change is audited with the admin, the reason and the IP.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly applications: ApplicationsService,
    private readonly billing: BillingService,
    private readonly flags: FlagsService,
    private readonly access: AccessCheckService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  private log(admin: AdminPrincipal, ip: string | null, action: string, targetType: string, targetId: string, reason?: string, data?: Prisma.InputJsonValue) {
    return this.audit.record({ actorType: 'admin', actorId: admin.id, action, targetType, targetId, reason, ip, data });
  }

  // ---------- A-09 overview ----------

  async overview(now = new Date()) {
    const { day, month } = cairoStarts(now);
    const db = this.prisma.client;
    const [paying, trials, pendingPayments, awaitingProof, activeGalleries, uploaded, downloaded, revenue, openReports, pendingApplications, lapsed] =
      await Promise.all([
        db.subscription.count({ where: { state: 'active', planId: { not: null } } }),
        db.subscription.count({ where: { state: 'trial' } }),
        db.payment.count({ where: { status: 'pending' } }),
        db.payment.count({ where: { status: 'awaiting_proof' } }),
        db.gallery.count({ where: { state: 'active' } }),
        db.usageEvent.aggregate({ where: { type: 'upload', createdAt: { gte: day } }, _sum: { bytes: true } }),
        db.downloadReceipt.aggregate({ where: { createdAt: { gte: day } }, _sum: { bytes: true } }),
        db.invoice.aggregate({ where: { issuedAt: { gte: month } }, _sum: { totalEgp: true } }),
        db.abuseReport.count({ where: { status: 'open' } }),
        db.application.count({ where: { status: 'pending' } }),
        db.subscription.count({ where: { state: { in: ['soft_locked', 'dormant'] } } }),
      ]);
    const switches = await this.switches();
    return {
      payingPhotographers: paying,
      trials,
      lapsed,
      pendingPayments,
      awaitingProof,
      activeGalleries,
      uploadedTodayBytes: bytes(uploaded._sum.bytes),
      downloadedTodayBytes: bytes(downloaded._sum.bytes),
      revenueThisMonthEgp: egp(revenue._sum.totalEgp),
      openAbuseReports: openReports,
      pendingApplications,
      switchesOn: switches.filter((s) => s.on).map((s) => s.key),
    };
  }

  // ---------- A-01 applications ----------

  async listApplications(status: 'pending' | 'approved' | 'rejected' = 'pending') {
    const rows = await this.prisma.client.application.findMany({ where: { status }, orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' }, take: 200 });
    // Flag people who already had a trial (B-09) so the reviewer does not offer another one.
    const earlierTrials = await this.prisma.client.application.findMany({
      where: {
        status: 'approved',
        grantTrial: true,
        OR: [{ email: { in: rows.map((r) => r.email) } }, { phone: { in: rows.map((r) => r.phone) } }],
      },
      select: { id: true, email: true, phone: true },
    });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      studioName: a.studioName,
      city: a.city,
      phone: a.phone,
      email: a.email,
      portfolioUrl: a.portfolioUrl,
      status: a.status,
      grantTrial: a.grantTrial,
      decisionReason: a.decisionReason,
      decidedAt: a.decidedAt,
      createdAt: a.createdAt,
      hadTrial: earlierTrials.some((t) => t.id !== a.id && (t.email === a.email || t.phone === a.phone)),
    }));
  }

  async approveApplication(admin: AdminPrincipal, ip: string | null, id: string, grantTrial: boolean) {
    await this.applications.approve(id, { grantTrial, decidedById: admin.id, ip });
  }

  async rejectApplication(admin: AdminPrincipal, ip: string | null, id: string, reason: string) {
    await this.applications.reject(id, reason, admin.id, ip);
  }

  // ---------- A-02 payments ----------

  async listPayments(status: 'open' | 'approved' | 'rejected' = 'open') {
    const where: Prisma.PaymentWhereInput =
      status === 'open' ? { status: { in: ['pending', 'awaiting_proof'] } } : { status };
    const rows = await this.prisma.client.payment.findMany({
      where,
      orderBy: [{ status: 'desc' }, { submittedAt: 'asc' }, { createdAt: 'asc' }],
      take: 200,
      include: { plan: true, invoice: { select: { id: true, number: true } } },
    });
    const people = await this.prisma.client.photographer.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.photographerId))] } },
      select: { id: true, name: true, studioName: true, email: true, phone: true },
    });
    return rows.map((p) => ({ ...paymentJson(p), photographer: people.find((x) => x.id === p.photographerId) ?? null }));
  }

  async paymentProof(admin: AdminPrincipal, ip: string | null, id: string) {
    const payment = await this.prisma.client.payment.findUnique({ where: { id } });
    if (!payment?.proofKey) throw new NotFoundException({ code: 'not_found', message: 'No receipt uploaded.' });
    await this.log(admin, ip, 'payment.proof_viewed', 'payment', id);
    return { url: await this.storage.signDownload(payment.proofKey, 300, payment.proofName ?? undefined), mime: payment.proofMime };
  }

  async approvePayment(admin: AdminPrincipal, ip: string | null, id: string) {
    const invoice = await this.billing.approve(id, { adminId: admin.id, ip });
    return { invoice: invoiceNumber(invoice.number) };
  }

  rejectPayment(admin: AdminPrincipal, ip: string | null, id: string, reason: string) {
    return this.billing.reject(id, reason, admin.id, ip);
  }

  // ---------- A-03 photographers ----------

  async listPhotographers(q?: string, cursor?: string) {
    const term = q?.trim();
    const rows = await this.prisma.client.photographer.findMany({
      where: {
        status: { not: 'deleted' },
        ...(term
          ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { studioName: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } }, _count: { select: { galleries: true } } },
    });
    const page = rows.slice(0, PAGE);
    return {
      items: page.map((p) => {
        const sub = p.subscriptions[0];
        return {
          id: p.id,
          name: p.name,
          studioName: p.studioName,
          email: p.email,
          phone: p.phone,
          city: p.city,
          status: p.status,
          createdAt: p.createdAt,
          galleries: p._count.galleries,
          subscription: sub
            ? { state: sub.state, plan: sub.plan ? planJson(sub.plan) : null, cycleEnd: sub.cycleEnd, usedBytes: bytes(sub.usedBytes), allowanceBytes: bytes(sub.allowanceBytes) }
            : null,
        };
      }),
      nextCursor: rows.length > PAGE ? page[page.length - 1]!.id : null,
    };
  }

  async photographer(id: string) {
    const db = this.prisma.client;
    const photographer = await db.photographer.findUnique({ where: { id } });
    if (!photographer) throw new NotFoundException({ code: 'not_found', message: 'Photographer not found.' });
    const [subscription, galleries, sessions, payments, receipts] = await Promise.all([
      db.subscription.findFirst({ where: { photographerId: id }, orderBy: { createdAt: 'desc' }, include: { plan: true, nextPlan: true } }),
      db.gallery.findMany({
        where: { photographerId: id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, name: true, clientName: true, state: true, suspended: true, suspendedUntil: true, suspendedReason: true, totalBytes: true, servedBytes: true, capBytes: true, fileCount: true, createdAt: true, activatedAt: true, expiresAt: true, closedReason: true },
      }),
      db.session.findMany({ where: { photographerId: id }, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, createdAt: true, lastUsedAt: true, ip: true, userAgent: true, revokedAt: true, expiresAt: true } }),
      db.payment.findMany({ where: { photographerId: id }, orderBy: { createdAt: 'desc' }, take: 50, include: { plan: true, invoice: { select: { id: true, number: true } } } }),
      db.downloadReceipt.groupBy({ by: ['galleryId'], where: { gallery: { photographerId: id } }, _count: { _all: true } }),
    ]);
    return {
      id: photographer.id,
      name: photographer.name,
      studioName: photographer.studioName,
      email: photographer.email,
      phone: photographer.phone,
      city: photographer.city,
      locale: photographer.locale,
      status: photographer.status,
      createdAt: photographer.createdAt,
      subscription: subscription ? subscriptionJson(subscription) : null,
      galleries: galleries.map((g) => ({
        ...g,
        totalBytes: bytes(g.totalBytes),
        servedBytes: bytes(g.servedBytes),
        capBytes: bytes(g.capBytes),
        receipts: receipts.find((r) => r.galleryId === g.id)?._count._all ?? 0,
      })),
      logins: sessions.map((s) => ({ ...s, active: !s.revokedAt && s.expiresAt > new Date() })),
      payments: payments.map(paymentJson),
    };
  }

  async suspendPhotographer(admin: AdminPrincipal, ip: string | null, id: string, reason: string, suspend: boolean) {
    const photographer = await this.prisma.client.photographer.findUnique({ where: { id } });
    if (!photographer || photographer.status === 'deleted') throw new NotFoundException({ code: 'not_found', message: 'Photographer not found.' });
    await this.prisma.client.photographer.update({ where: { id }, data: { status: suspend ? 'suspended' : 'active' } });
    if (suspend) await this.revokeSessions(id);
    this.access.forgetPhotographer(id);
    await this.log(admin, ip, suspend ? 'photographer.suspended' : 'photographer.unsuspended', 'photographer', id, reason);
  }

  async forceLogout(admin: AdminPrincipal, ip: string | null, id: string, reason: string) {
    const count = await this.revokeSessions(id);
    this.access.forgetPhotographer(id);
    await this.log(admin, ip, 'photographer.force_logout', 'photographer', id, reason, { sessions: count });
    return { sessions: count };
  }

  /** A-03 change plan without a payment (goodwill, corrections). Keeps the cycle if one is running. */
  async changePlan(admin: AdminPrincipal, ip: string | null, id: string, planId: string, reason: string) {
    const [subscription, plan] = await Promise.all([
      this.prisma.client.subscription.findFirst({ where: { photographerId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.client.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!subscription) throw new NotFoundException({ code: 'not_found', message: 'No subscription.' });
    if (!plan) throw new NotFoundException({ code: 'plan_not_found', message: 'Plan not found.' });
    const now = new Date();
    const running = subscription.state === 'active' && subscription.cycleEnd > now;
    await this.prisma.client.subscription.update({
      where: { id: subscription.id },
      data: {
        state: 'active',
        planId: plan.id,
        priceEgp: plan.priceEgp,
        allowanceBytes: cycleAllowanceBytes(plan.allowanceBytes, plan.cycle),
        nextPlanId: null,
        ...(running ? {} : { cycleStart: now, cycleEnd: addCycle(now, plan.cycle), usedBytes: 0n, renewalPaidAt: null }),
      },
    });
    await this.log(admin, ip, 'subscription.plan_changed', 'photographer', id, reason, { planId: plan.id, from: subscription.planId, keptCycle: running });
  }

  /** A-03 grant trial: 25 GB for 30 days, for accounts without a running paid plan. */
  async grantTrial(admin: AdminPrincipal, ip: string | null, id: string, reason: string) {
    const subscription = await this.prisma.client.subscription.findFirst({ where: { photographerId: id }, orderBy: { createdAt: 'desc' } });
    if (!subscription) throw new NotFoundException({ code: 'not_found', message: 'No subscription.' });
    const now = new Date();
    if (subscription.state === 'active' && subscription.cycleEnd > now) {
      throw new ConflictException({ code: 'plan_running', message: 'This photographer already has a paid plan running.' });
    }
    await this.prisma.client.subscription.update({
      where: { id: subscription.id },
      data: {
        state: 'trial',
        planId: null,
        priceEgp: null,
        nextPlanId: null,
        renewalPaidAt: null,
        cycleStart: now,
        cycleEnd: new Date(now.getTime() + TrialDefaults.days * DAY_MS),
        allowanceBytes: BigInt(TrialDefaults.allowanceBytes),
        usedBytes: 0n,
      },
    });
    await this.log(admin, ip, 'subscription.trial_granted', 'photographer', id, reason);
  }

  private async revokeSessions(photographerId: string): Promise<number> {
    const revoked = await this.prisma.client.session.updateMany({ where: { photographerId, revokedAt: null }, data: { revokedAt: new Date() } });
    return revoked.count;
  }

  // ---------- galleries (A-05 per-gallery suspend) ----------

  async suspendGallery(admin: AdminPrincipal, ip: string | null, id: string, reason: string, hours?: number) {
    const gallery = await this.prisma.client.gallery.findUnique({ where: { id } });
    if (!gallery) throw new NotFoundException({ code: 'not_found', message: 'Gallery not found.' });
    await this.prisma.client.gallery.update({
      where: { id },
      data: { suspended: true, suspendedUntil: hours ? new Date(Date.now() + hours * 3_600_000) : null, suspendedReason: reason },
    });
    await this.log(admin, ip, 'gallery.suspended', 'gallery', id, reason, { hours: hours ?? null });
  }

  async unsuspendGallery(admin: AdminPrincipal, ip: string | null, id: string, reason: string) {
    const updated = await this.prisma.client.gallery.updateMany({ where: { id }, data: { suspended: false, suspendedUntil: null, suspendedReason: null } });
    if (updated.count !== 1) throw new NotFoundException({ code: 'not_found', message: 'Gallery not found.' });
    await this.log(admin, ip, 'gallery.unsuspended', 'gallery', id, reason);
  }

  // ---------- A-07 abuse ----------

  async listAbuse(status: 'open' | 'actioned' | 'dismissed' = 'open') {
    const rows = await this.prisma.client.abuseReport.findMany({
      where: { status },
      orderBy: { createdAt: status === 'open' ? 'asc' : 'desc' },
      take: 200,
      include: {
        gallery: {
          select: {
            id: true,
            name: true,
            state: true,
            suspended: true,
            fileCount: true,
            totalBytes: true,
            servedBytes: true,
            activatedAt: true,
            expiresAt: true,
            photographer: { select: { id: true, name: true, studioName: true, email: true, status: true } },
            _count: { select: { reports: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      reporterEmail: r.reporterEmail,
      status: r.status,
      decisionNote: r.decisionNote,
      decidedAt: r.decidedAt,
      createdAt: r.createdAt,
      gallery: { ...r.gallery, totalBytes: bytes(r.gallery.totalBytes), servedBytes: bytes(r.gallery.servedBytes), reports: r.gallery._count.reports },
    }));
  }

  async decideAbuse(admin: AdminPrincipal, ip: string | null, id: string, input: { status: 'actioned' | 'dismissed'; note: string; suspendGallery: boolean }) {
    const report = await this.prisma.client.abuseReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException({ code: 'not_found', message: 'Report not found.' });
    if (report.status !== 'open') throw new ConflictException({ code: 'already_decided', message: 'This report was already decided.' });
    if (input.suspendGallery) {
      if (admin.role !== 'super_admin') throw new BadRequestException({ code: 'forbidden', message: 'Only a Super Admin can suspend from the abuse queue.' });
      await this.suspendGallery(admin, ip, report.galleryId, `Abuse report ${report.id}: ${input.note}`);
    }
    await this.prisma.client.abuseReport.update({
      where: { id },
      data: { status: input.status, decisionNote: input.note, decidedById: admin.id, decidedAt: new Date() },
    });
    await this.log(admin, ip, `abuse.${input.status}`, 'abuse_report', id, input.note, { galleryId: report.galleryId, suspended: input.suspendGallery });
  }

  /**
   * A-07: the only way an admin sees photos. Super Admin only, needs a stated reason, returns
   * previews (never originals) that expire in 15 minutes, and is written to the audit log.
   */
  async viewCase(admin: AdminPrincipal, ip: string | null, reportId: string, reason: string) {
    const report = await this.prisma.client.abuseReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException({ code: 'not_found', message: 'Report not found.' });
    const files = await this.prisma.client.file.findMany({
      where: { galleryId: report.galleryId, status: 'ready', previewKey: { not: null } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      take: 200,
      select: { id: true, originalName: true, previewKey: true, width: true, height: true },
    });
    await this.log(admin, ip, 'abuse.content_viewed', 'gallery', report.galleryId, reason, { reportId, files: files.length });
    const expiresAt = new Date(Date.now() + CASE_VIEW_TTL_SECONDS * 1000);
    return {
      expiresAt,
      files: await Promise.all(
        files.map(async (f) => ({ id: f.id, name: f.originalName, width: f.width, height: f.height, url: await this.storage.signDownload(f.previewKey!, CASE_VIEW_TTL_SECONDS) })),
      ),
    };
  }

  // ---------- A-04 plans ----------

  async listPlans() {
    const now = new Date();
    const rows = await this.prisma.client.plan.findMany({ orderBy: [{ allowanceBytes: 'asc' }, { cycle: 'asc' }, { activeFrom: 'desc' }] });
    const counts = await this.prisma.client.subscription.groupBy({ by: ['planId'], where: { state: 'active' }, _count: { _all: true } });
    return rows.map((p) => ({
      ...planJson(p),
      activeFrom: p.activeFrom,
      activeTo: p.activeTo,
      onSale: p.activeFrom <= now && (!p.activeTo || p.activeTo > now),
      activeSubscriptions: counts.find((c) => c.planId === p.id)?._count._all ?? 0,
    }));
  }

  async createPlan(admin: AdminPrincipal, ip: string | null, input: { tier: string; annualAllowanceGb: number; cycle: 'annual' | 'monthly'; priceEgp: number }) {
    const existing = await this.prisma.client.plan.findFirst({ where: { tier: input.tier, cycle: input.cycle, OR: [{ activeTo: null }, { activeTo: { gt: new Date() } }] } });
    if (existing) throw new ConflictException({ code: 'plan_exists', message: 'This tier and cycle are already on sale. Change its price instead.' });
    const plan = await this.prisma.client.plan.create({
      data: { tier: input.tier, cycle: input.cycle, allowanceBytes: BigInt(input.annualAllowanceGb) * 1024n ** 3n, priceEgp: input.priceEgp },
    });
    await this.log(admin, ip, 'plan.created', 'plan', plan.id, undefined, { ...input });
    return planJson(plan);
  }

  /**
   * A-04: a price change retires the old row and puts a new one on sale. Running cycles keep
   * their own stored price; new purchases and renewals use the new one.
   */
  async changePrice(admin: AdminPrincipal, ip: string | null, id: string, priceEgp: number) {
    const now = new Date();
    const plan = await this.prisma.client.plan.findUnique({ where: { id } });
    if (!plan || (plan.activeTo && plan.activeTo <= now)) throw new NotFoundException({ code: 'plan_not_found', message: 'This plan is not on sale.' });
    const next = await this.prisma.client.$transaction(async (tx) => {
      await tx.plan.update({ where: { id }, data: { activeTo: now } });
      return tx.plan.create({ data: { tier: plan.tier, cycle: plan.cycle, allowanceBytes: plan.allowanceBytes, priceEgp, activeFrom: now } });
    });
    // People who scheduled the old row for their renewal move to the new price.
    await this.prisma.client.subscription.updateMany({ where: { nextPlanId: id }, data: { nextPlanId: next.id } });
    await this.log(admin, ip, 'plan.price_changed', 'plan', next.id, undefined, { from: egp(plan.priceEgp), to: priceEgp, previousPlanId: id });
    return planJson(next);
  }

  async retirePlan(admin: AdminPrincipal, ip: string | null, id: string, reason: string) {
    const updated = await this.prisma.client.plan.updateMany({ where: { id, activeTo: null }, data: { activeTo: new Date() } });
    if (updated.count !== 1) throw new NotFoundException({ code: 'plan_not_found', message: 'This plan is not on sale.' });
    await this.log(admin, ip, 'plan.retired', 'plan', id, reason);
  }

  // ---------- A-05 switches ----------

  async switches() {
    const values = await this.flags.all();
    return SwitchKeys.map((key) => {
      const value = values.get(key);
      return { key, on: value?.on ?? false, reason: value?.reason ?? null, setById: value?.setById ?? null, updatedAt: value?.updatedAt ?? null };
    });
  }

  async setSwitch(admin: AdminPrincipal, ip: string | null, key: SwitchKey, on: boolean, reason: string) {
    await this.flags.set(key, on, reason, admin.id);
    await this.log(admin, ip, on ? 'switch.on' : 'switch.off', 'switch', key, reason);
  }

  async logoutAllPhotographers(admin: AdminPrincipal, ip: string | null, reason: string) {
    const revoked = await this.prisma.client.session.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
    this.access.forgetAll();
    await this.log(admin, ip, 'switch.logout_all', 'switch', 'logout_all', reason, { sessions: revoked.count });
    return { sessions: revoked.count };
  }

  // ---------- A-08 audit ----------

  async auditLog(filters: { action?: string; actorId?: string; targetId?: string; from?: string; to?: string; before?: string }) {
    const rows = await this.prisma.client.auditLog.findMany({
      where: {
        ...(filters.action ? { action: { startsWith: filters.action } } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.targetId ? { targetId: filters.targetId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                // A date without a time means "through the end of that day".
                ...(filters.to ? { lt: new Date(new Date(filters.to).getTime() + (/^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? 86_400_000 : 1)) } : {}),
              },
            }
          : {}),
        ...(filters.before ? { id: { lt: BigInt(filters.before) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: PAGE + 1,
    });
    const page = rows.slice(0, PAGE);
    const admins = await this.prisma.client.adminUser.findMany({
      where: { id: { in: [...new Set(page.filter((r) => r.actorType === 'admin' && r.actorId).map((r) => r.actorId!))] } },
      select: { id: true, name: true, email: true },
    });
    return {
      items: page.map((r) => ({
        id: r.id.toString(),
        actorType: r.actorType,
        actorId: r.actorId,
        actorName: admins.find((a) => a.id === r.actorId)?.name ?? null,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        ip: r.ip,
        data: r.data,
        createdAt: r.createdAt,
      })),
      nextBefore: rows.length > PAGE ? page[page.length - 1]!.id.toString() : null,
    };
  }

  verifyAudit() {
    return this.audit.verify();
  }

  // ---------- admins ----------

  async listAdmins() {
    const rows = await this.prisma.client.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      totpEnabled: Boolean(a.totpSecret),
      lastLoginAt: a.lastLoginAt,
      disabledAt: a.disabledAt,
      createdAt: a.createdAt,
    }));
  }
}
