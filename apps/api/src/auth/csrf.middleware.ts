import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { safeEqual } from '../common/crypto';
import { ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER, REFRESH_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF check: any state-changing request that carries a session cookie must echo
 * the pn_csrf cookie in the x-csrf-token header. Requests without session cookies (login,
 * apply) have nothing to forge and pass through.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) return next();
    const cookies = req.cookies as Record<string, string | undefined>;
    // Admin sessions use their own pair of cookies (pn_adm + pn_adm_csrf).
    if (cookies.pn_adm) {
      const adminCookie = cookies.pn_adm_csrf;
      const adminHeader = req.header(CSRF_HEADER);
      if (!adminCookie || !adminHeader || !safeEqual(adminCookie, adminHeader)) {
        throw new ForbiddenException({ code: 'csrf_failed', message: 'Please refresh the page and try again.' });
      }
      return next();
    }
    const hasSession = Boolean(cookies[ACCESS_COOKIE] || cookies[REFRESH_COOKIE]);
    if (!hasSession) return next();

    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = req.header(CSRF_HEADER);
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      throw new ForbiddenException({ code: 'csrf_failed', message: 'Please refresh the page and try again.' });
    }
    next();
  }
}
