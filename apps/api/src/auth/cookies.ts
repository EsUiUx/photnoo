import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env';

export const ACCESS_COOKIE = 'pn_at';
export const REFRESH_COOKIE = 'pn_rt';
export const CSRF_COOKIE = 'pn_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** The refresh cookie is only ever sent to the auth routes. */
const REFRESH_PATH = '/v1/auth';

function base(env: Env): CookieOptions {
  return { secure: env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test', sameSite: 'strict' };
}

export function setSessionCookies(
  res: Response,
  env: Env,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base(env),
    httpOnly: true,
    path: '/',
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base(env),
    httpOnly: true,
    path: REFRESH_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
  // Readable by the web app, which echoes it in the x-csrf-token header (double-submit).
  res.cookie(CSRF_COOKIE, tokens.csrfToken, {
    ...base(env),
    httpOnly: false,
    path: '/',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookies(res: Response, env: Env): void {
  res.clearCookie(ACCESS_COOKIE, { ...base(env), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(env), path: REFRESH_PATH });
  res.clearCookie(CSRF_COOKIE, { ...base(env), path: '/' });
}
