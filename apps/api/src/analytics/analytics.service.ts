import { Inject, Injectable } from '@nestjs/common';
import type { AnalyticsRange } from '@photnoo/shared';
import { Prisma } from '@photnoo/db';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';

/** Studio time. Buckets and period edges follow Cairo midnight, whatever the server's zone. */
const TZ = 'Africa/Cairo';
const COVER_TTL_SECONDS = 60 * 60;

type Bucket = { unit: 'day' | 'week' | 'month'; count: number; step: string };

/** 7 and 30 days by day, 6 months by week, 12 months by month. */
export const RANGES: Record<AnalyticsRange, Bucket> = {
  '7d': { unit: 'day', count: 7, step: '1 day' },
  '30d': { unit: 'day', count: 30, step: '1 day' },
  '6m': { unit: 'week', count: 26, step: '1 week' },
  '12m': { unit: 'month', count: 12, step: '1 month' },
};

export type Period = { start: Date; end: Date; previousStart: Date };

type Metric = { value: number; previous: number; change: number | null };

const metric = (value: number, previous: number): Metric => ({
  value,
  previous,
  change: previous === 0 ? null : (value - previous) / previous,
});

const egp = (value: Prisma.Decimal | null | undefined): number => (value ? Number(value.toString()) : 0);

/** A UTC instant as the naive UTC timestamp Prisma stores in timestamp(3) columns. */
const utc = (date: Date) => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
/** A naive UTC column as Cairo local time. */
const local = (column: Prisma.Sql) => Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})`;

/**
 * Photographer insights. Every number is aggregated in SQL and every query is scoped to one
 * photographer through Gallery.photographerId (or Order.photographerId).
 * Views are gallery opens (AccessEvent "open"), downloads are DownloadReceipts, orders are
 * non-cancelled orders placed in the period, revenue is the total of paid, non-cancelled orders
 * by payment date.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /**
   * The current period runs from the start of the first bucket (Cairo time) to now. The
   * previous period is the same length immediately before it, so a partly finished day or month
   * is compared with an equally long stretch.
   */
  async period(range: AnalyticsRange, now = new Date()): Promise<Period> {
    const { unit, count, step } = RANGES[range];
    // Epoch milliseconds, so no driver time-zone parsing is involved.
    const rows = await this.prisma.client.$queryRaw<Array<{ start: number }>>`
      SELECT (extract(epoch FROM (date_trunc(${unit}, ${now.toISOString()}::timestamptz AT TIME ZONE ${TZ})
               - (${count - 1}::int * ${step}::interval)) AT TIME ZONE ${TZ}) * 1000)::float8 AS start`;
    const start = new Date(Number(rows[0]!.start));
    return { start, end: now, previousStart: new Date(start.getTime() - (now.getTime() - start.getTime())) };
  }

  async overview(photographerId: string, range: AnalyticsRange, now = new Date()) {
    const p = await this.period(range, now);
    const inCurrent = { gte: p.start, lt: p.end };
    const inPrevious = { gte: p.previousStart, lt: p.start };
    const gallery = { photographerId };

    const [views, viewsBefore, downloads, downloadsBefore, orders, ordersBefore, revenue, revenueBefore, devices, countries] =
      await Promise.all([
        this.prisma.client.accessEvent.count({ where: { type: 'open', gallery, createdAt: inCurrent } }),
        this.prisma.client.accessEvent.count({ where: { type: 'open', gallery, createdAt: inPrevious } }),
        this.prisma.client.downloadReceipt.count({ where: { gallery, createdAt: inCurrent } }),
        this.prisma.client.downloadReceipt.count({ where: { gallery, createdAt: inPrevious } }),
        this.prisma.client.order.count({ where: { photographerId, status: { not: 'cancelled' }, createdAt: inCurrent } }),
        this.prisma.client.order.count({ where: { photographerId, status: { not: 'cancelled' }, createdAt: inPrevious } }),
        this.prisma.client.order.aggregate({
          where: { photographerId, status: { not: 'cancelled' }, paidAt: inCurrent },
          _sum: { totalEgp: true },
        }),
        this.prisma.client.order.aggregate({
          where: { photographerId, status: { not: 'cancelled' }, paidAt: inPrevious },
          _sum: { totalEgp: true },
        }),
        this.prisma.client.downloadReceipt.groupBy({
          by: ['deviceType'],
          where: { gallery, createdAt: inCurrent },
          _count: { _all: true },
        }),
        this.prisma.client.accessEvent.groupBy({
          by: ['country'],
          where: { type: 'open', gallery, createdAt: inCurrent },
          _count: { _all: true },
        }),
      ]);

    return {
      range,
      from: p.start,
      to: p.end,
      previousFrom: p.previousStart,
      views: metric(views, viewsBefore),
      downloads: metric(downloads, downloadsBefore),
      orders: metric(orders, ordersBefore),
      revenueEgp: metric(egp(revenue._sum.totalEgp), egp(revenueBefore._sum.totalEgp)),
      /** Downloads per device type, largest first. */
      devices: devices
        .map((d) => ({ deviceType: d.deviceType ?? 'unknown', downloads: d._count._all }))
        .reduce<Array<{ deviceType: string; downloads: number }>>((all, d) => {
          const same = all.find((a) => a.deviceType === d.deviceType);
          if (same) same.downloads += d.downloads;
          else all.push(d);
          return all;
        }, [])
        .sort((a, b) => b.downloads - a.downloads),
      /** Gallery views per country (ISO code from the CDN), top 5; unknown is kept apart. */
      countries: countries
        .filter((c) => c.country && c.country !== 'XX' && c.country !== 'T1')
        .map((c) => ({ country: c.country!.toUpperCase(), views: c._count._all }))
        .sort((a, b) => b.views - a.views || a.country.localeCompare(b.country))
        .slice(0, 5),
    };
  }

  /** One point per bucket, including empty ones, oldest first. `date` is the Cairo bucket start. */
  async timeseries(photographerId: string, range: AnalyticsRange, now = new Date()) {
    const { unit, step } = RANGES[range];
    const p = await this.period(range, now);
    const points = await this.prisma.client.$queryRaw<Array<{ date: string; views: number; downloads: number }>>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${unit}, ${p.start.toISOString()}::timestamptz AT TIME ZONE ${TZ}),
          date_trunc(${unit}, ${now.toISOString()}::timestamptz AT TIME ZONE ${TZ}),
          ${step}::interval
        ) AS bucket
      ),
      views AS (
        SELECT date_trunc(${unit}, ${local(Prisma.sql`a."createdAt"`)}) AS bucket, count(*)::int AS n
        FROM "AccessEvent" a
        JOIN "Gallery" g ON g.id = a."galleryId"
        WHERE g."photographerId" = ${photographerId}::uuid
          AND a.type = 'open'
          AND a."createdAt" >= ${utc(p.start)} AND a."createdAt" < ${utc(now)}
        GROUP BY 1
      ),
      downloads AS (
        SELECT date_trunc(${unit}, ${local(Prisma.sql`r."createdAt"`)}) AS bucket, count(*)::int AS n
        FROM "DownloadReceipt" r
        JOIN "Gallery" g ON g.id = r."galleryId"
        WHERE g."photographerId" = ${photographerId}::uuid
          AND r."createdAt" >= ${utc(p.start)} AND r."createdAt" < ${utc(now)}
        GROUP BY 1
      )
      SELECT to_char(b.bucket, 'YYYY-MM-DD') AS date,
             coalesce(v.n, 0)::int AS views,
             coalesce(d.n, 0)::int AS downloads
      FROM buckets b
      LEFT JOIN views v ON v.bucket = b.bucket
      LEFT JOIN downloads d ON d.bucket = b.bucket
      ORDER BY b.bucket`;
    return { range, unit, from: p.start, to: p.end, points };
  }

  /** Top 5 clients by downloads, then views. Galleries are grouped by client, or by phone for older ones. */
  async topClients(photographerId: string, range: AnalyticsRange, now = new Date()) {
    const p = await this.period(range, now);
    const rows = await this.prisma.client.$queryRaw<
      Array<{ key: string; clientId: string | null; name: string | null; phone: string | null; galleries: number; views: number; downloads: number }>
    >`
      WITH v AS (
        SELECT a."galleryId", count(*)::int AS n
        FROM "AccessEvent" a JOIN "Gallery" g ON g.id = a."galleryId"
        WHERE g."photographerId" = ${photographerId}::uuid AND a.type = 'open'
          AND a."createdAt" >= ${utc(p.start)} AND a."createdAt" < ${utc(now)}
        GROUP BY 1
      ),
      d AS (
        SELECT r."galleryId", count(*)::int AS n
        FROM "DownloadReceipt" r JOIN "Gallery" g ON g.id = r."galleryId"
        WHERE g."photographerId" = ${photographerId}::uuid
          AND r."createdAt" >= ${utc(p.start)} AND r."createdAt" < ${utc(now)}
        GROUP BY 1
      )
      SELECT coalesce(c.id::text, 'phone:' || g."clientPhone") AS key,
             max(c.id::text) AS "clientId",
             max(coalesce(c.name, g."clientName")) AS name,
             max(coalesce(c.phone, g."clientPhone")) AS phone,
             count(DISTINCT g.id)::int AS galleries,
             coalesce(sum(v.n), 0)::int AS views,
             coalesce(sum(d.n), 0)::int AS downloads
      FROM "Gallery" g
      LEFT JOIN "Client" c ON c.id = g."clientId" AND c."photographerId" = g."photographerId"
      LEFT JOIN v ON v."galleryId" = g.id
      LEFT JOIN d ON d."galleryId" = g.id
      WHERE g."photographerId" = ${photographerId}::uuid
        AND (g."clientId" IS NOT NULL OR g."clientPhone" IS NOT NULL)
        AND (v.n IS NOT NULL OR d.n IS NOT NULL)
      GROUP BY 1
      ORDER BY downloads DESC, views DESC, name ASC
      LIMIT 5`;
    return {
      range,
      items: rows.map((r, i) => ({
        rank: i + 1,
        clientId: r.clientId,
        name: r.name ?? r.phone ?? '',
        phone: r.phone,
        galleries: r.galleries,
        views: r.views,
        downloads: r.downloads,
      })),
    };
  }

  /** Top 5 galleries by views, then downloads, with a cover preview and the client. */
  async topGalleries(photographerId: string, range: AnalyticsRange, now = new Date()) {
    const p = await this.period(range, now);
    const rows = await this.prisma.client.$queryRaw<
      Array<{
        id: string;
        name: string;
        state: string;
        clientName: string | null;
        clientPhone: string | null;
        coverFileId: string | null;
        shareable: boolean;
        views: number;
        downloads: number;
      }>
    >`
      WITH v AS (
        SELECT a."galleryId", count(*)::int AS n
        FROM "AccessEvent" a JOIN "Gallery" g ON g.id = a."galleryId"
        WHERE g."photographerId" = ${photographerId}::uuid AND a.type = 'open'
          AND a."createdAt" >= ${utc(p.start)} AND a."createdAt" < ${utc(now)}
        GROUP BY 1
      ),
      d AS (
        SELECT r."galleryId", count(*)::int AS n
        FROM "DownloadReceipt" r JOIN "Gallery" g ON g.id = r."galleryId"
        WHERE g."photographerId" = ${photographerId}::uuid
          AND r."createdAt" >= ${utc(p.start)} AND r."createdAt" < ${utc(now)}
        GROUP BY 1
      )
      SELECT g.id::text AS id, g.name, g.state::text AS state,
             coalesce(c.name, g."clientName") AS "clientName",
             coalesce(c.phone, g."clientPhone") AS "clientPhone",
             g."coverFileId"::text AS "coverFileId",
             (g.state = 'active' AND g."linkTokenEnc" IS NOT NULL) AS shareable,
             coalesce(v.n, 0)::int AS views,
             coalesce(d.n, 0)::int AS downloads
      FROM "Gallery" g
      LEFT JOIN "Client" c ON c.id = g."clientId" AND c."photographerId" = g."photographerId"
      LEFT JOIN v ON v."galleryId" = g.id
      LEFT JOIN d ON d."galleryId" = g.id
      WHERE g."photographerId" = ${photographerId}::uuid
        AND g.state IN ('draft', 'active', 'closed')
        AND (v.n IS NOT NULL OR d.n IS NOT NULL)
      ORDER BY views DESC, downloads DESC, g.name ASC
      LIMIT 5`;

    const covers = await this.covers(rows);
    return {
      range,
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        state: r.state,
        clientName: r.clientName,
        clientPhone: r.clientPhone,
        shareable: r.shareable,
        views: r.views,
        downloads: r.downloads,
        coverUrl: covers.get(r.id) ?? null,
      })),
    };
  }

  /** The chosen cover, else the first ready preview. Galleries were already scoped to the photographer. */
  private async covers(galleries: Array<{ id: string; coverFileId: string | null }>) {
    const result = new Map<string, string>();
    if (galleries.length === 0) return result;
    const ids = galleries.map((g) => g.id);
    const select = { id: true, galleryId: true, previewKey: true } as const;
    const [chosen, first] = await Promise.all([
      this.prisma.client.file.findMany({
        where: { id: { in: galleries.flatMap((g) => (g.coverFileId ? [g.coverFileId] : [])) }, galleryId: { in: ids }, status: 'ready', previewKey: { not: null } },
        select,
      }),
      this.prisma.client.file.findMany({
        where: { galleryId: { in: ids }, status: 'ready', previewKey: { not: null } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        distinct: ['galleryId'],
        select,
      }),
    ]);
    const files = [...chosen, ...first];
    for (const g of galleries) {
      const file = files.find((f) => f.id === g.coverFileId) ?? files.find((f) => f.galleryId === g.id);
      if (file?.previewKey) result.set(g.id, await this.storage.signDownload(file.previewKey, COVER_TTL_SECONDS));
    }
    return result;
  }
}
