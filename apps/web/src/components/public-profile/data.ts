import { cache } from 'react';
import type { PublicProfile } from '@/lib/types-insights';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Server-side read of /v1/public/p/:slug, shared by generateMetadata, the layout and the page
 * within one request. Cached for two minutes: image links are signed for an hour, and an
 * unpublished portfolio disappears within that window.
 */
export const getPublicProfile = cache(async (slug: string): Promise<PublicProfile | null> => {
  // Handles are lowercase a-z, 0-9 and hyphens; anything else cannot exist, so skip the request.
  if (!/^[a-z0-9-]{1,40}$/i.test(slug)) return null;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/public/p/${encodeURIComponent(slug.toLowerCase())}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 120, tags: [`public-profile:${slug.toLowerCase()}`] },
    });
  } catch {
    throw new Error('The portfolio service is not responding.');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Public profile request failed (${res.status}).`);
  return (await res.json()) as PublicProfile;
});
