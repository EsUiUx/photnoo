import { Injectable } from '@nestjs/common';
import type { Prisma } from '@photnoo/db';
import { sha256 } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';

export type AuditEntry = {
  actorType: 'admin' | 'photographer' | 'system';
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  ip?: string | null;
  data?: Prisma.InputJsonValue;
};

type Tx = Prisma.TransactionClient;

// Any constant works; it only has to be the same for every writer.
const AUDIT_LOCK_KEY = 73_112_026;

/**
 * JSON with object keys sorted at every level. Postgres jsonb reorders keys on storage, so the
 * hash must not depend on insertion order or the chain could never be re-verified.
 */
export function canonicalJson(value: unknown): string {
  const normalised = value === undefined ? null : JSON.parse(JSON.stringify(value));
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(sort(normalised));
}

export type AuditRow = {
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  ip: string | null;
  data: unknown;
  createdAt: Date;
};

export function auditHash(prevHash: string | null, row: AuditRow): string {
  return sha256(
    canonicalJson([
      prevHash,
      row.actorType,
      row.actorId ?? null,
      row.action,
      row.targetType ?? null,
      row.targetId ?? null,
      row.reason ?? null,
      row.ip ?? null,
      row.data ?? null,
      row.createdAt.toISOString(),
    ]),
  );
}

/**
 * Append-only audit trail (PRD A-08). Each row stores the previous row's hash, so editing or
 * deleting a row breaks the chain and is detectable by re-hashing.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Tx): Promise<void> {
    if (tx) return this.append(tx, entry);
    await this.prisma.client.$transaction((inner) => this.append(inner, entry));
  }

  private async append(tx: Tx, entry: AuditEntry): Promise<void> {
    // Serialise writers so two rows never claim the same predecessor.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`;
    const previous = await tx.auditLog.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } });
    const createdAt = new Date();
    const prevHash = previous?.hash ?? null;
    const hash = auditHash(prevHash, {
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      reason: entry.reason ?? null,
      ip: entry.ip ?? null,
      data: entry.data ?? null,
      createdAt,
    });
    await tx.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        reason: entry.reason ?? null,
        ip: entry.ip ?? null,
        data: entry.data,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  /**
   * Re-hashes the chain from the start (A-08). Returns the first row whose stored hash or
   * link to its predecessor does not match, or null when the whole chain is intact.
   */
  async verify(): Promise<{ checked: number; brokenAt: string | null }> {
    let prevHash: string | null = null;
    let cursor: bigint | undefined;
    let checked = 0;
    for (;;) {
      const rows = await this.prisma.client.auditLog.findMany({
        where: cursor === undefined ? {} : { id: { gt: cursor } },
        orderBy: { id: 'asc' },
        take: 1000,
      });
      if (rows.length === 0) return { checked, brokenAt: null };
      for (const row of rows) {
        if (row.prevHash !== prevHash || auditHash(prevHash, row) !== row.hash) return { checked, brokenAt: row.id.toString() };
        prevHash = row.hash;
        checked += 1;
      }
      cursor = rows[rows.length - 1]!.id;
    }
  }
}
