import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

// Staff console (PRD section 8). Served from its own subdomain behind Cloudflare Access; the API
// is proxied same-origin so the admin cookies stay first-party and never reach the public site.
const nextConfig: NextConfig = {
  transpilePackages: ['@photnoo/shared'],
  poweredByHeader: false,
  rewrites: async () => [{ source: '/v1/:path*', destination: `${apiUrl}/v1/:path*` }],
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
};

export default nextConfig;
