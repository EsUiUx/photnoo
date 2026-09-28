import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

type Check = 'ok' | 'down';

/** Load balancer and uptime probe. Returns 503 when a dependency is down. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const ok = database === 'ok' && redis === 'ok';
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', checks: { database, redis } };
  }

  private async checkDatabase(): Promise<Check> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<Check> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return (await this.redis.ping()) === 'PONG' ? 'ok' : 'down';
    } catch {
      return 'down';
    }
  }
}
