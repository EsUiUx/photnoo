import type { Metadata } from 'next';
import { AppProviders } from '@/components/app/providers';
import { AppShell } from '@/components/app/app-shell';

// The photographer app is private: keep it out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** AppShell renders the single <main id="main"> for every photographer page. */
export default function PhotographerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
