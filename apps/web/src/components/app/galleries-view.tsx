'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useGalleries } from '@/lib/queries';
import { CreateGalleryDialog } from './create-gallery-dialog';
import { GalleriesTable } from './galleries-table';

/** Figma "All Galleries" (frame "Frame 1618872927"). */
export function GalleriesView() {
  const t = useTranslations('App.galleries');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const galleries = useGalleries(query);

  // Search as the photographer types, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const items = galleries.data?.items ?? [];

  return (
    <section className="mx-auto max-w-[1504px] overflow-hidden rounded-lg bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
      <div className="flex flex-wrap items-center gap-4 px-6 py-6">
        <h1 className="flex-1 text-2xl font-semibold text-primary-900">{t('title')}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-[42px] items-center rounded-3xl bg-primary-300 px-6 text-base font-semibold text-primary-50 hover:bg-primary-400"
        >
          {t('create')}
        </button>
        <label className="flex h-[42px] w-full items-center gap-3 rounded-3xl border border-field-border bg-white px-5 sm:w-[412px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
          <img src="/app/search.svg" alt="" className="size-6" />
          <span className="sr-only">{t('search')}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search')}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </label>
      </div>
      {galleries.isLoading ? (
        <div className="space-y-2 px-6 pb-6" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <GalleriesTable items={items} />
      ) : (
        <div className="flex flex-col items-center gap-4 px-6 pb-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma illustration */}
          <img src="/app/empty-state.png" alt="" width={260} height={283} className="h-auto w-[200px]" />
          <p className="text-[32px] font-bold text-primary-300">{query ? t('noResultsTitle') : t('emptyTitle')}</p>
          <p className="text-lg font-medium text-primary-300">{query ? t('noResults') : t('empty')}</p>
        </div>
      )}
      <CreateGalleryDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
