import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  type AcceptInviteInput,
  acceptInviteSchema,
  type LoginInput,
  loginSchema,
  type PasswordResetConfirmInput,
  passwordResetConfirmSchema,
  type PasswordResetRequestInput,
  passwordResetRequestSchema,
} from '@photnoo/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ENV, type Env } from '../config/env';
import { AuthGuard, CurrentAuth } from './auth.guard';
import { AuthService, type RequestMeta, type SessionTokens } from './auth.service';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from './cookies';
import type { AccessClaims } from './tokens.service';

function meta(req: Request): RequestMeta {
  return { ip: req.ip ?? null, userAgent: req.header('user-agent') ?? null };
}

function refreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('invites/:token')
  getInvite(@Param('token') token: string) {
    return this.auth.getInvite(token);
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.startSession(res, await this.auth.acceptInvite(body, meta(req)));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.startSession(res, await this.auth.login(body, meta(req)));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.startSession(res, await this.auth.refresh(refreshCookie(req), meta(req)));
    } catch (err) {
      clearSessionCookies(res, this.env);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshCookie(req));
    clearSessionCookies(res, this.env);
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentAuth() auth: AccessClaims,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(auth.photographerId, meta(req));
    clearSessionCookies(res, this.env);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestReset(@Body(new ZodValidationPipe(passwordResetRequestSchema)) body: PasswordResetRequestInput) {
    await this.auth.requestPasswordReset(body.email);
    return { status: 'sent_if_account_exists' };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmReset(
    @Body(new ZodValidationPipe(passwordResetConfirmSchema)) body: PasswordResetConfirmInput,
    @Req() req: Request,
  ) {
    await this.auth.confirmPasswordReset(body, meta(req));
  }

  private startSession(res: Response, tokens: SessionTokens) {
    setSessionCookies(res, this.env, tokens);
    return { status: 'authenticated', csrfToken: tokens.csrfToken };
  }
}
