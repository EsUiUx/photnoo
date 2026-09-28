import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TTL_MS = 30_000;

/**
 * Access tokens live 15 minutes, but suspension and force logout (PRD A-03, A-05) must bite
 * within 60 seconds. The guard therefore checks the session behind each token, cached for
 * 30 seconds per instance and dropped at once on the instance that revoked it.
 */
@Injectable()
export class AccessCheckService {
  private readonly cache = new Map<string, { ok: boolean; at: number; photographerId: string }>();

  constructor(private readonly prisma: PrismaService) {}

  async sessionIsLive(sessionId: string, photographerId: string): Promise<boolean> {
    const hit = this.cache.get(sessionId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, photographerId: true, photographer: { select: { status: true } } },
    });
    const ok = Boolean(session && !session.revokedAt && session.photographerId === photographerId && session.photographer.status === 'active');
    if (this.cache.size > 50_000) this.cache.clear();
    this.cache.set(sessionId, { ok, at: Date.now(), photographerId });
    return ok;
  }

  forgetPhotographer(photographerId: string): void {
    for (const [key, value] of this.cache) if (value.photographerId === photographerId) this.cache.delete(key);
  }

  forgetAll(): void {
    this.cache.clear();
  }
}
