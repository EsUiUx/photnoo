'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { type ClientContent, type ClientFile, daysLeft, whatsappLink } from '@/lib/client-api';
import { downloadFile } from '@/lib/client-downloads';
import { formatBytes, formatDate, percent } from '@/lib/format';
import { PhotographerMark, WhatsAppButton } from './client-shell';
import { DownloadAllDialog } from './download-all-dialog';
import { Viewer } from './viewer';

export type Notice = { kind: 'cap'; remainingBytes: string } | { kind: 'error' } | null;

type Tab = 'all' | 'root' | string;

/** C-04 header, C-05 grid with folder tabs, C-07 single downloads, C-09 cap messages. */
export function GalleryView({ token, content, onGone }: { token: string; content: ClientContent; onGone: () => void }) {
  const t = useTranslations('Client.gallery');
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('all');
  const [viewing, setViewing] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(content.allowance.remainingBytes);
  const [notice, setNotice] = useState<Notice>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const cover = content.files.find((f) => f.id === content.coverFileId) ?? content.files.find((f) => f.previewUrl);
  const days = daysLeft(content.expiresAt);
  const hasRoot = content.files.some((f) => !f.folderId);
  const tabs = useMemo(() => {
    const count = (id: string | null) => content.files.filter((f) => f.folderId === id).length;
    const groups = [
      ...content.folders.map((f) => ({ id: f.id, name: f.name, count: count(f.id) })).filter((f) => f.count > 0),
      ...(hasRoot ? [{ id: 'root', name: t('otherTab'), count: count(null) }] : []),
    ];
    // Tabs only help when the photos are split into two or more groups.
    return groups.length < 2 ? [] : [{ id: 'all', name: t('allTab'), count: content.files.length }, ...groups];
  }, [content.files, content.folders, hasRoot, t]);
  const files = useMemo(
    () => (tab === 'all' ? content.files : content.files.filter((f) => (tab === 'root' ? !f.folderId : f.folderId === tab))),
    [content.files, tab],
  );

  const capBytes = Number(content.allowance.capBytes);
  const remainingPercent = percent(remaining, capBytes);
  const used = Number(remaining) <= 0;
  const message = whatsappLink(content.photographer.whatsapp, t('whatsappText', { gallery: content.name }));

  function markDone(file: ClientFile, remainingBytes: string) {
    setRemaining(remainingBytes);
    setDownloaded((current) => new Set(current).add(file.id));
    if (Number(remainingBytes) <= 0) setNotice({ kind: 'cap', remainingBytes: '0' });
  }

  function onError(error: unknown) {
    const code = error instanceof ApiError ? error.code : 'error';
    if (code === 'cap_reached') {
      const left = error instanceof ApiError && typeof error.details.remainingBytes === 'string' ? error.details.remainingBytes : remaining;
      setRemaining(left);
      setNotice({ kind: 'cap', remainingBytes: left });
    } else if (code === 'gallery_closed' || code === 'temporarily_unavailable' || code === 'password_required') {
      onGone();
    } else {
      setNotice({ kind: 'error' });
    }
  }

  async function downloadOne(file: ClientFile) {
    if (busy) return;
    setBusy(file.id);
    setNotice(null);
    try {
      const grant = await downloadFile(token, file);
      markDone(file, grant.remainingBytes);
    } catch (error) {
      onError(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-8">
      <header className="mt-4 overflow-hidden rounded-[24px] bg-primary-900 text-white">
        <div className="relative">
          {cover?.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img
              src={cover.previewUrl}
              alt=""
              fetchPriority="high"
              className="h-[46vh] max-h-[520px] min-h-[260px] w-full object-cover"
              style={cover.blurDataUrl ? { backgroundImage: `url(${cover.blurDataUrl})`, backgroundSize: 'cover' } : undefined}
            />
          ) : (
            <div className="h-[200px] w-full bg-primary-500" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900 via-primary-900/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <div className="flex items-center gap-3">
              <PhotographerMark name={content.photographer.name} />
              <p className="font-medium text-primary-100">{content.photographer.name}</p>
            </div>
            <h1 className="mt-3 text-3xl leading-tight font-bold sm:text-5xl">{content.name}</h1>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-8 sm:pt-2">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-primary-100">
              <span>{t('photos', { count: content.files.length })}</span>
              {days !== null ? (
                <span>
                  {t('daysLeft', { days })} · {t('until', { date: formatDate(content.expiresAt, locale) })}
                </span>
              ) : null}
            </div>
            <div className="mt-4 max-w-[520px]">
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-medium">{t('allowance')}</span>
                <span className="text-primary-100">
                  {t('allowanceLeft', { left: formatBytes(remaining, locale), total: formatBytes(capBytes, locale) })}
                </span>
              </div>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-label={t('allowance')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={remainingPercent}
              >
                <div className="h-full rounded-full bg-primary-200 transition-[width]" style={{ width: `${remainingPercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-primary-100/80">{t('allowanceHelp')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <button
              type="button"
              onClick={() => setBatchOpen(true)}
              disabled={used || files.length === 0}
              className="h-12 rounded-full bg-white px-8 text-lg font-semibold text-primary-900 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tab === 'all' ? t('downloadAll') : t('downloadFolder')}
            </button>
          </div>
        </div>
      </header>

      {notice ? <NoticeBar notice={notice} message={message} onClose={() => setNotice(null)} /> : null}

      {tabs.length > 0 ? (
        <nav className="-mx-4 mt-6 overflow-x-auto px-4" aria-label={t('folders')}>
          <ul className="flex w-max gap-2">
            {tabs.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? 'true' : undefined}
                  className={`h-10 rounded-full border px-5 text-sm font-semibold whitespace-nowrap ${
                    tab === item.id ? 'border-primary-400 bg-primary-400 text-white' : 'border-field-border bg-white text-ink-body hover:border-primary-300'
                  }`}
                >
                  {item.name} <span className="opacity-70">{item.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {files.length === 0 ? (
        <p className="py-20 text-center text-ink-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-6 columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
          {files.map((file, index) => (
            <li key={file.id} className="mb-3 break-inside-avoid sm:mb-4">
              <Tile file={file} done={downloaded.has(file.id)} onOpen={() => setViewing(index)} />
            </li>
          ))}
        </ul>
      )}

      {viewing !== null ? (
        <Viewer
          files={files}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onDownload={(file) => void downloadOne(file)}
          busy={busy}
          downloaded={downloaded}
          disabled={used}
          message={notice ? noticeText(notice, t, locale) : undefined}
        />
      ) : null}

      <DownloadAllDialog
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        token={token}
        files={files}
        remainingBytes={remaining}
        onFileDone={markDone}
        onStopped={(reason, left) => {
          if (left) setRemaining(left);
          if (reason === 'cap_reached') setNotice({ kind: 'cap', remainingBytes: left ?? remaining });
          if (reason === 'gallery_closed') onGone();
        }}
        message={message}
      />
    </div>
  );
}

function Tile({ file, done, onOpen }: { file: ClientFile; done: boolean; onOpen: () => void }) {
  const t = useTranslations('Client.gallery');
  const locale = useLocale();
  const ratio = file.width && file.height ? `${file.width} / ${file.height}` : '1 / 1';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-xl bg-primary-100 text-start focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
      aria-label={t('open', { name: file.name })}
    >
      {file.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img
          src={file.previewUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="block w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          style={{
            aspectRatio: ratio,
            ...(file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})`, backgroundSize: 'cover' } : {}),
          }}
        />
      ) : (
        <span className="flex aspect-square flex-col items-center justify-center gap-2 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma placeholder */}
          <img src="/app/media-placeholder.svg" alt="" className="size-16" />
          <span className="line-clamp-2 text-sm font-medium break-all text-primary-400">{file.name}</span>
          <span className="text-xs text-ink-muted" dir="ltr">
            {formatBytes(file.sizeBytes, locale)}
          </span>
        </span>
      )}
      {done ? (
        <span className="absolute end-2 top-2 rounded-full bg-primary-400 px-2 py-0.5 text-xs font-semibold text-white">{t('saved')}</span>
      ) : null}
    </button>
  );
}

function noticeText(notice: NonNullable<Notice>, t: ReturnType<typeof useTranslations<'Client.gallery'>>, locale: string) {
  if (notice.kind !== 'cap') return t('downloadFailed');
  return Number(notice.remainingBytes) > 0 ? t('capPartial', { left: formatBytes(notice.remainingBytes, locale) }) : t('capUsed');
}

function NoticeBar({ notice, message, onClose }: { notice: NonNullable<Notice>; message: string | null; onClose: () => void }) {
  const t = useTranslations('Client.gallery');
  const locale = useLocale();
  return (
    <div role="alert" className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#f5c77e] bg-[#fff8eb] p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-ink-body">{noticeText(notice, t, locale)}</p>
      <div className="flex items-center gap-3">
        {notice.kind === 'cap' && message ? (
          <WhatsAppButton href={message} tone="outline">
            {t('messagePhotographer')}
          </WhatsAppButton>
        ) : null}
        <button type="button" onClick={onClose} className="text-sm font-semibold text-ink-muted underline">
          {t('dismiss')}
        </button>
      </div>
    </div>
  );
}
