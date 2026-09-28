import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderKind, OrderStatus, Prisma } from '@photnoo/db';
import type { ListOrdersQuery, UpdateOrderInput } from '@photnoo/shared';
import { ClientsService } from '../clients/clients.service';
import { ImageUploadService } from '../media/image-upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';
import { decimal, delta, egp } from './money';

type Tx = Prisma.TransactionClient;

export type OrderLine = { productId?: string; printItemId?: string; fileId?: string; quantity: number };

export type NewOrder = {
  kind: OrderKind;
  customer: { name: string; phone: string; email?: string | null };
  note?: string | null;
  galleryId?: string | null;
  lines: OrderLine[];
};

type PricedLine = { productId?: string; printItemId?: string; fileId?: string; name: string; detail: string | null; unit: number; quantity: number };

const PAGE_SIZE = 20;
const DAY = 24 * 60 * 60 * 1000;
const THUMB_TTL_SECONDS = 60 * 60;

/** Which status an order may move to from each status. Cancelling asks for confirmation in the app. */
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['in_production', 'cancelled'],
  in_production: ['pending', 'ready', 'cancelled'],
  ready: ['in_production', 'delivered', 'cancelled'],
  delivered: ['ready'],
  cancelled: ['pending'],
};

const orderInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      file: { select: { previewKey: true, blurDataUrl: true, originalName: true } },
      product: { select: { imageKey: true } },
      printItem: { select: { imageKey: true, type: true } },
    },
  },
  gallery: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/**
 * Store and print orders. Payment happens off-platform: the photographer records it (paidAt)
 * and moves the order through its statuses. Totals are always computed here from the
 * photographer's own catalog; a browser never sets a price.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly notifications: NotificationsService,
    private readonly images: ImageUploadService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  // ---------- create ----------

  async create(photographerId: string, input: NewOrder) {
    if (input.lines.length === 0) throw new BadRequestException({ code: 'order_empty', message: 'Choose at least one item.' });
    const priced = input.kind === 'store' ? await this.priceStore(photographerId, input.lines) : await this.pricePrints(photographerId, input);
    const total = priced.reduce((sum, line) => sum + line.unit * line.quantity, 0);

    const order = await this.prisma.client.$transaction(async (tx) => {
      const number = await this.nextNumber(tx, photographerId);
      const clientId = await this.clients.upsertByPhone(photographerId, input.customer, tx);
      return tx.order.create({
        data: {
          photographerId,
          number,
          kind: input.kind,
          clientId,
          galleryId: input.galleryId ?? null,
          customerName: input.customer.name,
          customerPhone: input.customer.phone,
          customerEmail: input.customer.email ?? null,
          note: input.note ?? null,
          totalEgp: decimal(total),
          items: {
            create: priced.map((line) => ({
              productId: line.productId ?? null,
              printItemId: line.printItemId ?? null,
              fileId: line.fileId ?? null,
              name: line.name,
              detail: line.detail,
              unitPriceEgp: decimal(line.unit),
              quantity: line.quantity,
            })),
          },
        },
        include: orderInclude,
      });
    });

    void this.notifications.notify(photographerId, {
      type: 'order_placed',
      orderId: order.id,
      galleryId: order.galleryId ?? undefined,
      data: { number: order.number, kind: order.kind, customerName: order.customerName, totalEgp: egp(order.totalEgp) },
    });
    return this.json(order);
  }

  /** Atomic per-photographer sequence: the first order is #1001. */
  async nextNumber(tx: Tx, photographerId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ lastOrderNumber: number }>>`
      INSERT INTO "PhotographerCounter" ("photographerId", "lastOrderNumber") VALUES (${photographerId}::uuid, 1001)
      ON CONFLICT ("photographerId") DO UPDATE SET "lastOrderNumber" = "PhotographerCounter"."lastOrderNumber" + 1
      RETURNING "lastOrderNumber"`;
    return rows[0]!.lastOrderNumber;
  }

  private async priceStore(photographerId: string, lines: OrderLine[]): Promise<PricedLine[]> {
    const ids = [...new Set(lines.map((l) => l.productId).filter((id): id is string => Boolean(id)))];
    const products = await this.prisma.client.product.findMany({ where: { id: { in: ids }, photographerId, archivedAt: null } });
    return lines.map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) throw new NotFoundException({ code: 'product_not_found', message: 'This product is no longer available.' });
      if (!product.inStock) throw new ConflictException({ code: 'out_of_stock', message: `${product.name} is out of stock.` });
      const unit = egp(product.salePriceEgp ?? product.priceEgp);
      return { productId: product.id, name: product.name, detail: null, unit, quantity: line.quantity };
    });
  }

  private async pricePrints(photographerId: string, input: NewOrder): Promise<PricedLine[]> {
    const ids = [...new Set(input.lines.map((l) => l.printItemId).filter((id): id is string => Boolean(id)))];
    const fileIds = [...new Set(input.lines.map((l) => l.fileId).filter((id): id is string => Boolean(id)))];
    const [items, files] = await Promise.all([
      this.prisma.client.printItem.findMany({ where: { id: { in: ids }, photographerId, archivedAt: null } }),
      this.prisma.client.file.findMany({
        where: { id: { in: fileIds }, status: 'ready', gallery: { photographerId }, ...(input.galleryId ? { galleryId: input.galleryId } : {}) },
        select: { id: true, originalName: true },
      }),
    ]);
    return input.lines.map((line) => {
      const item = items.find((p) => p.id === line.printItemId);
      if (!item || !item.available) throw new NotFoundException({ code: 'print_not_found', message: 'This print option is no longer available.' });
      const file = line.fileId ? files.find((f) => f.id === line.fileId) : undefined;
      if (line.fileId && !file) throw new NotFoundException({ code: 'not_found', message: 'Photo not found.' });
      return {
        printItemId: item.id,
        fileId: file?.id,
        name: item.name,
        detail: [item.size, file?.originalName].filter(Boolean).join(' · ') || null,
        unit: egp(item.priceEgp),
        quantity: line.quantity,
      };
    });
  }

  // ---------- read ----------

  async list(photographerId: string, query: ListOrdersQuery) {
    const where: Prisma.OrderWhereInput = { photographerId, kind: query.kind };
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: cairoDayStart(query.from) } : {}),
        ...(query.to ? { lt: new Date(cairoDayStart(query.to).getTime() + DAY) } : {}),
      };
    }
    const q = query.q?.trim();
    if (q) {
      const number = /^#?\d{1,9}$/.test(q) ? Number(q.replace('#', '')) : null;
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q.replace(/[^\d+]/g, '') || q } },
        ...(number !== null ? [{ number }] : []),
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.client.order.count({ where }),
    ]);
    return { items: await Promise.all(rows.map((row) => this.json(row))), total, page: query.page, pageSize: PAGE_SIZE };
  }

  async get(photographerId: string, id: string) {
    return this.json(await this.find(photographerId, id));
  }

  private async find(photographerId: string, id: string) {
    const order = await this.prisma.client.order.findFirst({ where: { id, photographerId }, include: orderInclude });
    if (!order) throw new NotFoundException({ code: 'not_found', message: 'Order not found.' });
    return order;
  }

  // ---------- update ----------

  async update(photographerId: string, id: string, input: UpdateOrderInput) {
    const order = await this.find(photographerId, id);
    const data: Prisma.OrderUpdateInput = {};
    if (input.status && input.status !== order.status) {
      if (!NEXT[order.status].includes(input.status)) {
        throw new ConflictException({
          code: 'invalid_status',
          message: 'This order cannot move to that status.',
          details: { from: order.status, allowed: NEXT[order.status] },
        });
      }
      data.status = input.status;
    }
    if (input.paid !== undefined) data.paidAt = input.paid ? (order.paidAt ?? new Date()) : null;
    const updated = await this.prisma.client.order.update({ where: { id: order.id }, data, include: orderInclude });
    return this.json(updated);
  }

  // ---------- stats ----------

  /** Counts per status, and paid revenue with its change against the previous 30 days. */
  async stats(photographerId: string, kind: OrderKind, now = new Date()) {
    const last30 = new Date(now.getTime() - 30 * DAY);
    const prev30 = new Date(now.getTime() - 60 * DAY);
    const revenueWhere = { photographerId, kind, paidAt: { not: null }, status: { not: 'cancelled' as const } };
    const [byStatus, revenue, revenueNow, revenuePrev, ordersNow, ordersPrev] = await Promise.all([
      this.prisma.client.order.groupBy({ by: ['status'], where: { photographerId, kind }, _count: { _all: true } }),
      this.prisma.client.order.aggregate({ where: revenueWhere, _sum: { totalEgp: true } }),
      this.prisma.client.order.aggregate({ where: { ...revenueWhere, createdAt: { gte: last30 } }, _sum: { totalEgp: true } }),
      this.prisma.client.order.aggregate({ where: { ...revenueWhere, createdAt: { gte: prev30, lt: last30 } }, _sum: { totalEgp: true } }),
      this.prisma.client.order.count({ where: { photographerId, kind, createdAt: { gte: last30 } } }),
      this.prisma.client.order.count({ where: { photographerId, kind, createdAt: { gte: prev30, lt: last30 } } }),
    ]);
    const count = (status: OrderStatus) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const orders = byStatus.reduce((sum, row) => sum + row._count._all, 0);
    return {
      orders: { value: orders, delta: delta(ordersNow, ordersPrev) },
      revenueEgp: { value: egp(revenue._sum.totalEgp), delta: delta(egp(revenueNow._sum.totalEgp), egp(revenuePrev._sum.totalEgp)) },
      pending: count('pending'),
      inProduction: count('in_production'),
      ready: count('ready'),
      delivered: count('delivered'),
      cancelled: count('cancelled'),
    };
  }

  // ---------- json ----------

  async json(order: OrderRow) {
    return {
      id: order.id,
      number: order.number,
      kind: order.kind,
      status: order.status,
      allowedStatuses: NEXT[order.status],
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      note: order.note,
      totalEgp: egp(order.totalEgp),
      paidAt: order.paidAt,
      clientId: order.clientId,
      gallery: order.gallery,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: await Promise.all(
        order.items.map(async (item) => ({
          id: item.id,
          name: item.name,
          detail: item.detail,
          unitPriceEgp: egp(item.unitPriceEgp),
          quantity: item.quantity,
          lineTotalEgp: Math.round(egp(item.unitPriceEgp) * item.quantity * 100) / 100,
          productId: item.productId,
          printItemId: item.printItemId,
          printType: item.printItem?.type ?? null,
          fileId: item.fileId,
          fileName: item.file?.originalName ?? null,
          blurDataUrl: item.file?.blurDataUrl ?? null,
          thumbnailUrl: await this.thumbnail(item),
        })),
      ),
    };
  }

  private async thumbnail(item: OrderRow['items'][number]): Promise<string | null> {
    if (item.file?.previewKey) return this.storage.signDownload(item.file.previewKey, THUMB_TTL_SECONDS);
    const key = item.product?.imageKey ?? item.printItem?.imageKey;
    return key ? this.images.url(this.images.previewKeyOf(key), THUMB_TTL_SECONDS) : null;
  }
}

/** Midnight in Cairo (which observes summer time) for a YYYY-MM-DD day, as a UTC instant. */
export function cairoDayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(y, m - 1, d);
  const offset = cairoOffsetMinutes(new Date(utcMidnight));
  const guess = utcMidnight - offset * 60_000;
  // The offset at the actual instant may differ on a switch day; one correction settles it.
  const corrected = cairoOffsetMinutes(new Date(guess));
  return new Date(utcMidnight - corrected * 60_000);
}

function cairoOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? '');
  if (!match) return 120;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}
