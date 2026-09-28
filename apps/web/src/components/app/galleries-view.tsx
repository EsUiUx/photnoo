'use client';

import { FolderOpen, Images, Plus, Search, SearchX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';
import { Segmented } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { useGalleries } from '@/lib/queries';
import type { GalleryListItem } from '@/lib/types';
import { CreateGalleryDialog } from './create-gallery-dialog';
import { GalleryCard } from './gallery-card';

type Filter = 'all' | 'active' | 'drafts' | 'closed';

function matches(filter: Filter, gallery: GalleryListItem) {
  if (filter === 'all') return true;
  if (filter === 'active') return gallery.state === 'active';
  if (filter === 'drafts') return gallery.state === 'draft';
  return gallery.state !== 'active' && gallery.state !== 'draft';
}

/** All galleries as a photo-first card grid, with server search and a client-side status filter. */
export function GalleriesView() {
  const t = useTranslations('App.galleries');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => Date.now());
  const galleries = useGalleries(query);

  // Search as the photographer types, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const items = useMemo(() => galleries.data?.pages.flatMap((page) => page.items) ?? [], [galleries.data]);
  const visible = useMemo(() => items.filter((gallery) => matches(filter, gallery)), [items, filter]);
  const create = () => setCreating(true);

  let body: React.ReactNode;
  if (galleries.isPending) {
    body = <GridSkeleton />;
  } else if (galleries.isError && !galleries.data) {
    body = <ErrorState onRetry={() => void galleries.refetch()} className="rounded-lg border border-border" />;
  } else if (items.length === 0 && !query) {
    body = (
      <EmptyState
        icon={Images}
        title={t('emptyTitle')}
        body={t('empty')}
        action={
          <Button icon={Plus} onClick={create}>
            {t('createFirst')}
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
        body={t('noResults', { query })}
        action={
          <Button variant="secondary" onClick={() => setSearch('')}>
            {t('clearSearch')}
          </Button>
        }
        className="rounded-lg border border-border"
      />
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={FolderOpen}
        title={t('noFilterResultsTitle')}
        body={t('noFilterResults')}
        action={
          <Button variant="secondary" onClick={() => setFilter('all')}>
            {t('showAll')}
          </Button>
        }
        className="rounded-lg border border-border"
      />
    );
  } else {
    body = (
      <>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy={galleries.isFetching || undefined}>
          {visible.map((gallery) => (
            <li key={gallery.id} className="grid">
              <GalleryCard gallery={gallery} now={now} />
            </li>
          ))}
        </ul>
        {galleries.hasNextPage ? (
          <div className="flex justify-center pt-2">
            <Button variant="secondary" pending={galleries.isFetchingNextPage} onClick={() => void galleries.fetchNextPage()}>
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
          {galleries.data ? (
            <p className="tabular mt-1 text-sm text-fg-muted" aria-live="polite">
              {t('count', { count: visible.length })}
            </p>
          ) : null}
        </div>
        <Button icon={Plus} onClick={create}>
          {t('create')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="gallery-search" className="sr-only">
            {t('search')}
          </label>
          <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            id="gallery-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            autoComplete="off"
            className={controlClasses(false, 'h-10 ps-10 pe-10 pointer-coarse:h-11 [&::-webkit-search-cancel-button]:hidden')}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('clearSearch')}
              className="absolute end-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-surface-subtle hover:text-fg"
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
        <Segmented<Filter>
          label={t('filterLabel')}
          value={filter}
          onChange={setFilter}
          options={(['all', 'active', 'drafts', 'closed'] as const).map((value) => ({ value, label: t(`filter.${value}`) }))}
          className="self-start sm:self-auto"
        />
      </div>

      {body}

      <CreateGalleryDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function GridSkeleton() {
  const t = useTranslations('Common');
  return (
    <>
    <p role="status" className="sr-only">{t('loading')}</p>
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-lg border border-border bg-surface">
          <Skeleton className="aspect-4/3 w-full rounded-none" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
    </>
  );
}
