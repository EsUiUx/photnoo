import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

/**
 * Fixed-window counters for public endpoints. Uses Redis when it is connected, so limits hold
 * across API instances; otherwise falls back to process memory, which still protects a single
 * instance (and keeps tests and local runs working without Redis).
 */
@Injectable()
export class RateLimitService {
  private readonly memory = new Map<string, { count: number; resetAt: number }>();
  private connecting = false;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Counts one hit and throws 429 once `limit` hits happened inside the window. */
  async consume(key: string, limit: number, windowSeconds: number, message = 'Too many requests. Please try again later.'): Promise<void> {
    const count = await this.hit(`rl:${key}`, windowSeconds);
    if (count > limit) {
      throw new HttpException(
        { code: 'rate_limited', message, details: { retryAfterSeconds: windowSeconds } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async hit(key: string, windowSeconds: number): Promise<number> {
    if (this.redis.status === 'ready') {
      try {
        const result = await this.redis.multi().incr(key).expire(key, windowSeconds, 'NX').exec();
        const count = Number(result?.[0]?.[1]);
        if (Number.isFinite(count)) return count;
      } catch {
        // Fall through to memory.
      }
    } else if (this.redis.status === 'wait' && !this.connecting) {
      // lazyConnect: start connecting in the background for the next request.
      this.connecting = true;
      this.redis.connect().catch(() => {}).finally(() => (this.connecting = false));
    }
    return this.memoryHit(key, windowSeconds);
  }

  private memoryHit(key: string, windowSeconds: number): number {
    const now = Date.now();
    if (this.memory.size > 10_000) {
      for (const [k, v] of this.memory) if (v.resetAt <= now) this.memory.delete(k);
    }
    const entry = this.memory.get(key);
    if (!entry || entry.resetAt <= now) {
      this.memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
}
