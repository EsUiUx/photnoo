import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CompleteUploadInput,
  type CreateUploadInput,
  DeliveryRules,
  isAcceptedFile,
  partCount,
} from '@photnoo/shared';
import { randomUUID } from 'node:crypto';
import { GalleriesService } from '../galleries/galleries.service';
import { JobsService } from '../jobs/jobs.service';
import { BillingLifecycleService } from '../billing/billing-lifecycle.service';
import { FlagsService } from '../flags/flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { objectKeys, STORAGE, type Storage } from '../storage/storage';

const OPEN_GALLERY_STATES = ['draft', 'active'] as const;

const paymentRequired = (code: string, message: string, details?: Record<string, unknown>) =>
  new HttpException({ code, message, details }, HttpStatus.PAYMENT_REQUIRED);

/**
 * Direct-to-storage multipart uploads (PRD P-06, P-07). The API only checks, signs and records;
 * file bytes go from the browser straight to R2. Allowance is reserved at start and charged
 * atomically at completion, so parallel uploads can never push a photographer over the limit.
 */
@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly galleries: GalleriesService,
    private readonly jobs: JobsService,
    private readonly billing: BillingLifecycleService,
    private readonly flags: FlagsService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  async create(photographerId: string, galleryId: string, input: CreateUploadInput) {
    await this.assertUploadsOpen();
    const gallery = await this.galleries.get(photographerId, galleryId);
    if (!(OPEN_GALLERY_STATES as readonly string[]).includes(gallery.state)) {
      throw new ConflictException({ code: 'gallery_closed', message: 'This gallery no longer accepts uploads.' });
    }
    if (!isAcceptedFile(input.name)) {
      throw new BadRequestException({ code: 'unsupported_type', message: 'This file type is not supported.' });
    }
    if (input.size > DeliveryRules.maxFileBytes) {
      throw new BadRequestException({ code: 'file_too_large', message: 'Files can be up to 2 GB.' });
    }
    if (input.folderId) {
      const folder = await this.prisma.client.folder.findFirst({ where: { id: input.folderId, galleryId } });
      if (!folder) throw new BadRequestException({ code: 'folder_not_found', message: 'Folder not found.' });
    }

    const subscription = await this.currentSubscription(photographerId);
    const reserved = await this.prisma.client.file.aggregate({
      where: { status: 'uploading', gallery: { photographerId } },
      _sum: { sizeBytes: true },
    });
    const size = BigInt(input.size);
    if (subscription.usedBytes + (reserved._sum.sizeBytes ?? 0n) + size > subscription.allowanceBytes) {
      throw this.allowanceExceeded(subscription);
    }

    const fileId = randomUUID();
    const originalKey = objectKeys.original(gallery.id, fileId);
    const uploadId = await this.storage.createMultipartUpload(originalKey, input.type || 'application/octet-stream');
    const position = await this.prisma.client.file.count({ where: { galleryId } });
    await this.prisma.client.file.create({
      data: {
        id: fileId,
        galleryId,
        folderId: input.folderId ?? null,
        originalName: input.name,
        sizeBytes: size,
        originalKey,
        uploadId,
        status: 'uploading',
        position,
      },
    });
    return { fileId, partSize: DeliveryRules.uploadPartBytes, partCount: partCount(input.size) };
  }

  async signParts(photographerId: string, fileId: string, partNumbers: number[]) {
    const file = await this.uploading(photographerId, fileId);
    const max = partCount(Number(file.sizeBytes));
    if (partNumbers.some((n) => n > max)) {
      throw new BadRequestException({ code: 'invalid_part', message: `This file has ${max} parts.` });
    }
    const urls = await Promise.all(
      partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await this.storage.signUploadPart(file.originalKey, file.uploadId!, partNumber, DeliveryRules.uploadUrlTtlSeconds),
      })),
    );
    return { parts: urls };
  }

  /** Parts already stored, so an interrupted upload resumes where it stopped. */
  async listParts(photographerId: string, fileId: string) {
    const file = await this.uploading(photographerId, fileId);
    return { parts: await this.storage.listParts(file.originalKey, file.uploadId!) };
  }

  async complete(photographerId: string, fileId: string, input: CompleteUploadInput) {
    await this.assertUploadsOpen();
    const file = await this.uploading(photographerId, fileId);
    await this.storage.completeMultipartUpload(file.originalKey, file.uploadId!, input.parts);

    const storedSize = await this.storage.headObject(file.originalKey);
    if (storedSize === null || BigInt(storedSize) !== file.sizeBytes) {
      await this.discard(file.id, file.originalKey);
      throw new BadRequestException({ code: 'size_mismatch', message: 'The upload was incomplete. Please try again.' });
    }

    const subscription = await this.currentSubscription(photographerId);
    const charged = await this.prisma.client.$transaction(async (tx) => {
      const allowance = await tx.$executeRaw`
        UPDATE "Subscription" SET "usedBytes" = "usedBytes" + ${file.sizeBytes}, "updatedAt" = now()
        WHERE id = ${subscription.id}::uuid AND state::text IN ('trial', 'active')
          AND "usedBytes" + ${file.sizeBytes} <= "allowanceBytes"`;
      if (allowance !== 1) return false;
      const galleryUpdated = await tx.$executeRaw`
        UPDATE "Gallery" SET "totalBytes" = "totalBytes" + ${file.sizeBytes},
          "capBytes" = ("totalBytes" + ${file.sizeBytes}) * ${BigInt(DeliveryRules.downloadCapMultiplier)},
          "fileCount" = "fileCount" + 1, "lastUploadAt" = now(), "updatedAt" = now()
        WHERE id = ${file.galleryId}::uuid AND state::text IN ('draft', 'active')`;
      if (galleryUpdated !== 1) throw new ConflictException({ code: 'gallery_closed', message: 'This gallery no longer accepts uploads.' });
      await tx.file.update({ where: { id: file.id }, data: { status: 'processing', uploadId: null } });
      await tx.usageEvent.create({
        data: { photographerId, type: 'upload', bytes: file.sizeBytes, galleryId: file.galleryId },
      });
      return true;
    });

    if (!charged) {
      await this.discard(file.id, file.originalKey);
      throw this.allowanceExceeded(subscription);
    }
    await this.jobs.send('file.process', { fileId: file.id });
    await this.billing.checkAllowance(subscription.id).catch(() => undefined);
    return { fileId: file.id, status: 'processing' as const };
  }

  async abort(photographerId: string, fileId: string) {
    const file = await this.uploading(photographerId, fileId);
    await this.storage.abortMultipartUpload(file.originalKey, file.uploadId!);
    await this.prisma.client.file.delete({ where: { id: file.id } });
  }

  // ---------- helpers ----------

  /** PRD A-05 global upload freeze. Uploads already sent stay; the browser retries later. */
  private async assertUploadsOpen() {
    if (await this.flags.isOn('uploads_frozen')) {
      throw new HttpException(
        { code: 'uploads_frozen', message: 'Uploads are paused for maintenance. Please try again shortly.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async uploading(photographerId: string, fileId: string) {
    const file = await this.prisma.client.file.findFirst({
      where: { id: fileId, status: 'uploading', gallery: { photographerId } },
    });
    if (!file?.uploadId) throw new NotFoundException({ code: 'not_found', message: 'Upload not found.' });
    return file;
  }

  private async currentSubscription(photographerId: string) {
    const subscription = await this.prisma.client.subscription.findFirst({
      where: { photographerId },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription || !['trial', 'active'].includes(subscription.state) || subscription.cycleEnd < new Date()) {
      throw paymentRequired('subscription_inactive', 'Your plan is not active. Renew or choose a plan to upload.');
    }
    return subscription;
  }

  private allowanceExceeded(subscription: { allowanceBytes: bigint; usedBytes: bigint }) {
    return paymentRequired('allowance_exceeded', 'This upload would go over your plan allowance.', {
      allowanceBytes: subscription.allowanceBytes.toString(),
      usedBytes: subscription.usedBytes.toString(),
    });
  }

  private async discard(fileId: string, key: string) {
    await this.storage.deleteObjects([key]).catch(() => undefined);
    await this.prisma.client.file.delete({ where: { id: fileId } }).catch(() => undefined);
  }
}
