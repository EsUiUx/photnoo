import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** Pages that need a photographer session. The API still enforces auth on every call. */
const PROTECTED = /^\/(?:(ar|en)\/)?dashboard(?:\/|$)/;

// Next.js 16 calls this file "proxy" (formerly middleware).
export default function proxy(request: NextRequest) {
  const match = PROTECTED.exec(request.nextUrl.pathname);
  // Optimistic check only: pn_csrf lives as long as the refresh session (30 days).
  if (match && !request.cookies.has('pn_csrf')) {
    const locale = match[1] ?? routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }
  return intl(request);
}

export const config = {
  // Skip the API rewrite (/v1), Next internals and files with an extension.
  matcher: '/((?!api|v1|_next|_vercel|.*\\..*).*)',
};
