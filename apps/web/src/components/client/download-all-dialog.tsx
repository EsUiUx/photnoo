'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Dialog, PillButton } from '@/components/app/dialog';
import type { ClientFile } from '@/lib/client-api';
import { type BatchProgress, canPickFolder, downloadAll, pickFolder } from '@/lib/client-downloads';
import { formatBytes, percent } from '@/lib/format';
import { WhatsAppButton } from './client-shell';

type Props = {
  open: boolean;
  onClose: () => void;
  token: string;
  files: ClientFile[];
  remainingBytes: string;
  onFileDone: (file: ClientFile, remainingBytes: string) => void;
  onStopped: (reason: BatchProgress['stoppedBy'], remainingBytes?: string) => void;
  message: string | null;
};

/**
 * C-08: downloads the files one after another with progress. On desktop Chrome and Edge the
 * client can pick a folder so the photos land together; elsewhere they go to Downloads.
 */
export function DownloadAllDialog(props: Props) {
  const t = useTranslations('Client.downloadAll');
  const [running, setRunning] = useState(false);
  // Closing while running would hide progress; the client cancels first.
  return (
    <Dialog open={props.open} onClose={() => !running && props.onClose()} title={t('title')} width="max-w-[560px]">
      <DownloadAllBody {...props} onRunning={setRunning} />
    </Dialog>
  );
}

function DownloadAllBody({
  onClose,
  token,
  files,
  remainingBytes,
  onFileDone,
  onStopped,
  message,
  onRunning,
}: Props & { onRunning: (running: boolean) => void }) {
  const t = useTranslations('Client.downloadAll');
  const locale = useLocale();
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [finished, setFinished] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const totalBytes = files.reduce((sum, f) => sum + Number(f.sizeBytes), 0);
  const fits = totalBytes <= Number(remainingBytes);
  const folderSupported = canPickFolder();

  async function start(useFolder: boolean) {
    const folder = useFolder ? await pickFolder() : null;
    if (useFolder && !folder) return;
    abort.current = new AbortController();
    onRunning(true);
    setFinished(false);
    let lastDone = 0;
    const result = await downloadAll(token, files, {
      folder,
      signal: abort.current.signal,
      onProgress: (next) => {
        // Report each finished file once, with the allowance the API returned for it.
        while (lastDone < next.done) {
          onFileDone(files[lastDone]!, next.remainingBytes ?? remainingBytes);
          lastDone += 1;
        }
        setProgress(next);
      },
    });
    onRunning(false);
    setFinished(true);
    if (result.stoppedBy) onStopped(result.stoppedBy, result.remainingBytes);
  }

  if (!progress) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-lg text-ink-body">
          {t('summary', { count: files.length, size: formatBytes(totalBytes, locale) })}
        </p>
        {!fits ? (
          <p className="rounded-xl border border-[#f5c77e] bg-[#fff8eb] p-3 text-ink-body">
            {t('overCap', { left: formatBytes(remainingBytes, locale) })}
          </p>
        ) : null}
        <p className="text-sm text-ink-muted">{folderSupported ? t('folderHint') : t('browserHint')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {folderSupported ? (
            <>
              <PillButton onClick={() => void start(true)}>{t('chooseFolder')}</PillButton>
              <PillButton tone="ghost" onClick={() => void start(false)}>
                {t('toDownloads')}
              </PillButton>
            </>
          ) : (
            <PillButton onClick={() => void start(false)}>{t('start')}</PillButton>
          )}
        </div>
      </div>
    );
  }

  const stopped = progress.stoppedBy;
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <p className="text-lg font-semibold text-primary-900">
        {finished
          ? stopped === 'cap_reached'
            ? t('stoppedCap', { done: progress.done, total: progress.total })
            : stopped === 'cancelled'
              ? t('stoppedCancelled', { done: progress.done, total: progress.total })
              : stopped
                ? t('stoppedError', { done: progress.done, total: progress.total })
                : t('finished', { count: progress.done })
          : t('progress', { done: progress.done, total: progress.total })}
      </p>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-primary-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent(progress.bytesDone, progress.bytesTotal)}
      >
        <div className="h-full rounded-full bg-primary-300 transition-[width]" style={{ width: `${percent(progress.bytesDone, progress.bytesTotal)}%` }} />
      </div>
      <p className="flex justify-between gap-3 text-sm text-ink-muted">
        <span className="min-w-0 truncate" dir="ltr">
          {progress.current ?? ' '}
        </span>
        <span dir="ltr">
          {formatBytes(progress.bytesDone, locale)} / {formatBytes(progress.bytesTotal, locale)}
        </span>
      </p>
      {finished && stopped === 'cap_reached' && message ? (
        <div className="flex justify-center">
          <WhatsAppButton href={message} tone="outline">
            {t('messagePhotographer')}
          </WhatsAppButton>
        </div>
      ) : null}
      <div className="flex justify-center">
        {finished ? (
          <PillButton onClick={onClose}>{t('close')}</PillButton>
        ) : (
          <PillButton tone="ghost" onClick={() => abort.current?.abort()}>
            {t('cancel')}
          </PillButton>
        )}
      </div>
    </div>
  );
}
