import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { UploadsController } from '../uploads/uploads.controller';
import { UploadsService } from '../uploads/uploads.service';
import { GalleriesController } from './galleries.controller';
import { GalleriesService } from './galleries.service';

@Module({
  imports: [AuthModule, LifecycleModule],
  controllers: [GalleriesController, UploadsController],
  providers: [GalleriesService, UploadsService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
