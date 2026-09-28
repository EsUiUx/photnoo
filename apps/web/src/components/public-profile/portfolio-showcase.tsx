'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { startTransition, useEffect, useRef, useState, ViewTransition } from 'react';
import { DevelopImg } from '@/components/motion/develop';
import { categoryLabel } from '@/components/portfolio/categories';
import { cn } from '@/lib/cn';
import type { PublicPortfolioItem } from '@/lib/types-insights';

const same = (a: string | null, b: string) => a?.toLowerCase() === b.toLowerCase();

/** Category tabs, a masonry of previews in the photographer's order, and a full-screen viewer. */
export function PortfolioShowcase({ items, categories }: { items: PublicPortfolioItem[]; categories: string[] }) {
  const t = useTranslations('PublicProfile');
  const tc = useTranslations('PublicProfile.categories');
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const shown = filter ? items.filter((i) => same(i.category, filter)) : items;
  const label = (c: string) => categoryLabel(c, (key) => tc(key));

  return (
    <section aria-labelledby="work-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="work-title" className="text-lg font-semibold text-fg">
            {t('work')}
          </h2>
          <p className="tabular mt-0.5 text-sm text-fg-muted" aria-live="polite">
            {t('count', { count: shown.length })}
          </p>
        </div>
        {categories.length > 1 ? (
          <div role="group" aria-label={t('filterLabel')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {[null, ...categories].map((c) => {
              const active = c === null ? filter === null : filter !== null && same(filter, c);
              return (
                <button
                  key={c ?? 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => startTransition(() => setFilter(c))}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 pointer-coarse:h-11',
                    active ? 'border-fg bg-fg text-fg-inverse' : 'border-border-strong bg-surface text-fg-secondary hover:text-fg',
                  )}
                >
                  {c === null ? t('all') : label(c)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* A filter change crossfades the grid (view transition); where unsupported it simply swaps. */}
      <ViewTransition update="auto" default="none">
      {shown.length === 0 ? (
        <p className="mt-10 text-center text-sm text-fg-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-6 columns-2 gap-2 sm:gap-3 lg:columns-3">
          {shown.map((item, index) => (
            <li key={item.id} className="mb-2 break-inside-avoid sm:mb-3">
              <button
                type="button"
                onClick={() => setOpen(index)}
                aria-label={item.caption ? `${item.caption}. ${t('open', { position: index + 1, total: shown.length })}` : t('open', { position: index + 1, total: shown.length })}
                className="group relative block w-full overflow-hidden rounded-md bg-surface-sunken bg-cover bg-center"
                style={{
                  aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : '3 / 2',
                  backgroundImage: item.blurDataUrl ? `url(${item.blurDataUrl})` : undefined,
                }}
              >
                <DevelopImg
                  src={item.previewUrl}
                  alt={item.caption ?? ''}
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  loading={index < 4 ? 'eager' : 'lazy'}
                  fetchPriority={index < 2 ? 'high' : undefined}
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition-opacity duration-200 group-hover:opacity-90"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      </ViewTransition>

      <Lightbox items={shown} index={open} onIndex={setOpen} />
    </section>
  );
}

function Lightbox({ items, index, onIndex }: { items: PublicPortfolioItem[]; index: number | null; onIndex: (i: number | null) => void }) {
  const t = useTranslations('PublicProfile');
  const ref = useRef<HTMLDialogElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const item = index !== null ? items[index] : undefined;
  const total = items.length;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);

  // Warm the neighbours so arrows and swipes feel instant.
  useEffect(() => {
    if (index === null) return;
    for (const i of [index - 1, index + 1]) {
      const next = items[(i + total) % total];
      if (next) new Image().src = next.url;
    }
  }, [index, items, total]);

  const go = (step: number) => {
    if (index === null || total === 0) return;
    onIndex((index + step + total) % total);
  };

  function onKeyDown(event: React.KeyboardEvent) {
    const rtl = document.documentElement.dir === 'rtl';
    if (event.key === 'ArrowRight') go(rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') go(rtl ? 1 : -1);
    else if (event.key === 'Home') onIndex(0);
    else if (event.key === 'End') onIndex(total - 1);
    else return;
    event.preventDefault();
  }

  const control = 'inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20';

  return (
    <dialog
      ref={ref}
      aria-label={t('lightbox')}
      onCancel={(e) => {
        e.preventDefault();
        onIndex(null);
      }}
      onKeyDown={onKeyDown}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black/95 p-0 text-white backdrop:bg-black/80"
    >
      {item ? (
        <div
          className="flex h-full flex-col"
          onPointerDown={(e) => {
            swipe.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const start = swipe.current;
            swipe.current = null;
            if (!start) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
              const rtl = document.documentElement.dir === 'rtl';
              go((dx < 0) !== rtl ? 1 : -1);
            } else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) {
              onIndex(null);
            }
          }}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="tabular text-sm text-white/70" aria-live="polite">
              {t('position', { position: (index ?? 0) + 1, total })}
            </p>
            <button type="button" onClick={() => onIndex(null)} className={control} aria-label={t('close')} autoFocus>
              <X size={20} strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2 sm:px-20">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL, already web-sized */}
            <img
              key={item.id}
              src={item.url}
              alt={item.caption ?? ''}
              width={item.width ?? undefined}
              height={item.height ?? undefined}
              draggable={false}
              className="max-h-full max-w-full animate-[lightbox-in_200ms_var(--ease-out-expo)] bg-cover bg-center object-contain select-none motion-reduce:animate-none"
              style={{ backgroundImage: item.blurDataUrl ? `url(${item.blurDataUrl})` : undefined }}
            />
            {total > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} className={cn(control, 'absolute start-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex')} aria-label={t('previous')}>
                  <ChevronLeft size={22} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
                </button>
                <button type="button" onClick={() => go(1)} className={cn(control, 'absolute end-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex')} aria-label={t('next')}>
                  <ChevronRight size={22} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
                </button>
              </>
            ) : null}
          </div>

          <div className="flex min-h-16 items-center justify-center gap-4 px-4 py-4 text-center">
            {total > 1 ? (
              <button type="button" onClick={() => go(-1)} className={cn(control, 'sm:hidden')} aria-label={t('previous')}>
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
              </button>
            ) : null}
            <p className="min-w-0 flex-1 text-sm text-white/85 sm:flex-none" dir="auto">
              {item.caption}
            </p>
            {total > 1 ? (
              <button type="button" onClick={() => go(1)} className={cn(control, 'sm:hidden')} aria-label={t('next')}>
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <style>{`@keyframes lightbox-in { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: none; } }`}</style>
    </dialog>
  );
}
