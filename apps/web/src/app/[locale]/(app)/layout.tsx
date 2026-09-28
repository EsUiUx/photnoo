import { AppProviders } from '@/components/app/providers';
import { AppShell } from '@/components/app/app-shell';

export default function PhotographerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
