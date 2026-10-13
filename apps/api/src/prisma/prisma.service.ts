import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@photnoo/db';
import { ENV, type Env } from '../config/env';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(ENV) env: Env) {
    this.client = createPrismaClient(env.DATABASE_URL, { maxConnections: env.DB_POOL_MAX });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
