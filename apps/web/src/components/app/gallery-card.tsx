'use client';

import { Check, Download, Eye, ImageIcon, Link2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { fetchLink } from '@/lib/queries';
import type { GalleryListItem } from '@/lib/types';
import { galleryBadge, StatusBadge } from './status-badge';

const DAY = 86_400_000;

/** Whole days until the link closes, never negative; null when the gallery is not live. */
export function daysLeft(gallery: Pick<GalleryListItem, 'state' | 'expiresAt'>, now: number): number | null {
  if (gallery.state !== 'active' || !gallery.expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(gallery.expiresAt).getTime() - now) / DAY));
}

/** Photo-first gallery card: 4:3 cover, name, client, status, time left and delivery counts. */
export function GalleryCard({ gallery, now }: { gallery: GalleryListItem; now: number }) {
  const t = useTranslations('App.table');
  const locale = useLocale();
  const kind = galleryBadge(gallery);
  const left = daysLeft(gallery, now);
  const closed = gallery.state !== 'draft' && gallery.state !== 'active';

  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-shadow duration-200 ease-[var(--ease-out-expo)] focus-within:shadow-card hover:shadow-card">
      <div className="relative aspect-4/3 overflow-hidden bg-surface-sunken">
        {gallery.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, sized by the card
          <img
            src={gallery.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-fg-muted">
            <ImageIcon size={22} strokeWidth={1.75} aria-hidden />
            <span className="text-xs">{t('noCover')}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-fg">
            {/* The stretched link makes the whole card open the gallery; the copy button sits above it. */}
            <Link href={`/galleries/${gallery.id}`} className="rounded-md outline-offset-4 after:absolute after:inset-0 after:content-['']">
              {gallery.name}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-sm text-fg-muted">{gallery.clientName ?? t('noClient')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind={kind} />
          {left !== null ? <span className="text-xs text-fg-muted">{t('daysLeft', { days: left })}</span> : null}
          {closed && gallery.closedAt ? <span className="text-xs text-fg-muted">{t('closedOn', { date: formatDate(gallery.closedAt, locale) })}</span> : null}
        </div>
        <div className="mt-auto flex items-center gap-4 border-t border-border pt-3 text-xs text-fg-secondary">
          <span className="tabular inline-flex items-center gap-1.5">
            <Eye size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
            {t('views', { count: gallery.views })}
          </span>
          <span className="tabular inline-flex items-center gap-1.5">
            <Download size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
            {t('downloads', { count: gallery.downloads })}
          </span>
          {gallery.state === 'active' ? <CopyLinkButton galleryId={gallery.id} name={gallery.name} className="relative z-10 ms-auto -me-2" /> : null}
        </div>
      </div>
    </article>
  );
}

/** Fetches the fresh share link, copies it and says so in place and to screen readers. */
export function CopyLinkButton({ galleryId, name, className }: { galleryId: string; name: string; className?: string }) {
  const t = useTranslations('App.table');
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    clearTimeout(timer.current);
    setState('busy');
    try {
      const { link } = await fetchLink(galleryId);
      await navigator.clipboard.writeText(link);
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = setTimeout(() => setState('idle'), 2500);
  }

  const message = state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : '';

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        disabled={state === 'busy'}
        aria-label={state === 'idle' || state === 'busy' ? t('copyLinkFor', { name }) : message}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors duration-150 disabled:opacity-60 pointer-coarse:h-11',
          state === 'copied' ? 'text-success' : state === 'failed' ? 'text-danger' : 'text-brand hover:bg-brand-soft',
          className,
        )}
      >
        {state === 'copied' ? <Check size={16} strokeWidth={2} aria-hidden /> : <Link2 size={16} strokeWidth={1.75} aria-hidden />}
        <span>{message || t('copyLink')}</span>
      </button>
      <span aria-live="polite" className="sr-only">
        {message}
      </span>
    </>
  );
}
