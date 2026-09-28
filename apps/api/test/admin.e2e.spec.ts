import type { INestApplication } from '@nestjs/common';
import type { AdminRole } from '@photnoo/db';
import request from 'supertest';
import { newTotpSecret, totpCode, totpStep, verifyTotp } from '../src/admin/totp';
import { hashPassword } from '../src/auth/passwords';
import { encrypt } from '../src/common/crypto';
import { createTestApp, type FakeMail } from './app';
import { newGallery, photo, readyFiles } from './gallery-helpers';
import { localPath, signUp, uniqueApplicant } from './helpers';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];

const SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
const PASSWORD = 'Admin-password-2026!';
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

let app: INestApplication;
let prisma: Prisma;
let mail: FakeMail;
let counter = 0;

beforeAll(async () => {
  ({ app, prisma, mail } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

async function createAdmin(role: AdminRole) {
  counter += 1;
  const email = `admin${counter}.${process.pid}.${Date.now()}@photnoo.test`;
  const secret = newTotpSecret();
  await prisma.adminUser.create({
    data: { email, name: `Admin ${counter}`, role, passwordHash: await hashPassword(PASSWORD), totpSecret: encrypt(SECRET, secret) },
  });
  return { email, secret };
}

/** Signs in and returns an agent that sends the admin CSRF header on writes. */
async function signIn(role: AdminRole) {
  const { email, secret } = await createAdmin(role);
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post('/v1/admin/auth/login').send({ email, password: PASSWORD, code: totpCode(secret, totpStep()) }).expect(200);
  const csrf = res.body.csrfToken as string;
  return {
    agent,
    email,
    get: (path: string) => agent.get(`/v1/admin${path}`),
    post: (path: string, body: object = {}) => agent.post(`/v1/admin${path}`).set('x-csrf-token', csrf).send(body),
    put: (path: string, body: object) => agent.put(`/v1/admin${path}`).set('x-csrf-token', csrf).send(body),
  };
}

describe('TOTP', () => {
  it('matches RFC 6238 and accepts one step of drift', () => {
    // RFC 6238 appendix B, SHA-1 secret "12345678901234567890", T = 59 s -> 94287082 (8 digits).
    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(totpCode(rfcSecret, 1)).toBe('287082');
    const now = Date.now();
    const code = totpCode(rfcSecret, totpStep(now) - 1);
    expect(verifyTotp(rfcSecret, code, now)).toBe(totpStep(now) - 1);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, totpStep(now) - 3), now)).toBeNull();
  });
});

describe('admin sign-in', () => {
  it('needs password and a fresh code, locks after five failures, and audits every attempt', async () => {
    const { email, secret } = await createAdmin('support');
    const server = app.getHttpServer();
    const code = totpCode(secret, totpStep());

    await request(server).post('/v1/admin/auth/login').send({ email, password: 'wrong', code }).expect(401);
    const ok = await request(server).post('/v1/admin/auth/login').send({ email, password: PASSWORD, code }).expect(200);
    expect(ok.body.admin.role).toBe('support');
    const cookie = ([] as string[]).concat(ok.headers['set-cookie'] ?? []).find((c) => c.startsWith('pn_adm='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/v1\/admin/);

    // The same code cannot be used twice.
    await request(server).post('/v1/admin/auth/login').send({ email, password: PASSWORD, code }).expect(401);

    for (let i = 0; i < 4; i += 1) {
      await request(server).post('/v1/admin/auth/login').send({ email, password: 'wrong', code: '000000' }).expect(401);
    }
    const locked = await request(server).post('/v1/admin/auth/login').send({ email, password: PASSWORD, code: totpCode(secret, totpStep() + 1) }).expect(403);
    expect(locked.body.error.code).toBe('account_locked');

    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    const events = await prisma.auditLog.findMany({ where: { targetId: admin.id }, select: { action: true } });
    expect(events.filter((e) => e.action === 'admin.login')).toHaveLength(1);
    expect(events.filter((e) => e.action === 'admin.login_failed').length).toBeGreaterThanOrEqual(6);

    // Photographer sessions never reach the admin API.
    const photographer = await signUp(app, prisma);
    await photographer.agent.get('/v1/admin/overview').expect(401);
  });

  it('enforces roles and CSRF', async () => {
    const support = await signIn('support');
    await support.get('/overview').expect(200);
    const denied = await support.post('/switches/logout-all', { reason: 'testing roles' }).expect(403);
    expect(denied.body.error.code).toBe('forbidden');
    await support.agent.post('/v1/admin/photographers/00000000-0000-0000-0000-000000000000/suspend').send({ reason: 'no csrf' }).expect(403);
  });
});

describe('queues', () => {
  it('approves and rejects applications with the right email', async () => {
    const ops = await signIn('operations');
    const server = app.getHttpServer();
    const yes = uniqueApplicant();
    const no = uniqueApplicant();
    await request(server).post('/v1/applications').send(yes).expect(202);
    await request(server).post('/v1/applications').send(no).expect(202);

    const list = await ops.get('/applications').expect(200);
    const pending = list.body as Array<{ id: string; email: string }>;
    const approveId = pending.find((a) => a.email === yes.email)!.id;
    const rejectId = pending.find((a) => a.email === no.email)!.id;

    await ops.post(`/applications/${approveId}/approve`, { grantTrial: true }).expect(204);
    expect(mail.last(yes.email)?.text).toContain('/invite/');
    await ops.post(`/applications/${rejectId}/reject`, { reason: 'Portfolio link does not open' }).expect(204);
    expect(mail.last(no.email)?.text).toContain('Portfolio link does not open');
  });

  it('reviews a payment: receipt, approve, invoice', async () => {
    const plan = await prisma.plan.create({ data: { tier: '300GB', allowanceBytes: 300n * 1024n ** 3n, cycle: 'annual', priceEgp: 900 } });
    const owner = await signUp(app, prisma);
    const payment = await owner.agent.post('/v1/billing/checkout').set('x-csrf-token', owner.csrf).send({ planId: plan.id }).expect(201);
    await owner.agent
      .post(`/v1/billing/payments/${payment.body.id}/proof`)
      .set('x-csrf-token', owner.csrf)
      .field('method', 'instapay')
      .field('declaredAmountEgp', '900')
      .attach('proof', PDF, { filename: 'receipt.pdf', contentType: 'application/pdf' })
      .expect(200);

    const ops = await signIn('operations');
    const queue = await ops.get('/payments').expect(200);
    const row = (queue.body as Array<{ id: string; photographer: { email: string } }>).find((p) => p.id === payment.body.id)!;
    expect(row.photographer.email).toBe(owner.applicant.email);
    const proof = await ops.get(`/payments/${payment.body.id}/proof`).expect(200);
    const file = await request(app.getHttpServer()).get(localPath(proof.body.url)).expect(200);
    expect(String(file.text ?? file.body).length).toBeGreaterThan(0);

    const approved = await ops.post(`/payments/${payment.body.id}/approve`).expect(200);
    expect(approved.body.invoice).toMatch(/^INV-\d{6}$/);
    const sub = await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } });
    expect(sub.state).toBe('active');
    const logged = await prisma.auditLog.findFirst({ where: { action: 'payment.approved', targetId: payment.body.id } });
    expect(logged?.actorType).toBe('admin');
    expect(logged?.ip).toBeTruthy();
  });
});

describe('photographer controls', () => {
  it('suspension and force logout take effect at once, and pause client links', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    await readyFiles(app, owner, galleryId, [['a.jpg', await photo(400, 300)]]);
    const shared = await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(200);
    const token = new URL(shared.body.link).pathname.split('/g/')[1]!;
    const ops = await signIn('operations');

    await ops.post(`/photographers/${owner.photographerId}/force-logout`, { reason: 'Lost phone' }).expect(200);
    await owner.agent.get('/v1/me').expect(401);

    const again = await signUp(app, prisma);
    await again.agent.get('/v1/me').expect(200);
    await ops.post(`/photographers/${again.photographerId}/suspend`, { reason: 'Chargeback investigation' }).expect(204);
    await again.agent.get('/v1/me').expect(401);
    await ops.post(`/photographers/${owner.photographerId}/suspend`, { reason: 'Same case' }).expect(204);
    const summary = await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200);
    expect(summary.body.state).toBe('unavailable');
    await ops.post(`/photographers/${owner.photographerId}/unsuspend`, { reason: 'Cleared' }).expect(204);
    expect((await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200)).body.state).toBe('open');

    const detail = await ops.get(`/photographers/${owner.photographerId}`).expect(200);
    expect(detail.body.galleries[0]).toMatchObject({ id: galleryId, state: 'active' });
    expect(detail.body.galleries[0]).not.toHaveProperty('previewUrl');
    expect(detail.body.logins.length).toBeGreaterThan(0);
  });

  it('changes plan and grants a trial with a reason', async () => {
    const plan = await prisma.plan.create({ data: { tier: '400GB', allowanceBytes: 400n * 1024n ** 3n, cycle: 'monthly', priceEgp: 99 } });
    const owner = await signUp(app, prisma, { trial: false });
    const ops = await signIn('operations');
    await ops.post(`/photographers/${owner.photographerId}/grant-trial`, { reason: 'Event partner' }).expect(204);
    expect((await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } })).state).toBe('trial');
    await ops.post(`/photographers/${owner.photographerId}/change-plan`, { planId: plan.id, reason: 'Goodwill after outage' }).expect(204);
    const sub = await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } });
    expect(sub.state).toBe('active');
    expect(sub.allowanceBytes).toBe((400n * 1024n ** 3n) / 12n);
    await ops.post(`/photographers/${owner.photographerId}/grant-trial`, { reason: 'Again' }).expect(409);
  });
});

describe('emergency switches', () => {
  it('freezes uploads, freezes downloads and turns on maintenance for everyone but admins', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const superAdmin = await signIn('super_admin');

    await superAdmin.put('/switches/uploads_frozen', { on: true, reason: 'Storage incident' }).expect(204);
    const frozen = await owner.agent.post(`/v1/galleries/${galleryId}/uploads`).set('x-csrf-token', owner.csrf).send({ name: 'a.jpg', size: 100 }).expect(503);
    expect(frozen.body.error.code).toBe('uploads_frozen');
    await superAdmin.put('/switches/uploads_frozen', { on: false, reason: 'Resolved' }).expect(204);

    await superAdmin.put('/switches/maintenance', { on: true, reason: 'Database upgrade' }).expect(204);
    const down = await owner.agent.get('/v1/me').expect(503);
    expect(down.body.error.code).toBe('maintenance');
    await superAdmin.get('/overview').expect(200);
    const switches = await superAdmin.get('/switches').expect(200);
    expect(switches.body.find((s: { key: string }) => s.key === 'maintenance')).toMatchObject({ on: true, reason: 'Database upgrade' });
    await superAdmin.put('/switches/maintenance', { on: false, reason: 'Done' }).expect(204);
    await owner.agent.get('/v1/me').expect(200);

    const ops = await signIn('operations');
    await ops.put('/switches/maintenance', { on: true, reason: 'Not allowed' }).expect(403);
  });
});

describe('plans', () => {
  it('changes a price for new purchases only', async () => {
    const superAdmin = await signIn('super_admin');
    const created = await superAdmin.post('/plans', { tier: '600GB', annualAllowanceGb: 600, cycle: 'annual', priceEgp: 1200 }).expect(201);
    await superAdmin.post('/plans', { tier: '600GB', annualAllowanceGb: 600, cycle: 'annual', priceEgp: 1300 }).expect(409);

    const owner = await signUp(app, prisma);
    const ops = await signIn('operations');
    await ops.post(`/photographers/${owner.photographerId}/change-plan`, { planId: created.body.id, reason: 'Pilot' }).expect(204);

    const next = await superAdmin.post(`/plans/${created.body.id}/price`, { priceEgp: 1500 }).expect(200);
    expect(next.body.priceEgp).toBe(1500);
    const plans = await superAdmin.get('/plans').expect(200);
    const old = plans.body.find((p: { id: string }) => p.id === created.body.id);
    expect(old.onSale).toBe(false);
    const sub = await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } });
    expect(Number(sub.priceEgp)).toBe(1200); // the running cycle keeps its price
  });
});

describe('abuse and audit', () => {
  it('lets a Super Admin open a logged, short-lived view for a case', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    await readyFiles(app, owner, galleryId, [['a.jpg', await photo(400, 300)]]);
    const shared = await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(200);
    const token = new URL(shared.body.link).pathname.split('/g/')[1]!;
    await request(app.getHttpServer()).post(`/v1/g/${token}/report`).send({ reason: 'These photos are of me without consent' }).expect(202);

    const ops = await signIn('operations');
    const queue = await ops.get('/abuse').expect(200);
    const report = (queue.body as Array<{ id: string; gallery: { id: string } }>).find((r) => r.gallery.id === galleryId)!;
    await ops.post(`/abuse/${report.id}/view`, { reason: 'Checking the claim' }).expect(403);

    const superAdmin = await signIn('super_admin');
    const view = await superAdmin.post(`/abuse/${report.id}/view`, { reason: 'Consent complaint from the subject' }).expect(200);
    expect(view.body.files).toHaveLength(1);
    expect(view.body.files[0].url).toMatch(/local-storage/);
    const logged = await prisma.auditLog.findFirst({ where: { action: 'abuse.content_viewed', targetId: galleryId } });
    expect(logged?.reason).toBe('Consent complaint from the subject');

    await superAdmin.post(`/abuse/${report.id}/decide`, { status: 'actioned', note: 'Removed at subject request', suspendGallery: true }).expect(204);
    expect((await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200)).body.state).toBe('unavailable');
    await superAdmin.post(`/abuse/${report.id}/decide`, { status: 'dismissed', note: 'Twice' }).expect(409);
  });

  it('detects an edited audit row', async () => {
    const superAdmin = await signIn('super_admin');
    const intact = await superAdmin.get('/audit/verify').expect(200);
    expect(intact.body.brokenAt).toBeNull();

    const row = await prisma.auditLog.findFirstOrThrow({ orderBy: { id: 'asc' } });
    await prisma.$executeRaw`UPDATE "AuditLog" SET reason = 'edited' WHERE id = ${row.id}`;
    try {
      const broken = await superAdmin.get('/audit/verify').expect(200);
      expect(broken.body.brokenAt).toBe(row.id.toString());
    } finally {
      await prisma.$executeRaw`UPDATE "AuditLog" SET reason = ${row.reason} WHERE id = ${row.id}`;
    }

    const page = await superAdmin.get('/audit?action=admin.login').expect(200);
    expect(page.body.items.length).toBeGreaterThan(0);
    expect(page.body.items[0].actorName).toBeTruthy();
  });
});
