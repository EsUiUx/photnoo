import { Inject, Injectable, Logger } from '@nestjs/common';
import { DeliveryRules } from '@photnoo/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { objectKeys, STORAGE, type Storage } from '../storage/storage';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Closed galleries keep their files briefly so download links already issued can finish. */
const PURGE_GRACE_MS = HOUR;
const BATCH = 50;

/**
 * Retention enforced by jobs, never by hand (PRD section 4 and the lifecycle diagram):
 * active → closed at expiry, closed → purged (files deleted), purged → anonymised after
 * 12 months. Also clears abandoned uploads and expired client sessions. Every step is
 * idempotent, so a crashed run is simply repeated.
 */
@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  async tick(now = new Date()): Promise<Record<string, number>> {
    const result = {
      expired: await this.expire(now),
      abandonedUploads: await this.cleanAbandonedUploads(now),
      purged: await this.purge(now),
      anonymised: await this.anonymise(now),
      sessionsRemoved: await this.removeExpiredSessions(now),
    };
    if (Object.values(result).some((n) => n > 0)) this.logger.log({ ...result }, 'Lifecycle run');
    return result;
  }

  /** Links close the moment they expire. */
  async expire(now: Date): Promise<number> {
    const closed = await this.prisma.client.gallery.updateMany({
      where: { state: 'active', expiresAt: { lte: now } },
      data: { state: 'closed', closedAt: now, closedReason: 'expired' },
    });
    return closed.count;
  }

  /** Deletes the files of closed galleries and of drafts left untouched for 14 days. */
  async purge(now: Date): Promise<number> {
    const staleDraft = new Date(now.getTime() - DeliveryRules.draftMaxIdleDays * DAY);
    const galleries = await this.prisma.client.gallery.findMany({
      where: {
        OR: [
          { state: 'closed', closedAt: { lte: new Date(now.getTime() - PURGE_GRACE_MS) } },
          { state: 'draft', createdAt: { lte: staleDraft }, OR: [{ lastUploadAt: null }, { lastUploadAt: { lte: staleDraft } }] },
        ],
      },
      take: BATCH,
      select: { id: true, state: true, photographerId: true },
    });
    for (const gallery of galleries) {
      const uploading = await this.prisma.client.file.findMany({
        where: { galleryId: gallery.id, status: 'uploading' },
        select: { originalKey: true, uploadId: true },
      });
      for (const file of uploading) {
        if (file.uploadId) await this.storage.abortMultipartUpload(file.originalKey, file.uploadId).catch(() => undefined);
      }
      await this.storage.deletePrefix(objectKeys.gallery(gallery.id));
      await this.prisma.client.$transaction([
        this.prisma.client.file.updateMany({ where: { galleryId: gallery.id }, data: { status: 'purged', uploadId: null } }),
        this.prisma.client.clientSession.deleteMany({ where: { galleryId: gallery.id } }),
        this.prisma.client.gallery.update({
          where: { id: gallery.id },
          data: {
            state: 'purged',
            purgedAt: now,
            closedAt: gallery.state === 'draft' ? now : undefined,
            closedReason: gallery.state === 'draft' ? 'draft_expired' : undefined,
            passwordHash: null,
            linkTokenEnc: null,
          },
        }),
      ]);
      await this.audit.record({
        actorType: 'system',
        action: 'gallery.purged',
        targetType: 'gallery',
        targetId: gallery.id,
        data: { from: gallery.state },
      });
    }
    return galleries.length;
  }

  /** Multipart uploads nobody finished within 24 hours. */
  async cleanAbandonedUploads(now: Date): Promise<number> {
    const files = await this.prisma.client.file.findMany({
      where: { status: 'uploading', createdAt: { lte: new Date(now.getTime() - DAY) } },
      take: BATCH * 4,
      select: { id: true, originalKey: true, uploadId: true },
    });
    for (const file of files) {
      if (file.uploadId) await this.storage.abortMultipartUpload(file.originalKey, file.uploadId).catch(() => undefined);
      await this.prisma.client.file.delete({ where: { id: file.id } });
    }
    return files.length;
  }

  /** 12 months after closing, erase client details and IP addresses; totals remain. */
  async anonymise(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - DeliveryRules.anonymiseAfterMonths * 30 * DAY);
    const galleries = await this.prisma.client.gallery.findMany({
      where: { state: 'purged', closedAt: { lte: cutoff } },
      take: BATCH * 4,
      select: { id: true },
    });
    for (const { id } of galleries) {
      await this.prisma.client.$transaction([
        this.prisma.client.accessEvent.updateMany({ where: { galleryId: id }, data: { ip: null } }),
        this.prisma.client.downloadReceipt.updateMany({ where: { galleryId: id }, data: { ip: null } }),
        this.prisma.client.abuseReport.updateMany({ where: { galleryId: id }, data: { reporterEmail: null } }),
        this.prisma.client.gallery.update({
          where: { id },
          data: { state: 'anonymised', clientName: null, clientPhone: null, clientEmail: null },
        }),
      ]);
    }
    return galleries.length;
  }

  async removeExpiredSessions(now: Date): Promise<number> {
    const removed = await this.prisma.client.clientSession.deleteMany({ where: { expiresAt: { lte: now } } });
    return removed.count;
  }
}
