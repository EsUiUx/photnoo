import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { type AdminLoginInput, adminLoginSchema } from '@photnoo/shared';
import type { Request, Response } from 'express';
import { randomToken } from '../common/crypto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { ADMIN_SESSION_MS, type AdminPrincipal, AdminAuthService } from './admin-auth.service';
import { ADMIN_COOKIE, ADMIN_COOKIE_PATH, ADMIN_CSRF_COOKIE, AdminGuard, adminMeta, CurrentAdmin } from './admin.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(adminLoginSchema)) body: AdminLoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(body.email, body.password, body.code, adminMeta(req));
    const secure = this.env.NODE_ENV !== 'development' && this.env.NODE_ENV !== 'test';
    res.cookie(ADMIN_COOKIE, session.token, { httpOnly: true, secure, sameSite: 'strict', path: ADMIN_COOKIE_PATH, maxAge: ADMIN_SESSION_MS });
    const csrf = randomToken(24);
    res.cookie(ADMIN_CSRF_COOKIE, csrf, { httpOnly: false, secure, sameSite: 'strict', path: '/', maxAge: ADMIN_SESSION_MS });
    return { admin: session.admin, expiresAt: session.expiresAt, csrfToken: csrf };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout((req.cookies as Record<string, string | undefined>)[ADMIN_COOKIE], adminMeta(req));
    res.clearCookie(ADMIN_COOKIE, { path: ADMIN_COOKIE_PATH });
    res.clearCookie(ADMIN_CSRF_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentAdmin() admin: AdminPrincipal) {
    return { id: admin.id, name: admin.name, email: admin.email, role: admin.role };
  }
}
