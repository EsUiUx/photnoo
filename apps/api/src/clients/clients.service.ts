import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ClientInput, UpdateClientInput } from '@photnoo/shared';
import type { Client, Prisma } from '@photnoo/db';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

const PAGE_SIZE = 24;
const ORDERS_PAGE_SIZE = 5;
/** Galleries still worth counting: purged/anonymised ones are history. */
const LISTED_STATES = ['draft', 'active', 'closed'] as const;
/** Gallery snapshots follow client edits only while the delivery is still open. */
const OPEN_STATES = ['draft', 'active'] as const;

const duplicate = () =>
  new ConflictException({ code: 'client_exists', message: 'A client with this phone number already exists.' });

const notFound = () => new NotFoundException({ code: 'not_found', message: 'Client not found.' });

function isUniqueViolation(err: unknown) {
  return (err as { code?: string }).code === 'P2002';
}

/**
 * Managed clients. A client is keyed by phone per photographer, so a gallery or an order
 * with a known phone attaches to the existing client instead of creating a duplicate.
 * Every query is scoped by photographerId.
 */
@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds or creates the client for this phone and returns its id. Fills in a missing email
   * but never overwrites a name or email the photographer already set. Returns null without a
   * phone or name.
   */
  async upsertByPhone(
    photographerId: string,
    input: { name?: string | null; phone?: string | null; email?: string | null },
    tx: Tx = this.prisma.client,
  ): Promise<string | null> {
    const phone = input.phone?.trim();
    const name = input.name?.trim();
    if (!phone || !name) return null;
    const existing = await tx.client.findUnique({
      where: { photographerId_phone: { photographerId, phone } },
      select: { id: true, email: true },
    });
    if (existing) {
      if (!existing.email && input.email) await tx.client.update({ where: { id: existing.id }, data: { email: input.email } });
      return existing.id;
    }
    const created = await tx.client.create({
      data: { photographerId, name, phone, email: input.email || null },
      select: { id: true },
    });
    return created.id;
  }

  /** Throws 404 for other photographers' clients, so their existence is never revealed. */
  async get(photographerId: string, clientId: string, tx: Tx = this.prisma.client): Promise<Client> {
    const client = await tx.client.findFirst({ where: { id: clientId, photographerId } });
    if (!client) throw notFound();
    return client;
  }

  /** Newest first, cursor-paged, with each client's gallery count and last delivery. */
  async list(photographerId: string, options: { q?: string; cursor?: string; take?: number } = {}) {
    const take = options.take ?? PAGE_SIZE;
    const q = options.q;
    const where: Prisma.ClientWhereInput = {
      photographerId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q.replace(/\s/g, '') } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.client.client.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: { _count: { select: { galleries: { where: { state: { in: [...LISTED_STATES] } } } } } },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const deliveries = items.length
      ? await this.prisma.client.gallery.groupBy({
          by: ['clientId'],
          where: { photographerId, clientId: { in: items.map((c) => c.id) }, activatedAt: { not: null } },
          _max: { activatedAt: true },
        })
      : [];
    const last = new Map(deliveries.map((d) => [d.clientId, d._max.activatedAt]));
    return {
      items: items.map(({ _count, ...client }) => ({
        client,
        galleryCount: _count.galleries,
        lastDeliveryAt: last.get(client.id) ?? null,
      })),
      nextCursor: hasMore ? items.at(-1)!.id : null,
    };
  }

  async detail(photographerId: string, clientId: string) {
    const client = await this.get(photographerId, clientId);
    const [galleries, orderCount] = await Promise.all([
      this.prisma.client.gallery.findMany({
        where: { photographerId, clientId, state: { in: [...LISTED_STATES] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          name: true,
          state: true,
          suspended: true,
          closedReason: true,
          createdAt: true,
          activatedAt: true,
          expiresAt: true,
          closedAt: true,
          fileCount: true,
        },
      }),
      this.prisma.client.order.count({ where: { photographerId, clientId } }),
    ]);
    return { client, galleries, orderCount };
  }

  async create(photographerId: string, input: ClientInput) {
    try {
      return await this.prisma.client.client.create({
        data: { photographerId, name: input.name, phone: input.phone, email: input.email ?? null, notes: input.notes || null },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicate();
      throw err;
    }
  }

  /** Open galleries of this client take the new name and phone; closed ones keep their snapshot. */
  async update(photographerId: string, clientId: string, input: UpdateClientInput) {
    await this.get(photographerId, clientId);
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        const client = await tx.client.update({
          where: { id: clientId },
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email === undefined ? undefined : input.email,
            notes: input.notes === undefined ? undefined : input.notes || null,
          },
        });
        await tx.gallery.updateMany({
          where: { photographerId, clientId, state: { in: [...OPEN_STATES] } },
          data: { clientName: client.name, clientPhone: client.phone, clientEmail: client.email },
        });
        return client;
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicate();
      throw err;
    }
  }

  /** Removing a client keeps its galleries and orders; they are only unlinked (onDelete: SetNull). */
  async remove(photographerId: string, clientId: string) {
    await this.get(photographerId, clientId);
    await this.prisma.client.client.deleteMany({ where: { id: clientId, photographerId } });
  }

  /** The client's store and print orders, newest first, numbered pages. */
  async orders(photographerId: string, clientId: string, page = 1) {
    await this.get(photographerId, clientId);
    const where: Prisma.OrderWhereInput = { photographerId, clientId };
    const [total, rows] = await Promise.all([
      this.prisma.client.order.count({ where }),
      this.prisma.client.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * ORDERS_PAGE_SIZE,
        take: ORDERS_PAGE_SIZE,
        include: { items: { select: { quantity: true } } },
      }),
    ]);
    return { rows, total, page, pageSize: ORDERS_PAGE_SIZE };
  }
}
