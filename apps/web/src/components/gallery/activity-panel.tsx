'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { formatBytes } from '@/lib/format';
import { useGalleryActivity } from '@/lib/queries';

/** PRD P-12: opens, password attempts and download receipts. Proof for disputes. */
export function ActivityPanel({ galleryId }: { galleryId: string }) {
  const t = useTranslations('App.activity');
  const locale = useLocale();
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const activity = useGalleryActivity(galleryId, open);

  const rows = [
    ...(activity.data?.accesses ?? []).map((a) => ({ at: a.at, what: t(`events.${a.type}`), detail: '', country: a.country, device: a.deviceType })),
    ...(activity.data?.receipts ?? []).map((r) => ({
      at: r.at,
      what: t('events.download', { file: r.fileName }),
      detail: formatBytes(r.bytes, locale),
      country: r.country,
      device: r.deviceType,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <section className="rounded-lg bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-6 py-5 text-start text-lg font-semibold text-primary-900"
      >
        {t('title')}
        <span aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open ? (
        <div className="overflow-x-auto px-6 pb-6">
          {activity.isLoading ? (
            <div className="h-20 animate-pulse rounded bg-neutral-100" />
          ) : rows.length === 0 ? (
            <p className="text-ink-muted">{t('empty')}</p>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-primary-50 text-start text-primary-900">
                  <th className="px-3 py-2 text-start font-semibold">{t('when')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('what')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('size')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('country')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('device')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.at}-${index}`} className="border-b border-[#e7e7e7]">
                    <td className="px-3 py-2 whitespace-nowrap">{format.dateTime(new Date(row.at), { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="px-3 py-2">{row.what}</td>
                    <td className="px-3 py-2" dir="ltr">{row.detail}</td>
                    <td className="px-3 py-2">{row.country ?? '—'}</td>
                    <td className="px-3 py-2">{row.device ? t(`devices.${row.device}`) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </section>
  );
}
