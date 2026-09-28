import { loadEnv } from './env';

const valid = {
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'media',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Photnoo <no-reply@photnoo.local>',
};

describe('loadEnv', () => {
  it('applies defaults and coerces numbers', () => {
    const env = loadEnv(valid);
    expect(env.API_PORT).toBe(4000);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it('rejects a short JWT secret with a readable message', () => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });
});
