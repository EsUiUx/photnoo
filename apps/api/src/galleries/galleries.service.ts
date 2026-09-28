import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateFolderInput, CreateGalleryInput } from '@photnoo/shared';
import type { Prisma } from '@photnoo/db';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 20;

export type GalleryRow = Prisma.GalleryGetPayload<object>;

/** Galleries belong to exactly one photographer; every query here is scoped by photographerId. */
@Injectable()
export class GalleriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(photographerId: string, input: CreateGalleryInput) {
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

  /** Cursor pagination, newest first (PRD API rules). Purged/anonymised galleries are history, not listed. */
  async list(photographerId: string, cursor?: string) {
    const rows = await this.prisma.client.gallery.findMany({
      where: { photographerId, state: { in: ['draft', 'active', 'closed'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)!.id : null };
  }

  /** Throws 404 for galleries of other photographers, so their existence is never revealed. */
  async get(photographerId: string, galleryId: string) {
    const gallery = await this.prisma.client.gallery.findFirst({ where: { id: galleryId, photographerId } });
    if (!gallery) throw new NotFoundException({ code: 'not_found', message: 'Gallery not found.' });
    return gallery;
  }

  async detail(photographerId: string, galleryId: string) {
    const gallery = await this.get(photographerId, galleryId);
    const [folders, files] = await Promise.all([
      this.prisma.client.folder.findMany({ where: { galleryId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.client.file.findMany({
        where: { galleryId, status: { in: ['uploading', 'processing', 'ready', 'rejected'] } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return { gallery, folders, files };
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
}
