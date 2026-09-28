import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { NotificationsService } from './notifications.service';

/** The bell and the Notifications page. Every query is scoped to the logged-in photographer. */
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Newest first, 20 per page. `unread=1` keeps only unread ones; `cursor` is the previous page's `nextCursor`. */
  @Get()
  list(
    @CurrentAuth() auth: AccessClaims,
    @Query('cursor') cursor?: string,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(auth.photographerId, {
      cursor: cursor || undefined,
      unreadOnly: unread === '1' || unread === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentAuth() auth: AccessClaims) {
    return { count: await this.notifications.unreadCount(auth.photographerId) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async readAll(@CurrentAuth() auth: AccessClaims) {
    return { updated: await this.notifications.markAllRead(auth.photographerId) };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(@CurrentAuth() auth: AccessClaims, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markRead(auth.photographerId, id);
  }
}
