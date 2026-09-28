import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingLifecycleModule } from './billing-lifecycle.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule, BillingLifecycleModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
