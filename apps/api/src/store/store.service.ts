import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Product } from '@photnoo/db';
import type { CommerceSettingsInput, CreateProductInput, PublicStoreOrderInput, UpdateProductInput } from '@photnoo/shared';
import { ImageUploadService, type UploadedImage } from '../media/image-upload.service';
import { decimal, delta, egp } from '../orders/money';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;
/** Where the public shop lives; the web app serves it at /<locale>/p/<slug>/shop. */
const PUBLIC_HOST = 'photnoo.com';

/**
 * The photographer's store (Figma 0:4111): products with an optional sale price, stock, one
 * picture each, and a public shop at photnoo.com/p/<slug>/shop where clients place orders.
 */
@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageUploadService,
    private readonly orders: OrdersService,
  ) {}

  // ---------- settings ----------

  async settings(photographerId: string) {
    const p = await this.prisma.client.photographer.findUniqueOrThrow({
      where: { id: photographerId },
      select: { slug: true, storeEnabled: true, printsEnabled: true },
    });
    return { ...p, shopPath: p.slug ? `/p/${p.slug}/shop` : null, shopUrl: p.slug ? `${PUBLIC_HOST}/p/${p.slug}/shop` : null };
  }

  async updateSettings(photographerId: string, input: CommerceSettingsInput) {
    await this.prisma.client.photographer.update({
      where: { id: photographerId },
      data: {
        ...(input.storeEnabled !== undefined ? { storeEnabled: input.storeEnabled } : {}),
        ...(input.printsEnabled !== undefined ? { printsEnabled: input.printsEnabled } : {}),
      },
    });
    return this.settings(photographerId);
  }

  // ---------- products ----------

  async products(photographerId: string) {
    const rows = await this.prisma.client.product.findMany({
      where: { photographerId, archivedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { orderItems: true } } },
    });
    return { items: await Promise.all(rows.map((row) => this.json(row, row._count.orderItems))) };
  }

  async create(photographerId: string, input: CreateProductInput) {
    const product = await this.prisma.client.product.create({
      data: {
        photographerId,
        name: input.name,
        description: input.description ?? null,
        priceEgp: decimal(input.priceEgp),
        salePriceEgp: input.salePriceEgp != null ? decimal(input.salePriceEgp) : null,
        inStock: input.inStock ?? true,
      },
    });
    return this.json(product, 0);
  }

  async update(photographerId: string, id: string, input: UpdateProductInput) {
    const product = await this.find(photographerId, id);
    const price = input.priceEgp ?? egp(product.priceEgp);
    const sale = input.salePriceEgp !== undefined ? input.salePriceEgp : product.salePriceEgp ? egp(product.salePriceEgp) : null;
    if (sale != null && sale >= price) {
      throw new BadRequestException({
        code: 'validation_failed',
        message: 'Some fields are invalid.',
        fields: [{ path: 'salePriceEgp', message: 'The sale price must be lower than the price.' }],
      });
    }
    const updated = await this.prisma.client.product.update({
      where: { id: product.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        priceEgp: decimal(price),
        salePriceEgp: sale != null ? decimal(sale) : null,
        ...(input.inStock !== undefined ? { inStock: input.inStock } : {}),
      },
      include: { _count: { select: { orderItems: true } } },
    });
    return this.json(updated, updated._count.orderItems);
  }

  /** Products that were ordered are archived, so their orders keep reading the same. */
  async remove(photographerId: string, id: string): Promise<{ archived: boolean }> {
    const product = await this.find(photographerId, id);
    const ordered = await this.prisma.client.orderItem.count({ where: { productId: product.id } });
    if (ordered > 0) {
      await this.prisma.client.product.update({ where: { id: product.id }, data: { archivedAt: new Date() } });
      return { archived: true };
    }
    await this.prisma.client.product.delete({ where: { id: product.id } });
    await this.images.remove(product.imageKey).catch(() => {});
    return { archived: false };
  }

  async setImage(photographerId: string, id: string, file: UploadedImage | undefined) {
    const product = await this.find(photographerId, id);
    const stored = await this.images.store(photographerId, 'product', file);
    const updated = await this.prisma.client.product.update({
      where: { id: product.id },
      data: { imageKey: stored.imageKey },
      include: { _count: { select: { orderItems: true } } },
    });
    await this.images.remove(product.imageKey).catch(() => {});
    return this.json(updated, updated._count.orderItems);
  }

  async removeImage(photographerId: string, id: string) {
    const product = await this.find(photographerId, id);
    const updated = await this.prisma.client.product.update({
      where: { id: product.id },
      data: { imageKey: null },
      include: { _count: { select: { orderItems: true } } },
    });
    await this.images.remove(product.imageKey).catch(() => {});
    return this.json(updated, updated._count.orderItems);
  }

  private async find(photographerId: string, id: string) {
    const product = await this.prisma.client.product.findFirst({ where: { id, photographerId, archivedAt: null } });
    if (!product) throw new NotFoundException({ code: 'not_found', message: 'Product not found.' });
    return product;
  }

  // ---------- stats ----------

  async stats(photographerId: string, now = new Date()) {
    const last30 = new Date(now.getTime() - 30 * DAY);
    const prev30 = new Date(now.getTime() - 60 * DAY);
    const live = { photographerId, archivedAt: null };
    const [products, productsNow, productsPrev, orders] = await Promise.all([
      this.prisma.client.product.count({ where: live }),
      this.prisma.client.product.count({ where: { ...live, createdAt: { gte: last30 } } }),
      this.prisma.client.product.count({ where: { ...live, createdAt: { gte: prev30, lt: last30 } } }),
      this.orders.stats(photographerId, 'store', now),
    ]);
    return {
      products: { value: products, delta: delta(productsNow, productsPrev) },
      orders: orders.orders,
      revenueEgp: orders.revenueEgp,
      pending: orders.pending,
    };
  }

  // ---------- public shop ----------

  /** Unknown slugs, disabled stores and inactive accounts all look the same from outside. */
  private async shopOwner(slug: string) {
    const owner = await this.prisma.client.photographer.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, name: true, studioName: true, avatarKey: true, logoKey: true, phone: true, bio: true, city: true, slug: true, storeEnabled: true, status: true, deletedAt: true },
    });
    if (!owner || !owner.storeEnabled || owner.status !== 'active' || owner.deletedAt) {
      throw new NotFoundException({ code: 'shop_not_found', message: 'This shop is not available.' });
    }
    return owner;
  }

  async publicShop(slug: string) {
    const owner = await this.shopOwner(slug);
    const products = await this.prisma.client.product.findMany({
      where: { photographerId: owner.id, archivedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });
    return {
      photographer: {
        name: owner.name,
        studioName: owner.studioName,
        slug: owner.slug,
        city: owner.city,
        bio: owner.bio,
        whatsapp: owner.phone,
        avatarUrl: await this.images.url(owner.avatarKey),
      },
      products: await Promise.all(
        products.map(async (p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceEgp: egp(p.priceEgp),
          salePriceEgp: p.salePriceEgp ? egp(p.salePriceEgp) : null,
          inStock: p.inStock,
          imageUrl: await this.images.url(p.imageKey),
          previewUrl: await this.images.url(p.imageKey ? this.images.previewKeyOf(p.imageKey) : null),
        })),
      ),
    };
  }

  async placePublicOrder(slug: string, input: PublicStoreOrderInput) {
    const owner = await this.shopOwner(slug);
    const order = await this.orders.create(owner.id, {
      kind: 'store',
      customer: { name: input.name, phone: input.phone, email: input.email },
      note: input.note,
      lines: input.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    });
    // The customer sees only what they need for their receipt.
    return {
      number: order.number,
      totalEgp: order.totalEgp,
      status: order.status,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPriceEgp: i.unitPriceEgp })),
      photographer: { name: owner.studioName ?? owner.name, whatsapp: owner.phone },
    };
  }

  // ---------- json ----------

  private async json(p: Product, orderCount: number) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      priceEgp: egp(p.priceEgp),
      salePriceEgp: p.salePriceEgp ? egp(p.salePriceEgp) : null,
      inStock: p.inStock,
      imageUrl: await this.images.url(p.imageKey),
      previewUrl: await this.images.url(p.imageKey ? this.images.previewKeyOf(p.imageKey) : null),
      orderCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
