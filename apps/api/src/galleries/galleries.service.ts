import { BadRequestException, ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateFolderInput,
  CreateGalleryInput,
  GalleryListQuery,
  MoveFilesInput,
  UpdateFolderInput,
  UpdateGalleryInput,
} from '@photnoo/shared';
import { type File, Prisma } from '@photnoo/db';
import { ClientsService } from '../clients/clients.service';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Photographer-side preview links are short: the dashboard refetches them on every visit. */
const OWNER_PREVIEW_TTL_SECONDS = 60 * 60;
const LISTED_STATES = ['draft', 'active', 'closed'] as const;
const STATUS_STATES: Record<GalleryListQuery['status'], readonly string[]> = {
  all: LISTED_STATES,
  active: ['active'],
  drafts: ['draft'],
  closed: ['closed'],
};

export type GalleryStats = { views: number; downloads: number };
export type Trend = { current: number; previous: number };
type ListOptions = Partial<GalleryListQuery>;

const galleryNotFound = () => new NotFoundException({ code: 'not_found', message: 'Gallery not found.' });
const folderNotFound = () => new NotFoundException({ code: 'not_found', message: 'Folder not found.' });
const folderExists = () => new ConflictException({ code: 'folder_exists', message: 'A folder with this name already exists.' });

/** Minutes east of UTC for a zone at an instant, e.g. 180 for Cairo in summer. */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const match = name ? /GMT([+-])(\d{2}):(\d{2})/.exec(name) : null;
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/** Midnight of a YYYY-MM-DD day in Cairo, as a UTC instant. */
export function cairoMidnight(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, d);
  return new Date(utc - zoneOffsetMinutes(new Date(utc), 'Africa/Cairo') * 60_000);
}

/** Timestamp columns are UTC wall time without a zone; pass bounds the same way. */
const sqlTime = (date: Date) => Prisma.sql`${date.toISOString().slice(0, 23)}::timestamp`;
const likeEscape = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Galleries belong to exactly one photographer; every query here is scoped by photographerId. */
@Injectable()
export class GalleriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly clients: ClientsService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /** PRD B-08: a soft-locked, dormant or unpaid account keeps its galleries but cannot start new ones. */
  async create(photographerId: string, input: CreateGalleryInput) {
    const subscription = await this.prisma.client.subscription.findFirst({ where: { photographerId }, orderBy: { createdAt: 'desc' } });
    if (!subscription || !['trial', 'active'].includes(subscription.state) || subscription.cycleEnd <= new Date()) {
      throw new HttpException(
        { code: 'subscription_inactive', message: 'Your plan is not active. Renew or choose a plan to create galleries.' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return this.prisma.client.$transaction(async (tx) => {
      const client = await this.resolveClient(photographerId, input, tx);
      return tx.gallery.create({ data: { photographerId, name: input.name, ...client } });
    });
  }

  /**
   * Picks the managed client for a gallery and the snapshot fields that travel with it. A chosen
   * client (clientId) wins; otherwise the typed name and phone find or create one by phone.
   */
  private async resolveClient(
    photographerId: string,
    input: { clientId?: string; clientName?: string; clientPhone?: string; clientEmail?: string | null },
    tx: Prisma.TransactionClient,
  ) {
    if (input.clientId) {
      const client = await this.clients.get(photographerId, input.clientId, tx);
      return { clientId: client.id, clientName: client.name, clientPhone: client.phone, clientEmail: client.email };
    }
    const clientId = await this.clients.upsertByPhone(
      photographerId,
      { name: input.clientName, phone: input.clientPhone, email: input.clientEmail ?? null },
      tx,
    );
    return {
      clientId,
      clientName: input.clientName ?? null,
      clientPhone: input.clientPhone ?? null,
      clientEmail: input.clientEmail ?? null,
    };
  }

  /**
   * Cursor pagination with status, created-date range and four sort orders. Purged/anonymised
   * galleries are history, not listed. One keyset query orders the ids; the cursor is the last
   * gallery id of the previous page.
   */
  async list(photographerId: string, options: ListOptions = {}) {
    const take = options.take ?? PAGE_SIZE;
    const sort = options.sort ?? 'newest';
    const states = STATUS_STATES[options.status ?? 'all'];

    const conditions: Prisma.Sql[] = [
      Prisma.sql`g."photographerId" = ${photographerId}::uuid`,
      Prisma.sql`g.state::text IN (${Prisma.join(states)})`,
    ];
    if (options.q) {
      const like = `%${likeEscape(options.q)}%`;
      conditions.push(Prisma.sql`(g.name ILIKE ${like} OR g."clientName" ILIKE ${like} OR g."clientPhone" LIKE ${like})`);
    }
    if (options.from) conditions.push(Prisma.sql`g."createdAt" >= ${sqlTime(cairoMidnight(options.from))}`);
    if (options.to) conditions.push(Prisma.sql`g."createdAt" < ${sqlTime(new Date(cairoMidnight(options.to).getTime() + DAY_MS))}`);

    const key = {
      newest: Prisma.sql`g."createdAt"`,
      oldest: Prisma.sql`g."createdAt"`,
      // Live links by closing time; drafts and closed galleries after them.
      expiring: Prisma.sql`COALESCE(CASE WHEN g.state::text = 'active' THEN g."expiresAt" END, 'infinity'::timestamp)`,
      views: Prisma.sql`(SELECT count(*) FROM "AccessEvent" a WHERE a."galleryId" = g.id AND a.type::text = 'open')`,
    }[sort];
    const ascending = sort === 'oldest' || sort === 'expiring';
    const direction = ascending ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const after = options.cursor
      ? ascending
        ? Prisma.sql`WHERE (k, id) > (SELECT k, id FROM s WHERE id = ${options.cursor}::uuid)`
        : Prisma.sql`WHERE (k, id) < (SELECT k, id FROM s WHERE id = ${options.cursor}::uuid)`
      : Prisma.empty;

    const ordered = await this.prisma.client.$queryRaw<Array<{ id: string }>>`
      WITH s AS (SELECT g.id, ${key} AS k FROM "Gallery" g WHERE ${Prisma.join(conditions, ' AND ')})
      SELECT id::text AS id FROM s ${after} ORDER BY k ${direction}, id ${direction} LIMIT ${take + 1}`;

    const hasMore = ordered.length > take;
    const ids = (hasMore ? ordered.slice(0, take) : ordered).map((row) => row.id);
    const rows = ids.length ? await this.prisma.client.gallery.findMany({ where: { photographerId, id: { in: ids } } }) : [];
    const byId = new Map(rows.map((g) => [g.id, g]));
    const items = ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
    const [stats, covers] = await Promise.all([this.stats(items.map((g) => g.id)), this.covers(items)]);
    return {
      items: items.map((gallery) => ({ gallery, stats: stats.get(gallery.id)!, coverUrl: covers.get(gallery.id) ?? null })),
      nextCursor: hasMore ? ids.at(-1)! : null,
    };
  }

  /** Throws 404 for galleries of other photographers, so their existence is never revealed. */
  async get(photographerId: string, galleryId: string) {
    const gallery = await this.prisma.client.gallery.findFirst({ where: { id: galleryId, photographerId } });
    if (!gallery) throw galleryNotFound();
    return gallery;
  }

  async detail(photographerId: string, galleryId: string) {
    const gallery = await this.get(photographerId, galleryId);
    const [folders, files, stats] = await Promise.all([
      this.prisma.client.folder.findMany({ where: { galleryId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.client.file.findMany({
        where: { galleryId, status: { in: ['uploading', 'processing', 'ready', 'rejected'] } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      this.stats([galleryId]),
    ]);
    const withPreviews = await Promise.all(files.map(async (file) => ({ file, previewUrl: await this.previewUrl(file) })));
    const cover = withPreviews.find((f) => f.file.id === gallery.coverFileId && f.previewUrl) ?? withPreviews.find((f) => f.previewUrl);
    return { gallery, folders, files: withPreviews, stats: stats.get(galleryId)!, coverUrl: cover?.previewUrl ?? null };
  }

  /**
   * Name, client and cover can change at any time; the link and password stay the same.
   * Choosing a client copies its details; typing a phone attaches the matching client.
   */
  async update(photographerId: string, galleryId: string, input: UpdateGalleryInput) {
    const gallery = await this.get(photographerId, galleryId);
    if (gallery.state === 'purged' || gallery.state === 'anonymised') {
      throw new ConflictException({ code: 'gallery_deleted', message: 'This gallery was deleted.' });
    }
    if (input.coverFileId) await this.readyFile(galleryId, input.coverFileId);
    return this.prisma.client.$transaction(async (tx) => {
      let client: { clientId?: string | null; clientName?: string | null; clientPhone?: string | null; clientEmail?: string | null } = {
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        clientEmail: input.clientEmail,
      };
      if (input.clientId) {
        client = await this.resolveClient(photographerId, { clientId: input.clientId }, tx);
      } else if (input.clientPhone) {
        const clientId = await this.clients.upsertByPhone(
          photographerId,
          { name: input.clientName ?? gallery.clientName, phone: input.clientPhone, email: input.clientEmail ?? gallery.clientEmail },
          tx,
        );
        client = { ...client, clientId };
      }
      return tx.gallery.update({
        where: { id: galleryId },
        data: { name: input.name, coverFileId: input.coverFileId, ...client },
      });
    });
  }

  /** Cover from the gallery's own ready photos only. */
  async setCover(photographerId: string, galleryId: string, fileId: string) {
    await this.get(photographerId, galleryId);
    await this.readyFile(galleryId, fileId);
    return this.prisma.client.gallery.update({ where: { id: galleryId }, data: { coverFileId: fileId } });
  }

  /** PRD P-13 Delete: access ends now and files are deleted now. Allowance is not refunded. */
  async remove(photographerId: string, galleryId: string) {
    const gallery = await this.get(photographerId, galleryId);
    if (gallery.state === 'purged' || gallery.state === 'anonymised') return;
    await this.lifecycle.purgeGallery(gallery.id, 'deleted_by_photographer');
  }

  async createFolder(photographerId: string, galleryId: string, input: CreateFolderInput) {
    const gallery = await this.get(photographerId, galleryId);
    const last = await this.prisma.client.folder.aggregate({ where: { galleryId: gallery.id }, _max: { position: true } });
    try {
      return await this.prisma.client.folder.create({
        data: { galleryId: gallery.id, name: input.name, position: (last._max.position ?? -1) + 1 },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw folderExists();
      throw err;
    }
  }

  /** Rename, and/or move to a new place among the gallery's folders (PRD P-09). */
  async updateFolder(photographerId: string, folderId: string, input: UpdateFolderInput) {
    const folder = await this.prisma.client.folder.findFirst({ where: { id: folderId, gallery: { photographerId } } });
    if (!folder) throw folderNotFound();
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        if (input.position !== undefined) {
          const siblings = await tx.folder.findMany({
            where: { galleryId: folder.galleryId },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
          });
          const order = siblings.map((s) => s.id).filter((id) => id !== folderId);
          order.splice(Math.min(input.position, order.length), 0, folderId);
          await this.writePositions(tx, folder.galleryId, order);
        }
        return tx.folder.update({ where: { id: folderId }, data: input.name ? { name: input.name } : {} });
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw folderExists();
      throw err;
    }
  }

  /** The full new order of the gallery's folders; every folder must be listed exactly once. */
  async reorderFolders(photographerId: string, galleryId: string, folderIds: string[]) {
    await this.get(photographerId, galleryId);
    const folders = await this.prisma.client.folder.findMany({ where: { galleryId }, select: { id: true } });
    const known = new Set(folders.map((f) => f.id));
    if (new Set(folderIds).size !== folderIds.length || folderIds.length !== known.size || folderIds.some((id) => !known.has(id))) {
      throw new BadRequestException({ code: 'folders_mismatch', message: 'List every folder of this gallery exactly once.' });
    }
    await this.prisma.client.$transaction((tx) => this.writePositions(tx, galleryId, folderIds));
    return this.prisma.client.folder.findMany({ where: { galleryId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  }

  private async writePositions(tx: Prisma.TransactionClient, galleryId: string, order: string[]) {
    for (const [position, id] of order.entries()) {
      await tx.folder.updateMany({ where: { id, galleryId }, data: { position } });
    }
  }

  /** Deleting a folder keeps its photos: they move to the top level of the gallery. */
  async deleteFolder(photographerId: string, folderId: string) {
    const folder = await this.prisma.client.folder.findFirst({ where: { id: folderId, gallery: { photographerId } } });
    if (!folder) throw folderNotFound();
    await this.prisma.client.$transaction([
      this.prisma.client.file.updateMany({ where: { folderId }, data: { folderId: null } }),
      this.prisma.client.folder.delete({ where: { id: folderId } }),
    ]);
  }

  /** Moves one file to another folder of its gallery, or to the top level with null. */
  async moveFile(photographerId: string, fileId: string, folderId: string | null) {
    const file = await this.prisma.client.file.findFirst({
      where: { id: fileId, status: { not: 'purged' }, gallery: { photographerId } },
    });
    if (!file) throw new NotFoundException({ code: 'not_found', message: 'File not found.' });
    await this.moveFiles(photographerId, file.galleryId, { fileIds: [fileId], folderId });
    return this.prisma.client.file.findUniqueOrThrow({ where: { id: fileId } });
  }

  /** Bulk move within one gallery. Every file must belong to it, or nothing moves. */
  async moveFiles(photographerId: string, galleryId: string, input: MoveFilesInput) {
    await this.get(photographerId, galleryId);
    if (input.folderId) {
      const folder = await this.prisma.client.folder.findFirst({ where: { id: input.folderId, galleryId } });
      if (!folder) throw folderNotFound();
    }
    const ids = [...new Set(input.fileIds)];
    const moved = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.file.updateMany({
        where: { id: { in: ids }, galleryId, status: { not: 'purged' } },
        data: { folderId: input.folderId },
      });
      if (result.count !== ids.length) throw new NotFoundException({ code: 'not_found', message: 'Some files were not found in this gallery.' });
      return result.count;
    });
    return { moved };
  }

  /** Removes one photo from a gallery. Its bytes stay counted against the allowance (PRD section 2). */
  async deleteFile(photographerId: string, fileId: string) {
    const file = await this.prisma.client.file.findFirst({
      where: { id: fileId, status: { in: ['processing', 'ready', 'rejected'] }, gallery: { photographerId } },
    });
    if (!file) throw new NotFoundException({ code: 'not_found', message: 'File not found.' });
    const counted = file.status !== 'rejected'; // rejected files already left the totals
    await this.prisma.client.$transaction([
      this.prisma.client.file.update({ where: { id: file.id }, data: { status: 'purged' } }),
      ...(counted
        ? [
            this.prisma.client.gallery.update({
              where: { id: file.galleryId },
              data: { totalBytes: { decrement: file.sizeBytes }, fileCount: { decrement: 1 } },
            }),
          ]
        : []),
      this.prisma.client.gallery.updateMany({ where: { id: file.galleryId, coverFileId: file.id }, data: { coverFileId: null } }),
    ]);
    await this.storage.deleteObjects([file.originalKey, ...(file.previewKey ? [file.previewKey] : [])]);
  }

  /**
   * Dashboard numbers (Figma "Overview"), each with the last 30 days against the 30 before, so
   * the page can show a trend. All from indexed counts, no full scans.
   */
  async dashboard(photographerId: string) {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * DAY_MS);
    const d60 = new Date(now.getTime() - 60 * DAY_MS);
    const current = { gte: d30, lt: now };
    const previous = { gte: d60, lt: d30 };
    const db = this.prisma.client;
    const subscription = await db.subscription.findFirst({ where: { photographerId }, orderBy: { createdAt: 'desc' } });
    const cycleStart = subscription?.cycleStart;

    const uploaded = (createdAt: { gte: Date; lt: Date }) =>
      db.usageEvent.aggregate({ where: { photographerId, type: 'upload', createdAt }, _sum: { bytes: true } }).then((r) => Number(r._sum.bytes ?? 0));

    const [
      clients,
      clientsNow,
      clientsBefore,
      activeGalleries,
      activatedNow,
      activatedBefore,
      downloads,
      downloadsNow,
      downloadsBefore,
      uploadedNow,
      uploadedBefore,
      recent,
      recentEvents,
      expiringSoon,
    ] = await Promise.all([
      db.client.count({ where: { photographerId } }),
      db.client.count({ where: { photographerId, createdAt: current } }),
      db.client.count({ where: { photographerId, createdAt: previous } }),
      db.gallery.count({ where: { photographerId, state: 'active' } }),
      db.gallery.count({ where: { photographerId, activatedAt: current } }),
      db.gallery.count({ where: { photographerId, activatedAt: previous } }),
      db.downloadReceipt.count({ where: { gallery: { photographerId }, ...(cycleStart ? { createdAt: { gte: cycleStart } } : {}) } }),
      db.downloadReceipt.count({ where: { gallery: { photographerId }, createdAt: current } }),
      db.downloadReceipt.count({ where: { gallery: { photographerId }, createdAt: previous } }),
      uploaded(current),
      uploaded(previous),
      this.list(photographerId, { take: 5 }),
      this.recentActivity(photographerId),
      db.gallery.findMany({
        where: { photographerId, state: 'active', expiresAt: { lte: new Date(now.getTime() + DAY_MS) } },
        select: { id: true, name: true, clientName: true, expiresAt: true },
        orderBy: { expiresAt: 'asc' },
        take: 3,
      }),
    ]);
    const trend = (c: number, p: number): Trend => ({ current: c, previous: p });
    return {
      clients,
      activeGalleries,
      downloads,
      cycleStart: cycleStart ?? null,
      trends: {
        clients: trend(clientsNow, clientsBefore),
        activeGalleries: trend(activatedNow, activatedBefore),
        downloads: trend(downloadsNow, downloadsBefore),
        allowance: trend(uploadedNow, uploadedBefore),
      },
      storage: subscription
        ? { usedBytes: subscription.usedBytes, allowanceBytes: subscription.allowanceBytes, state: subscription.state }
        : null,
      recentGalleries: recent.items,
      activity: [
        ...expiringSoon.map((g) => ({
          type: 'expiring' as const,
          galleryId: g.id,
          galleryName: g.name,
          clientName: g.clientName,
          at: g.expiresAt!,
        })),
        ...recentEvents,
      ].slice(0, 20),
    };
  }

  // ---------- helpers ----------

  private async readyFile(galleryId: string, fileId: string) {
    const file = await this.prisma.client.file.findFirst({ where: { id: fileId, galleryId, status: 'ready' } });
    if (!file) throw new NotFoundException({ code: 'not_found', message: 'Cover photo not found in this gallery.' });
    return file;
  }

  private async recentActivity(photographerId: string) {
    const [opens, receipts] = await Promise.all([
      this.prisma.client.accessEvent.findMany({
        where: { type: 'open', gallery: { photographerId } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { gallery: { select: { id: true, name: true, clientName: true } } },
      }),
      this.prisma.client.downloadReceipt.findMany({
        where: { gallery: { photographerId } },
        orderBy: { createdAt: 'desc' },
        distinct: ['galleryId'],
        take: 20,
        include: { gallery: { select: { id: true, name: true, clientName: true } } },
      }),
    ]);
    return [
      ...opens.map((e) => ({ type: 'viewed' as const, galleryId: e.gallery.id, galleryName: e.gallery.name, clientName: e.gallery.clientName, at: e.createdAt })),
      ...receipts.map((r) => ({ type: 'downloaded' as const, galleryId: r.gallery.id, galleryName: r.gallery.name, clientName: r.gallery.clientName, at: r.createdAt })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  /** Views = gallery opens, downloads = receipts. Two grouped counts for the whole page. */
  private async stats(galleryIds: string[]): Promise<Map<string, GalleryStats>> {
    const result = new Map(galleryIds.map((id) => [id, { views: 0, downloads: 0 }]));
    if (galleryIds.length === 0) return result;
    const [views, downloads] = await Promise.all([
      this.prisma.client.accessEvent.groupBy({ by: ['galleryId'], where: { galleryId: { in: galleryIds }, type: 'open' }, _count: { _all: true } }),
      this.prisma.client.downloadReceipt.groupBy({ by: ['galleryId'], where: { galleryId: { in: galleryIds } }, _count: { _all: true } }),
    ]);
    for (const v of views) result.get(v.galleryId)!.views = v._count._all;
    for (const d of downloads) result.get(d.galleryId)!.downloads = d._count._all;
    return result;
  }

  private async covers(galleries: Array<{ id: string; coverFileId: string | null }>): Promise<Map<string, string>> {
    const covers = new Map<string, string>();
    if (galleries.length === 0) return covers;
    const files = await this.prisma.client.file.findMany({
      where: { galleryId: { in: galleries.map((g) => g.id) }, status: 'ready', previewKey: { not: null } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      distinct: ['galleryId'],
    });
    const chosen = await this.prisma.client.file.findMany({
      where: { id: { in: galleries.flatMap((g) => (g.coverFileId ? [g.coverFileId] : [])) }, status: 'ready' },
    });
    for (const file of [...files, ...chosen]) {
      const url = await this.previewUrl(file);
      if (url) covers.set(file.galleryId, url);
    }
    return covers;
  }

  private previewUrl(file: File): Promise<string | null> {
    if (!file.previewKey || file.status !== 'ready') return Promise.resolve(null);
    return this.storage.signDownload(file.previewKey, OWNER_PREVIEW_TTL_SECONDS);
  }
}
