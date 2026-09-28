import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@photnoo/shared'],
  poweredByHeader: false,
  // Lets the preview redeploy build next to the live build and swap (scripts/preview-redeploy.mjs).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // The API is served under the web origin (/v1/*), so auth cookies are first-party and
  // no CORS is needed. In production the CDN routes /v1/* to the API the same way.
  rewrites: async () => [{ source: '/v1/:path*', destination: `${apiUrl}/v1/:path*` }],
};

export default withNextIntl(nextConfig);
