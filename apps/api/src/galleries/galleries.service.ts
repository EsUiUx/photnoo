import { ConflictException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateFolderInput, CreateGalleryInput, UpdateGalleryInput } from '@photnoo/shared';
import type { File, Prisma } from '@photnoo/db';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';

const PAGE_SIZE = 20;
/** Photographer-side preview links are short: the dashboard refetches them on every visit. */
const OWNER_PREVIEW_TTL_SECONDS = 60 * 60;
const LISTED_STATES = ['draft', 'active', 'closed'] as const;

export type GalleryStats = { views: number; downloads: number };

/** Galleries belong to exactly one photographer; every query here is scoped by photographerId. */
@Injectable()
export class GalleriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
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
    return this.prisma.client.gallery.create({
      data: {
        photographerId,
        name: input.name,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        clientEmail: input.clientEmail ?? null,
      },
    });
  }

  /** Cursor pagination, newest first. Purged/anonymised galleries are history, not listed. */
  async list(photographerId: string, options: { cursor?: string; q?: string; take?: number } = {}) {
    const take = options.take ?? PAGE_SIZE;
    const where: Prisma.GalleryWhereInput = {
      photographerId,
      state: { in: [...LISTED_STATES] },
      ...(options.q
        ? {
            OR: [
              { name: { contains: options.q, mode: 'insensitive' } },
              { clientName: { contains: options.q, mode: 'insensitive' } },
              { clientPhone: { contains: options.q } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.client.gallery.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const [stats, covers] = await Promise.all([this.stats(items.map((g) => g.id)), this.covers(items)]);
    return {
      items: items.map((gallery) => ({ gallery, stats: stats.get(gallery.id)!, coverUrl: covers.get(gallery.id) ?? null })),
      nextCursor: hasMore ? items.at(-1)!.id : null,
    };
  }

  /** Throws 404 for galleries of other photographers, so their existence is never revealed. */
  async get(photographerId: string, galleryId: string) {
    const gallery = await this.prisma.client.gallery.findFirst({ where: { id: galleryId, photographerId } });
    if (!gallery) throw new NotFoundException({ code: 'not_found', message: 'Gallery not found.' });
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

  /** Name and client details can change at any time; the link and password stay the same. */
  async update(photographerId: string, galleryId: string, input: UpdateGalleryInput) {
    const gallery = await this.get(photographerId, galleryId);
    if (gallery.state === 'purged' || gallery.state === 'anonymised') {
      throw new ConflictException({ code: 'gallery_deleted', message: 'This gallery was deleted.' });
    }
    if (input.coverFileId) {
      const cover = await this.prisma.client.file.findFirst({ where: { id: input.coverFileId, galleryId, status: 'ready' } });
      if (!cover) throw new NotFoundException({ code: 'not_found', message: 'Cover photo not found in this gallery.' });
    }
    return this.prisma.client.gallery.update({
      where: { id: galleryId },
      data: {
        name: input.name,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        clientEmail: input.clientEmail,
        coverFileId: input.coverFileId,
      },
    });
  }

  /** PRD P-13 Delete: access ends now and files are deleted now. Allowance is not refunded. */
  async remove(photographerId: string, galleryId: string) {
    const gallery = await this.get(photographerId, galleryId);
    if (gallery.state === 'purged' || gallery.state === 'anonymised') return;
    await this.lifecycle.purgeGallery(gallery.id, 'deleted_by_photographer');
  }

  async createFolder(photographerId: string, galleryId: string, input: CreateFolderInput) {
    const gallery = await this.get(photographerId, galleryId);
    const count = await this.prisma.client.folder.count({ where: { galleryId: gallery.id } });
    try {
      return await this.prisma.client.folder.create({ data: { galleryId: gallery.id, name: input.name, position: count } });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: 'folder_exists', message: 'A folder with this name already exists.' });
      }
      throw err;
    }
  }

  /** Deleting a folder keeps its photos: they move to the top level of the gallery. */
  async deleteFolder(photographerId: string, folderId: string) {
    const folder = await this.prisma.client.folder.findFirst({ where: { id: folderId, gallery: { photographerId } } });
    if (!folder) throw new NotFoundException({ code: 'not_found', message: 'Folder not found.' });
    await this.prisma.client.$transaction([
      this.prisma.client.file.updateMany({ where: { folderId }, data: { folderId: null } }),
      this.prisma.client.folder.delete({ where: { id: folderId } }),
    ]);
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

  /** Dashboard numbers (Figma "Overview"): all from counters and indexed counts, no full scans. */
  async dashboard(photographerId: string) {
    const [clients, activeGalleries, downloads, subscription, recent, recentEvents, expiringSoon] = await Promise.all([
      this.prisma.client.gallery.groupBy({
        by: ['clientPhone'],
        where: { photographerId, clientPhone: { not: null } },
      }),
      this.prisma.client.gallery.count({ where: { photographerId, state: 'active' } }),
      this.prisma.client.downloadReceipt.count({ where: { gallery: { photographerId } } }),
      this.prisma.client.subscription.findFirst({ where: { photographerId }, orderBy: { createdAt: 'desc' } }),
      this.list(photographerId, { take: 5 }),
      this.recentActivity(photographerId),
      this.prisma.client.gallery.findMany({
        where: { photographerId, state: 'active', expiresAt: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
        select: { id: true, name: true, expiresAt: true },
        take: 3,
      }),
    ]);
    return {
      clients: clients.length,
      activeGalleries,
      downloads,
      storage: subscription
        ? { usedBytes: subscription.usedBytes, allowanceBytes: subscription.allowanceBytes, state: subscription.state }
        : null,
      recentGalleries: recent.items,
      activity: [
        ...expiringSoon.map((g) => ({ type: 'expiring' as const, galleryId: g.id, galleryName: g.name, at: g.expiresAt! })),
        ...recentEvents,
      ].slice(0, 5),
    };
  }

  // ---------- helpers ----------

  private async recentActivity(photographerId: string) {
    const [opens, receipts] = await Promise.all([
      this.prisma.client.accessEvent.findMany({
        where: { type: 'open', gallery: { photographerId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { gallery: { select: { id: true, name: true, clientName: true } } },
      }),
      this.prisma.client.downloadReceipt.findMany({
        where: { gallery: { photographerId } },
        orderBy: { createdAt: 'desc' },
        distinct: ['galleryId'],
        take: 5,
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
