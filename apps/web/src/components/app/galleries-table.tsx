'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { fetchLink } from '@/lib/queries';
import type { GalleryListItem } from '@/lib/types';
import { galleryBadge, StatusBadge } from './status-badge';

/** Figma "All Galleries" / "Recent Galleries" table. Scrolls sideways on small screens. */
export function GalleriesTable({ items }: { items: GalleryListItem[] }) {
  const t = useTranslations('App.table');
  const locale = useLocale();
  const [copied, setCopied] = useState<string | null>(null);

  async function copyLink(id: string) {
    const { link } = await fetchLink(id);
    await navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] border-collapse text-xs text-black">
        <thead>
          <tr className="h-[61px] bg-primary-50 text-sm font-semibold text-primary-900">
            {['no', 'cover', 'name', 'client', 'created', 'views', 'downloads', 'status', 'expires', 'link', 'action'].map((key) => (
              <th key={key} scope="col" className="px-3 text-center font-semibold">
                {t(key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((gallery, index) => (
            <tr key={gallery.id} className="h-14 border-b border-[#e7e7e7] text-center">
              <td className="px-3">{String(index + 1).padStart(2, '0')}</td>
              <td className="px-3">
                <span className="mx-auto flex h-9 w-[74px] items-center justify-center overflow-hidden rounded-[9px] border border-primary-300 bg-primary-100">
                  {gallery.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                    <img src={gallery.coverUrl} alt="" className="h-[25px] w-[61px] rounded-[5px] object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- Figma icon
                    <img src="/app/media-placeholder.svg" alt="" className="size-5" />
                  )}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-3 font-medium">{gallery.name}</td>
              <td className="max-w-[160px] truncate px-3">{gallery.clientName}</td>
              <td className="px-3">{formatDate(gallery.createdAt, locale)}</td>
              <td className="px-3">{gallery.views}</td>
              <td className="px-3">{gallery.downloads}</td>
              <td className="px-3">
                <StatusBadge kind={galleryBadge(gallery)} />
              </td>
              <td className="px-3">{formatDate(gallery.expiresAt, locale)}</td>
              <td className="px-3">
                {gallery.state === 'active' ? (
                  <button
                    type="button"
                    onClick={() => void copyLink(gallery.id)}
                    className="mx-auto flex size-8 items-center justify-center rounded-md bg-neutral-100 hover:bg-primary-100"
                    aria-label={t('copyLink', { name: gallery.name })}
                    title={copied === gallery.id ? t('copied') : t('copyLinkShort')}
                  >
                    {copied === gallery.id ? (
                      <span className="text-sm text-primary-400">✓</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- Figma icon
                      <img src="/app/link-blue.svg" alt="" className="size-6" />
                    )}
                  </button>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="px-3">
                <Link
                  href={`/galleries/${gallery.id}`}
                  className="mx-auto flex h-9 w-[99px] items-center justify-center rounded-3xl bg-primary-300 text-xs font-semibold text-primary-50 hover:bg-primary-400"
                >
                  {t('view')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
