'use client';

import { Check } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { IconButton } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import type { AppNotification } from '@/lib/types-account';
import { notificationHref, TONE_CLASSES, useNotificationText } from './notification-text';

/** "12 minutes ago", refreshed each minute; the exact time is in the tooltip and <time>. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const date = new Date(iso);
  return (
    <time
      dateTime={iso}
      title={format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn' })}
      className={cn('tabular text-xs whitespace-nowrap text-fg-muted', className)}
    >
      {format.relativeTime(date, { now, numberingSystem: 'latn' })}
    </time>
  );
}

/**
 * One notification row. The title is the link (to its gallery, order or billing); opening it
 * marks it read. `compact` is the bell dropdown, the default is the Notifications page.
 */
export function NotificationItem({
  notification,
  onRead,
  onNavigate,
  compact,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations('App.notifications');
  const render = useNotificationText();
  const { title, body, icon: Icon, tone } = render(notification);
  const href = notificationHref(notification);
  const unread = !notification.read;

  const open = () => {
    if (unread) onRead(notification.id);
    onNavigate?.();
  };

  const heading = (
    <span className={cn('text-sm text-fg', unread ? 'font-semibold' : 'font-medium')}>
      {title}
    </span>
  );

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 transition-colors duration-150 hover:bg-surface-subtle',
        compact ? 'rounded-md px-3 py-3' : 'px-4 py-4 sm:px-5',
      )}
    >
      <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full', compact ? 'size-9' : 'size-10', TONE_CLASSES[tone])}>
        <Icon size={compact ? 16 : 18} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {href ? (
            <Link href={href} onClick={open} className="rounded-md outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-brand">
              {heading}
            </Link>
          ) : (
            heading
          )}
          {unread ? (
            <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">{t('new')}</span>
          ) : null}
        </div>
        {body ? <p className={cn('mt-0.5 text-sm text-fg-secondary', compact && 'line-clamp-2')}>{body}</p> : null}
        {compact ? <RelativeTime iso={notification.createdAt} className="mt-1 block" /> : null}
      </div>
      {compact ? null : (
        <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">
          <RelativeTime iso={notification.createdAt} className="pt-0.5" />
          {unread ? <IconButton icon={Check} label={t('markRead')} size="sm" onClick={() => onRead(notification.id)} /> : null}
        </div>
      )}
    </div>
  );
}
