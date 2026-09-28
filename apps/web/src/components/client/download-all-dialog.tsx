'use client';

import { Download, FolderDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Meter } from '@/components/ui/primitives';
import { Alert } from '@/components/ui/state';
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
 * While it runs the dialog cannot be dismissed (Escape, backdrop): the client stops it first,
 * so React state and the native dialog never fall out of sync.
 */
export function DownloadAllDialog(props: Props) {
  const t = useTranslations('Client.downloadAll');
  const [running, setRunning] = useState(false);
  return (
    <Dialog open={props.open} onClose={props.onClose} title={t('title')} dismissible={!running}>
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

  // If the gallery closes underneath us, stop the queue instead of downloading into nowhere.
  useEffect(
    () => () => {
      abort.current?.abort();
      onRunning(false);
    },
    [onRunning],
  );

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
      <div className="flex flex-col gap-4">
        <p className="text-base text-fg">
          {t('summary', { count: files.length, size: formatBytes(totalBytes, locale) })}
        </p>
        {!fits ? <Alert tone="warning">{t('overCap', { left: formatBytes(remainingBytes, locale) })}</Alert> : null}
        <p className="text-sm text-fg-muted">{folderSupported ? t('folderHint') : t('browserHint')}</p>
        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t('dismiss')}
          </Button>
          {folderSupported ? (
            <>
              <Button variant="secondary" icon={Download} onClick={() => void start(false)}>
                {t('toDownloads')}
              </Button>
              <Button icon={FolderDown} onClick={() => void start(true)} autoFocus>
                {t('chooseFolder')}
              </Button>
            </>
          ) : (
            <Button icon={Download} onClick={() => void start(false)} autoFocus>
              {t('start')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const stopped = progress.stoppedBy;
  const value = percent(progress.bytesDone, progress.bytesTotal);
  const headline = finished
    ? stopped === 'cap_reached'
      ? t('stoppedCap', { done: progress.done, total: progress.total })
      : stopped === 'cancelled'
        ? t('stoppedCancelled', { done: progress.done, total: progress.total })
        : stopped
          ? t('stoppedError', { done: progress.done, total: progress.total })
          : t('finished', { count: progress.done })
    : t('progress', { done: progress.done, total: progress.total });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base font-semibold text-fg" aria-live="polite">
        {headline}
      </p>
      <Meter value={value} label={t('progressLabel')} tone={finished && stopped && stopped !== 'cancelled' ? 'warning' : 'brand'} />
      <p className="flex justify-between gap-3 text-sm text-fg-muted">
        <span className="min-w-0 truncate" dir="ltr">
          {finished ? ' ' : (progress.current ?? ' ')}
        </span>
        <span className="tabular shrink-0" dir="ltr">
          {formatBytes(progress.bytesDone, locale)} / {formatBytes(progress.bytesTotal, locale)}
        </span>
      </p>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {finished && stopped === 'cap_reached' && message ? (
          <WhatsAppButton href={message}>{t('messagePhotographer')}</WhatsAppButton>
        ) : null}
        {finished ? (
          <Button onClick={onClose} autoFocus>
            {t('close')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => abort.current?.abort()} autoFocus>
            {t('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
