import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import type { PgBoss } from 'pg-boss';
import { ENV, type Env } from '../config/env';

/** Background job names and their payloads. */
export type JobPayloads = {
  'file.process': { fileId: string };
  'lifecycle.tick': Record<string, never>;
};
export type JobName = keyof JobPayloads;

const QUEUES: Record<JobName, { retryLimit: number; retryDelay: number; expireInSeconds: number }> = {
  // Transient storage errors retry with backoff; bad files fail fast inside the handler (PRD 7).
  'file.process': { retryLimit: 5, retryDelay: 10, expireInSeconds: 15 * 60 },
  // Runs on a schedule; a failed run is simply picked up by the next one.
  'lifecycle.tick': { retryLimit: 0, retryDelay: 0, expireInSeconds: 30 * 60 },
};

/**
 * Postgres-backed job queue (pg-boss). Chosen over BullMQ/Redis for launch: one fewer service
 * to run, and jobs commit with the rows that create them. Swap the implementation if volume
 * ever outgrows Postgres; callers only see send() and work().
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private boss?: Promise<PgBoss>;
  private readonly inlineHandlers = new Map<JobName, (data: unknown) => Promise<void>>();

  constructor(@Inject(ENV) private readonly env: Env) {}

  private start(): Promise<PgBoss> {
    this.boss ??= (async () => {
      // Loaded on first use: pg-boss is ESM-only, and the serverless runtime cannot require() it.
      const { PgBoss } = await import('pg-boss');
      const boss = new PgBoss({ connectionString: this.env.DATABASE_URL, schema: 'pgboss' });
      boss.on('error', (err) => this.logger.error({ err }, 'Job queue error'));
      await boss.start();
      for (const [name, options] of Object.entries(QUEUES)) {
        await boss.createQueue(name, { ...options, retryBackoff: true });
      }
      return boss;
    })();
    return this.boss;
  }

  async send<N extends JobName>(name: N, data: JobPayloads[N]): Promise<void> {
    const inline = this.env.JOBS_INLINE ? this.inlineHandlers.get(name) : undefined;
    if (!inline) {
      await (await this.start()).send(name, data);
      return;
    }
    // Serverless: run after the response is sent, keeping the function alive until it finishes.
    waitUntil(inline(data).catch((err: unknown) => this.logger.error({ err, name }, 'Inline job failed')));
  }

  /** Handlers for JOBS_INLINE mode, where no worker process polls the queue. */
  registerInline<N extends JobName>(name: N, handler: (data: JobPayloads[N]) => Promise<void>): void {
    this.inlineHandlers.set(name, handler as (data: unknown) => Promise<void>);
  }

  async work<N extends JobName>(
    name: N,
    handler: (data: JobPayloads[N]) => Promise<void>,
    options: { concurrency?: number } = {},
  ): Promise<void> {
    const boss = await this.start();
    await boss.work<JobPayloads[N]>(name, { localConcurrency: options.concurrency ?? 2 }, async (jobs) => {
      for (const job of jobs) await handler(job.data);
    });
  }

  /** Cron schedule, stored in Postgres, so only one worker runs each tick even with several. */
  async schedule<N extends JobName>(name: N, cron: string, data: JobPayloads[N]): Promise<void> {
    await (await this.start()).schedule(name, cron, data, { tz: 'Africa/Cairo' });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) await (await this.boss).stop({ graceful: true });
  }
}
