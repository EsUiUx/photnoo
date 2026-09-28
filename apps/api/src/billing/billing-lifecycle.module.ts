import { Module } from '@nestjs/common';
import { BillingLifecycleService } from './billing-lifecycle.service';

/** Kept apart from BillingModule so the worker and uploads can use it without the HTTP layer. */
@Module({ providers: [BillingLifecycleService], exports: [BillingLifecycleService] })
export class BillingLifecycleModule {}
