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
    const hash = sha256(
      JSON.stringify([
        prevHash,
        entry.actorType,
        entry.actorId ?? null,
        entry.action,
        entry.targetType ?? null,
        entry.targetId ?? null,
        entry.reason ?? null,
        entry.ip ?? null,
        entry.data ?? null,
        createdAt.toISOString(),
      ]),
    );
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
}
