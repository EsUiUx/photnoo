import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsController } from '../uploads/uploads.controller';
import { UploadsService } from '../uploads/uploads.service';
import { GalleriesController } from './galleries.controller';
import { GalleriesService } from './galleries.service';

@Module({
  imports: [AuthModule],
  controllers: [GalleriesController, UploadsController],
  providers: [GalleriesService, UploadsService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
