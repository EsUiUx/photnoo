import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeliveryRules, fileExtension, isPreviewable } from '@photnoo/shared';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { objectKeys, STORAGE, type Storage } from '../storage/storage';
import { matchesExtension, MIME, sniff } from './file-sniff';

/** Images above this size are hashed but not previewed, to bound worker memory. */
const MAX_PREVIEW_SOURCE_BYTES = 200 * 1024 ** 2;

class RejectFile extends Error {}

/**
 * Background step after every completed upload ("file.process" job):
 * checks the real file type, stores a SHA-256, and makes the single web preview (PRD P-08, 4).
 * A bad file is rejected once and its bytes refunded; storage errors throw so the job retries.
 */
@Injectable()
export class FileProcessorService {
  private readonly logger = new Logger(FileProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  async process(fileId: string): Promise<void> {
    const file = await this.prisma.client.file.findUnique({ where: { id: fileId } });
    if (!file || file.status !== 'processing') return; // already done, rejected or purged

    const extension = fileExtension(file.originalName);
    const wantsPreview = isPreviewable(file.originalName) && file.sizeBytes <= BigInt(MAX_PREVIEW_SOURCE_BYTES);

    const hash = createHash('sha256');
    const chunks: Buffer[] = [];
    let head = Buffer.alloc(0);
    const stream = await this.storage.getObjectStream(file.originalKey);
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      hash.update(chunk);
      if (head.length < 64) head = Buffer.concat([head, chunk]).subarray(0, 64);
      if (wantsPreview) chunks.push(chunk);
    }

    try {
      const sniffed = sniff(head);
      if (!matchesExtension(extension, sniffed)) {
        throw new RejectFile(`Content is ${sniffed}, not .${extension}`);
      }
      const update: Parameters<typeof this.prisma.client.file.update>[0]['data'] = {
        sha256: hash.digest('hex'),
        mimeType: MIME[sniffed] ?? 'application/octet-stream',
        status: 'ready',
      };
      if (wantsPreview) Object.assign(update, await this.makePreview(file.galleryId, file.id, Buffer.concat(chunks)));
      await this.prisma.client.file.update({ where: { id: file.id }, data: update });
    } catch (err) {
      if (!(err instanceof RejectFile)) throw err;
      await this.reject(file.id, err.message);
    }
    await this.notifyIfGalleryReady(file.galleryId);
  }

  /** "Gallery ready" once the last file of an upload batch is processed. */
  private async notifyIfGalleryReady(galleryId: string): Promise<void> {
    const [pending, gallery] = await Promise.all([
      this.prisma.client.file.count({ where: { galleryId, status: { in: ['uploading', 'processing'] } } }),
      this.prisma.client.gallery.findUnique({ where: { id: galleryId }, select: { name: true, photographerId: true, state: true } }),
    ]);
    if (pending > 0 || !gallery || (gallery.state !== 'draft' && gallery.state !== 'active')) return;
    const ready = await this.prisma.client.file.count({ where: { galleryId, status: 'ready' } });
    if (ready === 0) return;
    // One notice per gallery per day; later batches that day update its photo count.
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
    await this.notifications.notifyOrRefresh(gallery.photographerId, {
      type: 'gallery_ready',
      galleryId,
      dedupeKey: `ready:${galleryId}:${day}`,
      data: { gallery: gallery.name, files: ready },
    });
  }

  private async makePreview(galleryId: string, fileId: string, source: Buffer) {
    let image: sharp.Sharp;
    let metadata: sharp.Metadata;
    try {
      image = sharp(source, { failOn: 'error' });
      metadata = await image.metadata();
    } catch {
      throw new RejectFile('Image is corrupt or unreadable');
    }
    // EXIF orientations 5-8 swap width and height.
    const rotated = (metadata.orientation ?? 1) >= 5;
    const width = rotated ? metadata.height : metadata.width;
    const height = rotated ? metadata.width : metadata.height;

    // rotate() applies EXIF orientation; sharp strips all other metadata (EXIF, GPS) by default.
    const preview = await image
      .clone()
      .rotate()
      .resize({ width: DeliveryRules.previewMaxPixels, height: DeliveryRules.previewMaxPixels, fit: 'inside', withoutEnlargement: true })
      .toColourspace('srgb')
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    const blur = await image.clone().rotate().resize(16, 16, { fit: 'inside' }).jpeg({ quality: 50 }).toBuffer();

    const previewKey = objectKeys.preview(galleryId, fileId);
    await this.storage.putObject(previewKey, preview, 'image/jpeg');
    return {
      previewKey,
      width: width ?? null,
      height: height ?? null,
      blurDataUrl: `data:image/jpeg;base64,${blur.toString('base64')}`,
    };
  }

  /** Mark the file rejected, take it out of the gallery totals and give the bytes back. */
  private async reject(fileId: string, reason: string): Promise<void> {
    const file = await this.prisma.client.$transaction(async (tx) => {
      const claimed = await tx.file.updateMany({
        where: { id: fileId, status: 'processing' },
        data: { status: 'rejected', rejectReason: reason },
      });
      if (claimed.count !== 1) return null;
      const row = await tx.file.findUniqueOrThrow({ where: { id: fileId }, include: { gallery: true } });
      await tx.gallery.update({
        where: { id: row.galleryId },
        data: { totalBytes: { decrement: row.sizeBytes }, fileCount: { decrement: 1 } },
      });
      await tx.$executeRaw`
        UPDATE "Subscription" SET "usedBytes" = GREATEST("usedBytes" - ${row.sizeBytes}, 0)
        WHERE id = (SELECT id FROM "Subscription" WHERE "photographerId" = ${row.gallery.photographerId}::uuid
                    ORDER BY "createdAt" DESC LIMIT 1)`;
      return row;
    });
    if (file) {
      await this.storage.deleteObjects([file.originalKey]);
      this.logger.warn({ fileId, reason }, 'File rejected');
    }
  }
}
