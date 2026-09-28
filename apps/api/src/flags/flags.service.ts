import { Inject, Injectable } from '@nestjs/common';
import type { SwitchKey } from '@photnoo/shared';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export type SwitchState = { on: boolean; reason: string | null; setById: string | null; updatedAt: Date | null };

/**
 * Emergency switches (PRD A-05) stored in the Flag table. Each API instance caches them for
 * 20 seconds, so a change reaches every instance well inside the required 60 seconds; the
 * instance that made the change sees it at once.
 */
@Injectable()
export class FlagsService {
  private cache: { at: number; values: Map<string, SwitchState> } | null = null;
  private static readonly TTL_MS = 20_000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private key(key: SwitchKey): string {
    return `${this.env.FLAG_NAMESPACE}${key}`;
  }

  async all(): Promise<Map<string, SwitchState>> {
    if (this.cache && Date.now() - this.cache.at < FlagsService.TTL_MS) return this.cache.values;
    const ns = this.env.FLAG_NAMESPACE;
    const rows = await this.prisma.client.flag.findMany(ns ? { where: { key: { startsWith: ns } } } : undefined);
    const values = new Map<string, SwitchState>(
      rows.map((row) => [
        row.key.slice(ns.length),
        { on: (row.value as { on?: boolean } | null)?.on === true, reason: row.reason, setById: row.setById, updatedAt: row.updatedAt },
      ]),
    );
    this.cache = { at: Date.now(), values };
    return values;
  }

  async isOn(key: SwitchKey): Promise<boolean> {
    return (await this.all()).get(key)?.on === true;
  }

  async set(key: SwitchKey, on: boolean, reason: string, adminId: string): Promise<void> {
    await this.prisma.client.flag.upsert({
      where: { key: this.key(key) },
      create: { key: this.key(key), value: { on }, reason, setById: adminId },
      update: { value: { on }, reason, setById: adminId },
    });
    this.cache = null;
  }

  /** For tests and for the instance that just changed a switch. */
  forget(): void {
    this.cache = null;
  }
}
