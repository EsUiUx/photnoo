import type { Readable } from 'node:stream';

export type CompletedPart = { partNumber: number; etag: string };

/**
 * Object storage used for originals and previews. The API never proxies file bytes in
 * production: browsers upload and download directly with short-lived signed URLs (PRD 5).
 */
export interface Storage {
  createMultipartUpload(key: string, contentType: string): Promise<string>;
  signUploadPart(key: string, uploadId: string, partNumber: number, ttlSeconds: number): Promise<string>;
  listParts(key: string, uploadId: string): Promise<CompletedPart[]>;
  completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
  /** Size in bytes, or null when the object does not exist. */
  headObject(key: string): Promise<number | null>;
  getObjectStream(key: string): Promise<Readable>;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  signDownload(key: string, ttlSeconds: number, fileName?: string): Promise<string>;
  deleteObjects(keys: string[]): Promise<void>;
  /** Delete everything under a prefix (a whole gallery at purge). */
  deletePrefix(prefix: string): Promise<void>;
}

export const STORAGE = Symbol('STORAGE');

/** Object keys group by gallery so a purge is one prefix delete. */
export const objectKeys = {
  gallery: (galleryId: string) => `galleries/${galleryId}/`,
  original: (galleryId: string, fileId: string) => `galleries/${galleryId}/originals/${fileId}`,
  preview: (galleryId: string, fileId: string) => `galleries/${galleryId}/previews/${fileId}.jpg`,
};

/** Content-Disposition value that keeps non-ASCII (Arabic) file names intact. */
export function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
