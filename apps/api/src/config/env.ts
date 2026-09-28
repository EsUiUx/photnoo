import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    WEB_ORIGIN: z.string().url(),
    /** Base URL browsers use to reach the API; only the local storage driver signs URLs against it. */
    PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    /** "s3" = Cloudflare R2 / MinIO. "local" = files on disk, for development and tests only. */
    STORAGE_DRIVER: z.enum(['s3', 'local']).default('s3'),
    LOCAL_STORAGE_DIR: z.string().default('.local/storage'),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    MAIL_FROM: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required when STORAGE_DRIVER=s3' });
      }
    }
    if (env.STORAGE_DRIVER === 'local' && env.NODE_ENV === 'production') {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'The local driver is not allowed in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Parse and validate environment once at startup; fail fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
