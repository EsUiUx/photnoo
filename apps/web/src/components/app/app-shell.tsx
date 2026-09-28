'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { useMe } from '@/lib/queries';
import type { Me } from '@/lib/types';
import { AppHeader } from './app-header';
import { RenewalBanner } from './renewal-banner';
import { Sidebar } from './sidebar';

/**
 * Photographer app frame: light sidebar on lg+, a top bar with a drawer below that, and the one
 * <main id="main"> every app page renders into. Sends the visitor to /login when the session ends.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
  }, [me.error, router]);

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-e border-border bg-surface-subtle lg:block">
        <Sidebar me={me.data} loading={me.isLoading} />
      </aside>
      <MobileNav
        open={drawer}
        onClose={() => {
          setDrawer(false);
          menuButton.current?.focus();
        }}
        me={me.data}
        loading={me.isLoading}
      />
      <div className="flex min-h-dvh min-w-0 flex-col">
        <AppHeader me={me.data} onMenu={() => setDrawer(true)} menuButtonRef={menuButton} />
        <RenewalBanner me={me.data} />
        <main id="main" tabIndex={-1} className="flex-1 px-4 pt-8 pb-16 outline-none sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

/**
 * Navigation drawer on the native modal <dialog>: the browser moves focus in, makes the page
 * behind inert and routes Escape through onCancel; closing hands focus back to the menu button.
 */
function MobileNav({ open, onClose, me, loading }: { open: boolean; onClose: () => void; me?: Me; loading?: boolean }) {
  const t = useTranslations('App.header');
  const tNav = useTranslations('App.nav');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A wide window has the sidebar, so a drawer left open there would only trap focus.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia('(min-width: 64rem)');
    const onChange = () => query.matches && onClose();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [open, onClose]);

  return (
    <dialog
      data-motion="drawer-start"
      ref={ref}
      aria-label={tNav('label')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="fixed inset-y-0 start-0 end-auto m-0 h-dvh max-h-none w-72 max-w-[85vw] border-e border-border bg-surface-subtle p-0 text-fg shadow-overlay backdrop:bg-overlay lg:hidden"
    >
      {open ? (
        <div className="relative h-full">
          <IconButton icon={X} label={t('closeMenu')} onClick={onClose} className="absolute end-3 top-3 z-10" />
          <Sidebar me={me} loading={loading} onNavigate={onClose} />
        </div>
      ) : null}
    </dialog>
  );
}
