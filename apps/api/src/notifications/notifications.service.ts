import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type NotificationType, Prisma } from '@photnoo/db';
import { PrismaService } from '../prisma/prisma.service';

/** Types a photographer may switch off in Settings, and the preference that controls each. */
const OPTIONAL: Partial<Record<NotificationType, 'notifyFirstOpen' | 'notifyFullDownload' | 'notifyExpiring' | 'notifyOrders'>> = {
  gallery_opened: 'notifyFirstOpen',
  gallery_downloaded: 'notifyFullDownload',
  gallery_expiring: 'notifyExpiring',
  order_placed: 'notifyOrders',
};

const PAGE = 20;

export type NotifyInput = {
  type: NotificationType;
  /** Values the web app interpolates into the message (gallery name, client name, amount...). */
  data?: Record<string, string | number | null>;
  galleryId?: string;
  orderId?: string;
  /** Same key twice for one photographer keeps the first notification only. */
  dedupeKey?: string;
};

/**
 * In-app notifications (the bell and the Notifications page). Callers fire and forget:
 * a failed notification must never fail the action that caused it.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async notify(photographerId: string, input: NotifyInput): Promise<void> {
    try {
      const pref = OPTIONAL[input.type];
      if (pref) {
        const owner = await this.prisma.client.photographer.findUnique({ where: { id: photographerId }, select: { [pref]: true } });
        if (!owner || (owner as unknown as Record<string, boolean>)[pref] === false) return;
      }
      await this.prisma.client.notification.create({
        data: {
          photographerId,
          type: input.type,
          data: (input.data ?? {}) as Prisma.InputJsonObject,
          galleryId: input.galleryId,
          orderId: input.orderId,
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return; // deduped
      this.logger.warn({ err: error, type: input.type }, 'notification not recorded');
    }
  }

  /**
   * Like `notify`, but when the dedupe key already exists its data is refreshed instead
   * (e.g. "Gallery ready: 12 photos" growing as more uploads finish the same day).
   */
  async notifyOrRefresh(photographerId: string, input: NotifyInput & { dedupeKey: string }): Promise<void> {
    try {
      const refreshed = await this.prisma.client.notification.updateMany({
        where: { photographerId, dedupeKey: input.dedupeKey },
        data: { data: (input.data ?? {}) as Prisma.InputJsonObject },
      });
      if (refreshed.count === 0) await this.notify(photographerId, input);
    } catch (error) {
      this.logger.warn({ err: error, type: input.type }, 'notification not refreshed');
    }
  }

  /** Dedupe keys among `keys` this photographer already has, so callers can skip repeat work. */
  async existingKeys(photographerId: string, keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const rows = await this.prisma.client.notification.findMany({
      where: { photographerId, dedupeKey: { in: keys } },
      select: { dedupeKey: true },
    });
    return new Set(rows.map((r) => r.dedupeKey ?? ''));
  }

  // ---------- inbox ----------

  /** Newest first. The cursor is opaque (createdAt + id) and every query is scoped to the owner. */
  async list(photographerId: string, options: { cursor?: string; unreadOnly?: boolean; limit?: number } = {}) {
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? PAGE) || PAGE, 1), 50);
    const after = options.cursor ? decodeCursor(options.cursor) : null;
    const where: Prisma.NotificationWhereInput = {
      photographerId,
      ...(options.unreadOnly ? { readAt: null } : {}),
      ...(after ? { OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }] } : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 }),
      this.unreadCount(photographerId),
    ]);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
        galleryId: n.galleryId,
        orderId: n.orderId,
        read: n.readAt !== null,
        createdAt: n.createdAt,
      })),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
      unreadCount,
    };
  }

  unreadCount(photographerId: string): Promise<number> {
    return this.prisma.client.notification.count({ where: { photographerId, readAt: null } });
  }

  /** Someone else's notification is simply not found. Reading twice is fine. */
  async markRead(photographerId: string, id: string): Promise<void> {
    const found = await this.prisma.client.notification.findFirst({ where: { id, photographerId }, select: { readAt: true } });
    if (!found) throw new NotFoundException({ code: 'not_found', message: 'Notification not found.' });
    if (!found.readAt) {
      await this.prisma.client.notification.updateMany({ where: { id, photographerId, readAt: null }, data: { readAt: new Date() } });
    }
  }

  async markAllRead(photographerId: string): Promise<number> {
    const result = await this.prisma.client.notification.updateMany({ where: { photographerId, readAt: null }, data: { readAt: new Date() } });
    return result.count;
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || Number.isNaN(createdAt.getTime())) {
    throw new BadRequestException({ code: 'invalid_cursor', message: 'This page link is not valid.' });
  }
  return { createdAt, id };
}
