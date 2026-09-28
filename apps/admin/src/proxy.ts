import { type NextRequest, NextResponse } from 'next/server';

/** Optimistic check only (the API verifies every call): no admin CSRF cookie means not signed in. */
export default function proxy(request: NextRequest) {
  if (!request.cookies.has('pn_adm_csrf')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!login|v1|_next|.*\\..*).*)',
};
