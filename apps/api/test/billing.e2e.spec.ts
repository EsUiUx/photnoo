import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApplicationsService } from '../src/applications/applications.service';
import { BillingLifecycleService } from '../src/billing/billing-lifecycle.service';
import { BillingService } from '../src/billing/billing.service';
import { createTestApp, type FakeMail } from './app';
import { localPath, signUp, uniqueApplicant } from './helpers';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];
type Owner = Awaited<ReturnType<typeof signUp>>;

const GB = 1024 ** 3;
const DAY = 24 * 60 * 60 * 1000;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');

let app: INestApplication;
let prisma: Prisma;
let mail: FakeMail;
let billing: BillingService;
let lifecycle: BillingLifecycleService;
const plans: Record<string, string> = {};

beforeAll(async () => {
  ({ app, prisma, mail } = await createTestApp());
  billing = app.get(BillingService);
  lifecycle = app.get(BillingLifecycleService);
  await prisma.plan.deleteMany({ where: { payments: { none: {} }, subscriptions: { none: {} }, nextSubscriptions: { none: {} } } });
  for (const [tier, gb, monthly] of [['100GB', 100, 100], ['500GB', 500, 300]] as const) {
    for (const cycle of ['monthly', 'annual'] as const) {
      const plan = await prisma.plan.create({
        data: { tier, allowanceBytes: BigInt(gb * GB), cycle, priceEgp: cycle === 'annual' ? monthly * 10 : monthly },
      });
      plans[`${tier}-${cycle}`] = plan.id;
    }
  }
});

afterAll(async () => {
  await app.close();
});

async function overview(owner: Owner) {
  return (await owner.agent.get('/v1/billing').expect(200)).body;
}

function offerFor(body: { plans: Array<{ id: string; offer: { action: string; amountEgp?: number } }> }, key: string) {
  return body.plans.find((p) => p.id === plans[key])!.offer;
}

/** Checkout → receipt → approval, the whole manual payment flow. */
async function pay(owner: Owner, key: string) {
  const payment = await owner.agent.post('/v1/billing/checkout').set('x-csrf-token', owner.csrf).send({ planId: plans[key] }).expect(201);
  await owner.agent
    .post(`/v1/billing/payments/${payment.body.id}/proof`)
    .set('x-csrf-token', owner.csrf)
    .field('method', 'instapay')
    .field('declaredAmountEgp', String(payment.body.amountEgp))
    .attach('proof', PDF, { filename: 'receipt.pdf', contentType: 'application/pdf' })
    .expect(200);
  await billing.approve(payment.body.id);
  return payment.body;
}

async function subscriptionOf(owner: Owner) {
  return prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId }, include: { plan: true } });
}

describe('billing', () => {
  it('buys a first plan by manual payment and issues an invoice', async () => {
    const owner = await signUp(app, prisma);
    const before = await overview(owner);
    expect(before.subscription.state).toBe('trial');
    expect(offerFor(before, '100GB-annual')).toEqual({ action: 'subscribe', amountEgp: 1000 });
    expect(before.paymentDetails.instapay).toBeNull(); // not configured in tests

    const payment = await owner.agent.post('/v1/billing/checkout').set('x-csrf-token', owner.csrf).send({ planId: plans['100GB-annual'] }).expect(201);
    expect(payment.body).toMatchObject({ status: 'awaiting_proof', kind: 'new', amountEgp: 1000 });
    expect(payment.body.reference).toMatch(/^PHN-[2-9A-HJ-NP-Z]{6}$/);

    // One open payment at a time.
    const again = await owner.agent.post('/v1/billing/checkout').set('x-csrf-token', owner.csrf).send({ planId: plans['500GB-annual'] }).expect(409);
    expect(again.body.error.code).toBe('payment_open');

    // Only images and PDFs are accepted as receipts, whatever the name says.
    const wrong = await owner.agent
      .post(`/v1/billing/payments/${payment.body.id}/proof`)
      .set('x-csrf-token', owner.csrf)
      .field('method', 'instapay')
      .field('declaredAmountEgp', '1000')
      .attach('proof', Buffer.from('not a receipt'), { filename: 'receipt.pdf', contentType: 'application/pdf' })
      .expect(415);
    expect(wrong.body.error.code).toBe('unsupported_proof');

    const proof = await owner.agent
      .post(`/v1/billing/payments/${payment.body.id}/proof`)
      .set('x-csrf-token', owner.csrf)
      .field('method', 'vodafone_cash')
      .field('declaredAmountEgp', '1000')
      .attach('proof', PDF, { filename: 'receipt.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(proof.body).toMatchObject({ status: 'pending', method: 'vodafone_cash', declaredAmountEgp: 1000, hasProof: true });

    const invoice = await billing.approve(payment.body.id);
    const subscription = await subscriptionOf(owner);
    expect(subscription.state).toBe('active');
    expect(subscription.plan?.tier).toBe('100GB');
    expect(subscription.allowanceBytes).toBe(BigInt(100 * GB));
    expect(subscription.usedBytes).toBe(0n);
    const length = subscription.cycleEnd.getTime() - subscription.cycleStart.getTime();
    expect([365 * DAY, 366 * DAY]).toContain(length);
    expect(mail.last(owner.applicant.email)?.subject).toContain('Payment confirmed');

    const after = await overview(owner);
    expect(after.openPayment).toBeNull();
    expect(after.payments[0]).toMatchObject({ status: 'approved', invoice: { id: invoice.id } });
    expect(after.payments[0].invoice.number).toMatch(/^INV-\d{6}$/);
    const pdf = await owner.agent.get(`/v1/billing/invoices/${invoice.id}/pdf`).expect(200);
    const file = await request(app.getHttpServer()).get(localPath(pdf.body.url)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect((file.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    // Invoices belong to their owner only.
    const stranger = await signUp(app, prisma);
    await stranger.agent.get(`/v1/billing/invoices/${invoice.id}/pdf`).expect(404);
  });

  it('prorates an upgrade and keeps the renewal date', async () => {
    const owner = await signUp(app, prisma);
    await pay(owner, '100GB-annual');
    const now = Date.now();
    const cycleStart = new Date(now - 73 * DAY);
    const cycleEnd = new Date(now + 292 * DAY);
    const sub = await subscriptionOf(owner);
    await prisma.subscription.update({ where: { id: sub.id }, data: { cycleStart, cycleEnd, usedBytes: BigInt(5 * GB) } });

    const offer = offerFor(await overview(owner), '500GB-annual');
    expect(offer.action).toBe('upgrade');
    // (3000 − 1000) × 292 ÷ 365 = 1600, give or take the partial day.
    expect(offer.amountEgp).toBeGreaterThanOrEqual(1600);
    expect(offer.amountEgp).toBeLessThanOrEqual(1606);
    // Moving to monthly is not an upgrade; it waits for the renewal.
    expect(offerFor(await overview(owner), '500GB-monthly').action).toBe('switch');

    const payment = await pay(owner, '500GB-annual');
    expect(payment.kind).toBe('upgrade');
    const upgraded = await subscriptionOf(owner);
    expect(upgraded.plan?.tier).toBe('500GB');
    expect(upgraded.allowanceBytes).toBe(BigInt(500 * GB));
    expect(upgraded.usedBytes).toBe(BigInt(5 * GB));
    expect(upgraded.cycleEnd.toISOString()).toBe(cycleEnd.toISOString());
  });

  it('schedules a downgrade, takes the renewal early and rolls over at cycle end', async () => {
    const owner = await signUp(app, prisma);
    await pay(owner, '500GB-annual');
    await owner.agent.put('/v1/billing/next-plan').set('x-csrf-token', owner.csrf).send({ planId: plans['100GB-annual'] }).expect(204);

    let body = await overview(owner);
    expect(body.subscription.nextPlan.tier).toBe('100GB');
    expect(offerFor(body, '100GB-annual').action).toBe('scheduled'); // renewal window not open yet

    const sub = await subscriptionOf(owner);
    const cycleEnd = new Date(Date.now() + 10 * DAY);
    await prisma.subscription.update({ where: { id: sub.id }, data: { cycleEnd, usedBytes: BigInt(40 * GB) } });
    body = await overview(owner);
    expect(offerFor(body, '100GB-annual')).toEqual({ action: 'renew', amountEgp: 1000 });

    const payment = await pay(owner, '100GB-annual');
    expect(payment.kind).toBe('renewal');
    const booked = await subscriptionOf(owner);
    expect(booked.renewalPaidAt).not.toBeNull();
    expect(booked.plan?.tier).toBe('500GB'); // still the old plan until the cycle ends

    // Only the rollover step: a full tick at a future date would lapse other test files' trials.
    await lifecycle.rollOver(new Date(cycleEnd.getTime() + 60_000));
    const rolled = await subscriptionOf(owner);
    expect(rolled.state).toBe('active');
    expect(rolled.plan?.tier).toBe('100GB');
    expect(rolled.cycleStart.toISOString()).toBe(cycleEnd.toISOString());
    expect(rolled.usedBytes).toBe(0n);
    expect(rolled.allowanceBytes).toBe(BigInt(100 * GB));
    expect(rolled.renewalPaidAt).toBeNull();
  });

  it('soft-locks an unpaid account, then marks it dormant', async () => {
    const owner = await signUp(app, prisma);
    const sub = await subscriptionOf(owner);
    const cycleEnd = new Date(Date.now() - 60_000);
    await prisma.subscription.update({ where: { id: sub.id }, data: { cycleEnd } });

    await lifecycle.tick();
    expect((await subscriptionOf(owner)).state).toBe('soft_locked');
    expect(mail.last(owner.applicant.email)?.subject).toContain('Your plan has ended');

    const blocked = await owner.agent
      .post('/v1/galleries')
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'After lapse', clientName: 'Nour', clientPhone: '+201011112222' })
      .expect(402);
    expect(blocked.body.error.code).toBe('subscription_inactive');
    // Login and the billing page still work, and paying reopens everything.
    expect(offerFor(await overview(owner), '100GB-monthly')).toEqual({ action: 'subscribe', amountEgp: 100 });

    await lifecycle.markDormant(new Date(cycleEnd.getTime() + 31 * DAY));
    expect((await subscriptionOf(owner)).state).toBe('dormant');

    await pay(owner, '100GB-monthly');
    expect((await subscriptionOf(owner)).state).toBe('active');
    await owner.agent
      .post('/v1/galleries')
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'Back again', clientName: 'Nour', clientPhone: '+201011112222' })
      .expect(201);
  });

  it('sends each renewal reminder and allowance warning once per cycle', async () => {
    const owner = await signUp(app, prisma);
    await pay(owner, '100GB-annual');
    const sub = await subscriptionOf(owner);
    await prisma.subscription.update({ where: { id: sub.id }, data: { cycleEnd: new Date(Date.now() + 14.5 * DAY) } });

    const count = () => mail.sent.filter((m) => m.to === owner.applicant.email).length;
    const before = count();
    await lifecycle.tick();
    expect(count()).toBe(before + 1);
    expect(mail.last(owner.applicant.email)?.text).toContain('in 15 days');
    await lifecycle.tick();
    expect(count()).toBe(before + 1);

    await prisma.subscription.update({ where: { id: sub.id }, data: { usedBytes: BigInt(85 * GB) } });
    await lifecycle.checkAllowance(sub.id);
    expect(mail.last(owner.applicant.email)?.subject).toContain('80%');
    await lifecycle.checkAllowance(sub.id);
    expect(count()).toBe(before + 2);
    await prisma.subscription.update({ where: { id: sub.id }, data: { usedBytes: BigInt(96 * GB) } });
    await lifecycle.checkAllowance(sub.id);
    expect(mail.last(owner.applicant.email)?.subject).toContain('95%');
  });

  it('rejects a payment with a reason and lets the photographer try again', async () => {
    const owner = await signUp(app, prisma);
    const payment = await owner.agent.post('/v1/billing/checkout').set('x-csrf-token', owner.csrf).send({ planId: plans['100GB-monthly'] }).expect(201);
    await billing.reject(payment.body.id, 'Amount does not match');
    expect(mail.last(owner.applicant.email)?.text).toContain('Amount does not match');
    const body = await overview(owner);
    expect(body.openPayment).toBeNull();
    expect(body.payments[0]).toMatchObject({ status: 'rejected', rejectReason: 'Amount does not match' });
    await owner.agent.post('/v1/billing/checkout').set('x-csrf-token', owner.csrf).send({ planId: plans['100GB-monthly'] }).expect(201);
  });

  it('grants one trial per person', async () => {
    const applicant = uniqueApplicant();
    const server = app.getHttpServer();
    await request(server).post('/v1/applications').send(applicant).expect(202);
    const first = await prisma.application.findFirstOrThrow({ where: { email: applicant.email } });
    await app.get(ApplicationsService).approve(first.id, { grantTrial: true });

    await request(server).post('/v1/applications').send({ ...applicant, email: `again.${applicant.email}` }).expect(202);
    const second = await prisma.application.findFirstOrThrow({ where: { email: `again.${applicant.email}` } });
    await expect(app.get(ApplicationsService).approve(second.id, { grantTrial: true })).rejects.toMatchObject({
      response: { code: 'trial_already_used' },
    });
    await app.get(ApplicationsService).approve(second.id, { grantTrial: false });
  });
});
