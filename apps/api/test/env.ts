import { inject } from 'vitest';

// Test environment. DATABASE_URL points at the embedded Postgres from global-setup.ts.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: inject('databaseUrl'),
  WEB_ORIGIN: 'http://localhost:3000',
  REDIS_URL: 'redis://localhost:6399',
  JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'photnoo-test',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Photnoo <test@photnoo.local>',
});
