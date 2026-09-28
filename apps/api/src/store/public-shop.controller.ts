import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommerceRules, type PublicStoreOrderInput, publicStoreOrderSchema } from '@photnoo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RateLimitService } from '../orders/rate-limit.service';
import { StoreService } from './store.service';

const HOUR_SECONDS = 60 * 60;

/** The public shop at photnoo.com/p/<slug>/shop. No account; orders are paid off-platform. */
@Controller('public/p/:slug')
export class PublicShopController {
  constructor(
    private readonly store: StoreService,
    private readonly limits: RateLimitService,
  ) {}

  @Get('shop')
  async shop(@Param('slug') slug: string, @Req() req: Request) {
    // Generous: the web app renders the page on the server, so many visitors share one IP.
    await this.limits.consume(`shop:get:${req.ip ?? 'unknown'}`, 600, 60);
    return this.store.publicShop(slug);
  }

  @Post('orders')
  async order(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(publicStoreOrderSchema)) body: PublicStoreOrderInput,
    @Req() req: Request,
  ) {
    await this.limits.consume(
      `shop:order:${slug.toLowerCase()}:${req.ip ?? 'unknown'}`,
      CommerceRules.ordersPerHour,
      HOUR_SECONDS,
      'You have placed several orders in a short time. Please try again in an hour or message the photographer.',
    );
    return this.store.placePublicOrder(slug, body);
  }
}
