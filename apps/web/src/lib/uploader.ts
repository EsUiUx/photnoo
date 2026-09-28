import { api, ApiError } from './api';

/**
 * Direct-to-storage multipart uploader (PRD P-06).
 *
 * The API decides everything (allowance, file type, part size) and signs one URL per part;
 * this module only slices the file, PUTs the parts in parallel with retries, and completes.
 * Interrupted uploads resume: if the same file is added again to the same gallery, the parts
 * already stored are skipped (the upload id is remembered in localStorage for 24 hours).
 */

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

export type UploadItem = {
  key: string;
  name: string;
  size: number;
  galleryId: string;
  folderId?: string;
  status: UploadStatus;
  uploadedBytes: number;
  error?: { code: string; message: string };
};

export type UploadSnapshot = {
  items: UploadItem[];
  totalBytes: number;
  uploadedBytes: number;
  bytesPerSecond: number;
  secondsLeft: number | null;
  active: boolean;
};

type Started = { fileId: string; partSize: number; partCount: number };
type Part = { partNumber: number; etag: string };

const FILES_IN_PARALLEL = 3;
const PARTS_IN_PARALLEL = 2;
const MAX_RETRIES = 5;
const SIGN_BATCH = 100;
const RESUME_TTL_MS = 24 * 60 * 60 * 1000;

function resumeKey(galleryId: string, file: File) {
  return `photnoo.upload:${galleryId}:${file.name}:${file.size}:${file.lastModified}`;
}

function remember(key: string, value: Started | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }));
    else localStorage.removeItem(key);
  } catch {
    // Private mode or storage full: resume is a convenience, uploads still work.
  }
}

function recall(key: string): Started | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Started & { at: number };
    return Date.now() - saved.at < RESUME_TTL_MS ? saved : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function waitUntilOnline(): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('online', () => resolve(), { once: true }));
}

/** PUT one part with upload progress. Resolves with the ETag storage returned. */
function putPart(url: string, body: Blob, onProgress: (loaded: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      const etag = xhr.getResponseHeader('ETag');
      if (xhr.status >= 200 && xhr.status < 300 && etag) resolve(etag);
      else reject(new Error(`part_failed_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

export class Uploader {
  private items = new Map<string, UploadItem & { file: File; controller: AbortController }>();
  private listeners = new Set<(snapshot: UploadSnapshot) => void>();
  private running = 0;
  private speedSamples: Array<{ at: number; bytes: number }> = [];
  private onFileDone?: (galleryId: string) => void;

  constructor(options: { onFileDone?: (galleryId: string) => void } = {}) {
    this.onFileDone = options.onFileDone;
  }

  subscribe(listener: (snapshot: UploadSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  add(galleryId: string, files: File[], folderId?: string) {
    for (const file of files) {
      const key = `${galleryId}:${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`;
      this.items.set(key, {
        key,
        file,
        name: file.name,
        size: file.size,
        galleryId,
        folderId,
        status: 'queued',
        uploadedBytes: 0,
        controller: new AbortController(),
      });
    }
    this.emit();
    this.pump();
  }

  cancel(key: string) {
    const item = this.items.get(key);
    if (!item || item.status === 'done') return;
    item.controller.abort();
    item.status = 'cancelled';
    this.emit();
  }

  retry(key: string) {
    const item = this.items.get(key);
    if (!item || (item.status !== 'error' && item.status !== 'cancelled')) return;
    item.status = 'queued';
    item.error = undefined;
    item.controller = new AbortController();
    this.emit();
    this.pump();
  }

  clearFinished() {
    for (const [key, item] of this.items) if (item.status === 'done' || item.status === 'cancelled') this.items.delete(key);
    this.emit();
  }

  private pump() {
    while (this.running < FILES_IN_PARALLEL) {
      const next = [...this.items.values()].find((item) => item.status === 'queued');
      if (!next) return;
      this.running += 1;
      next.status = 'uploading';
      this.emit();
      void this.upload(next).finally(() => {
        this.running -= 1;
        this.pump();
        this.emit();
      });
    }
  }

  private async upload(item: UploadItem & { file: File; controller: AbortController }) {
    const signal = item.controller.signal;
    const storeKey = resumeKey(item.galleryId, item.file);
    try {
      let started = recall(storeKey);
      let done: Part[] = [];
      if (started) {
        try {
          done = (await api<{ parts: Part[] }>(`/v1/uploads/${started.fileId}/parts`)).parts;
        } catch {
          started = null; // the server no longer knows this upload; start over
        }
      }
      if (!started) {
        started = await api<Started>(`/v1/galleries/${item.galleryId}/uploads`, {
          body: { name: item.file.name, size: item.file.size, type: item.file.type || undefined, folderId: item.folderId },
        });
        remember(storeKey, started);
      }
      const { fileId, partSize, partCount } = started;

      const finished = new Map(done.map((p) => [p.partNumber, p.etag]));
      const progress = new Map<number, number>();
      for (const n of finished.keys()) progress.set(n, Math.min(partSize, item.file.size - (n - 1) * partSize));
      const report = () => {
        const before = item.uploadedBytes;
        item.uploadedBytes = [...progress.values()].reduce((a, b) => a + b, 0);
        this.sample(item.uploadedBytes - before);
        this.emit();
      };
      report();

      const pending = Array.from({ length: partCount }, (_, i) => i + 1).filter((n) => !finished.has(n));
      const urls = new Map<number, string>();
      for (let i = 0; i < pending.length; i += SIGN_BATCH) {
        const batch = pending.slice(i, i + SIGN_BATCH);
        const signed = await api<{ parts: Array<{ partNumber: number; url: string }> }>(`/v1/uploads/${fileId}/parts`, {
          body: { partNumbers: batch },
        });
        for (const p of signed.parts) urls.set(p.partNumber, p.url);
      }

      const queue = [...pending];
      const worker = async () => {
        for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
          const partNumber = n;
          const blob = item.file.slice((partNumber - 1) * partSize, partNumber * partSize);
          for (let attempt = 0; ; attempt += 1) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            try {
              await waitUntilOnline();
              const etag = await putPart(urls.get(partNumber)!, blob, (loaded) => {
                progress.set(partNumber, loaded);
                report();
              }, signal);
              finished.set(partNumber, etag);
              progress.set(partNumber, blob.size);
              report();
              break;
            } catch (err) {
              if ((err as Error).name === 'AbortError' || attempt >= MAX_RETRIES) throw err;
              progress.set(partNumber, 0);
              report();
              await sleep(1000 * 2 ** attempt);
            }
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARTS_IN_PARALLEL, pending.length) }, worker));

      await api(`/v1/uploads/${fileId}/complete`, {
        body: { parts: [...finished].map(([partNumber, etag]) => ({ partNumber, etag })) },
      });
      remember(storeKey, null);
      item.status = 'done';
      item.uploadedBytes = item.file.size;
      this.onFileDone?.(item.galleryId);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        item.status = 'cancelled';
        return;
      }
      item.status = 'error';
      item.error =
        err instanceof ApiError
          ? { code: err.code, message: err.message }
          : { code: 'upload_failed', message: (err as Error).message };
      // Allowance, type and size errors will not fix themselves; forget the upload.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) remember(storeKey, null);
    }
  }

  private sample(bytes: number) {
    const now = Date.now();
    if (bytes > 0) this.speedSamples.push({ at: now, bytes });
    this.speedSamples = this.speedSamples.filter((s) => now - s.at < 8000);
  }

  snapshot(): UploadSnapshot {
    const items: UploadItem[] = [...this.items.values()].map((item) => ({
      key: item.key,
      name: item.name,
      size: item.size,
      galleryId: item.galleryId,
      folderId: item.folderId,
      status: item.status,
      uploadedBytes: item.uploadedBytes,
      error: item.error,
    }));
    const live = items.filter((i) => i.status !== 'cancelled');
    const totalBytes = live.reduce((a, i) => a + i.size, 0);
    const uploadedBytes = live.reduce((a, i) => a + i.uploadedBytes, 0);
    const now = Date.now();
    const recent = this.speedSamples.filter((s) => now - s.at < 8000);
    const windowSeconds = recent.length > 0 ? Math.max(1, (now - recent[0]!.at) / 1000) : 1;
    const bytesPerSecond = recent.reduce((a, s) => a + s.bytes, 0) / windowSeconds;
    const active = items.some((i) => i.status === 'uploading' || i.status === 'queued');
    const secondsLeft = active && bytesPerSecond > 0 ? Math.ceil((totalBytes - uploadedBytes) / bytesPerSecond) : null;
    return { items, totalBytes, uploadedBytes, bytesPerSecond: active ? bytesPerSecond : 0, secondsLeft, active };
  }

  private emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
