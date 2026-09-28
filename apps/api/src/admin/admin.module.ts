import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminService, AdminGuard],
  exports: [AdminAuthService],
})
export class AdminModule {}
