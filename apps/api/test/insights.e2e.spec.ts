import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { createTestApp } from './app';
import { photo } from './gallery-helpers';
import { signUp } from './helpers';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];
type Owner = Awaited<ReturnType<typeof signUp>>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let app: INestApplication;
let prisma: Prisma;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
});

afterAll(async () => {
  await app.close();
});

async function uploadPortfolio(owner: Owner, fields: Record<string, string> = {}) {
  let req = owner.agent.post('/v1/portfolio/items').set('x-csrf-token', owner.csrf);
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  const res = await req.attach('image', await photo(1200, 800), { filename: 'showcase.jpg', contentType: 'image/jpeg' }).expect(201);
  return res.body as { id: string; previewUrl: string; url: string; category: string | null; caption: string | null };
}

describe('portfolio', () => {
  let owner: Owner;
  let other: Owner;

  beforeAll(async () => {
    owner = await signUp(app, prisma);
    other = await signUp(app, prisma);
  });

  it('uploads, edits, reorders and deletes showcase images', async () => {
    const a = await uploadPortfolio(owner, { category: 'Wedding', caption: 'First look' });
    const b = await uploadPortfolio(owner, { category: 'Portrait' });
    const c = await uploadPortfolio(owner);
    expect(a).toMatchObject({ category: 'Wedding', caption: 'First look' });
    expect(c.category).toBeNull();

    // Does not use the storage allowance.
    const sub = await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } });
    expect(sub.usedBytes).toBe(0n);

    await owner.agent.patch(`/v1/portfolio/items/${c.id}`).set('x-csrf-token', owner.csrf).send({ caption: 'Golden hour', category: 'Engagement' }).expect(200);
    await owner.agent.patch(`/v1/portfolio/items/${a.id}`).set('x-csrf-token', owner.csrf).send({ caption: '' }).expect(200);

    const reordered = await owner.agent.post('/v1/portfolio/reorder').set('x-csrf-token', owner.csrf).send({ ids: [c.id, a.id] }).expect(200);
    expect(reordered.body.items.map((i: { id: string }) => i.id)).toEqual([c.id, a.id, b.id]);
    expect(reordered.body.items[0]).toMatchObject({ caption: 'Golden hour', category: 'Engagement' });
    expect(reordered.body.items[1].caption).toBeNull();

    await owner.agent.delete(`/v1/portfolio/items/${b.id}`).set('x-csrf-token', owner.csrf).expect(204);
    const list = await owner.agent.get('/v1/portfolio').expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body).toMatchObject({ published: false, slug: null, maxItems: 200 });
  });

  it("keeps each photographer's portfolio private to them", async () => {
    const mine = await uploadPortfolio(owner);
    await other.agent.patch(`/v1/portfolio/items/${mine.id}`).set('x-csrf-token', other.csrf).send({ caption: 'x' }).expect(404);
    await other.agent.delete(`/v1/portfolio/items/${mine.id}`).set('x-csrf-token', other.csrf).expect(404);
    await other.agent.post('/v1/portfolio/reorder').set('x-csrf-token', other.csrf).send({ ids: [mine.id] }).expect(404);
    const list = await other.agent.get('/v1/portfolio').expect(200);
    expect(list.body.items).toHaveLength(0);
    expect(await prisma.portfolioItem.count({ where: { id: mine.id } })).toBe(1);
  });

  it('rejects non-images and needs a slug before publishing', async () => {
    await owner.agent
      .post('/v1/portfolio/items')
      .set('x-csrf-token', owner.csrf)
      .attach('image', Buffer.from('%PDF-1.4 nope'), { filename: 'a.pdf', contentType: 'application/pdf' })
      .expect(400);
    const res = await owner.agent.patch('/v1/portfolio/settings').set('x-csrf-token', owner.csrf).send({ published: true }).expect(409);
    expect(res.body.error.code).toBe('slug_required');
  });

  it('serves only published portfolios on the public page, never gallery files', async () => {
    const server = app.getHttpServer();
    const slug = `studio-${Date.now()}`;
    await prisma.photographer.update({ where: { id: owner.photographerId }, data: { slug, bio: 'Weddings in Cairo', instagramUrl: 'https://instagram.com/studio' } });

    // A gallery file exists, but must never appear publicly.
    const gallery = await prisma.gallery.create({ data: { photographerId: owner.photographerId, name: 'Private wedding' } });
    const file = await prisma.file.create({
      data: { galleryId: gallery.id, originalName: 'secret.jpg', sizeBytes: 10n, originalKey: `galleries/${gallery.id}/secret`, previewKey: `galleries/${gallery.id}/secret-preview`, status: 'ready' },
    });

    // Unpublished: same answer as an unknown slug.
    const hidden = await request(server).get(`/v1/public/p/${slug}`).expect(404);
    expect(hidden.body.error.code).toBe('profile_not_found');
    await request(server).get('/v1/public/p/no-such-studio').expect(404);

    await owner.agent.patch('/v1/portfolio/settings').set('x-csrf-token', owner.csrf).send({ published: true }).expect(200);
    const res = await request(server).get(`/v1/public/p/${slug.toUpperCase()}`).expect(200);
    expect(res.body).toMatchObject({ slug, bio: 'Weddings in Cairo', links: { instagram: 'https://instagram.com/studio' }, storeEnabled: false });
    expect(res.body.items).toHaveLength(3);
    expect(res.body.categories).toEqual(['Engagement', 'Wedding']);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(file.id);
    expect(body).not.toContain('galleries/');
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain(owner.applicant.email);

    // The other photographer's images never show on this page.
    const theirs = await uploadPortfolio(other);
    expect(JSON.stringify((await request(server).get(`/v1/public/p/${slug}`).expect(200)).body)).not.toContain(theirs.id);

    await owner.agent.patch('/v1/portfolio/settings').set('x-csrf-token', owner.csrf).send({ published: false }).expect(200);
    await request(server).get(`/v1/public/p/${slug}`).expect(404);

    // A suspended account is not served even when published.
    await prisma.photographer.update({ where: { id: owner.photographerId }, data: { portfolioPublished: true, status: 'suspended' } });
    await request(server).get(`/v1/public/p/${slug}`).expect(404);
    await prisma.photographer.update({ where: { id: owner.photographerId }, data: { status: 'active' } });
  });
});

describe('analytics', () => {
  let owner: Owner;
  let rival: Owner;
  const now = Date.now();

  async function galleryWithClient(photographerId: string, name: string, client: { name: string; phone: string }) {
    const c = await prisma.client.create({ data: { photographerId, name: client.name, phone: client.phone } });
    const gallery = await prisma.gallery.create({
      data: { photographerId, name, clientId: c.id, clientName: client.name, clientPhone: client.phone, state: 'active' },
    });
    const file = await prisma.file.create({
      data: { galleryId: gallery.id, originalName: 'a.jpg', sizeBytes: 100n, originalKey: `galleries/${gallery.id}/${randomUUID()}`, status: 'ready' },
    });
    return { gallery, file };
  }

  async function views(galleryId: string, ats: number[], extra: { country?: string; deviceType?: string } = {}) {
    await prisma.accessEvent.createMany({
      data: ats.map((at) => ({ galleryId, type: 'open' as const, createdAt: new Date(at), country: extra.country ?? 'EG', deviceType: extra.deviceType ?? 'mobile' })),
    });
  }

  async function downloads(galleryId: string, fileId: string, ats: number[], deviceType = 'mobile') {
    await prisma.downloadReceipt.createMany({
      data: ats.map((at) => ({ galleryId, fileId, bytes: 100n, sessionId: 's', createdAt: new Date(at), deviceType, country: 'EG' })),
    });
  }

  beforeAll(async () => {
    owner = await signUp(app, prisma);
    rival = await signUp(app, prisma);
    const pid = owner.photographerId;

    // Sara: few views, many downloads. Omar: many views, one download.
    const sara = await galleryWithClient(pid, 'Sara wedding', { name: 'Sara Nabil', phone: '+201001110001' });
    const omar = await galleryWithClient(pid, 'Omar graduation', { name: 'Omar Tarek', phone: '+201001110002' });
    await views(sara.gallery.id, [now - 1 * HOUR]);
    await downloads(sara.gallery.id, sara.file.id, [now - 1 * HOUR, now - 2 * HOUR, now - 2 * DAY], 'desktop');
    await views(omar.gallery.id, [now - 2 * HOUR, now - 3 * HOUR, now - 1 * DAY, now - 2 * DAY], { country: 'SA' });
    await downloads(omar.gallery.id, omar.file.id, [now - 3 * HOUR]);
    // Previous 7-day window (about 8 to 12 days ago) and long ago.
    await views(omar.gallery.id, [now - 9 * DAY, now - 10 * DAY]);
    await downloads(sara.gallery.id, sara.file.id, [now - 9 * DAY]);
    await views(sara.gallery.id, [now - 200 * DAY]);

    const order = (data: { status: 'pending' | 'delivered' | 'cancelled'; total: number; paidAt?: number; createdAt: number; number: number }) =>
      prisma.order.create({
        data: {
          photographerId: pid,
          number: data.number,
          kind: 'store',
          status: data.status,
          customerName: 'Sara',
          customerPhone: '+201001110001',
          totalEgp: data.total,
          paidAt: data.paidAt ? new Date(data.paidAt) : null,
          createdAt: new Date(data.createdAt),
        },
      });
    await order({ number: 1001, status: 'delivered', total: 1250.5, paidAt: now - 1 * DAY, createdAt: now - 2 * DAY });
    await order({ number: 1002, status: 'pending', total: 400, createdAt: now - 1 * HOUR });
    await order({ number: 1003, status: 'cancelled', total: 900, paidAt: now - 1 * DAY, createdAt: now - 1 * DAY });
    await order({ number: 1004, status: 'delivered', total: 500, paidAt: now - 10 * DAY, createdAt: now - 10 * DAY });

    // The rival photographer has lots of activity that must never leak into the owner's numbers.
    const r = await galleryWithClient(rival.photographerId, 'Rival gallery', { name: 'Rival client', phone: '+201001110009' });
    await views(r.gallery.id, Array.from({ length: 20 }, (_, i) => now - i * HOUR));
    await downloads(r.gallery.id, r.file.id, Array.from({ length: 30 }, (_, i) => now - i * HOUR));
    await prisma.order.create({
      data: { photographerId: rival.photographerId, number: 1001, kind: 'store', customerName: 'X', customerPhone: '+201001110009', totalEgp: 99999, paidAt: new Date(now - HOUR), status: 'delivered' },
    });
  });

  it('computes KPIs with deltas against the previous period', async () => {
    const res = await owner.agent.get('/v1/analytics/overview?range=7d').expect(200);
    expect(res.body.views).toEqual({ value: 5, previous: 2, change: 1.5 });
    expect(res.body.downloads).toEqual({ value: 4, previous: 1, change: 3 });
    expect(res.body.orders).toEqual({ value: 2, previous: 1, change: 1 });
    expect(res.body.revenueEgp).toEqual({ value: 1250.5, previous: 500, change: 1.501 });
    expect(res.body.devices).toEqual([
      { deviceType: 'desktop', downloads: 3 },
      { deviceType: 'mobile', downloads: 1 },
    ]);
    expect(res.body.countries).toEqual([
      { country: 'SA', views: 4 },
      { country: 'EG', views: 1 },
    ]);
  });

  it('returns a gap-free time series in Cairo buckets', async () => {
    const week = await owner.agent.get('/v1/analytics/timeseries?range=7d').expect(200);
    expect(week.body.points).toHaveLength(7);
    const sum = (points: Array<{ views: number; downloads: number }>, k: 'views' | 'downloads') => points.reduce((s, p) => s + p[k], 0);
    expect(sum(week.body.points, 'views')).toBe(5);
    expect(sum(week.body.points, 'downloads')).toBe(4);
    const dates = week.body.points.map((p: { date: string }) => p.date);
    for (let i = 1; i < dates.length; i += 1) {
      expect(Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`)).toBe(DAY);
    }

    const year = await owner.agent.get('/v1/analytics/timeseries?range=12m').expect(200);
    expect(year.body.unit).toBe('month');
    expect(year.body.points).toHaveLength(12);
    expect(year.body.points.every((p: { date: string }) => p.date.endsWith('-01'))).toBe(true);
    expect(sum(year.body.points, 'views')).toBe(8);

    const half = await owner.agent.get('/v1/analytics/timeseries?range=6m').expect(200);
    expect(half.body.points.length).toBeGreaterThanOrEqual(26);
    await owner.agent.get('/v1/analytics/timeseries?range=5y').expect(400);
  });

  it('ranks clients by downloads, then views, and galleries by views', async () => {
    const clients = await owner.agent.get('/v1/analytics/top-clients?range=7d').expect(200);
    expect(clients.body.items.map((c: { name: string; downloads: number; views: number }) => [c.name, c.downloads, c.views])).toEqual([
      ['Sara Nabil', 3, 1],
      ['Omar Tarek', 1, 4],
    ]);
    expect(clients.body.items[0].rank).toBe(1);

    const galleries = await owner.agent.get('/v1/analytics/top-galleries?range=7d').expect(200);
    expect(galleries.body.items[0]).toMatchObject({ name: 'Omar graduation', views: 4, downloads: 1, clientName: 'Omar Tarek', clientPhone: '+201001110002' });
  });

  it("isolates tenants: a photographer never sees another's numbers", async () => {
    const res = await rival.agent.get('/v1/analytics/overview?range=30d').expect(200);
    expect(res.body.views.value).toBe(20);
    expect(res.body.downloads.value).toBe(30);
    const clients = await rival.agent.get('/v1/analytics/top-clients?range=30d').expect(200);
    expect(clients.body.items.map((c: { name: string }) => c.name)).toEqual(['Rival client']);
    const mine = await owner.agent.get('/v1/analytics/overview?range=30d').expect(200);
    expect(mine.body.revenueEgp.value).toBe(1750.5);
    expect(mine.body.views.value).toBe(7);
    await request(app.getHttpServer()).get('/v1/analytics/overview').expect(401);
  });

  it('starts periods at Cairo midnight, across daylight saving', async () => {
    const analytics = app.get(AnalyticsService);
    // 21:30 UTC on 29 Sep 2026 is 00:30 on 30 Sep in Cairo (UTC+3 in summer).
    const at = new Date('2026-09-29T21:30:00Z');
    expect((await analytics.period('7d', at)).start.toISOString()).toBe('2026-09-23T21:00:00.000Z');
    expect((await analytics.period('12m', at)).start.toISOString()).toBe('2025-09-30T21:00:00.000Z');
    // Winter: UTC+2.
    const winter = new Date('2026-01-15T10:00:00Z');
    expect((await analytics.period('30d', winter)).start.toISOString()).toBe('2025-12-16T22:00:00.000Z');
  });
});
