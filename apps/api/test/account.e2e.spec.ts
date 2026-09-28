import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BillingService } from '../src/billing/billing.service';
import { BillingLifecycleService } from '../src/billing/billing-lifecycle.service';
import { LifecycleService } from '../src/lifecycle/lifecycle.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { createTestApp } from './app';
import { newGallery, photo, readyFiles } from './gallery-helpers';
import { localPath, PASSWORD, signUp } from './helpers';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];

let app: INestApplication;
let prisma: Prisma;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

const HOUR = 60 * 60 * 1000;

async function sharedGallery() {
  const owner = await signUp(app, prisma);
  const galleryId = await newGallery(owner);
  const fileIds = await readyFiles(app, owner, galleryId, [
    ['a.jpg', await photo(800, 600)],
    ['b.jpg', await photo(600, 400)],
  ]);
  const res = await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(200);
  const token = new URL(res.body.link).pathname.split('/g/')[1]!;
  return { owner, galleryId, fileIds, token, password: res.body.password as string };
}

async function unlockedClient(token: string, password: string) {
  const client = request.agent(app.getHttpServer());
  await client.post(`/v1/g/${token}/session`).send({ password }).expect(200);
  return client;
}

describe('profile', () => {
  it('reads and updates the profile, normalising links and validating them', async () => {
    const owner = await signUp(app, prisma);
    const initial = await owner.agent.get('/v1/me/profile').expect(200);
    expect(initial.body).toMatchObject({ email: owner.applicant.email, slug: null, galleryTheme: 'light', avatarUrl: null, logoUrl: null });
    expect(initial.body.notifications.notifyFirstOpen).toBe(true);

    const updated = await owner.agent
      .patch('/v1/me/profile')
      .set('x-csrf-token', owner.csrf)
      .send({
        name: 'Mona Adel',
        studioName: 'Mona Adel Studio',
        city: 'Alexandria',
        bio: 'Weddings and portraits.',
        instagramUrl: 'instagram.com/mona.adel',
        websiteUrl: 'https://mona.example.com',
        behanceUrl: '',
        locale: 'en',
        galleryTheme: 'dark',
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      name: 'Mona Adel',
      studioName: 'Mona Adel Studio',
      locale: 'en',
      galleryTheme: 'dark',
      links: { instagramUrl: 'https://instagram.com/mona.adel', websiteUrl: 'https://mona.example.com', behanceUrl: null },
    });

    const bad = await owner.agent
      .patch('/v1/me/profile')
      .set('x-csrf-token', owner.csrf)
      .send({ instagramUrl: 'https://facebook.com/mona', websiteUrl: 'not a url' })
      .expect(400);
    expect(bad.body.error.fields.map((f: { path: string }) => f.path).sort()).toEqual(['instagramUrl', 'websiteUrl']);

    // Unknown fields (such as email or passwordHash) are refused, not silently written.
    await owner.agent.patch('/v1/me/profile').set('x-csrf-token', owner.csrf).send({ email: 'x@example.com' }).expect(400);
  });

  it('checks handles: format, reserved words, taken by someone else', async () => {
    const a = await signUp(app, prisma);
    const b = await signUp(app, prisma);
    const slug = `mona-${Date.now().toString(36)}`;

    expect((await a.agent.get('/v1/me/slug-available?slug=ab').expect(200)).body).toMatchObject({ available: false, reason: 'length' });
    expect((await a.agent.get('/v1/me/slug-available?slug=Bad_Slug').expect(200)).body).toMatchObject({ available: false, reason: 'characters' });
    expect((await a.agent.get('/v1/me/slug-available?slug=admin').expect(200)).body).toMatchObject({ available: false, reason: 'reserved' });
    expect((await a.agent.get(`/v1/me/slug-available?slug=${slug}`).expect(200)).body).toMatchObject({ available: true });

    await a.agent.patch('/v1/me/profile').set('x-csrf-token', a.csrf).send({ slug: slug.toUpperCase() }).expect(200);
    expect((await prisma.photographer.findUniqueOrThrow({ where: { id: a.photographerId } })).slug).toBe(slug);
    // Your own handle is available to you, not to anyone else.
    expect((await a.agent.get(`/v1/me/slug-available?slug=${slug}`).expect(200)).body.available).toBe(true);
    expect((await b.agent.get(`/v1/me/slug-available?slug=${slug}`).expect(200)).body).toMatchObject({ available: false, reason: 'taken' });
    const taken = await b.agent.patch('/v1/me/profile').set('x-csrf-token', b.csrf).send({ slug }).expect(409);
    expect(taken.body.error.code).toBe('slug_taken');
    await b.agent.patch('/v1/me/profile').set('x-csrf-token', b.csrf).send({ slug: 'settings' }).expect(400);

    // Another account's phone number is refused.
    const phone = await b.agent.patch('/v1/me/profile').set('x-csrf-token', b.csrf).send({ phone: a.applicant.phone }).expect(409);
    expect(phone.body.error.code).toBe('phone_taken');
  });

  it('uploads and removes the avatar and logo, and shows them to clients with the theme', async () => {
    const { owner, token } = await sharedGallery();
    const image = await photo(900, 900);

    const avatar = await owner.agent.post('/v1/me/avatar').set('x-csrf-token', owner.csrf).attach('image', image, 'me.jpg').expect(200);
    expect(avatar.body.avatarUrl).toBeTruthy();
    const logo = await owner.agent.post('/v1/me/logo').set('x-csrf-token', owner.csrf).attach('image', image, 'logo.jpg').expect(200);
    expect(logo.body.logoUrl).toBeTruthy();
    await request(app.getHttpServer()).get(localPath(logo.body.logoUrl)).expect(200);

    await owner.agent.patch('/v1/me/profile').set('x-csrf-token', owner.csrf).send({ galleryTheme: 'dark' }).expect(200);
    const summary = await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200);
    expect(summary.body.photographer).toMatchObject({ theme: 'dark' });
    expect(summary.body.photographer.logoUrl).toBeTruthy();

    const me = await owner.agent.get('/v1/me').expect(200);
    expect(me.body.avatarUrl).toBeTruthy();
    expect(typeof me.body.unreadNotifications).toBe('number');

    const bad = await owner.agent.post('/v1/me/avatar').set('x-csrf-token', owner.csrf).attach('image', Buffer.from('not an image'), 'x.jpg').expect(400);
    expect(bad.body.error.code).toBe('image_type');

    const removed = await owner.agent.delete('/v1/me/avatar').set('x-csrf-token', owner.csrf).expect(200);
    expect(removed.body.avatarUrl).toBeNull();
    const oldKey = (await prisma.photographer.findUniqueOrThrow({ where: { id: owner.photographerId } })).logoKey;
    await owner.agent.delete('/v1/me/logo').set('x-csrf-token', owner.csrf).expect(200);
    expect(oldKey).toBeTruthy();
    expect((await prisma.photographer.findUniqueOrThrow({ where: { id: owner.photographerId } })).logoKey).toBeNull();
  });

  it('saves notification preferences', async () => {
    const owner = await signUp(app, prisma);
    const res = await owner.agent
      .patch('/v1/me/notification-preferences')
      .set('x-csrf-token', owner.csrf)
      .send({ notifyFirstOpen: false, notifyByEmail: false })
      .expect(200);
    expect(res.body).toEqual({ notifyFirstOpen: false, notifyFullDownload: true, notifyExpiring: true, notifyOrders: true, notifyByEmail: false });
    await owner.agent.patch('/v1/me/notification-preferences').set('x-csrf-token', owner.csrf).send({ notifyFirstOpen: 'no' }).expect(400);
  });

  it('refuses every account route without a session', async () => {
    const server = app.getHttpServer();
    await request(server).get('/v1/me/profile').expect(401);
    await request(server).get('/v1/notifications').expect(401);
    await request(server).get('/v1/notifications/unread-count').expect(401);
  });
});

describe('password change', () => {
  it('needs the current password, applies the strength rules and can end other logins', async () => {
    const owner = await signUp(app, prisma);
    // A second device logged in with the same account.
    const other = request.agent(app.getHttpServer());
    await other.post('/v1/auth/login').send({ email: owner.applicant.email, password: PASSWORD }).expect(200);
    await other.get('/v1/me').expect(200);

    const wrong = await owner.agent
      .post('/v1/me/password')
      .set('x-csrf-token', owner.csrf)
      .send({ currentPassword: 'not-my-password', newPassword: 'River-lights-2027!' })
      .expect(400);
    expect(wrong.body.error.fields[0].path).toBe('currentPassword');

    const short = await owner.agent.post('/v1/me/password').set('x-csrf-token', owner.csrf).send({ currentPassword: PASSWORD, newPassword: 'short' }).expect(400);
    expect(short.body.error.fields[0].path).toBe('newPassword');
    const common = await owner.agent
      .post('/v1/me/password')
      .set('x-csrf-token', owner.csrf)
      .send({ currentPassword: PASSWORD, newPassword: 'password123' })
      .expect(400);
    expect(common.body.error.fields[0].path).toBe('newPassword');

    const done = await owner.agent
      .post('/v1/me/password')
      .set('x-csrf-token', owner.csrf)
      .send({ currentPassword: PASSWORD, newPassword: 'River-lights-2027!', logoutOtherDevices: true })
      .expect(200);
    expect(done.body.otherSessionsEnded).toBeGreaterThanOrEqual(1);

    await owner.agent.get('/v1/me').expect(200); // this device stays in
    await other.get('/v1/me').expect(401);
    await request(app.getHttpServer()).post('/v1/auth/login').send({ email: owner.applicant.email, password: PASSWORD }).expect(401);
    await request(app.getHttpServer()).post('/v1/auth/login').send({ email: owner.applicant.email, password: 'River-lights-2027!' }).expect(200);
  });

  it('pauses after five wrong current passwords', async () => {
    const owner = await signUp(app, prisma);
    for (let i = 0; i < 5; i += 1) {
      await owner.agent.post('/v1/me/password').set('x-csrf-token', owner.csrf).send({ currentPassword: `wrong-${i}`, newPassword: 'River-lights-2027!' }).expect(400);
    }
    await owner.agent.post('/v1/me/password').set('x-csrf-token', owner.csrf).send({ currentPassword: PASSWORD, newPassword: 'River-lights-2027!' }).expect(429);
  });
});

describe('notifications inbox', () => {
  it('pages newest first, filters unread, marks read, and keeps other photographers out', async () => {
    const owner = await signUp(app, prisma);
    const stranger = await signUp(app, prisma);
    const base = Date.now() - 60 * HOUR;
    await prisma.notification.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        photographerId: owner.photographerId,
        type: 'gallery_opened' as const,
        data: { gallery: `Gallery ${i}` },
        createdAt: new Date(base + i * 60_000),
      })),
    });

    const first = await owner.agent.get('/v1/notifications').expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.items[0].data.gallery).toBe('Gallery 24');
    expect(first.body.unreadCount).toBe(25);
    const second = await owner.agent.get(`/v1/notifications?cursor=${first.body.nextCursor}`).expect(200);
    expect(second.body.items).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
    await owner.agent.get('/v1/notifications?cursor=garbage').expect(400);

    const target = first.body.items[0].id as string;
    // Someone else's notification does not exist for this photographer.
    await stranger.agent.post(`/v1/notifications/${target}/read`).set('x-csrf-token', stranger.csrf).expect(404);
    expect((await stranger.agent.get('/v1/notifications').expect(200)).body.items).toHaveLength(0);
    await stranger.agent.post('/v1/notifications/read-all').set('x-csrf-token', stranger.csrf).expect(200);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: target } })).readAt).toBeNull();

    await owner.agent.post(`/v1/notifications/${target}/read`).set('x-csrf-token', owner.csrf).expect(204);
    await owner.agent.post(`/v1/notifications/${target}/read`).set('x-csrf-token', owner.csrf).expect(204);
    expect((await owner.agent.get('/v1/notifications/unread-count').expect(200)).body.count).toBe(24);
    const unread = await owner.agent.get('/v1/notifications?unread=1&limit=50').expect(200);
    expect(unread.body.items).toHaveLength(24);
    expect(unread.body.items.every((n: { read: boolean }) => !n.read)).toBe(true);

    const all = await owner.agent.post('/v1/notifications/read-all').set('x-csrf-token', owner.csrf).expect(200);
    expect(all.body.updated).toBe(24);
    expect((await owner.agent.get('/v1/me').expect(200)).body.unreadNotifications).toBe(0);
  });
});

describe('notification events', () => {
  const ofType = (photographerId: string, type: string) =>
    prisma.notification.findMany({ where: { photographerId, type: type as never } });

  it('announces a ready gallery, its first open (once), and a full download', async () => {
    const { owner, galleryId, fileIds, token, password } = await sharedGallery();
    const ready = await ofType(owner.photographerId, 'gallery_ready');
    expect(ready).toHaveLength(1);
    expect(ready[0]!.galleryId).toBe(galleryId);

    const client = await unlockedClient(token, password);
    await client.get(`/v1/g/${token}/content`).expect(200);
    const again = await unlockedClient(token, password);
    await prisma.accessEvent.updateMany({ where: { galleryId }, data: { createdAt: new Date(Date.now() - 2 * HOUR) } });
    await again.get(`/v1/g/${token}/content`).expect(200);
    const opened = await ofType(owner.photographerId, 'gallery_opened');
    expect(opened).toHaveLength(1);
    expect(opened[0]!.data).toMatchObject({ gallery: 'Sara & Omar wedding', client: 'Sara' });

    await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).expect(200);
    expect(await ofType(owner.photographerId, 'gallery_downloaded')).toHaveLength(0);
    await client.post(`/v1/g/${token}/files/${fileIds[1]}/download`).expect(200);
    const downloaded = await ofType(owner.photographerId, 'gallery_downloaded');
    expect(downloaded).toHaveLength(1);
    expect(downloaded[0]!.data).toMatchObject({ reason: 'all_files' });
  });

  it('respects a switched-off preference', async () => {
    const { owner, token, password } = await sharedGallery();
    await prisma.photographer.update({ where: { id: owner.photographerId }, data: { notifyFirstOpen: false } });
    const client = await unlockedClient(token, password);
    await client.get(`/v1/g/${token}/content`).expect(200);
    expect(await ofType(owner.photographerId, 'gallery_opened')).toHaveLength(0);
  });

  it('warns 24 hours before expiry once, then announces the close', async () => {
    const { owner, galleryId } = await sharedGallery();
    const lifecycle = app.get(LifecycleService);
    await prisma.gallery.update({ where: { id: galleryId }, data: { expiresAt: new Date(Date.now() + 5 * HOUR) } });
    await lifecycle.tick();
    await lifecycle.tick();
    expect(await ofType(owner.photographerId, 'gallery_expiring')).toHaveLength(1);

    await prisma.gallery.update({ where: { id: galleryId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await lifecycle.tick();
    const closed = await ofType(owner.photographerId, 'gallery_closed');
    expect(closed).toHaveLength(1);
    expect(closed[0]!.data).toMatchObject({ reason: 'expired' });
  });

  it('records allowance warnings once per threshold and renewal reminders', async () => {
    const owner = await signUp(app, prisma);
    const sub = await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } });
    const billing = app.get(BillingLifecycleService);
    await prisma.subscription.update({ where: { id: sub.id }, data: { allowanceBytes: 1000n, usedBytes: 850n } });
    await billing.checkAllowance(sub.id);
    await billing.checkAllowance(sub.id);
    await prisma.subscription.update({ where: { id: sub.id }, data: { usedBytes: 960n } });
    await billing.checkAllowance(sub.id);
    const warnings = await ofType(owner.photographerId, 'allowance_warning');
    expect(warnings.map((w) => (w.data as { percent: number }).percent).sort()).toEqual([80, 95]);

    await prisma.subscription.update({ where: { id: sub.id }, data: { cycleEnd: new Date(Date.now() + 3 * 24 * HOUR) } });
    await billing.remind(new Date());
    await billing.remind(new Date());
    expect(await ofType(owner.photographerId, 'renewal_due')).toHaveLength(1);
  });

  it('announces approved and rejected payments', async () => {
    const owner = await signUp(app, prisma, { trial: false });
    const plan = await prisma.plan.create({ data: { tier: '200GB', allowanceBytes: BigInt(200 * 1024 ** 3), cycle: 'monthly', priceEgp: 150 } });
    const checkout = await owner.agent.post('/v1/billing/checkout').set('x-csrf-token', owner.csrf).send({ planId: plan.id }).expect(201);
    await owner.agent
      .post(`/v1/billing/payments/${checkout.body.id}/proof`)
      .set('x-csrf-token', owner.csrf)
      .field('method', 'instapay')
      .field('declaredAmountEgp', String(checkout.body.amountEgp))
      .attach('proof', await photo(400, 300), 'receipt.jpg')
      .expect(200);
    await app.get(BillingService).approve(checkout.body.id);
    expect(await ofType(owner.photographerId, 'payment_approved')).toHaveLength(1);

    const other = await signUp(app, prisma, { trial: false });
    const second = await other.agent.post('/v1/billing/checkout').set('x-csrf-token', other.csrf).send({ planId: plan.id }).expect(201);
    await app.get(BillingService).reject(second.body.id, 'The amount does not match.');
    const rejected = await ofType(other.photographerId, 'payment_rejected');
    expect(rejected[0]!.data).toMatchObject({ reason: 'The amount does not match.' });
  });

  it('keeps notify fire-and-forget: a bad photographer id never throws', async () => {
    await expect(
      app.get(NotificationsService).notify('00000000-0000-0000-0000-000000000000', { type: 'gallery_closed', data: {} }),
    ).resolves.toBeUndefined();
  });
});
