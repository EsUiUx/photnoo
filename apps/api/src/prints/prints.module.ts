import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientGalleryService } from '../client/client-gallery.service';
import { MediaModule } from '../media/media.module';
import { OrdersModule } from '../orders/orders.module';
import { ClientPrintsController } from './client-prints.controller';
import { PrintsController } from './prints.controller';
import { PrintsService } from './prints.service';

/**
 * Print catalog, print settings, and client print orders. ClientGalleryService is stateless, so
 * this module keeps its own instance for the link-session check instead of reaching into sharing.
 */
@Module({
  imports: [AuthModule, MediaModule, OrdersModule],
  controllers: [PrintsController, ClientPrintsController],
  providers: [PrintsService, ClientGalleryService],
})
export class PrintsModule {}
