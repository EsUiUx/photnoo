import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentAuth } from '../auth/auth.guard';
import type { AccessClaims } from '../auth/tokens.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  /** The logged-in photographer and their current subscription. Byte counts are strings (BigInt). */
  @Get()
  async me(@CurrentAuth() auth: AccessClaims) {
    const photographer = await this.prisma.client.photographer.findUnique({
      where: { id: auth.photographerId },
      include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!photographer) throw new NotFoundException();
    const subscription = photographer.subscriptions[0];

    return {
      id: photographer.id,
      name: photographer.name,
      studioName: photographer.studioName,
      email: photographer.email,
      phone: photographer.phone,
      locale: photographer.locale,
      subscription: subscription
        ? {
            state: subscription.state,
            cycleStart: subscription.cycleStart,
            cycleEnd: subscription.cycleEnd,
            allowanceBytes: subscription.allowanceBytes.toString(),
            usedBytes: subscription.usedBytes.toString(),
          }
        : null,
    };
  }
}
