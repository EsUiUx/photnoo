import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { sha256 } from '../src/common/crypto';
import { ApplicationsService } from '../src/applications/applications.service';
import { createTestApp, type FakeMail } from './app';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];

let app: INestApplication;
let mail: FakeMail;
let prisma: Prisma;
let counter = 0;

const STRONG_PASSWORD = 'Nile-sunset-2026!';

beforeAll(async () => {
  ({ app, mail, prisma } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

function uniqueApplicant() {
  counter += 1;
  const n = `${Date.now()}${counter}`.slice(-9);
  return {
    name: `Photographer ${counter}`,
    city: 'Cairo',
    phone: `+2010${n}`,
    email: `photographer${n}@example.com`,
    portfolioUrl: 'https://instagram.com/example',
  };
}

/** Apply, approve and return the invite token, as an operator would via the CLI. */
async function invite(options: { trial: boolean }) {
  const applicant = uniqueApplicant();
  await request(app.getHttpServer()).post('/v1/applications').send(applicant).expect(202);
  const application = await prisma.application.findFirstOrThrow({ where: { email: applicant.email } });
  const url = await app.get(ApplicationsService).approve(application.id, { grantTrial: options.trial });
  return { applicant, token: url.split('/invite/')[1]! };
}

/** A logged-in agent (cookies persist between calls) plus its CSRF token. */
async function signedUp(options = { trial: true }) {
  const { applicant, token } = await invite(options);
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post('/v1/auth/accept-invite')
    .send({ token, password: STRONG_PASSWORD, acceptTerms: true, acceptContentDeclaration: true })
    .expect(201);
  return { agent, applicant, csrf: res.body.csrfToken as string };
}

describe('applications', () => {
  it('accepts an application and does not reveal duplicates', async () => {
    const applicant = uniqueApplicant();
    const server = app.getHttpServer();
    await request(server).post('/v1/applications').send(applicant).expect(202);
    await request(server).post('/v1/applications').send(applicant).expect(202);
    expect(await prisma.application.count({ where: { email: applicant.email } })).toBe(1);
    expect(mail.last(applicant.email)?.subject).toContain('application');
  });

  it('rejects invalid input with field errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/applications')
      .send({ ...uniqueApplicant(), phone: '01012345678' })
      .expect(400);
    expect(res.body.error.code).toBe('validation_failed');
    expect(res.body.error.fields[0].path).toBe('phone');
  });
});

describe('invites', () => {
  it('creates a trial account from a single-use invite', async () => {
    const { applicant, token } = await invite({ trial: true });
    const server = app.getHttpServer();

    const preview = await request(server).get(`/v1/auth/invites/${token}`).expect(200);
    expect(preview.body).toEqual({ name: applicant.name, email: applicant.email });

    await request(server)
      .post('/v1/auth/accept-invite')
      .send({ token, password: '1234567890', acceptTerms: true, acceptContentDeclaration: true })
      .expect(400);

    const agent = request.agent(server);
    const accepted = await agent
      .post('/v1/auth/accept-invite')
      .send({ token, password: STRONG_PASSWORD, acceptTerms: true, acceptContentDeclaration: true })
      .expect(201);
    const cookies = ([] as string[]).concat(accepted.headers['set-cookie'] ?? []);
    expect(cookies.find((c) => c.startsWith('pn_at='))).toMatch(/HttpOnly/);
    expect(cookies.find((c) => c.startsWith('pn_rt='))).toMatch(/Path=\/v1\/auth/);
    expect(cookies.find((c) => c.startsWith('pn_at='))).toMatch(/SameSite=Strict/);

    const me = await agent.get('/v1/me').expect(200);
    expect(me.body.email).toBe(applicant.email);
    expect(me.body.subscription.state).toBe('trial');
    expect(me.body.subscription.allowanceBytes).toBe(String(25 * 1024 ** 3));

    const reuse = await request(server)
      .post('/v1/auth/accept-invite')
      .send({ token, password: STRONG_PASSWORD, acceptTerms: true, acceptContentDeclaration: true })
      .expect(410);
    expect(reuse.body.error.code).toBe('invite_invalid');
  });

  it('starts without a trial in pending payment', async () => {
    const { agent } = await signedUp({ trial: false });
    const me = await agent.get('/v1/me').expect(200);
    expect(me.body.subscription.state).toBe('pending_payment');
  });

  it('refuses an expired invite', async () => {
    const { token } = await invite({ trial: false });
    await prisma.application.update({
      where: { inviteTokenHash: sha256(token) },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer()).get(`/v1/auth/invites/${token}`).expect(410);
  });
});

describe('login and sessions', () => {
  it('requires a session for /v1/me', async () => {
    const res = await request(app.getHttpServer()).get('/v1/me').expect(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('logs in and uses one message for wrong email and wrong password', async () => {
    const { applicant } = await signedUp();
    const server = app.getHttpServer();

    const wrongPassword = await request(server)
      .post('/v1/auth/login')
      .send({ email: applicant.email, password: 'not-the-password' })
      .expect(401);
    const unknownEmail = await request(server)
      .post('/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'not-the-password' })
      .expect(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);

    const agent = request.agent(server);
    await agent.post('/v1/auth/login').send({ email: applicant.email, password: STRONG_PASSWORD }).expect(200);
    await agent.get('/v1/me').expect(200);
  });

  it('locks the account for 15 minutes after 5 failed attempts', async () => {
    const { applicant } = await signedUp();
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i += 1) {
      await request(server).post('/v1/auth/login').send({ email: applicant.email, password: 'wrong-password' }).expect(401);
    }
    const locked = await request(server)
      .post('/v1/auth/login')
      .send({ email: applicant.email, password: STRONG_PASSWORD })
      .expect(429);
    expect(locked.body.error.code).toBe('account_locked');
  });

  it('blocks state-changing requests without the CSRF header', async () => {
    const { agent, csrf } = await signedUp();
    const res = await agent.post('/v1/auth/logout-all').expect(403);
    expect(res.body.error.code).toBe('csrf_failed');
    await agent.post('/v1/auth/logout-all').set('x-csrf-token', csrf).expect(204);
  });

  it('rotates refresh tokens and revokes the family when an old one is replayed', async () => {
    const { agent, csrf, applicant } = await signedUp();
    const photographer = await prisma.photographer.findUniqueOrThrow({ where: { email: applicant.email } });
    const first = await prisma.session.findFirstOrThrow({ where: { photographerId: photographer.id } });

    const rotated = await agent.post('/v1/auth/refresh').set('x-csrf-token', csrf).expect(200);
    const oldRefresh = await prisma.session.findUniqueOrThrow({ where: { id: first.id } });
    expect(oldRefresh.revokedAt).not.toBeNull();
    expect(oldRefresh.replacedById).not.toBeNull();

    // Replay the first refresh token after the race grace period has passed.
    await prisma.session.update({ where: { id: first.id }, data: { revokedAt: new Date(Date.now() - 60_000) } });
    const stolen = await prisma.session.findUniqueOrThrow({ where: { id: first.id } });
    const attacker = request.agent(app.getHttpServer());
    const replayCookie = await rawRefreshCookieFor(stolen.refreshHash, first.id);
    await attacker.post('/v1/auth/refresh').set('Cookie', replayCookie).set('x-csrf-token', 'x').expect(403);

    // With a matching CSRF pair the replay is rejected and the whole family is revoked.
    await attacker
      .post('/v1/auth/refresh')
      .set('Cookie', `${replayCookie}; pn_csrf=x`)
      .set('x-csrf-token', 'x')
      .expect(401);
    const active = await prisma.session.count({
      where: { familyId: first.familyId, revokedAt: null },
    });
    expect(active).toBe(0);
    await agent.post('/v1/auth/refresh').set('x-csrf-token', rotated.body.csrfToken).expect(401);
  });
});

describe('password reset', () => {
  it('resets with the emailed code and ends existing sessions', async () => {
    const { agent, applicant, csrf } = await signedUp();
    const server = app.getHttpServer();

    await request(server).post('/v1/auth/password-reset/request').send({ email: applicant.email }).expect(202);
    await request(server).post('/v1/auth/password-reset/request').send({ email: 'nobody@example.com' }).expect(202);
    const code = mail.last(applicant.email)?.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeDefined();

    const wrong = code === '000000' ? '111111' : '000000';
    await request(server)
      .post('/v1/auth/password-reset/confirm')
      .send({ email: applicant.email, code: wrong, newPassword: 'Another-strong-2026' })
      .expect(400);
    await request(server)
      .post('/v1/auth/password-reset/confirm')
      .send({ email: applicant.email, code, newPassword: 'Another-strong-2026' })
      .expect(204);

    const photographer = await prisma.photographer.findUniqueOrThrow({ where: { email: applicant.email } });
    expect(await prisma.session.count({ where: { photographerId: photographer.id, revokedAt: null } })).toBe(0);
    await request(server)
      .post('/v1/auth/login')
      .send({ email: applicant.email, password: 'Another-strong-2026' })
      .expect(200);
    // The pre-reset login can no longer refresh.
    await agent.post('/v1/auth/refresh').set('x-csrf-token', csrf).expect(401);
  });
});

describe('audit log', () => {
  it('chains every row to the previous one', async () => {
    const rows = await prisma.auditLog.findMany({ orderBy: { id: 'asc' } });
    expect(rows.length).toBeGreaterThan(3);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.prevHash).toBe(rows[i - 1]!.hash);
    }
  });
});

/**
 * The test cannot recover a plaintext refresh token from its hash, so it swaps in a known token:
 * it writes sha256(known) onto the stolen session row and replays `known`.
 */
async function rawRefreshCookieFor(_hash: string, sessionId: string): Promise<string> {
  const known = `replayed-token-${sessionId}`;
  await prisma.session.update({ where: { id: sessionId }, data: { refreshHash: sha256(known) } });
  return `pn_rt=${known}`;
}
