'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { useLatestNotifications, useMarkAllRead, useMarkRead, useUnreadCount } from '@/lib/queries-account';
import { NotificationItem } from './notification-item';

/**
 * Header bell: unread badge, and a panel with the latest 8 notifications and a link to all.
 * A disclosure (not a menu): Escape or a click outside closes it and focus returns to the bell.
 */
export function NotificationBell({ initialUnread }: { initialUnread?: number }) {
  const t = useTranslations('App.notifications');
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const headingId = useId();

  const unread = useUnreadCount();
  const count = unread.data ?? initialUnread ?? 0;
  const latest = useLatestNotifications(open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const label = count > 0 ? t('bellUnread', { count }) : t('bell');

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-10 items-center justify-center rounded-md text-fg-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-fg pointer-coarse:size-11"
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden />
        {count > 0 ? (
          <span
            aria-hidden
            className="tabular absolute end-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs leading-none font-semibold text-white ring-2 ring-surface"
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className={cn(
            'fixed inset-x-4 top-16 z-50 mt-1 flex max-h-[min(36rem,calc(100dvh-6rem))] flex-col rounded-lg border border-border bg-surface shadow-popover',
            'sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:w-96',
            'animate-[bell-in_160ms_var(--ease-out-expo)] motion-reduce:animate-none',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 id={headingId} className="text-base font-semibold text-fg">
              {t('latest')}
            </h2>
            {count > 0 ? (
              <Button variant="ghost" size="sm" icon={CheckCheck} pending={markAll.isPending} onClick={() => markAll.mutate()}>
                {t('markAllRead')}
              </Button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {latest.isPending ? (
              <div role="status" className="flex flex-col gap-1 p-1.5">
                <span className="sr-only">{t('loading')}</span>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3 px-1.5 py-2">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : latest.isError ? (
              <ErrorState title={t('loadFailedTitle')} body={t('loadFailed')} onRetry={() => void latest.refetch()} className="py-8" />
            ) : latest.data.items.length === 0 ? (
              <EmptyState icon={Bell} title={t('emptyTitle')} body={t('emptyBody')} className="py-8" />
            ) : (
              <ul className="flex flex-col">
                {latest.data.items.map((n) => (
                  <li key={n.id}>
                    <NotificationItem notification={n} compact onRead={(id) => markRead.mutate(id)} onNavigate={close} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-1.5">
            <Link
              href="/notifications"
              onClick={close}
              className="flex min-h-10 items-center justify-center rounded-md text-sm font-medium text-brand hover:bg-brand-soft pointer-coarse:min-h-11"
            >
              {t('seeAll')}
            </Link>
          </div>
          <style>{`@keyframes bell-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
        </div>
      ) : null}
    </div>
  );
}
