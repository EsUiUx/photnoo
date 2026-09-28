import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { OrdersModule } from '../orders/orders.module';
import { PublicShopController } from './public-shop.controller';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

/** Store products, the public shop, and (through OrdersModule) store and print orders. */
@Module({
  imports: [AuthModule, MediaModule, OrdersModule],
  controllers: [StoreController, PublicShopController],
  providers: [StoreService],
})
export class StoreModule {}
