import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PrintItem } from '@photnoo/db';
import type { ClientPrintOrderInput, CreatePrintItemInput, UpdatePrintItemInput } from '@photnoo/shared';
import { ImageUploadService, type UploadedImage } from '../media/image-upload.service';
import { decimal, egp } from '../orders/money';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';

const TYPE_ORDER = ['album', 'frame', 'canvas', 'magazine', 'wooden', 'other'] as const;

/**
 * The print catalog (Figma 0:4259) and print orders placed by clients from their gallery.
 * Prints are offered when the photographer turns them on and the gallery does not opt out.
 */
@Injectable()
export class PrintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageUploadService,
    private readonly orders: OrdersService,
  ) {}

  // ---------- settings ----------

  async settings(photographerId: string) {
    const p = await this.prisma.client.photographer.findUniqueOrThrow({ where: { id: photographerId }, select: { printsEnabled: true } });
    const [optedOut, available] = await Promise.all([
      this.prisma.client.gallery.count({ where: { photographerId, printsEnabled: false, state: { in: ['draft', 'active'] } } }),
      this.prisma.client.printItem.count({ where: { photographerId, archivedAt: null, available: true } }),
    ]);
    return { printsEnabled: p.printsEnabled, availableItems: available, galleriesOptedOut: optedOut };
  }

  async setEnabled(photographerId: string, enabled: boolean) {
    await this.prisma.client.photographer.update({ where: { id: photographerId }, data: { printsEnabled: enabled } });
    return this.settings(photographerId);
  }

  /** Per-gallery override (the galleries screens own the control). */
  async galleryPrints(photographerId: string, galleryId: string) {
    const [gallery, owner] = await Promise.all([
      this.prisma.client.gallery.findFirst({ where: { id: galleryId, photographerId }, select: { id: true, printsEnabled: true } }),
      this.prisma.client.photographer.findUniqueOrThrow({ where: { id: photographerId }, select: { printsEnabled: true } }),
    ]);
    if (!gallery) throw new NotFoundException({ code: 'not_found', message: 'Gallery not found.' });
    return { galleryId: gallery.id, printsEnabled: gallery.printsEnabled, offered: owner.printsEnabled && gallery.printsEnabled };
  }

  async setGalleryPrints(photographerId: string, galleryId: string, enabled: boolean) {
    const updated = await this.prisma.client.gallery.updateMany({ where: { id: galleryId, photographerId }, data: { printsEnabled: enabled } });
    if (updated.count === 0) throw new NotFoundException({ code: 'not_found', message: 'Gallery not found.' });
    return this.galleryPrints(photographerId, galleryId);
  }

  // ---------- catalog ----------

  async items(photographerId: string) {
    const rows = await this.prisma.client.printItem.findMany({
      where: { photographerId, archivedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    rows.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    return { items: await Promise.all(rows.map((row) => this.json(row))) };
  }

  async create(photographerId: string, input: CreatePrintItemInput) {
    const position = await this.prisma.client.printItem.count({ where: { photographerId, type: input.type, archivedAt: null } });
    const item = await this.prisma.client.printItem.create({
      data: {
        photographerId,
        type: input.type,
        name: input.name,
        size: input.size,
        priceEgp: decimal(input.priceEgp),
        available: input.available ?? true,
        position,
      },
    });
    return this.json(item);
  }

  async update(photographerId: string, id: string, input: UpdatePrintItemInput) {
    const item = await this.find(photographerId, id);
    const updated = await this.prisma.client.printItem.update({
      where: { id: item.id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.size !== undefined ? { size: input.size } : {}),
        ...(input.priceEgp !== undefined ? { priceEgp: decimal(input.priceEgp) } : {}),
        ...(input.available !== undefined ? { available: input.available } : {}),
      },
    });
    return this.json(updated);
  }

  /** Items that were ordered are archived, so their orders keep reading the same. */
  async remove(photographerId: string, id: string): Promise<{ archived: boolean }> {
    const item = await this.find(photographerId, id);
    const ordered = await this.prisma.client.orderItem.count({ where: { printItemId: item.id } });
    if (ordered > 0) {
      await this.prisma.client.printItem.update({ where: { id: item.id }, data: { archivedAt: new Date(), available: false } });
      return { archived: true };
    }
    await this.prisma.client.printItem.delete({ where: { id: item.id } });
    await this.images.remove(item.imageKey).catch(() => {});
    return { archived: false };
  }

  async setImage(photographerId: string, id: string, file: UploadedImage | undefined) {
    const item = await this.find(photographerId, id);
    const stored = await this.images.store(photographerId, 'print', file);
    const updated = await this.prisma.client.printItem.update({ where: { id: item.id }, data: { imageKey: stored.imageKey } });
    await this.images.remove(item.imageKey).catch(() => {});
    return this.json(updated);
  }

  async removeImage(photographerId: string, id: string) {
    const item = await this.find(photographerId, id);
    const updated = await this.prisma.client.printItem.update({ where: { id: item.id }, data: { imageKey: null } });
    await this.images.remove(item.imageKey).catch(() => {});
    return this.json(updated);
  }

  private async find(photographerId: string, id: string) {
    const item = await this.prisma.client.printItem.findFirst({ where: { id, photographerId, archivedAt: null } });
    if (!item) throw new NotFoundException({ code: 'not_found', message: 'Print option not found.' });
    return item;
  }

  async stats(photographerId: string) {
    const s = await this.orders.stats(photographerId, 'print');
    return { pending: s.pending, inProduction: s.inProduction, ready: s.ready, delivered: s.delivered, orders: s.orders, revenueEgp: s.revenueEgp };
  }

  // ---------- client side ----------

  /** What a client with an open, unlocked gallery may order. */
  async offer(gallery: { id: string; photographerId: string; printsEnabled: boolean; clientName: string | null; clientPhone: string | null }) {
    const owner = await this.prisma.client.photographer.findUniqueOrThrow({ where: { id: gallery.photographerId }, select: { printsEnabled: true } });
    const on = owner.printsEnabled && gallery.printsEnabled;
    const rows = on
      ? await this.prisma.client.printItem.findMany({
          where: { photographerId: gallery.photographerId, archivedAt: null, available: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        })
      : [];
    rows.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    return {
      enabled: on && rows.length > 0,
      items: await Promise.all(
        rows.map(async (item) => ({
          id: item.id,
          type: item.type,
          name: item.name,
          size: item.size,
          priceEgp: egp(item.priceEgp),
          previewUrl: await this.images.url(item.imageKey ? this.images.previewKeyOf(item.imageKey) : null),
        })),
      ),
      customer: { name: gallery.clientName, phone: gallery.clientPhone },
    };
  }

  async clientOrder(
    gallery: { id: string; photographerId: string; printsEnabled: boolean; clientName: string | null; clientPhone: string | null },
    input: ClientPrintOrderInput,
  ) {
    const owner = await this.prisma.client.photographer.findUniqueOrThrow({ where: { id: gallery.photographerId }, select: { printsEnabled: true } });
    if (!owner.printsEnabled || !gallery.printsEnabled) {
      throw new ConflictException({ code: 'prints_unavailable', message: 'Prints are not offered for this gallery.' });
    }
    const file = await this.prisma.client.file.findFirst({ where: { id: input.fileId, galleryId: gallery.id, status: 'ready' }, select: { id: true } });
    if (!file) throw new NotFoundException({ code: 'not_found', message: 'Photo not found.' });
    const order = await this.orders.create(gallery.photographerId, {
      kind: 'print',
      galleryId: gallery.id,
      customer: { name: input.name, phone: input.phone },
      note: input.note,
      lines: [{ printItemId: input.printItemId, fileId: file.id, quantity: input.quantity }],
    });
    return { number: order.number, totalEgp: order.totalEgp, status: order.status };
  }

  private async json(item: PrintItem) {
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      size: item.size,
      priceEgp: egp(item.priceEgp),
      available: item.available,
      imageUrl: await this.images.url(item.imageKey),
      previewUrl: await this.images.url(item.imageKey ? this.images.previewKeyOf(item.imageKey) : null),
      createdAt: item.createdAt,
    };
  }
}
