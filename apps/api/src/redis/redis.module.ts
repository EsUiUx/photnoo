import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, type Env } from '../config/env';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) => {
        const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true });
        // Nothing depends on Redis yet, so an unreachable server is one warning, not a log flood.
        let warned = false;
        redis.on('error', (err: Error) => {
          if (warned) return;
          warned = true;
          new Logger('Redis').warn(`Redis unavailable (${err.message || err.name}); health will report it as down.`);
        });
        redis.on('ready', () => {
          warned = false;
        });
        return redis;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
