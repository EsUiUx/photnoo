import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { FileProcessorService } from '../src/media/file-processor.service';
import { localPath, type signUp } from './helpers';

type Session = Awaited<ReturnType<typeof signUp>>;
type Part = { partNumber: number; etag: string };

export async function newGallery(session: Session, name = 'Sara & Omar wedding') {
  const res = await session.agent
    .post('/v1/galleries')
    .set('x-csrf-token', session.csrf)
    .send({ name, clientName: 'Sara', clientPhone: '+201012345678' })
    .expect(201);
  return res.body.id as string;
}

/** Runs the browser side of a multipart upload: start, sign, PUT each part (not complete). */
export async function upload(
  app: INestApplication,
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
  const signed = await session.agent
    .post(`/v1/uploads/${fileId}/parts`)
    .set('x-csrf-token', session.csrf)
    .send({ partNumbers: Array.from({ length: partCount }, (_, i) => i + 1) })
    .expect(200);

  const parts: Part[] = [];
  for (const { partNumber, url } of signed.body.parts as Array<{ partNumber: number; url: string }>) {
    if (options.stopAfterParts !== undefined && parts.length >= options.stopAfterParts) break;
    const put = await request(app.getHttpServer())
      .put(localPath(url))
      .set('content-type', 'application/octet-stream')
      .send(body.subarray((partNumber - 1) * partSize, partNumber * partSize))
      .expect(200);
    parts.push({ partNumber, etag: put.headers.etag as string });
  }
  return { fileId, parts, partCount };
}

export function complete(agent: TestAgent, csrf: string, fileId: string, parts: Part[]) {
  return agent.post(`/v1/uploads/${fileId}/complete`).set('x-csrf-token', csrf).send({ parts });
}

export function photo(width: number, height: number, orientation = 1) {
  return sharp({ create: { width, height, channels: 3, background: '#6a8f6b' } })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation, exif: { IFD0: { Artist: 'Private Artist Name', Copyright: 'Secret' } } })
    .toBuffer();
}

/** Upload, complete and process files, so the gallery is ready to share. Returns the file ids. */
export async function readyFiles(app: INestApplication, session: Session, galleryId: string, files: Array<[string, Buffer]>) {
  const ids: string[] = [];
  for (const [name, body] of files) {
    const { fileId, parts } = await upload(app, session, galleryId, name, body);
    await complete(session.agent, session.csrf, fileId, parts).expect(200);
    await app.get(FileProcessorService).process(fileId);
    ids.push(fileId);
  }
  return ids;
}
