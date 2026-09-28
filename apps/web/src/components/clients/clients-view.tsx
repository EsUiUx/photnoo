'use client';

import { Phone, Plus, SearchX, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { SearchInput, useDebounced } from '@/components/gallery/gallery-filters';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { formatDate } from '@/lib/format';
import { useClients } from '@/lib/queries-galleries';
import type { ClientListItem } from '@/lib/types-galleries';
import { ClientAvatar } from './client-avatar';
import { ClientDrawer } from './client-drawer';
import { ClientFormDialog } from './client-form-dialog';

/** Clients management (Figma 0:3818): cards with search, Add client, and a detail drawer. */
export function ClientsView() {
  const t = useTranslations('App.clients');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useDebounced(search.trim());
  const clients = useClients(q);
  const items = useMemo(() => clients.data?.pages.flatMap((page) => page.items) ?? [], [clients.data]);

  let body: React.ReactNode;
  if (clients.isPending) body = <CardsSkeleton />;
  else if (clients.isError && !clients.data) body = <ErrorState onRetry={() => void clients.refetch()} className="rounded-lg border border-border" />;
  else if (items.length === 0 && !q) {
    body = (
      <EmptyState
        icon={Users}
        title={t('emptyTitle')}
        body={t('empty')}
        action={
          <Button icon={Plus} onClick={() => setAdding(true)}>
            {t('add')}
          </Button>
        }
        className="rounded-lg border border-dashed border-border-strong"
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('noResultsTitle')}
        body={t('noResults', { query: q })}
        action={
          <Button variant="secondary" onClick={() => setSearch('')}>
            {t('clearSearch')}
          </Button>
        }
        className="rounded-lg border border-border"
      />
    );
  } else {
    body = (
      <>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy={clients.isFetching || undefined}>
          {items.map((client) => (
            <li key={client.id} className="grid">
              <ClientCard client={client} onOpen={() => setOpenId(client.id)} />
            </li>
          ))}
        </ul>
        {clients.hasNextPage ? (
          <div className="flex justify-center pt-2">
            <Button variant="secondary" pending={clients.isFetchingNextPage} onClick={() => void clients.fetchNextPage()}>
              {t('loadMore')}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <Button icon={Plus} onClick={() => setAdding(true)}>
          {t('add')}
        </Button>
      </div>
      <SearchInput value={search} onChange={setSearch} label={t('search')} placeholder={t('searchPlaceholder')} className="sm:max-w-sm" />
      {body}
      <ClientFormDialog open={adding} onClose={() => setAdding(false)} onSaved={(client) => setOpenId(client.id)} />
      <ClientDrawer clientId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ClientCard({ client, onOpen }: { client: ClientListItem; onOpen: () => void }) {
  const t = useTranslations('App.clients');
  const locale = useLocale();
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs transition-shadow duration-200 hover:shadow-card">
      <div className="flex items-center gap-3">
        <ClientAvatar name={client.name} />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-fg">{client.name}</h2>
          <p className="text-xs text-fg-muted">{t('createdOn', { date: formatDate(client.createdAt, locale) })}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="col-span-2 flex items-center gap-1.5 text-fg-secondary">
          <dt>
            <Phone size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
            <span className="sr-only">{t('phone')}</span>
          </dt>
          <dd dir="ltr">{client.phone}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{t('galleriesCount')}</dt>
          <dd className="tabular font-medium text-fg">{t('galleryCount', { count: client.galleryCount })}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{t('lastDelivery')}</dt>
          <dd className="tabular font-medium text-fg">{client.lastDeliveryAt ? formatDate(client.lastDeliveryAt, locale) : t('never')}</dd>
        </div>
      </dl>
      <Button variant="soft" block onClick={onOpen} className="mt-auto" aria-label={t('viewDetailsFor', { name: client.name })}>
        {t('viewDetails')}
      </Button>
    </article>
  );
}

function CardsSkeleton() {
  const tc = useTranslations('Common');
  return (
    <>
      <p role="status" className="sr-only">
        {tc('loading')}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </li>
        ))}
      </ul>
    </>
  );
}
