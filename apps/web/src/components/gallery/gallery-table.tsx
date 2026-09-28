'use client';

import { ArrowRight, ImageIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { ListStagger } from '@/components/app/app-motion';
import { CopyLinkButton, daysLeft } from '@/components/app/gallery-card';
import { galleryBadge, StatusBadge } from '@/components/app/status-badge';
import { DevelopImg } from '@/components/motion/develop';
import { staggerItem } from '@/components/motion/stagger-item';
import { ButtonLink } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import type { GalleryListItem } from '@/lib/types';

function Cover({ gallery, className }: { gallery: GalleryListItem; className: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-sunken text-fg-muted ${className}`}>
      {gallery.coverUrl ? (
        <DevelopImg src={gallery.coverUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <ImageIcon size={16} strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
}

/** Expiry for a row: the closing date while live, "Not shared" for drafts, the close date after. */
function Expiry({ gallery, now }: { gallery: GalleryListItem; now: number }) {
  const t = useTranslations('App.table');
  const locale = useLocale();
  const left = daysLeft(gallery, now);
  if (gallery.state === 'draft') return <span className="text-fg-muted">{t('notShared')}</span>;
  if (left !== null) {
    return (
      <span className="flex flex-col">
        <span className="tabular text-fg">{formatDate(gallery.expiresAt, locale)}</span>
        <span className="text-xs text-fg-muted">{t('daysLeft', { days: left })}</span>
      </span>
    );
  }
  return <span className="tabular text-fg-muted">{formatDate(gallery.closedAt ?? gallery.expiresAt, locale)}</span>;
}

/**
 * Galleries as a table on wide screens and a stacked list on phones. Every row links to the
 * gallery; live galleries get an inline copy-link action.
 */
export function GalleryTable({ galleries, now, caption }: { galleries: GalleryListItem[]; now: number; caption: string }) {
  const t = useTranslations('App.table');
  const locale = useLocale();
  const format = useFormatter();

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-start text-xs font-medium text-fg-muted">
              <th scope="col" className="px-4 py-3 text-start font-medium">
                <span className="sr-only">{t('cover')}</span>
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t('name')}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t('client')}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t('created')}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t('viewsHeader')}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t('downloadsHeader')}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t('status')}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t('expiry')}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">
                <span className="sr-only">{t('actions')}</span>
              </th>
            </tr>
          </thead>
          <ListStagger as="tbody" className="divide-y divide-border">
            {galleries.map((gallery, index) => (
              <tr key={gallery.id} {...staggerItem(index)} className="transition-colors duration-150 hover:bg-surface-subtle">
                <td className="px-4 py-2.5">
                  <Cover gallery={gallery} className="h-10 w-14" />
                </td>
                <th scope="row" className="max-w-56 px-4 py-2.5 text-start font-medium">
                  <Link href={`/galleries/${gallery.id}`} className="block truncate rounded-md text-fg hover:text-brand">
                    {gallery.name}
                  </Link>
                </th>
                <td className="max-w-44 truncate px-4 py-2.5 text-fg-secondary">{gallery.clientName ?? t('noClient')}</td>
                <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-secondary">{formatDate(gallery.createdAt, locale)}</td>
                <td className="tabular px-4 py-2.5 text-end text-fg-secondary">{format.number(gallery.views)}</td>
                <td className="tabular px-4 py-2.5 text-end text-fg-secondary">{format.number(gallery.downloads)}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge kind={galleryBadge(gallery)} />
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Expiry gallery={gallery} now={now} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    {gallery.state === 'active' ? <CopyLinkButton galleryId={gallery.id} name={gallery.name} /> : null}
                    <ButtonLink href={`/galleries/${gallery.id}`} variant="secondary" size="sm" aria-label={t('viewGallery', { name: gallery.name })}>
                      {t('view')}
                    </ButtonLink>
                  </div>
                </td>
              </tr>
            ))}
          </ListStagger>
        </table>
      </div>

      <ListStagger className="divide-y divide-border md:hidden" aria-label={caption}>
        {galleries.map((gallery, index) => {
          const left = daysLeft(gallery, now);
          return (
            <li key={gallery.id} {...staggerItem(index)} className="relative flex items-start gap-3 px-4 py-3">
              <Cover gallery={gallery} className="h-12 w-16" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/galleries/${gallery.id}`}
                    className="min-w-0 truncate rounded-md text-sm font-medium text-fg after:absolute after:inset-0 after:content-['']"
                  >
                    {gallery.name}
                  </Link>
                  <StatusBadge kind={galleryBadge(gallery)} className="shrink-0" />
                </div>
                <p className="truncate text-xs text-fg-muted">
                  {gallery.clientName ?? t('noClient')} · {formatDate(gallery.createdAt, locale)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-secondary">
                  <span className="tabular">{t('views', { count: gallery.views })}</span>
                  <span className="tabular">{t('downloads', { count: gallery.downloads })}</span>
                  {left !== null ? <span>{t('daysLeft', { days: left })}</span> : null}
                  {gallery.state === 'active' ? <CopyLinkButton galleryId={gallery.id} name={gallery.name} className="relative z-10 ms-auto" /> : null}
                  {gallery.state !== 'active' ? (
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="ms-auto text-fg-muted rtl:-scale-x-100" />
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ListStagger>
    </>
  );
}
