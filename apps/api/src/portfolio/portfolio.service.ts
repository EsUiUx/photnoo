import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PortfolioRules,
  type PortfolioUploadInput,
  type UpdatePortfolioItemInput,
} from '@photnoo/shared';
import type { PortfolioItem } from '@photnoo/db';
import { ImageUploadService, type UploadedImage } from '../media/image-upload.service';
import { PrismaService } from '../prisma/prisma.service';

/** Signed image links live one hour; pages refetch well before that. */
const URL_TTL_SECONDS = 60 * 60;

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * The photographer's public showcase. Images are re-encoded copies owned by the photographer,
 * never gallery files, so nothing a client received is ever exposed publicly. They do not use
 * the storage allowance; the count is capped at PortfolioRules.maxItems instead.
 * Every query is scoped by photographerId.
 */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageUploadService,
  ) {}

  async list(photographerId: string) {
    const [photographer, items] = await Promise.all([
      this.prisma.client.photographer.findUniqueOrThrow({
        where: { id: photographerId },
        select: { slug: true, portfolioPublished: true },
      }),
      this.prisma.client.portfolioItem.findMany({
        where: { photographerId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    return {
      published: photographer.portfolioPublished,
      slug: photographer.slug,
      maxItems: PortfolioRules.maxItems,
      items: await Promise.all(items.map((item) => this.itemJson(item))),
    };
  }

  async add(photographerId: string, file: UploadedImage | undefined, input: PortfolioUploadInput) {
    const count = await this.prisma.client.portfolioItem.count({ where: { photographerId } });
    if (count >= PortfolioRules.maxItems) {
      throw new ConflictException({
        code: 'portfolio_full',
        message: `Your portfolio can hold up to ${PortfolioRules.maxItems} images. Remove some to add more.`,
      });
    }
    const stored = await this.images.store(photographerId, 'portfolio', file);
    const last = await this.prisma.client.portfolioItem.aggregate({ where: { photographerId }, _max: { position: true } });
    try {
      const item = await this.prisma.client.portfolioItem.create({
        data: {
          photographerId,
          imageKey: stored.imageKey,
          previewKey: stored.previewKey,
          blurDataUrl: stored.blurDataUrl,
          width: stored.width,
          height: stored.height,
          caption: clean(input.caption),
          category: clean(input.category),
          position: (last._max.position ?? -1) + 1,
        },
      });
      return this.itemJson(item);
    } catch (error) {
      await this.images.remove(stored.imageKey).catch(() => {});
      throw error;
    }
  }

  async update(photographerId: string, id: string, input: UpdatePortfolioItemInput) {
    const item = await this.find(photographerId, id);
    const updated = await this.prisma.client.portfolioItem.update({
      where: { id: item.id },
      data: {
        ...(input.caption !== undefined ? { caption: clean(input.caption) } : {}),
        ...(input.category !== undefined ? { category: clean(input.category) } : {}),
      },
    });
    return this.itemJson(updated);
  }

  async remove(photographerId: string, id: string) {
    const item = await this.find(photographerId, id);
    await this.prisma.client.portfolioItem.delete({ where: { id: item.id } });
    await this.images.remove(item.imageKey).catch(() => {});
  }

  /**
   * `ids` in their new order. Items missing from the list (e.g. uploaded meanwhile) keep their
   * relative order after the listed ones. Ids that are not this photographer's are rejected.
   */
  async reorder(photographerId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const items = await this.prisma.client.portfolioItem.findMany({
      where: { photographerId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    const owned = new Set(items.map((i) => i.id));
    if (unique.some((id) => !owned.has(id))) {
      throw new NotFoundException({ code: 'not_found', message: 'Some of these images are not in your portfolio.' });
    }
    const listed = new Set(unique);
    const order = [...unique, ...items.map((i) => i.id).filter((id) => !listed.has(id))];
    await this.prisma.client.$transaction(
      order.map((id, position) =>
        this.prisma.client.portfolioItem.updateMany({ where: { id, photographerId }, data: { position } }),
      ),
    );
    return this.list(photographerId);
  }

  async settings(photographerId: string, published: boolean) {
    const photographer = await this.prisma.client.photographer.findUniqueOrThrow({
      where: { id: photographerId },
      select: { slug: true },
    });
    if (published && !photographer.slug) {
      throw new ConflictException({
        code: 'slug_required',
        message: 'Choose your public page address in Settings before publishing.',
      });
    }
    await this.prisma.client.photographer.update({ where: { id: photographerId }, data: { portfolioPublished: published } });
    return { published, slug: photographer.slug };
  }

  // ---------- helpers ----------

  private async find(photographerId: string, id: string) {
    const item = await this.prisma.client.portfolioItem.findFirst({ where: { id, photographerId } });
    if (!item) throw new NotFoundException({ code: 'not_found', message: 'This image is not in your portfolio.' });
    return item;
  }

  async itemJson(item: PortfolioItem) {
    const [url, previewUrl] = await Promise.all([
      this.images.url(item.imageKey, URL_TTL_SECONDS),
      this.images.url(item.previewKey, URL_TTL_SECONDS),
    ]);
    return {
      id: item.id,
      url: url!,
      previewUrl: previewUrl!,
      blurDataUrl: item.blurDataUrl,
      width: item.width,
      height: item.height,
      caption: item.caption,
      category: item.category,
      position: item.position,
      createdAt: item.createdAt,
    };
  }
}
