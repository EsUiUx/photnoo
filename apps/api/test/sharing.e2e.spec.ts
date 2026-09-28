import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LifecycleService } from '../src/lifecycle/lifecycle.service';
import { STORAGE, type Storage } from '../src/storage/storage';
import { createTestApp, type FakeMail } from './app';
import { newGallery, photo, readyFiles, upload } from './gallery-helpers';
import { localPath, signUp } from './helpers';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];

let app: INestApplication;
let prisma: Prisma;
let mail: FakeMail;
let storage: Storage;

beforeAll(async () => {
  ({ app, prisma, mail } = await createTestApp());
  storage = app.get(STORAGE);
});

afterAll(async () => {
  await app.close();
});

const MINUTE = 60_000;

/** A photographer with a shared gallery of two photos, plus the link token and password. */
async function sharedGallery() {
  const owner = await signUp(app, prisma);
  const galleryId = await newGallery(owner);
  const fileIds = await readyFiles(app, owner, galleryId, [
    ['DSC_0001.jpg', await photo(1200, 800)],
    ['DSC_0002.jpg', await photo(900, 600)],
  ]);
  const res = await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(200);
  const token = new URL(res.body.link).pathname.split('/g/')[1]!;
  return { owner, galleryId, fileIds, token, password: res.body.password as string, link: res.body.link as string };
}

async function unlockedClient(token: string, password: string) {
  const client = request.agent(app.getHttpServer());
  await client.post(`/v1/g/${token}/session`).send({ password }).expect(200);
  return client;
}

describe('activate and share', () => {
  it('refuses an empty gallery, then shares with a link and a one-time password', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const empty = await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(409);
    expect(empty.body.error.code).toBe('gallery_empty');

    const image = await photo(1000, 700);
    await readyFiles(app, owner, galleryId, [['a.jpg', image]]);
    const res = await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(200);
    expect(res.body.link).toMatch(/^http:\/\/localhost:3000\/g\/[A-Za-z0-9_-]{22}$/);
    expect(res.body.password).toMatch(/^[A-Za-z0-9]{9}$/);
    expect(res.body.password.replace(/\D/g, '')).toHaveLength(3);
    expect(res.body.password).not.toMatch(/[IlO01]/);

    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.state).toBe('active');
    expect(gallery.capBytes).toBe(BigInt(image.length * 2));
    expect(gallery.passwordHash).toMatch(/^\$argon2id\$/);
    expect(gallery.passwordHash).not.toContain(res.body.password);
    expect(gallery.expiresAt!.getTime() - gallery.activatedAt!.getTime()).toBe(7 * 24 * 60 * MINUTE);

    const link = await owner.agent.get(`/v1/galleries/${galleryId}/link`).expect(200);
    expect(link.body.link).toBe(res.body.link);
    await owner.agent.post(`/v1/galleries/${galleryId}/activate`).set('x-csrf-token', owner.csrf).expect(409);
  });

  it('keeps other photographers out', async () => {
    const { galleryId } = await sharedGallery();
    const stranger = await signUp(app, prisma);
    await stranger.agent.get(`/v1/galleries/${galleryId}/link`).expect(404);
    await stranger.agent.post(`/v1/galleries/${galleryId}/password`).set('x-csrf-token', stranger.csrf).expect(404);
    await stranger.agent.get(`/v1/galleries/${galleryId}/activity`).expect(404);
  });
});

describe('client access', () => {
  it('shows the password screen data without any photos, and 404 for unknown links', async () => {
    const { token } = await sharedGallery();
    const summary = await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200);
    expect(summary.body).toMatchObject({ state: 'open', name: 'Sara & Omar wedding' });
    expect(summary.body.files).toBeUndefined();
    const unknown = await request(app.getHttpServer()).get('/v1/g/AAAAAAAAAAAAAAAAAAAAAA').expect(404);
    expect(unknown.body.error.code).toBe('link_invalid');
  });

  it('unlocks with the password into a session scoped to this link', async () => {
    const { token, password } = await sharedGallery();
    const server = app.getHttpServer();
    await request(server).get(`/v1/g/${token}/content`).expect(401);

    const wrong = await request(server).post(`/v1/g/${token}/session`).send({ password: 'Wrong1234' }).expect(401);
    expect(wrong.body.error.code).toBe('wrong_password');

    const client = request.agent(server);
    const ok = await client.post(`/v1/g/${token}/session`).send({ password }).expect(200);
    const cookie = ([] as string[]).concat(ok.headers['set-cookie'] ?? []).find((c) => c.startsWith('pn_g='))!;
    expect(cookie).toMatch(new RegExp(`Path=/v1/g/${token}`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const content = await client.get(`/v1/g/${token}/content`).expect(200);
    expect(content.body.files).toHaveLength(2);
    expect(content.body.files[0].previewUrl).toMatch(/\/v1\/local-storage\?/);
    expect(content.body.allowance.remainingBytes).toBe(content.body.allowance.capBytes);
    const preview = await request(server).get(localPath(content.body.files[0].previewUrl)).expect(200);
    expect(preview.headers['content-type']).toBe('image/jpeg');
  });

  it('does not accept one gallery session on another link', async () => {
    const first = await sharedGallery();
    const second = await sharedGallery();
    const ok = await request(app.getHttpServer()).post(`/v1/g/${first.token}/session`).send({ password: first.password }).expect(200);
    const sessionCookie = ([] as string[]).concat(ok.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
    await request(app.getHttpServer()).get(`/v1/g/${second.token}/content`).set('Cookie', sessionCookie).expect(401);
  });
});

describe('brute-force protection', () => {
  it('slows down after 5 failures and locks an IP after 10, even with the right password', async () => {
    const { token, password } = await sharedGallery();
    const server = app.getHttpServer();
    for (let i = 1; i <= 5; i += 1) {
      const res = await request(server).post(`/v1/g/${token}/session`).send({ password: `Wrong000${i}` }).expect(401);
      expect(res.body.error.details.captchaRequired).toBe(i >= 3);
    }
    const slow = await request(server).post(`/v1/g/${token}/session`).send({ password }).expect(429);
    expect(slow.body.error.code).toBe('slow_down');

    const gallery = await prisma.gallery.findFirstOrThrow({ where: { accesses: { some: {} } }, orderBy: { createdAt: 'desc' } });
    const ip = (await prisma.accessEvent.findFirstOrThrow({ where: { galleryId: gallery.id } })).ip;
    await prisma.accessEvent.createMany({
      data: Array.from({ length: 5 }, () => ({ galleryId: gallery.id, type: 'password_fail' as const, ip })),
    });
    const locked = await request(server).post(`/v1/g/${token}/session`).send({ password }).expect(429);
    expect(locked.body.error.code).toBe('too_many_attempts');
  });

  it('locks the link after 30 failures in an hour from any IPs and tells the photographer', async () => {
    const { token, galleryId, owner } = await sharedGallery();
    await prisma.accessEvent.createMany({
      data: Array.from({ length: 29 }, (_, i) => ({ galleryId, type: 'password_fail' as const, ip: `10.0.0.${i}` })),
    });
    await request(app.getHttpServer()).post(`/v1/g/${token}/session`).send({ password: 'Wrong0000' }).expect(401);
    expect(mail.last(owner.applicant.email)?.subject).toContain('locked');

    const locked = await request(app.getHttpServer()).post(`/v1/g/${token}/session`).send({ password: 'x' }).expect(429);
    expect(locked.body.error.code).toBe('link_locked');

    // A new password clears the lock; the old one stops working.
    const fresh = await owner.agent.post(`/v1/galleries/${galleryId}/password`).set('x-csrf-token', owner.csrf).expect(200);
    await prisma.accessEvent.deleteMany({ where: { galleryId } });
    await request(app.getHttpServer()).post(`/v1/g/${token}/session`).send({ password: fresh.body.password }).expect(200);
  });
});

describe('downloads', () => {
  it('signs a 5-minute URL for the original, writes a receipt and charges the cap once per 10 minutes', async () => {
    const { token, password, galleryId, fileIds } = await sharedGallery();
    const client = await unlockedClient(token, password);

    const first = await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).set('content-type', 'application/json').expect(200);
    expect(first.body.charged).toBe(true);
    const original = await request(app.getHttpServer()).get(localPath(first.body.url)).expect(200);
    expect(original.headers['content-disposition']).toContain('DSC_0001.jpg');
    const file = await prisma.file.findUniqueOrThrow({ where: { id: fileIds[0] } });
    expect(BigInt(original.body.length)).toBe(file.sizeBytes);

    const again = await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).expect(200);
    expect(again.body.charged).toBe(false);
    expect(again.body.receiptId).toBe(first.body.receiptId);

    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.servedBytes).toBe(file.sizeBytes);
    const receipts = await prisma.downloadReceipt.findMany({ where: { galleryId } });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.ip).toBeTruthy();
  });

  it('closes the link when twice the gallery size has been downloaded', async () => {
    const { token, password, galleryId, fileIds } = await sharedGallery();
    const client = await unlockedClient(token, password);
    const downloadAll = async () => {
      for (const id of fileIds) await client.post(`/v1/g/${token}/files/${id}/download`).expect(200);
    };
    await downloadAll();
    // Step past the 10-minute repeat window, then download everything a second time.
    await prisma.downloadReceipt.updateMany({ where: { galleryId }, data: { createdAt: new Date(Date.now() - 11 * MINUTE) } });
    await downloadAll();

    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.servedBytes).toBe(gallery.capBytes);
    expect([gallery.state, gallery.closedReason]).toEqual(['closed', 'cap_used']);
    const after = await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).expect(409);
    expect(after.body.error.code).toBe('gallery_closed');
    const summary = await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200);
    expect(summary.body.state).toBe('closed');
  });

  it('tells the client how much is left when a file would go over the cap', async () => {
    const { token, password, galleryId, fileIds } = await sharedGallery();
    await prisma.gallery.update({ where: { id: galleryId }, data: { capBytes: 10n } });
    const client = await unlockedClient(token, password);
    const res = await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).expect(409);
    expect(res.body.error).toMatchObject({ code: 'cap_reached', details: { remainingBytes: '10' } });
  });

  it('pauses a gallery that serves more than 50 GB in an hour', async () => {
    const { token, password, galleryId, fileIds, owner } = await sharedGallery();
    await prisma.downloadReceipt.create({
      data: { galleryId, fileId: fileIds[1]!, bytes: 50n * 1024n ** 3n, sessionId: 'earlier-session' },
    });
    const client = await unlockedClient(token, password);
    const res = await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).expect(503);
    expect(res.body.error.code).toBe('temporarily_unavailable');
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.suspended).toBe(true);
    expect(mail.last(owner.applicant.email)?.subject).toContain('paused');
    const summary = await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200);
    expect(summary.body.state).toBe('unavailable');
  });

  it("shows the photographer who opened and downloaded, and accepts abuse reports", async () => {
    const { token, password, galleryId, fileIds, owner } = await sharedGallery();
    const client = await unlockedClient(token, password);
    await client.get(`/v1/g/${token}/content`).expect(200);
    await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).expect(200);

    const activity = await owner.agent.get(`/v1/galleries/${galleryId}/activity`).expect(200);
    expect(activity.body.accesses.map((a: { type: string }) => a.type)).toEqual(expect.arrayContaining(['open', 'password_ok']));
    expect(activity.body.receipts[0]).toMatchObject({ fileName: 'DSC_0001.jpg', deviceType: 'unknown' });
    expect(activity.body.receipts[0].ip).toBeUndefined();

    await request(app.getHttpServer()).post(`/v1/g/${token}/report`).send({ reason: 'These are my photos, shared without consent.' }).expect(202);
    expect(await prisma.abuseReport.count({ where: { galleryId } })).toBe(1);
  });
});

describe('lifecycle', () => {
  it('closes at expiry, purges files after closing, and anonymises after 12 months', async () => {
    const { token, password, galleryId, fileIds } = await sharedGallery();
    const client = await unlockedClient(token, password);
    await client.post(`/v1/g/${token}/files/${fileIds[0]}/download`).expect(200);
    const lifecycle = app.get(LifecycleService);

    await prisma.gallery.update({ where: { id: galleryId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await lifecycle.tick();
    let gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect([gallery.state, gallery.closedReason]).toEqual(['closed', 'expired']);
    const summary = await request(app.getHttpServer()).get(`/v1/g/${token}`).expect(200);
    expect(summary.body.state).toBe('closed');

    // Files survive a short grace period, then the purge deletes them.
    const file = await prisma.file.findUniqueOrThrow({ where: { id: fileIds[0] } });
    expect(await storage.headObject(file.originalKey)).not.toBeNull();
    await prisma.gallery.update({ where: { id: galleryId }, data: { closedAt: new Date(Date.now() - 2 * 60 * MINUTE) } });
    await lifecycle.tick();
    gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.state).toBe('purged');
    expect(await storage.headObject(file.originalKey)).toBeNull();
    expect(await storage.headObject(file.previewKey!)).toBeNull();
    expect(await prisma.file.count({ where: { galleryId, status: { not: 'purged' } } })).toBe(0);
    expect(await prisma.downloadReceipt.count({ where: { galleryId } })).toBe(1); // proof is kept

    await prisma.gallery.update({ where: { id: galleryId }, data: { closedAt: new Date(Date.now() - 370 * 24 * 60 * MINUTE) } });
    await lifecycle.tick();
    gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.state).toBe('anonymised');
    expect([gallery.clientName, gallery.clientPhone]).toEqual([null, null]);
    const receipt = await prisma.downloadReceipt.findFirstOrThrow({ where: { galleryId } });
    expect(receipt.ip).toBeNull();
  });

  it('removes abandoned uploads and drafts left for 14 days', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const { fileId } = await upload(app, owner, galleryId, 'never-finished.jpg', await photo(300, 200));
    await prisma.file.update({ where: { id: fileId }, data: { createdAt: new Date(Date.now() - 25 * 60 * MINUTE) } });
    await prisma.gallery.update({ where: { id: galleryId }, data: { createdAt: new Date(Date.now() - 15 * 24 * 60 * MINUTE) } });

    const result = await app.get(LifecycleService).tick();
    expect(result.abandonedUploads).toBeGreaterThanOrEqual(1);
    expect(await prisma.file.findUnique({ where: { id: fileId } })).toBeNull();
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect([gallery.state, gallery.closedReason]).toEqual(['purged', 'draft_expired']);
  });
});
