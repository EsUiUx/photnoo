import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, type Env } from '../config/env';

export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: Env) =>
        new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: true }),
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
