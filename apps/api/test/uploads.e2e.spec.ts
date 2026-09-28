import type { INestApplication } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { FileProcessorService } from '../src/media/file-processor.service';
import { STORAGE, type Storage } from '../src/storage/storage';
import { createTestApp, type FakeJobs } from './app';
import { localPath, signUp } from './helpers';

type Prisma = Awaited<ReturnType<typeof createTestApp>>['prisma'];
type Session = Awaited<ReturnType<typeof signUp>>;

let app: INestApplication;
let prisma: Prisma;
let jobs: FakeJobs;
let storage: Storage;

beforeAll(async () => {
  ({ app, prisma, jobs } = await createTestApp());
  storage = app.get(STORAGE);
});

afterAll(async () => {
  await app.close();
});

async function newGallery(session: Session, name = 'Sara & Omar wedding') {
  const res = await session.agent
    .post('/v1/galleries')
    .set('x-csrf-token', session.csrf)
    .send({ name, clientName: 'Sara', clientPhone: '+201012345678' })
    .expect(201);
  return res.body.id as string;
}

/** Runs the whole browser side of a multipart upload: start, sign, PUT each part, complete. */
async function upload(
  session: Session,
  galleryId: string,
  name: string,
  body: Buffer,
  options: { stopAfterParts?: number; folderId?: string } = {},
) {
  const started = await session.agent
    .post(`/v1/galleries/${galleryId}/uploads`)
    .set('x-csrf-token', session.csrf)
    .send({ name, size: body.length, folderId: options.folderId })
    .expect(201);
  const { fileId, partSize, partCount } = started.body as { fileId: string; partSize: number; partCount: number };
  const numbers = Array.from({ length: partCount }, (_, i) => i + 1);
  const signed = await session.agent
    .post(`/v1/uploads/${fileId}/parts`)
    .set('x-csrf-token', session.csrf)
    .send({ partNumbers: numbers })
    .expect(200);

  const parts: Array<{ partNumber: number; etag: string }> = [];
  for (const { partNumber, url } of signed.body.parts as Array<{ partNumber: number; url: string }>) {
    if (options.stopAfterParts !== undefined && parts.length >= options.stopAfterParts) break;
    const slice = body.subarray((partNumber - 1) * partSize, partNumber * partSize);
    const put = await request(app.getHttpServer())
      .put(localPath(url))
      .set('content-type', 'application/octet-stream')
      .send(slice)
      .expect(200);
    parts.push({ partNumber, etag: put.headers.etag as string });
  }
  return { fileId, parts, partCount };
}

function complete(agent: TestAgent, csrf: string, fileId: string, parts: Array<{ partNumber: number; etag: string }>) {
  return agent.post(`/v1/uploads/${fileId}/complete`).set('x-csrf-token', csrf).send({ parts });
}

async function photo(width: number, height: number, orientation = 1) {
  return sharp({ create: { width, height, channels: 3, background: '#6a8f6b' } })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation, exif: { IFD0: { Artist: 'Private Artist Name', Copyright: 'Secret' } } })
    .toBuffer();
}

async function readObject(key: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of (await storage.getObjectStream(key)) as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

describe('galleries', () => {
  it('creates, lists and shows a gallery only to its owner', async () => {
    const owner = await signUp(app, prisma);
    const stranger = await signUp(app, prisma);
    const id = await newGallery(owner);

    const list = await owner.agent.get('/v1/galleries').expect(200);
    expect(list.body.items.map((g: { id: string }) => g.id)).toContain(id);
    const detail = await owner.agent.get(`/v1/galleries/${id}`).expect(200);
    expect(detail.body).toMatchObject({ state: 'draft', totalBytes: '0', fileCount: 0, folders: [], files: [] });

    await stranger.agent.get(`/v1/galleries/${id}`).expect(404);
    const strangerList = await stranger.agent.get('/v1/galleries').expect(200);
    expect(strangerList.body.items).toHaveLength(0);
    await owner.agent.get('/v1/galleries/not-a-uuid').expect(400);
  });

  it('creates folders with unique names', async () => {
    const owner = await signUp(app, prisma);
    const id = await newGallery(owner);
    await owner.agent.post(`/v1/galleries/${id}/folders`).set('x-csrf-token', owner.csrf).send({ name: 'Ceremony' }).expect(201);
    const dup = await owner.agent
      .post(`/v1/galleries/${id}/folders`)
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'Ceremony' })
      .expect(409);
    expect(dup.body.error.code).toBe('folder_exists');
  });
});

describe('uploads', () => {
  it('uploads a JPEG, charges the allowance and makes a clean, rotated preview', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const image = await photo(3000, 2000, 6); // EXIF orientation 6 = portrait when displayed

    const { fileId, parts } = await upload(owner, galleryId, 'DSC_0001.jpg', image);
    const done = await complete(owner.agent, owner.csrf, fileId, parts).expect(200);
    expect(done.body.status).toBe('processing');
    expect(jobs.sent).toContainEqual({ name: 'file.process', data: { fileId } });

    const subscription = await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } });
    expect(subscription.usedBytes).toBe(BigInt(image.length));
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.totalBytes).toBe(BigInt(image.length));
    expect(gallery.capBytes).toBe(BigInt(image.length * 2));
    expect(gallery.fileCount).toBe(1);

    await app.get(FileProcessorService).process(fileId);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: fileId } });
    expect(file.status).toBe('ready');
    expect(file.sha256).toBe(createHash('sha256').update(image).digest('hex'));
    expect([file.width, file.height]).toEqual([2000, 3000]);
    expect(file.blurDataUrl).toMatch(/^data:image\/jpeg;base64,/);

    const preview = await sharp(await readObject(file.previewKey!)).metadata();
    expect([preview.width, preview.height]).toEqual([1067, 1600]);
    expect(preview.exif).toBeUndefined(); // EXIF (artist, GPS, camera) stripped
    expect(preview.orientation).toBeUndefined();
  });

  it('uploads a multi-part file and can resume from the parts already stored', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const zip = Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), randomBytes(21 * 1024 * 1024)]);

    const first = await upload(owner, galleryId, 'all-raws.zip', zip, { stopAfterParts: 2 });
    expect(first.partCount).toBe(3);
    const stored = await owner.agent.get(`/v1/uploads/${first.fileId}/parts`).expect(200);
    expect(stored.body.parts.map((p: { partNumber: number }) => p.partNumber)).toEqual([1, 2]);

    // Resume: sign and send only the missing part, then complete with all three.
    const signed = await owner.agent
      .post(`/v1/uploads/${first.fileId}/parts`)
      .set('x-csrf-token', owner.csrf)
      .send({ partNumbers: [3] })
      .expect(200);
    const last = zip.subarray(2 * 10 * 1024 * 1024);
    const put = await request(app.getHttpServer())
      .put(localPath(signed.body.parts[0].url))
      .set('content-type', 'application/octet-stream')
      .send(last)
      .expect(200);
    await complete(owner.agent, owner.csrf, first.fileId, [
      ...stored.body.parts,
      { partNumber: 3, etag: put.headers.etag },
    ]).expect(200);

    await app.get(FileProcessorService).process(first.fileId);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: first.fileId } });
    expect(file.status).toBe('ready');
    expect(file.mimeType).toBe('application/zip');
    expect(file.previewKey).toBeNull();
  });

  it('rejects a renamed file and refunds its bytes', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const fake = Buffer.from('this is a text file pretending to be a photo');
    const { fileId, parts } = await upload(owner, galleryId, 'holiday.jpg', fake);
    await complete(owner.agent, owner.csrf, fileId, parts).expect(200);

    await app.get(FileProcessorService).process(fileId);
    const file = await prisma.file.findUniqueOrThrow({ where: { id: fileId } });
    expect(file.status).toBe('rejected');
    expect(file.rejectReason).toMatch(/not \.jpg/);
    expect(await storage.headObject(file.originalKey)).toBeNull();
    const subscription = await prisma.subscription.findFirstOrThrow({ where: { photographerId: owner.photographerId } });
    expect(subscription.usedBytes).toBe(0n);
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect([gallery.totalBytes, gallery.fileCount]).toEqual([0n, 0]);
  });

  it('refuses unsupported types and oversized files before issuing any URL', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const video = await owner.agent
      .post(`/v1/galleries/${galleryId}/uploads`)
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'clip.mp4', size: 1000 })
      .expect(400);
    expect(video.body.error.code).toBe('unsupported_type');
    const huge = await owner.agent
      .post(`/v1/galleries/${galleryId}/uploads`)
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'huge.zip', size: 3 * 1024 ** 3 })
      .expect(400);
    expect(huge.body.error.code).toBe('file_too_large');
  });
});

describe('allowance', () => {
  it('needs an active plan', async () => {
    const owner = await signUp(app, prisma, { trial: false });
    const galleryId = await newGallery(owner);
    const res = await owner.agent
      .post(`/v1/galleries/${galleryId}/uploads`)
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'a.jpg', size: 100 })
      .expect(402);
    expect(res.body.error.code).toBe('subscription_inactive');
  });

  it('counts uploads in progress, so parallel uploads cannot exceed the plan', async () => {
    const owner = await signUp(app, prisma);
    await prisma.subscription.updateMany({ where: { photographerId: owner.photographerId }, data: { allowanceBytes: 100_000n } });
    const galleryId = await newGallery(owner);
    const start = (size: number) =>
      owner.agent.post(`/v1/galleries/${galleryId}/uploads`).set('x-csrf-token', owner.csrf).send({ name: 'a.jpg', size });

    await start(60_000).expect(201);
    const second = await start(60_000).expect(402);
    expect(second.body.error.code).toBe('allowance_exceeded');
    expect(second.body.error.details).toEqual({ allowanceBytes: '100000', usedBytes: '0' });
  });

  it('re-checks the allowance atomically at completion', async () => {
    const owner = await signUp(app, prisma);
    await prisma.subscription.updateMany({ where: { photographerId: owner.photographerId }, data: { allowanceBytes: 100_000n } });
    const galleryId = await newGallery(owner);
    const image = await photo(400, 300);
    const { fileId, parts } = await upload(owner, galleryId, 'late.jpg', image);

    // Something else used the allowance while this upload was in flight.
    await prisma.subscription.updateMany({ where: { photographerId: owner.photographerId }, data: { usedBytes: 99_990n } });
    const res = await complete(owner.agent, owner.csrf, fileId, parts).expect(402);
    expect(res.body.error.code).toBe('allowance_exceeded');
    expect(await prisma.file.findUnique({ where: { id: fileId } })).toBeNull();
    const gallery = await prisma.gallery.findUniqueOrThrow({ where: { id: galleryId } });
    expect(gallery.totalBytes).toBe(0n);
  });
});

describe('isolation and signatures', () => {
  it("does not let another photographer touch someone's upload", async () => {
    const owner = await signUp(app, prisma);
    const stranger = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const started = await owner.agent
      .post(`/v1/galleries/${galleryId}/uploads`)
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'a.jpg', size: 1000 })
      .expect(201);
    await stranger.agent
      .post(`/v1/galleries/${galleryId}/uploads`)
      .set('x-csrf-token', stranger.csrf)
      .send({ name: 'b.jpg', size: 1000 })
      .expect(404);
    await stranger.agent
      .post(`/v1/uploads/${started.body.fileId}/parts`)
      .set('x-csrf-token', stranger.csrf)
      .send({ partNumbers: [1] })
      .expect(404);
  });

  it('rejects a tampered storage URL', async () => {
    const owner = await signUp(app, prisma);
    const galleryId = await newGallery(owner);
    const started = await owner.agent
      .post(`/v1/galleries/${galleryId}/uploads`)
      .set('x-csrf-token', owner.csrf)
      .send({ name: 'a.jpg', size: 1000 })
      .expect(201);
    const signed = await owner.agent
      .post(`/v1/uploads/${started.body.fileId}/parts`)
      .set('x-csrf-token', owner.csrf)
      .send({ partNumbers: [1] })
      .expect(200);
    const tampered = localPath(signed.body.parts[0].url).replace('part=1', 'part=2');
    await request(app.getHttpServer()).put(tampered).set('content-type', 'application/octet-stream').send(Buffer.alloc(10)).expect(403);
  });
});
