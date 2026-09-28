import { Controller, Get, Inject, NotFoundException, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { subscriptionJson } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type Storage } from '../storage/storage';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /** The logged-in photographer and their current subscription. Byte counts are strings (BigInt). */
  @Get()
  async me(@CurrentAuth() auth: AccessClaims) {
    const [photographer, unreadNotifications] = await Promise.all([
      this.prisma.client.photographer.findUnique({
        where: { id: auth.photographerId },
        include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true, nextPlan: true } } },
      }),
      this.prisma.client.notification.count({ where: { photographerId: auth.photographerId, readAt: null } }),
    ]);
    if (!photographer) throw new NotFoundException();
    const subscription = photographer.subscriptions[0];

    return {
      id: photographer.id,
      name: photographer.name,
      studioName: photographer.studioName,
      email: photographer.email,
      phone: photographer.phone,
      locale: photographer.locale,
      slug: photographer.slug,
      avatarUrl: photographer.avatarKey ? await this.storage.signDownload(photographer.avatarKey, 3600) : null,
      unreadNotifications,
      subscription: subscription ? subscriptionJson(subscription) : null,
    };
  }
}
