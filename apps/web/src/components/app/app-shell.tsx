'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { AppHeader } from './app-header';
import { Sidebar } from './sidebar';

/** Photographer app frame. Sends the visitor to /login when the session has ended. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
  }, [me.error, router]);

  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">
        <Sidebar me={me.data} />
      </aside>
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-primary-900/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 start-0">
            <Sidebar me={me.data} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader me={me.data} onMenu={() => setDrawer(true)} />
        <main className="flex-1 px-4 py-8 sm:px-8 xl:px-12">{children}</main>
      </div>
    </div>
  );
}
