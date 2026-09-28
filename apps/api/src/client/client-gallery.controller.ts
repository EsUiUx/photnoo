import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  type ReportGalleryInput,
  reportGallerySchema,
  type UnlockGalleryInput,
  unlockGallerySchema,
} from '@photnoo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { type ClientMeta, ClientGalleryService } from './client-gallery.service';

export const CLIENT_COOKIE = 'pn_g';

function meta(req: Request): ClientMeta {
  return {
    ip: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    // Cloudflare adds the visitor's country; nothing finer is stored (PRD section 10).
    country: req.header('cf-ipcountry') ?? null,
  };
}

/**
 * Public, link-scoped client API. The session cookie is HttpOnly, SameSite=Strict and limited
 * to this one link's path, so a client session can never reach another gallery.
 */
@Controller('g/:token')
export class ClientGalleryController {
  constructor(
    private readonly client: ClientGalleryService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private sessionToken(req: Request): string | undefined {
    return (req.cookies as Record<string, string | undefined>)[CLIENT_COOKIE];
  }

  @Get()
  summary(@Param('token') token: string) {
    return this.client.summary(token);
  }

  @Post('session')
  @HttpCode(HttpStatus.OK)
  async unlock(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(unlockGallerySchema)) body: UnlockGalleryInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.client.unlock(token, body.password, meta(req));
    res.cookie(CLIENT_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.env.NODE_ENV !== 'development' && this.env.NODE_ENV !== 'test',
      path: `/v1/g/${token}`,
      expires: session.expiresAt,
    });
    return { status: 'unlocked', expiresAt: session.expiresAt };
  }

  @Get('content')
  content(@Param('token') token: string, @Req() req: Request) {
    return this.client.content(token, this.sessionToken(req), meta(req));
  }

  @Post('files/:fileId/download')
  @HttpCode(HttpStatus.OK)
  download(@Param('token') token: string, @Param('fileId', ParseUUIDPipe) fileId: string, @Req() req: Request) {
    return this.client.download(token, this.sessionToken(req), fileId, meta(req));
  }

  @Post('report')
  @HttpCode(HttpStatus.ACCEPTED)
  async report(@Param('token') token: string, @Body(new ZodValidationPipe(reportGallerySchema)) body: ReportGalleryInput) {
    await this.client.report(token, body.reason, body.email);
    return { status: 'received' };
  }
}
