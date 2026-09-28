import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import type { Env } from '../config/env';
import { attachmentDisposition, type CompletedPart, type Storage } from './storage';

/** Cloudflare R2 in staging/production, MinIO when running with Docker locally. */
export class S3Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    this.bucket = env.S3_BUCKET!;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    });
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    );
    if (!result.UploadId) throw new Error('Storage did not return an upload id');
    return result.UploadId;
  }

  signUploadPart(key: string, uploadId: string, partNumber: number, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
      { expiresIn: ttlSeconds },
    );
  }

  async listParts(key: string, uploadId: string): Promise<CompletedPart[]> {
    const parts: CompletedPart[] = [];
    let marker: string | undefined;
    do {
      const page = await this.client.send(
        new ListPartsCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }),
      );
      for (const part of page.Parts ?? []) {
        if (part.PartNumber && part.ETag) parts.push({ partNumber: part.PartNumber, etag: part.ETag });
      }
      marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (marker);
    return parts;
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: CompletedPart[]): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
  }

  async headObject(key: string): Promise<number | null> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return head.ContentLength ?? 0;
    } catch (err) {
      if ((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async getObjectStream(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return result.Body as Readable;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  signDownload(key: string, ttlSeconds: number, fileName?: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: fileName ? attachmentDisposition(fileName) : undefined,
      }),
      { expiresIn: ttlSeconds },
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      if (batch.length === 0) continue;
      await this.client.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }),
      );
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      await this.deleteObjects((page.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : [])));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}
