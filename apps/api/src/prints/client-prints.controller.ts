import { Body, ConflictException, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { type ClientPrintOrderInput, clientPrintOrderSchema, CommerceRules } from '@photnoo/shared';
import { CLIENT_COOKIE } from '../client/client-gallery.controller';
import { ClientGalleryService } from '../client/client-gallery.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RateLimitService } from '../orders/rate-limit.service';
import { PrintsService } from './prints.service';

const HOUR_SECONDS = 60 * 60;

/**
 * Print ordering from inside a client gallery. Lives under /v1/g/:token so the link-scoped
 * session cookie (Path=/v1/g/<token>) reaches it; the same unlock rules apply as for downloads.
 */
@Controller('g/:token/prints')
export class ClientPrintsController {
  constructor(
    private readonly client: ClientGalleryService,
    private readonly prints: PrintsService,
    private readonly limits: RateLimitService,
  ) {}

  private async openGallery(token: string, req: Request) {
    const sessionToken = (req.cookies as Record<string, string | undefined>)[CLIENT_COOKIE];
    const { gallery } = await this.client.session(token, sessionToken);
    if (this.client.state(gallery) !== 'open') {
      throw new ConflictException({ code: 'gallery_closed', message: 'This gallery has closed.' });
    }
    return gallery;
  }

  /** Print options for this gallery, and the gallery's client to pre-fill the form. */
  @Get()
  async offer(@Param('token') token: string, @Req() req: Request) {
    return this.prints.offer(await this.openGallery(token, req));
  }

  @Post('orders')
  async order(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(clientPrintOrderSchema)) body: ClientPrintOrderInput,
    @Req() req: Request,
  ) {
    const gallery = await this.openGallery(token, req);
    await this.limits.consume(
      `prints:order:${gallery.id}:${req.ip ?? 'unknown'}`,
      CommerceRules.ordersPerHour,
      HOUR_SECONDS,
      'You have placed several print orders in a short time. Please try again in an hour or message the photographer.',
    );
    return this.prints.clientOrder(gallery, body);
  }
}
