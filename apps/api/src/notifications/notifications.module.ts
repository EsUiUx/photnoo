import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

/**
 * Global so any module (API or worker) can raise a notification without importing this one.
 * The HTTP routes (NotificationsController) are registered by ProfileModule, which has the
 * auth guard, so the worker can load this module without the auth stack.
 */
@Global()
@Module({ providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
