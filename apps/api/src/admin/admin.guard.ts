import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '@photnoo/db';
import type { Request } from 'express';
import { type AdminMeta, type AdminPrincipal, AdminAuthService, ROLE_LEVEL } from './admin-auth.service';

export const ADMIN_COOKIE = 'pn_adm';
export const ADMIN_CSRF_COOKIE = 'pn_adm_csrf';
/** The admin session cookie is only ever sent to the admin API. */
export const ADMIN_COOKIE_PATH = '/v1/admin';

type AdminRequest = Request & { admin?: AdminPrincipal };

const MIN_ROLE = 'photnoo:minRole';
/** Lowest role allowed: support < operations < super_admin (PRD section 8). */
export const MinRole = (role: AdminRole) => SetMetadata(MIN_ROLE, role);

export function adminMeta(req: Request): AdminMeta {
  return {
    ip: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    accessJwt: req.header('cf-access-jwt-assertion') ?? null,
  };
}

/** Every admin route: a live admin session, then the route's minimum role (default: support). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const token = (req.cookies as Record<string, string | undefined>)[ADMIN_COOKIE];
    const admin = await this.auth.authenticate(token, adminMeta(req));
    const required = this.reflector.getAllAndOverride<AdminRole | undefined>(MIN_ROLE, [context.getHandler(), context.getClass()]) ?? 'support';
    if (ROLE_LEVEL[admin.role] < ROLE_LEVEL[required]) {
      throw new ForbiddenException({ code: 'forbidden', message: 'Your role cannot do this.' });
    }
    req.admin = admin;
    return true;
  }
}

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<AdminRequest>();
  if (!req.admin) throw new UnauthorizedException();
  return req.admin;
});
