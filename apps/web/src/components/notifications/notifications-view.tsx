'use client';

import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, Segmented } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from '@/lib/queries-account';
import { NotificationItem } from './notification-item';

/** Notifications page: All or Unread, newest first, 20 at a time. */
export function NotificationsView() {
  const t = useTranslations('App.notifications');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const list = useNotifications(filter);
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = unread.data ?? list.data?.pages[0]?.unreadCount ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('intro')}</p>
        </div>
        <Button variant="secondary" size="sm" icon={CheckCheck} disabled={unreadCount === 0} pending={markAll.isPending} onClick={() => markAll.mutate()}>
          {t('markAllRead')}
        </Button>
      </header>

      <Segmented
        label={t('filterLabel')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('all') },
          {
            value: 'unread',
            label: (
              <>
                {t('unread')}
                {unreadCount > 0 ? <span className="tabular rounded-full bg-brand-soft px-1.5 text-xs font-semibold text-brand">{unreadCount}</span> : null}
              </>
            ),
          },
        ]}
        className="self-start"
      />

      <p role="status" className="sr-only">
        {markAll.isSuccess ? t('markedAllRead') : ''}
      </p>
      {markAll.isError || markRead.isError ? <Alert tone="danger">{t('actionFailed')}</Alert> : null}

      <Card className="overflow-hidden">
        {list.isPending ? (
          <div role="status" className="divide-y divide-border">
            <span className="sr-only">{t('loading')}</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 px-5 py-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="mt-2 h-3.5 w-2/3" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState title={t('loadFailedTitle')} body={t('loadFailed')} onRetry={() => void list.refetch()} />
        ) : items.length === 0 ? (
          filter === 'unread' ? (
            <EmptyState icon={Inbox} title={t('emptyUnreadTitle')} body={t('emptyUnreadBody')} />
          ) : (
            <EmptyState icon={Bell} title={t('emptyTitle')} body={t('emptyBody')} />
          )
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} onRead={(id) => markRead.mutate(id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {list.hasNextPage ? (
        <Button variant="secondary" className="self-center" pending={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {t('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
