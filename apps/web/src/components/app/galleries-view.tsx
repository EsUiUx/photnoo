'use client';

import type { GallerySort, GalleryStatusFilter } from '@photnoo/shared';
import { FolderOpen, Images, LayoutGrid, Plus, SearchX, Table2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';
import { DateRangeFilter, type DateRange, SearchInput, useDebounced } from '@/components/gallery/gallery-filters';
import { GalleryTable } from '@/components/gallery/gallery-table';
import { staggerItem } from '@/components/motion/stagger-item';
import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';
import { Card, Segmented } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { useGalleries } from '@/lib/queries';
import { ListStagger } from './app-motion';
import { CreateGalleryDialog } from './create-gallery-dialog';
import { GalleryCard } from './gallery-card';

type View = 'grid' | 'table';
const VIEW_KEY = 'photnoo.galleries.view';
const SORTS: GallerySort[] = ['newest', 'oldest', 'expiring', 'views'];

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

/** All galleries as a photo-first grid or a table, with search, status, created dates and sort on the server. */
export function GalleriesView() {
  const t = useTranslations('App.galleries');
  const sortId = useId();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<GalleryStatusFilter>('all');
  const [sort, setSort] = useState<GallerySort>('newest');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [view, setView] = useState<View>('grid');
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => Date.now());
  const q = useDebounced(search.trim());
  const filters = useMemo(
    () => ({ q: q || undefined, status, sort, from: range.from || undefined, to: range.to || undefined }),
    [q, status, sort, range],
  );
  const galleries = useGalleries(filters);

  // The remembered view is read after mount, so the server render and the first client render match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only preference
    setView(readView());
  }, []);

  function changeView(next: View) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice lasts for this visit only.
    }
  }

  const items = useMemo(() => galleries.data?.pages.flatMap((page) => page.items) ?? [], [galleries.data]);
  const narrowed = Boolean(q || range.from || range.to);
  // A new search, filter or sort dims the current list until the answer lands (no re-stagger).
  const refreshing = galleries.isFetching && !galleries.isFetchingNextPage;
  const dim = cn('transition-opacity duration-150', refreshing && 'opacity-70');
  const create = () => setCreating(true);
  const reset = () => {
    setSearch('');
    setRange({ from: '', to: '' });
    setStatus('all');
  };

  let body: React.ReactNode;
  if (galleries.isPending) {
    body = view === 'grid' ? <GridSkeleton /> : <TableSkeleton />;
  } else if (galleries.isError && !galleries.data) {
    body = <ErrorState onRetry={() => void galleries.refetch()} className="rounded-lg border border-border" />;
  } else if (items.length === 0 && !narrowed && status === 'all') {
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
  } else if (items.length === 0 && narrowed) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('noResultsTitle')}
        body={q ? t('noResults', { query: q }) : t('noResultsDates')}
        action={
          <Button variant="secondary" onClick={reset}>
            {t('clearFilters')}
          </Button>
        }
        className="rounded-lg border border-border"
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={FolderOpen}
        title={t('noFilterResultsTitle')}
        body={t('noFilterResults')}
        action={
          <Button variant="secondary" onClick={() => setStatus('all')}>
            {t('showAll')}
          </Button>
        }
        className="rounded-lg border border-border"
      />
    );
  } else {
    body = (
      <>
        {view === 'grid' ? (
          <ListStagger className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4', dim)} aria-busy={galleries.isFetching || undefined}>
            {items.map((gallery, index) => (
              <li key={gallery.id} {...staggerItem(index)} className="grid">
                <GalleryCard gallery={gallery} now={now} />
              </li>
            ))}
          </ListStagger>
        ) : (
          <Card aria-busy={galleries.isFetching || undefined} className={cn('overflow-hidden', dim)}>
            <GalleryTable galleries={items} now={now} caption={t('title')} />
          </Card>
        )}
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
              {galleries.hasNextPage ? t('countMore', { count: items.length }) : t('count', { count: items.length })}
            </p>
          ) : null}
        </div>
        <Button icon={Plus} onClick={create}>
          {t('create')}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SearchInput value={search} onChange={setSearch} label={t('search')} placeholder={t('searchPlaceholder')} className="sm:min-w-48 sm:max-w-xs sm:flex-1" />
            <DateRangeFilter value={range} onChange={setRange} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={sortId} className="text-xs font-medium text-fg-muted">
                {t('sortLabel')}
              </label>
              <select
                id={sortId}
                value={sort}
                onChange={(event) => setSort(event.target.value as GallerySort)}
                className={controlClasses(false, 'h-10 w-auto pe-8 pointer-coarse:h-11')}
              >
                {SORTS.map((value) => (
                  <option key={value} value={value}>
                    {t(`sort.${value}`)}
                  </option>
                ))}
              </select>
            </div>
            <Segmented<View>
              label={t('viewLabel')}
              value={view}
              onChange={changeView}
              options={[
                {
                  value: 'grid',
                  label: (
                    <>
                      <LayoutGrid size={16} strokeWidth={1.75} aria-hidden />
                      <span className="sr-only sm:not-sr-only">{t('view.grid')}</span>
                    </>
                  ),
                },
                {
                  value: 'table',
                  label: (
                    <>
                      <Table2 size={16} strokeWidth={1.75} aria-hidden />
                      <span className="sr-only sm:not-sr-only">{t('view.table')}</span>
                    </>
                  ),
                },
              ]}
            />
          </div>
        </div>
        <Segmented<GalleryStatusFilter>
          label={t('filterLabel')}
          value={status}
          onChange={setStatus}
          options={(['all', 'active', 'drafts', 'closed'] as const).map((value) => ({ value, label: t(`filter.${value}`) }))}
          className="self-start"
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
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
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

function TableSkeleton() {
  const t = useTranslations('Common');
  return (
    <Card>
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <div className="divide-y divide-border" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-10 w-14" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 md:block" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
