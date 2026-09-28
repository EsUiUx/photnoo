import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next.js 16 calls this file "proxy" (formerly middleware). It picks the locale for each request.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
