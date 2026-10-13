import { Controller, Get, Headers, Inject, NotFoundException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { BillingLifecycleService } from '../billing/billing-lifecycle.service';
import { ENV, type Env } from '../config/env';
import { LifecycleService } from '../lifecycle/lifecycle.service';

/** The worker's scheduled tick, called by Vercel Cron with `Authorization: Bearer <CRON_SECRET>`. */
@Controller('internal/cron')
export class CronController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly lifecycle: LifecycleService,
    private readonly billing: BillingLifecycleService,
  ) {}

  @Get('tick')
  async tick(@Headers('authorization') authorization?: string) {
    // 404, not 401: the route does not exist for anyone without the secret.
    if (!this.env.JOBS_INLINE || !this.env.CRON_SECRET || !this.authorized(authorization, this.env.CRON_SECRET)) {
      throw new NotFoundException({ code: 'not_found', message: 'Not found.' });
    }
    await this.lifecycle.tick();
    await this.billing.tick();
    return { ok: true };
  }

  private authorized(header: string | undefined, secret: string): boolean {
    const given = Buffer.from(header ?? '');
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
