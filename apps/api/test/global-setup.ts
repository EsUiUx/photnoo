// Starts a throwaway PostgreSQL for the integration tests and applies every migration.
import EmbeddedPostgres from 'embedded-postgres';
import { readdirSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const migrationsDir = join(__dirname, '../../../packages/db/prisma/migrations');

export default async function setup(project: TestProject) {
  const port = 54330 + Math.floor(Math.random() * 500);
  const databaseDir = join(tmpdir(), `photnoo-test-pg-${process.pid}-${Date.now()}`);
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'photnoo',
    password: 'photnoo',
    port,
    // Teardown removes the folder itself; Windows can hold file locks briefly after shutdown.
    persistent: true,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('photnoo_test');

  const client = pg.getPgClient('photnoo_test');
  await client.connect();
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of migrations) {
    await client.query(readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8'));
  }
  await client.end();

  project.provide('databaseUrl', `postgresql://photnoo:photnoo@localhost:${port}/photnoo_test`);

  return async () => {
    await pg.stop();
    // Best effort: a locked temp folder is left for the OS to clean, never a test failure.
    await rm(databaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  };
}
