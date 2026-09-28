import { Injectable, NotFoundException } from '@nestjs/common';
import { ImageUploadService } from '../media/image-upload.service';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from './portfolio.service';

const URL_TTL_SECONDS = 60 * 60;

/**
 * The public page at /p/<slug>. Only published portfolios of active accounts are served, and
 * only portfolio images (never gallery files). An unknown slug and an unpublished portfolio
 * answer the same 404, so the page does not reveal which slugs exist.
 */
@Injectable()
export class PublicProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageUploadService,
    private readonly portfolio: PortfolioService,
  ) {}

  async get(slug: string) {
    const normalized = slug.trim().toLowerCase();
    const photographer = normalized
      ? await this.prisma.client.photographer.findFirst({
          where: { slug: normalized, status: 'active', deletedAt: null, portfolioPublished: true },
        })
      : null;
    if (!photographer) {
      throw new NotFoundException({ code: 'profile_not_found', message: 'There is no public portfolio at this address.' });
    }

    const items = await this.prisma.client.portfolioItem.findMany({
      where: { photographerId: photographer.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const categories: string[] = [];
    for (const item of items) {
      if (item.category && !categories.some((c) => c.toLowerCase() === item.category!.toLowerCase())) categories.push(item.category);
    }

    const [avatarUrl, logoUrl, serialized] = await Promise.all([
      this.images.url(photographer.avatarKey, URL_TTL_SECONDS),
      this.images.url(photographer.logoKey, URL_TTL_SECONDS),
      Promise.all(items.map((item) => this.portfolio.itemJson(item))),
    ]);

    return {
      slug: photographer.slug,
      name: photographer.name,
      studioName: photographer.studioName,
      city: photographer.city,
      bio: photographer.bio,
      avatarUrl,
      logoUrl,
      links: {
        instagram: photographer.instagramUrl,
        behance: photographer.behanceUrl,
        website: photographer.websiteUrl,
        other: photographer.otherUrl,
      },
      /** E.164; the page turns it into a WhatsApp link. */
      whatsapp: photographer.phone,
      storeEnabled: photographer.storeEnabled,
      categories,
      items: serialized.map(({ id, url, previewUrl, blurDataUrl, width, height, caption, category }) => ({
        id,
        url,
        previewUrl,
        blurDataUrl,
        width,
        height,
        caption,
        category,
      })),
      /** Signed image links expire; the page should not be cached longer than this. */
      expiresInSeconds: URL_TTL_SECONDS,
    };
  }
}
