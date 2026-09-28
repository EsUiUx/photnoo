import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DeliveryRules, ExtendDays, LinkDays } from '@photnoo/shared';
import { AuditService } from '../audit/audit.service';
import { hashPassword } from '../auth/passwords';
import { decrypt, encrypt, galleryPassword, randomToken, sha256 } from '../common/crypto';
import { ENV, type Env } from '../config/env';
import { GalleriesService } from '../galleries/galleries.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Photographer side of delivery: activate, share, rotate the password, close (PRD P-10 to P-13). */
@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly galleries: GalleriesService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  linkFor(token: string): string {
    return `${this.env.WEB_ORIGIN}/g/${token}`;
  }

  /**
   * Starts the link clock (1 to 10 days, 7 by default) and returns the link and a fresh password. The password is shown
   * only here; it is stored as an argon2id hash and can only be replaced, never read back.
   */
  async activate(photographerId: string, galleryId: string, days: number = LinkDays.default) {
    const gallery = await this.galleries.get(photographerId, galleryId);
    if (gallery.state !== 'draft') {
      throw new ConflictException({ code: 'not_draft', message: 'This gallery was already shared.' });
    }
    const [uploading, ready] = await Promise.all([
      this.prisma.client.file.count({ where: { galleryId, status: 'uploading' } }),
      this.prisma.client.file.count({ where: { galleryId, status: { in: ['processing', 'ready'] } } }),
    ]);
    if (uploading > 0) {
      throw new ConflictException({ code: 'uploads_in_progress', message: 'Wait for all uploads to finish.' });
    }
    if (ready === 0) throw new ConflictException({ code: 'gallery_empty', message: 'Add at least one file first.' });

    const token = randomToken(16); // 128-bit, 22 URL-safe characters
    const password = galleryPassword();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * DAY_MS);

    const updated = await this.prisma.client.gallery.updateMany({
      where: { id: galleryId, photographerId, state: 'draft' },
      data: {
        state: 'active',
        linkTokenHash: sha256(token),
        linkTokenEnc: encrypt(this.env.JWT_ACCESS_SECRET, token),
        passwordHash: await hashPassword(password),
        activatedAt: now,
        expiresAt,
        capBytes: gallery.totalBytes * BigInt(DeliveryRules.downloadCapMultiplier),
      },
    });
    if (updated.count !== 1) throw new ConflictException({ code: 'not_draft', message: 'This gallery was already shared.' });

    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: 'gallery.activated',
      targetType: 'gallery',
      targetId: galleryId,
      data: { expiresAt: expiresAt.toISOString(), days },
    });
    return { link: this.linkFor(token), password, expiresAt };
  }

  /**
   * PRD P-14: an active link may be extended once, by 1 to 3 days. Open client sessions that
   * were cut short by the old expiry run on to their normal 24-hour end (PRD C-03), capped at
   * the new expiry, so nobody is asked for the password again just because of the extension.
   */
  async extend(photographerId: string, galleryId: string, days: number) {
    if (days < ExtendDays.min || days > ExtendDays.max) {
      throw new ConflictException({ code: 'invalid_extension', message: 'Extend by 1 to 3 days.' });
    }
    const gallery = await this.galleries.get(photographerId, galleryId);
    if (gallery.state !== 'active' || !gallery.expiresAt) {
      throw new ConflictException({ code: 'not_active', message: 'Only a shared gallery can be extended.' });
    }
    if (gallery.extendedAt) {
      throw new ConflictException({ code: 'already_extended', message: 'This link was already extended once.' });
    }
    const expiresAt = new Date(gallery.expiresAt.getTime() + days * DAY_MS);
    const updated = await this.prisma.client.gallery.updateMany({
      where: { id: galleryId, photographerId, state: 'active', extendedAt: null },
      data: { expiresAt, extendedAt: new Date() },
    });
    if (updated.count !== 1) throw new ConflictException({ code: 'already_extended', message: 'This link was already extended once.' });
    await this.prisma.client.$executeRaw`
      UPDATE "ClientSession"
      SET "expiresAt" = LEAST("createdAt" + interval '24 hours', ${expiresAt})
      WHERE "galleryId" = ${galleryId}::uuid AND "expiresAt" >= ${gallery.expiresAt} AND "expiresAt" > now()`;
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: 'gallery.extended',
      targetType: 'gallery',
      targetId: galleryId,
      data: { days, expiresAt: expiresAt.toISOString() },
    });
    return { expiresAt, extendedAt: new Date() };
  }

  /** PRD P-11: the old password stops working at once; open client sessions run out normally. */
  async regeneratePassword(photographerId: string, galleryId: string) {
    const gallery = await this.galleries.get(photographerId, galleryId);
    if (gallery.state !== 'active') {
      throw new ConflictException({ code: 'not_active', message: 'Only a shared gallery has a password.' });
    }
    const password = galleryPassword();
    await this.prisma.client.gallery.update({
      where: { id: galleryId },
      data: { passwordHash: await hashPassword(password), linkLockedUntil: null },
    });
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: 'gallery.password_regenerated',
      targetType: 'gallery',
      targetId: galleryId,
    });
    return { password };
  }

  async link(photographerId: string, galleryId: string) {
    const gallery = await this.galleries.get(photographerId, galleryId);
    if (!gallery.linkTokenEnc || gallery.state !== 'active') {
      throw new ConflictException({ code: 'not_active', message: 'This gallery is not shared.' });
    }
    return { link: this.linkFor(decrypt(this.env.JWT_ACCESS_SECRET, gallery.linkTokenEnc)), expiresAt: gallery.expiresAt };
  }

  /** PRD P-13 "Close now": access ends at once; the purge job deletes the files. */
  async close(photographerId: string, galleryId: string) {
    await this.galleries.get(photographerId, galleryId);
    const closed = await this.prisma.client.gallery.updateMany({
      where: { id: galleryId, photographerId, state: { in: ['draft', 'active'] } },
      data: { state: 'closed', closedAt: new Date(), closedReason: 'closed_by_photographer' },
    });
    if (closed.count !== 1) throw new ConflictException({ code: 'already_closed', message: 'This gallery is already closed.' });
    await this.audit.record({
      actorType: 'photographer',
      actorId: photographerId,
      action: 'gallery.closed',
      targetType: 'gallery',
      targetId: galleryId,
    });
  }

  /** PRD P-12: opens, password attempts and download receipts, newest first. */
  async activity(photographerId: string, galleryId: string) {
    await this.galleries.get(photographerId, galleryId);
    const [accesses, receipts] = await Promise.all([
      this.prisma.client.accessEvent.findMany({ where: { galleryId }, orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.client.downloadReceipt.findMany({
        where: { galleryId },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: { file: { select: { originalName: true } } },
      }),
    ]);
    return {
      accesses: accesses.map((a) => ({ type: a.type, country: a.country, deviceType: a.deviceType, at: a.createdAt })),
      receipts: receipts.map((r) => ({
        receiptId: r.id,
        fileName: r.file.originalName,
        bytes: r.bytes.toString(),
        country: r.country,
        deviceType: r.deviceType,
        at: r.createdAt,
      })),
    };
  }
}
