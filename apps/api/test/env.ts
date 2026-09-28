import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inject } from 'vitest';

// Test environment. DATABASE_URL points at the embedded Postgres from global-setup.ts.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: inject('databaseUrl'),
  WEB_ORIGIN: 'http://localhost:3000',
  PUBLIC_API_URL: 'http://localhost:4000',
  REDIS_URL: 'redis://localhost:6399',
  JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: join(tmpdir(), `photnoo-test-storage-${process.pid}`),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Photnoo <test@photnoo.local>',
});
