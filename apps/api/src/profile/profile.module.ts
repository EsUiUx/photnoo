import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { NotificationsController } from '../notifications/notifications.controller';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

/**
 * The photographer's account: Settings (profile, avatar and logo, public handle, notification
 * preferences, password) and the notification inbox routes.
 */
@Module({
  imports: [AuthModule, MediaModule],
  controllers: [ProfileController, NotificationsController],
  providers: [ProfileService],
})
export class ProfileModule {}
