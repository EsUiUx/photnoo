import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientGalleryController } from '../client/client-gallery.controller';
import { ClientGalleryService } from '../client/client-gallery.service';
import { GalleriesModule } from '../galleries/galleries.module';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  imports: [AuthModule, GalleriesModule],
  controllers: [SharingController, ClientGalleryController],
  providers: [SharingService, ClientGalleryService],
})
export class SharingModule {}
