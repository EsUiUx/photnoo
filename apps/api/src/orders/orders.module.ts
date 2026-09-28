import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RateLimitService } from './rate-limit.service';

/** Shared by the store and prints modules, which import it. */
@Module({
  imports: [AuthModule, MediaModule],
  controllers: [OrdersController],
  providers: [OrdersService, RateLimitService],
  exports: [OrdersService, RateLimitService],
})
export class OrdersModule {}
