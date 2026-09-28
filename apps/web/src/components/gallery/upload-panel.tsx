'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useUploader } from '@/components/app/providers';
import { formatBytes, formatDuration, percent } from '@/lib/format';
import type { UploadSnapshot } from '@/lib/uploader';

/**
 * Upload progress for one gallery (PRD P-06, spec 19 "Client Galleries" left side):
 * overall bar, speed, time left, files remaining, and per-file retry.
 */
export function UploadPanel({ galleryId }: { galleryId: string }) {
  const t = useTranslations('App.upload');
  const locale = useLocale();
  const uploader = useUploader();
  const [snapshot, setSnapshot] = useState<UploadSnapshot | null>(null);

  useEffect(() => uploader.subscribe(setSnapshot), [uploader]);

  const items = (snapshot?.items ?? []).filter((item) => item.galleryId === galleryId && item.status !== 'cancelled');
  if (items.length === 0) return null;

  const total = items.reduce((a, i) => a + i.size, 0);
  const uploaded = items.reduce((a, i) => a + i.uploadedBytes, 0);
  const remaining = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length;
  const failed = items.filter((i) => i.status === 'error');
  const active = remaining > 0;

  return (
    <section className="rounded-lg border border-primary-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold text-primary-900">
          {active ? t('uploading', { count: remaining }) : failed.length > 0 ? t('someFailed', { count: failed.length }) : t('done')}
        </p>
        <p className="text-sm text-ink-muted" dir="ltr">
          {formatBytes(uploaded, locale)} / {formatBytes(total, locale)}
          {active && snapshot && snapshot.bytesPerSecond > 0 ? ` · ${formatBytes(snapshot.bytesPerSecond, locale)}/s` : ''}
        </p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(uploaded, total)}>
        <div className="h-full rounded-full bg-primary-300 transition-[width] duration-300" style={{ width: `${percent(uploaded, total)}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm text-ink-muted">
        <span>{active && snapshot?.secondsLeft ? t('timeLeft', { time: formatDuration(snapshot.secondsLeft, locale) }) : ' '}</span>
        <span>{t('resumeNote')}</span>
      </div>

      {failed.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {failed.map((item) => (
            <li key={item.key} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="text-danger">{t(`errors.${errorKey(item.error?.code)}`)}</span>
              {errorKey(item.error?.code) === 'generic' ? (
                <button type="button" onClick={() => uploader.retry(item.key)} className="font-semibold text-primary-400 underline">
                  {t('retry')}
                </button>
              ) : null}
              <button type="button" onClick={() => uploader.cancel(item.key)} className="text-ink-muted underline">
                {t('dismiss')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!active ? (
        <button type="button" onClick={() => uploader.clearFinished()} className="mt-3 text-sm font-semibold text-primary-400 underline">
          {t('clear')}
        </button>
      ) : null}
    </section>
  );
}

function errorKey(code: string | undefined): string {
  switch (code) {
    case 'allowance_exceeded':
    case 'subscription_inactive':
    case 'unsupported_type':
    case 'file_too_large':
    case 'gallery_closed':
      return code;
    default:
      return 'generic';
  }
}
