import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { hmac, safeEqual } from '../common/crypto';
import type { Env } from '../config/env';
import type { CompletedPart, Storage } from './storage';

export type LocalSignedRequest =
  | { action: 'part'; key: string; uploadId: string; partNumber: number }
  | { action: 'get'; key: string; fileName?: string };

/**
 * Filesystem stand-in for R2, for development and tests without Docker. Signed URLs point at
 * LocalStorageController on the API, which verifies the HMAC signature and expiry.
 * Never used in production (enforced in env validation).
 */
export class LocalStorage implements Storage {
  private readonly root: string;
  private readonly secret: string;

  constructor(private readonly env: Env) {
    this.root = resolve(env.LOCAL_STORAGE_DIR);
    this.secret = hmac(env.JWT_ACCESS_SECRET, 'local-storage');
  }

  private path(key: string): string {
    const full = resolve(this.root, 'objects', key);
    if (!full.startsWith(join(this.root, 'objects') + sep)) throw new Error('Invalid storage key');
    return full;
  }

  private uploadDir(uploadId: string): string {
    if (!/^[0-9a-f-]{36}$/.test(uploadId)) throw new Error('Invalid upload id');
    return join(this.root, 'uploads', uploadId);
  }

  // ---------- signing ----------

  private sign(params: Record<string, string>): string {
    const query = new URLSearchParams(params);
    query.sort();
    query.set('sig', hmac(this.secret, query.toString()));
    return query.toString();
  }

  /** Validates a signed query string; returns the request it authorises, or null. */
  verify(query: Record<string, string | undefined>): LocalSignedRequest | null {
    const { sig, ...rest } = query;
    if (!sig) return null;
    const params = new URLSearchParams(Object.entries(rest).filter((e): e is [string, string] => typeof e[1] === 'string'));
    params.sort();
    if (!safeEqual(sig, hmac(this.secret, params.toString()))) return null;
    if (Number(rest.exp) < Date.now() / 1000) return null;
    if (rest.action === 'part' && rest.key && rest.uploadId && rest.part) {
      return { action: 'part', key: rest.key, uploadId: rest.uploadId, partNumber: Number(rest.part) };
    }
    if (rest.action === 'get' && rest.key) return { action: 'get', key: rest.key, fileName: rest.name };
    return null;
  }

  private url(params: Record<string, string>, ttlSeconds: number): string {
    const exp = String(Math.floor(Date.now() / 1000) + ttlSeconds);
    return `${this.env.PUBLIC_API_URL}/v1/local-storage?${this.sign({ ...params, exp })}`;
  }

  // ---------- multipart ----------

  async createMultipartUpload(key: string): Promise<string> {
    const uploadId = randomUUID();
    await mkdir(this.uploadDir(uploadId), { recursive: true });
    await writeFile(join(this.uploadDir(uploadId), 'key'), key);
    return uploadId;
  }

  async signUploadPart(key: string, uploadId: string, partNumber: number, ttlSeconds: number): Promise<string> {
    return this.url({ action: 'part', key, uploadId, part: String(partNumber) }, ttlSeconds);
  }

  /** Called by LocalStorageController with the request body. Returns the part's ETag. */
  async writePart(key: string, uploadId: string, partNumber: number, body: Readable): Promise<string> {
    const dir = this.uploadDir(uploadId);
    if ((await readFile(join(dir, 'key'), 'utf8')) !== key) throw new Error('Upload does not match key');
    const file = join(dir, `part-${String(partNumber).padStart(5, '0')}`);
    const hash = createHash('md5');
    body.on('data', (chunk: Buffer) => hash.update(chunk));
    await pipeline(body, createWriteStream(file));
    const etag = `"${hash.digest('hex')}"`;
    await writeFile(`${file}.etag`, etag);
    return etag;
  }

  async listParts(_key: string, uploadId: string): Promise<CompletedPart[]> {
    const dir = this.uploadDir(uploadId);
    const names = (await readdir(dir).catch(() => [])).filter((n) => /^part-\d{5}$/.test(n)).sort();
    return Promise.all(
      names.map(async (name) => ({
        partNumber: Number(name.slice(5)),
        etag: await readFile(join(dir, `${name}.etag`), 'utf8'),
      })),
    );
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void> {
    const dir = this.uploadDir(uploadId);
    const stored = new Map((await this.listParts(key, uploadId)).map((p) => [p.partNumber, p.etag]));
    const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    for (const part of ordered) {
      if (stored.get(part.partNumber) !== part.etag) throw new Error(`Part ${part.partNumber} does not match`);
    }
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const out = createWriteStream(target);
    for (const part of ordered) {
      await pipeline(createReadStream(join(dir, `part-${String(part.partNumber).padStart(5, '0')}`)), out, { end: false });
    }
    await new Promise<void>((done, fail) => out.end((err?: Error | null) => (err ? fail(err) : done())));
    await rm(dir, { recursive: true, force: true });
  }

  async abortMultipartUpload(_key: string, uploadId: string): Promise<void> {
    await rm(this.uploadDir(uploadId), { recursive: true, force: true });
  }

  // ---------- objects ----------

  async headObject(key: string): Promise<number | null> {
    try {
      return (await stat(this.path(key))).size;
    } catch {
      return null;
    }
  }

  async getObjectStream(key: string): Promise<Readable> {
    await stat(this.path(key));
    return createReadStream(this.path(key));
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async signDownload(key: string, ttlSeconds: number, fileName?: string): Promise<string> {
    return this.url({ action: 'get', key, ...(fileName ? { name: fileName } : {}) }, ttlSeconds);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.path(key), { force: true })));
  }

  async deletePrefix(prefix: string): Promise<void> {
    const target = resolve(this.root, 'objects', prefix);
    if (!target.startsWith(join(this.root, 'objects') + sep)) throw new Error('Invalid prefix');
    await rm(target, { recursive: true, force: true });
  }
}
