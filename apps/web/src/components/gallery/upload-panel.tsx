'use client';

import { CircleAlert, CloudUpload, RotateCw, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { EasedMeter } from '@/components/app/app-motion';
import { useUploader } from '@/components/app/providers';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { formatBytes, formatDuration, percent } from '@/lib/format';
import type { UploadSnapshot } from '@/lib/uploader';

const ACCEPT = '.jpg,.jpeg,.png,.tif,.tiff,.psd,.zip,.cr2,.cr3,.nef,.arw,.raf,.dng,.orf,.rw2';

/** Always-available drop target; the whole page also accepts drops, this is where they land visually. */
export function DropZone({
  dragging,
  compact,
  folderName,
  onFiles,
}: {
  dragging: boolean;
  compact: boolean;
  folderName?: string;
  onFiles: (files: FileList | null) => void;
}) {
  const t = useTranslations('App.gallery');
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        'flex rounded-lg border-2 border-dashed transition-colors duration-150',
        dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-subtle',
        compact ? 'flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center' : 'flex-col items-center px-6 py-10 text-center',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-surface text-brand shadow-xs',
          compact ? 'size-10' : 'mb-4 size-12',
        )}
      >
        <CloudUpload size={compact ? 20 : 22} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium text-fg', compact ? 'text-sm' : 'text-base')}>
          {dragging ? (
            t('dropRelease')
          ) : (
            <>
              {t('dropTitle')}{' '}
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="rounded-md font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
              >
                {t('browse')}
              </button>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-fg-muted">
          {folderName ? `${t('dropTarget', { folder: folderName })} · ` : ''}
          {t('dropHint')}
        </p>
      </div>
      {compact ? (
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()}>
          {t('upload')}
        </Button>
      ) : null}
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        onChange={(event) => {
          onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </div>
  );
}

const KNOWN = ['allowance_exceeded', 'subscription_inactive', 'unsupported_type', 'file_too_large', 'gallery_closed'];

function errorKey(code: string | undefined): string {
  return code && KNOWN.includes(code) ? code : 'generic';
}

/** Only unknown (network, server) failures can succeed on a retry; the known ones will not. */
function retryable(code: string | undefined) {
  return errorKey(code) === 'generic';
}

/**
 * Upload progress for one gallery (PRD P-06): overall meter, speed, time left and per-file
 * errors. The visible numbers tick freely; the live region only speaks when the status changes.
 */
export function UploadPanel({ galleryId }: { galleryId: string }) {
  const t = useTranslations('App.upload');
  const locale = useLocale();
  const uploader = useUploader();
  const [snapshot, setSnapshot] = useState<UploadSnapshot | null>(null);

  useEffect(() => uploader.subscribe(setSnapshot), [uploader]);

  const items = (snapshot?.items ?? []).filter((item) => item.galleryId === galleryId && item.status !== 'cancelled');
  const total = items.reduce((a, i) => a + i.size, 0);
  const uploaded = items.reduce((a, i) => a + i.uploadedBytes, 0);
  const remaining = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length;
  const failed = items.filter((i) => i.status === 'error');
  const active = remaining > 0;

  const status =
    items.length === 0
      ? ''
      : active
        ? t('uploading', { count: remaining })
        : failed.length > 0
          ? t('someFailed', { count: failed.length })
          : t('done');

  return (
    <>
      {/* Always mounted so screen readers hear "Upload finished" even as the panel changes. */}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
      <AnimatePresence initial={false}>
        {items.length > 0 ? (
          <m.div key="uploads" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
            <Card className="p-5" as="section">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
                  {!active && failed.length > 0 ? (
                    <CircleAlert size={18} strokeWidth={1.75} aria-hidden className="text-danger" />
                  ) : null}
                  {status}
                </h2>
                <p className="tabular text-sm text-fg-muted">
                  {t('bytes', { uploaded: formatBytes(uploaded, locale), total: formatBytes(total, locale) })}
                </p>
              </div>
              <EasedMeter className="mt-3" value={percent(uploaded, total)} label={t('progressLabel')} tone={!active && failed.length > 0 ? 'danger' : 'brand'} />
              <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-fg-muted">
                <span className="tabular">
                  {active && snapshot && snapshot.bytesPerSecond > 0 ? t('speed', { speed: formatBytes(snapshot.bytesPerSecond, locale) }) : null}
                  {active && snapshot?.secondsLeft ? ` · ${t('timeLeft', { time: formatDuration(snapshot.secondsLeft, locale) })}` : null}
                </span>
                <span>{t('resumeNote')}</span>
              </div>

              {failed.length > 0 ? (
                <ul className="mt-4 divide-y divide-border border-t border-border">
                  <AnimatePresence initial={false}>
                    {failed.map((item) => {
                      const key = errorKey(item.error?.code);
                      return (
                        <m.li
                          key={item.key}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-center gap-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">{item.name}</p>
                            <p className="text-xs text-danger">{t(`errors.${key}`)}</p>
                          </div>
                          {retryable(item.error?.code) ? (
                            <Button variant="secondary" size="sm" icon={RotateCw} onClick={() => uploader.retry(item.key)} aria-label={t('retryFile', { name: item.name })}>
                              {t('retry')}
                            </Button>
                          ) : null}
                          <IconButton icon={X} size="sm" label={t('dismissFile', { name: item.name })} onClick={() => uploader.cancel(item.key)} />
                        </m.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              ) : null}
              {!active ? (
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => uploader.clearFinished()}>
                    {t('clear')}
                  </Button>
                </div>
              ) : null}
            </Card>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
