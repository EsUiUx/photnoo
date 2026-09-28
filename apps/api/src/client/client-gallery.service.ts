import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DeliveryRules } from '@photnoo/shared';
import type { Gallery } from '@photnoo/db';
import { verifyPassword } from '../auth/passwords';
import { ENV, type Env } from '../config/env';
import { FlagsService } from '../flags/flags.service';
import { deviceType, randomToken, sha256 } from '../common/crypto';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';

export type ClientMeta = { ip: string | null; userAgent: string | null; country: string | null };
export type PublicState = 'open' | 'closed' | 'unavailable';

const MINUTE = 60_000;
const IP_WINDOW_MS = 20 * MINUTE;
const LINK_WINDOW_MS = 60 * MINUTE;
const CAPTCHA_AFTER = 3;
const SLOW_AFTER = 5;
const LOCK_AFTER = 10;
const LINK_LOCK_AFTER = 30;
const SESSION_MS = 24 * 60 * MINUTE;
const PREVIEW_URL_TTL_SECONDS = 24 * 60 * 60;
const BREAKER_PAUSE_MS = 60 * MINUTE;

const tooMany = (code: string, message: string, retryAfterSeconds: number) =>
  new HttpException({ code, message, details: { retryAfterSeconds } }, HttpStatus.TOO_MANY_REQUESTS);

/**
 * Everything a client can do with a link: see whether it is open, unlock it with the password,
 * browse previews and download originals within the cap (PRD C-01 to C-10).
 * The client never has an account; access is the link token plus a gallery-scoped session.
 */
@Injectable()
export class ClientGalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly flags: FlagsService,
    @Inject(ENV) private readonly env: Env,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /** Links of unshared (draft) galleries do not exist from the outside. */
  async resolve(linkToken: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(linkToken)) throw this.notFound();
    const gallery = await this.prisma.client.gallery.findUnique({
      where: { linkTokenHash: sha256(linkToken) },
      include: { photographer: { select: { name: true, studioName: true, phone: true, email: true, logoKey: true, status: true } } },
    });
    if (!gallery || gallery.state === 'draft') throw this.notFound();
    return gallery;
  }

  state(gallery: Gallery & { photographer?: { status: string } }, now = new Date()): PublicState {
    if (gallery.state !== 'active' || (gallery.expiresAt && gallery.expiresAt <= now)) return 'closed';
    // A suspended photographer's links pause with the account (PRD A-03).
    if (gallery.photographer && gallery.photographer.status !== 'active') return 'unavailable';
    if (gallery.suspended && (!gallery.suspendedUntil || gallery.suspendedUntil > now)) return 'unavailable';
    return 'open';
  }

  /** Password screen data (C-01) and the closed page (C-09). Contains no photos. */
  async summary(linkToken: string) {
    const gallery = await this.resolve(linkToken);
    return {
      state: this.state(gallery),
      name: gallery.name,
      photographer: {
        name: gallery.photographer.studioName ?? gallery.photographer.name,
        whatsapp: gallery.photographer.phone,
      },
      expiresAt: gallery.expiresAt,
    };
  }

  // ---------- unlock ----------

  /** C-02 / C-03. Returns a session token for the gallery-scoped cookie. */
  async unlock(linkToken: string, password: string, meta: ClientMeta) {
    const gallery = await this.resolve(linkToken);
    const now = new Date();
    if (this.state(gallery, now) !== 'open') {
      throw new ConflictException({ code: 'gallery_unavailable', message: 'This gallery is not available.' });
    }
    if (gallery.linkLockedUntil && gallery.linkLockedUntil > now) {
      throw tooMany('link_locked', 'Too many attempts on this gallery. Try again later.', seconds(gallery.linkLockedUntil, now));
    }

    const recentFailures = await this.prisma.client.accessEvent.findMany({
      where: { galleryId: gallery.id, type: 'password_fail', ip: meta.ip, createdAt: { gt: new Date(now.getTime() - IP_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const failures = recentFailures.length;
    const lastFailure = recentFailures[0]?.createdAt;
    if (failures >= LOCK_AFTER && lastFailure) {
      throw tooMany('too_many_attempts', 'Too many attempts. Try again in 20 minutes.', seconds(new Date(lastFailure.getTime() + IP_WINDOW_MS), now));
    }
    if (failures >= SLOW_AFTER && lastFailure) {
      const wait = Math.min(5_000 * 2 ** (failures - SLOW_AFTER), 5 * MINUTE);
      if (lastFailure.getTime() + wait > now.getTime()) {
        throw tooMany('slow_down', 'Please wait a moment before trying again.', seconds(new Date(lastFailure.getTime() + wait), now));
      }
    }

    const event = { galleryId: gallery.id, ip: meta.ip, country: meta.country, deviceType: deviceType(meta.userAgent) };
    if (!(await verifyPassword(gallery.passwordHash, password))) {
      await this.prisma.client.accessEvent.create({ data: { ...event, type: 'password_fail' } });
      await this.maybeLockLink(gallery, now);
      throw new UnauthorizedException({
        code: 'wrong_password',
        message: 'That password is not right.',
        details: { captchaRequired: failures + 1 >= CAPTCHA_AFTER },
      });
    }

    const token = randomToken();
    const expiresAt = new Date(Math.min(now.getTime() + SESSION_MS, gallery.expiresAt!.getTime()));
    await this.prisma.client.$transaction([
      this.prisma.client.clientSession.create({
        data: { ...event, tokenHash: sha256(token), expiresAt },
      }),
      this.prisma.client.accessEvent.create({ data: { ...event, type: 'password_ok' } }),
    ]);
    return { token, expiresAt };
  }

  /** 30 wrong passwords on one link within an hour, from any IPs, lock it for an hour. */
  private async maybeLockLink(gallery: Gallery & { photographer: { email: string } }, now: Date) {
    const linkFailures = await this.prisma.client.accessEvent.count({
      where: { galleryId: gallery.id, type: 'password_fail', createdAt: { gt: new Date(now.getTime() - LINK_WINDOW_MS) } },
    });
    if (linkFailures < LINK_LOCK_AFTER) return;
    const locked = await this.prisma.client.gallery.updateMany({
      where: { id: gallery.id, OR: [{ linkLockedUntil: null }, { linkLockedUntil: { lt: now } }] },
      data: { linkLockedUntil: new Date(now.getTime() + LINK_WINDOW_MS) },
    });
    if (locked.count === 1) await this.mail.send(templates.linkLocked(gallery.photographer.email, gallery.name));
  }

  // ---------- session ----------

  async session(linkToken: string, sessionToken: string | undefined) {
    const gallery = await this.resolve(linkToken);
    if (!sessionToken) throw this.locked();
    const session = await this.prisma.client.clientSession.findUnique({ where: { tokenHash: sha256(sessionToken) } });
    if (!session || session.galleryId !== gallery.id || session.expiresAt <= new Date()) throw this.locked();
    return { gallery, session };
  }

  async content(linkToken: string, sessionToken: string | undefined, meta: ClientMeta) {
    const { gallery } = await this.session(linkToken, sessionToken);
    this.assertOpen(gallery);

    const [folders, files, recentOpen] = await Promise.all([
      this.prisma.client.folder.findMany({ where: { galleryId: gallery.id }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.client.file.findMany({ where: { galleryId: gallery.id, status: 'ready' }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.client.accessEvent.count({
        where: { galleryId: gallery.id, type: 'open', ip: meta.ip, createdAt: { gt: new Date(Date.now() - 30 * MINUTE) } },
      }),
    ]);
    if (recentOpen === 0) {
      await this.prisma.client.accessEvent.create({
        data: { galleryId: gallery.id, type: 'open', ip: meta.ip, country: meta.country, deviceType: deviceType(meta.userAgent) },
      });
    }

    return {
      name: gallery.name,
      photographer: { name: gallery.photographer.studioName ?? gallery.photographer.name, whatsapp: gallery.photographer.phone },
      expiresAt: gallery.expiresAt,
      coverFileId: gallery.coverFileId ?? files.find((f) => f.previewKey)?.id ?? null,
      allowance: {
        capBytes: gallery.capBytes.toString(),
        servedBytes: gallery.servedBytes.toString(),
        remainingBytes: maxZero(gallery.capBytes - gallery.servedBytes).toString(),
      },
      folders: folders.map((f) => ({ id: f.id, name: f.name })),
      files: await Promise.all(
        files.map(async (f) => ({
          id: f.id,
          folderId: f.folderId,
          name: f.originalName,
          sizeBytes: f.sizeBytes.toString(),
          width: f.width,
          height: f.height,
          blurDataUrl: f.blurDataUrl,
          previewUrl: f.previewKey ? await this.storage.signDownload(f.previewKey, PREVIEW_URL_TTL_SECONDS) : null,
        })),
      ),
    };
  }

  // ---------- download ----------

  /**
   * C-07. Charges the file against the link's byte cap atomically, writes a receipt, and returns
   * a 5-minute signed URL. Asking again for the same file within 10 minutes is free (retries).
   */
  async download(linkToken: string, sessionToken: string | undefined, fileId: string, meta: ClientMeta) {
    const { gallery, session } = await this.session(linkToken, sessionToken);
    this.assertOpen(gallery);
    if (await this.flags.isOn('downloads_frozen')) {
      throw new HttpException(
        { code: 'temporarily_unavailable', message: 'Downloads are paused for a short while. Please try again later.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const file = await this.prisma.client.file.findFirst({ where: { id: fileId, galleryId: gallery.id, status: 'ready' } });
    if (!file) throw new NotFoundException({ code: 'not_found', message: 'File not found.' });

    const url = () => this.storage.signDownload(file.originalKey, DeliveryRules.signedUrlTtlSeconds, file.originalName);
    const now = new Date();

    const repeat = await this.prisma.client.downloadReceipt.findFirst({
      where: {
        sessionId: session.id,
        fileId: file.id,
        createdAt: { gt: new Date(now.getTime() - DeliveryRules.repeatDownloadWindowMinutes * MINUTE) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (repeat) {
      return { url: await url(), receiptId: repeat.id, charged: false, remainingBytes: maxZero(gallery.capBytes - gallery.servedBytes).toString() };
    }

    await this.checkBreaker(gallery, now);

    const receipt = await this.prisma.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ servedBytes: bigint; capBytes: bigint }>>`
        UPDATE "Gallery" SET "servedBytes" = "servedBytes" + ${file.sizeBytes}, "updatedAt" = now()
        WHERE id = ${gallery.id}::uuid AND state::text = 'active' AND "servedBytes" + ${file.sizeBytes} <= "capBytes"
        RETURNING "servedBytes", "capBytes"`;
      const row = rows[0];
      if (!row) return null;
      const created = await tx.downloadReceipt.create({
        data: {
          galleryId: gallery.id,
          fileId: file.id,
          bytes: file.sizeBytes,
          sessionId: session.id,
          ip: meta.ip,
          country: meta.country,
          deviceType: deviceType(meta.userAgent),
        },
      });
      if (row.servedBytes >= row.capBytes) {
        await tx.gallery.update({ where: { id: gallery.id }, data: { state: 'closed', closedAt: now, closedReason: 'cap_used' } });
      }
      return { id: created.id, remaining: maxZero(row.capBytes - row.servedBytes) };
    });

    if (!receipt) {
      const current = await this.prisma.client.gallery.findUniqueOrThrow({ where: { id: gallery.id } });
      throw new ConflictException({
        code: 'cap_reached',
        message: 'The download allowance for this gallery is used up.',
        details: { remainingBytes: maxZero(current.capBytes - current.servedBytes).toString() },
      });
    }
    return { url: await url(), receiptId: receipt.id, charged: true, remainingBytes: receipt.remaining.toString() };
  }

  /** PRD A-06: more than 50 GB served in an hour pauses the gallery for an hour. */
  private async checkBreaker(gallery: Gallery & { photographer: { email: string } }, now: Date) {
    const served = await this.prisma.client.downloadReceipt.aggregate({
      where: { galleryId: gallery.id, createdAt: { gt: new Date(now.getTime() - 60 * MINUTE) } },
      _sum: { bytes: true },
    });
    if ((served._sum.bytes ?? 0n) < BigInt(DeliveryRules.breakerBytesPerHour)) return;
    await this.prisma.client.gallery.update({
      where: { id: gallery.id },
      data: { suspended: true, suspendedUntil: new Date(now.getTime() + BREAKER_PAUSE_MS) },
    });
    await this.mail.send(templates.galleryThrottled(gallery.photographer.email, gallery.name));
    // A-06: admins hear about it too.
    if (this.env.ADMIN_ALERT_EMAIL) await this.mail.send(templates.galleryThrottled(this.env.ADMIN_ALERT_EMAIL, `${gallery.name} (${gallery.id})`));
    throw new HttpException(
      { code: 'temporarily_unavailable', message: 'Downloads are paused for a while. Please try later.' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // ---------- abuse ----------

  /** C-10: anyone holding the link can report it; it goes to the admin abuse queue. */
  async report(linkToken: string, reason: string, email: string | undefined) {
    const gallery = await this.resolve(linkToken);
    const recent = await this.prisma.client.abuseReport.count({
      where: { galleryId: gallery.id, createdAt: { gt: new Date(Date.now() - 60 * MINUTE) } },
    });
    if (recent >= 20) throw tooMany('rate_limited', 'Thank you, we already received reports for this gallery.', 3600);
    await this.prisma.client.abuseReport.create({ data: { galleryId: gallery.id, reason, reporterEmail: email ?? null } });
  }

  // ---------- helpers ----------

  private assertOpen(gallery: Gallery) {
    const state = this.state(gallery);
    if (state === 'closed') throw new ConflictException({ code: 'gallery_closed', message: 'This gallery has closed.' });
    if (state === 'unavailable') {
      throw new HttpException({ code: 'temporarily_unavailable', message: 'This gallery is temporarily unavailable.' }, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private notFound() {
    return new NotFoundException({ code: 'link_invalid', message: 'This link is not valid.' });
  }

  private locked() {
    return new UnauthorizedException({ code: 'password_required', message: 'Enter the gallery password.' });
  }
}

function seconds(until: Date, now: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}

function maxZero(value: bigint): bigint {
  return value > 0n ? value : 0n;
}
