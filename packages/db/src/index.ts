import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

/** Create a Prisma client over the node-postgres driver adapter (required by Prisma 7). */
export function createPrismaClient(connectionString: string, options: { maxConnections?: number } = {}): PrismaClient {
  const adapter = new PrismaPg({ connectionString, max: options.maxConnections });
  return new PrismaClient({ adapter });
}
