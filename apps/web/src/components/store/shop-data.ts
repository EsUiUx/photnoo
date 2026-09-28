import { cache } from 'react';
import type { PublicShop } from '@/lib/types-commerce';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Server-side read of the public shop. Uncached on purpose: product image URLs are signed per
 * request. `cache` dedupes the call between generateMetadata and the page. Null means the
 * slug is unknown or the store is off; a thrown error means the API is unreachable.
 */
export const loadShop = cache(async (slug: string): Promise<PublicShop | null> => {
  const res = await fetch(`${apiUrl}/v1/public/p/${encodeURIComponent(slug)}/shop`, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`shop ${res.status}`);
  return (await res.json()) as PublicShop;
});
