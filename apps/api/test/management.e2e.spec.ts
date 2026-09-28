import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { STORAGE, type Storage } from '../src/storage/storage';
import { createTestApp } from './app';
import { newGallery, photo, readyFiles } from './gallery-helpers';
import { signUp } from './helpers';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];

let app: INestApplication;
let prisma: Prisma;
let storage: Storage;

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  storage = app.get(STORAGE);
});

afterAll(async () => {
  await app.close();
});

describe('gallery management', () => {
  it('lists with views, downloads, cover and search', async () => {
    const owner = await signUp(app, prisma);
    const wedding = await newGallery(owner, 'Nour wedding');
    await newGallery(owner, 'Karim graduation');
    await readyFiles(app, owner, wedding, [['a.jpg', await photo(800, 600)]]);
    const shared = await owner.agent.post(`/v1/galleries/${wedding}/activate`).set('x-csrf-token', owner.csrf).expect(200);
    const token = new URL(shared.body.link).pathname.split('/g/')[1]!;
    const client = request.agent(app.getHttpServer());
    await client.post(`/v1/g/${token}/session`).send({ password: shared.body.password }).expect(200);
    const content = await client.get(`/v1/g/${token}/content`).expect(200);
    await client.post(`/v1/g/${token}/files/${content.body.files[0].id}/download`).expect(200);

    const list = await owner.agent.get('/v1/galleries').expect(200);
    const row = list.body.items.find((g: { id: string }) => g.id === wedding);
    expect(row).toMatchObject({ views: 1, downloads: 1, state: 'active' });
    expect(row.coverUrl).toMatch(/local-storage/);

    const search = await owner.agent.get('/v1/galleries?q=karim').expect(200);
    expect(search.body.items.map((g: { name: string }) => g.name)).toEqual(['Karim graduation']);
  });

  it('summarises the dashboard', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    await readyFiles(app, owner, id, [['a.jpg', await photo(400, 300)]]);
    await owner.agent.post(`/v1/galleries/${id}/activate`).set('x-csrf-token', owner.csrf).expect(200);
    const res = await owner.agent.get('/v1/dashboard').expect(200);
    expect(res.body).toMatchObject({ clients: 1, activeGalleries: 1, downloads: 0 });
    expect(res.body.storage.state).toBe('trial');
    expect(Number(res.body.storage.usedBytes)).toBeGreaterThan(0);
    expect(res.body.recentGalleries[0].id).toBe(id);
  });

  it('edits details and picks a cover photo from the same gallery only', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    const other = await newGallery(owner, 'Other');
    const [fileId] = await readyFiles(app, owner, id, [['a.jpg', await photo(400, 300)]]);
    const [foreign] = await readyFiles(app, owner, other, [['b.jpg', await photo(400, 300)]]);

    const res = await owner.agent
      .patch(`/v1/galleries/${id}`)
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'Renamed', clientName: 'Laila', coverFileId: fileId })
      .expect(200);
    expect(res.body).toMatchObject({ name: 'Renamed', clientName: 'Laila', coverFileId: fileId });
    await owner.agent.patch(`/v1/galleries/${id}`).set('x-csrf-token', owner.csrf).send({ coverFileId: foreign }).expect(404);
    await owner.agent.patch(`/v1/galleries/${id}`).set('x-csrf-token', owner.csrf).send({}).expect(400);
  });

  it('deletes a photo without refunding its bytes, and a folder without deleting its photos', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    const folder = await owner.agent.post(`/v1/galleries/${id}/folders`).set('x-csrf-token', owner.csrf).send({ name: 'Party' }).expect(201);
    const image = await photo(400, 300);
    const [keep, drop] = await readyFiles(app, owner, id, [
      ['keep.jpg', image],
      ['drop.jpg', image],
    ]);
    await prisma.file.update({ where: { id: keep }, data: { folderId: folder.body.id } });
    const usedBefore = (await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } })).usedBytes;

    const dropped = await prisma.file.findUniqueOrThrow({ where: { id: drop } });
    await owner.agent.delete(`/v1/files/${drop}`).set('x-csrf-token', owner.csrf).expect(204);
    expect(await storage.headObject(dropped.originalKey)).toBeNull();
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id } });
    expect([gallery.fileCount, gallery.totalBytes]).toEqual([1, BigInt(image.length)]);
    const usedAfter = (await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } })).usedBytes;
    expect(usedAfter).toBe(usedBefore);

    await owner.agent.delete(`/v1/folders/${folder.body.id}`).set('x-csrf-token', owner.csrf).expect(204);
    const kept = await prisma.file.findUniqueOrThrow({ where: { id: keep } });
    expect([kept.status, kept.folderId]).toEqual(['ready', null]);
  });

  it('deletes a whole gallery at once and keeps it out of the list', async () => {
    const owner = await signUp(app, prisma);
    const stranger = await signUp(app, prisma);
    const id = await newGallery(owner);
    const [fileId] = await readyFiles(app, owner, id, [['a.jpg', await photo(400, 300)]]);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: fileId } });

    await stranger.agent.delete(`/v1/galleries/${id}`).set('x-csrf-token', stranger.csrf).expect(404);
    await owner.agent.delete(`/v1/galleries/${id}`).set('x-csrf-token', owner.csrf).expect(204);
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id } });
    expect([gallery.state, gallery.closedReason]).toEqual(['purged', 'deleted_by_photographer']);
    expect(await storage.headObject(file.originalKey)).toBeNull();
    const list = await owner.agent.get('/v1/galleries').expect(200);
    expect(list.body.items.map((g: { id: string }) => g.id)).not.toContain(id);
  });
});
