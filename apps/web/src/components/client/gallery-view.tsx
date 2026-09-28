'use client';

import { AlertTriangle, Clock, Download, FileImage, Images, Info } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Meter } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { type ClientContent, type ClientFile, daysLeft, whatsappLink } from '@/lib/client-api';
import { downloadFile } from '@/lib/client-downloads';
import { cn } from '@/lib/cn';
import { formatBytes, formatDate, percent } from '@/lib/format';
import { PhotographerMark, WhatsAppButton } from './client-shell';
import { DownloadAllDialog } from './download-all-dialog';
import { Viewer } from './viewer';

export type Notice = { kind: 'cap'; remainingBytes: string } | { kind: 'error' } | null;

type Tab = 'all' | 'root' | string;

/** C-04 cover and header, C-05 grid with folder filter, C-07 single downloads, C-09 cap messages. */
export function GalleryView({ token, content, onGone }: { token: string; content: ClientContent; onGone: () => void }) {
  const t = useTranslations('Client.gallery');
  const locale = useLocale();
  const format = useFormatter();
  const [tab, setTab] = useState<Tab>('all');
  const [viewing, setViewing] = useState<number | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(content.allowance.remainingBytes);
  const [notice, setNotice] = useState<Notice>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());

  const cover = content.files.find((f) => f.id === content.coverFileId) ?? content.files.find((f) => f.previewUrl);
  const days = daysLeft(content.expiresAt);
  const hasRoot = content.files.some((f) => !f.folderId);
  const tabs = useMemo(() => {
    const count = (id: string | null) => content.files.filter((f) => f.folderId === id).length;
    const groups = [
      ...content.folders.map((f) => ({ id: f.id, name: f.name, count: count(f.id) })).filter((f) => f.count > 0),
      ...(hasRoot ? [{ id: 'root', name: t('otherTab'), count: count(null) }] : []),
    ];
    // A filter only helps when the photos are split into two or more groups.
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
  const activeTab = tabs.find((item) => item.id === tab);
  const blocked = used ? t('reasonUsed') : files.length === 0 ? t('reasonEmpty') : null;
  const reasonId = 'download-all-reason';
  const meterTone = used ? 'danger' : remainingPercent <= 15 ? 'warning' : 'brand';

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

  function closeViewer() {
    const id = viewing !== null ? files[viewing]?.id : undefined;
    setViewing(null);
    // Back to the tile of the photo the client was last looking at, not the one they opened.
    if (id) requestAnimationFrame(() => tileRefs.current.get(id)?.focus());
  }

  return (
    <div className="w-full">
      <header
        data-surface="dark"
        className={cn(
          'relative isolate flex flex-col justify-end overflow-hidden text-white',
          cover?.previewUrl ? 'h-[64svh] max-h-[760px] min-h-[380px] bg-fg' : 'min-h-80 bg-brand',
        )}
      >
        {cover?.previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img
              src={cover.previewUrl}
              alt=""
              fetchPriority="high"
              className="absolute inset-0 -z-10 size-full object-cover"
              style={cover.blurDataUrl ? { backgroundImage: `url(${cover.blurDataUrl})`, backgroundSize: 'cover' } : undefined}
            />
            {/* Two washes: one keeps the language toggle legible, the other carries the title. */}
            <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-black/45 to-transparent" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-3/4 bg-linear-to-t from-black/85 via-black/45 to-transparent" />
          </>
        ) : null}
        <div className="mx-auto w-full max-w-screen-2xl px-4 pt-24 pb-8 sm:px-6 sm:pb-12 lg:px-8">
          <div className="flex items-center gap-3">
            <PhotographerMark name={content.photographer.name} size="sm" className="ring-2 ring-white/70" />
            <p className="text-sm font-medium text-white/90">{content.photographer.name}</p>
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{content.name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
            <span>{t('photos', { count: content.files.length })}</span>
            {days !== null ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={16} strokeWidth={1.75} aria-hidden />
                  {t('daysLeft', { days })} {t('until', { date: formatDate(content.expiresAt, locale) })}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:gap-6 lg:px-8">
          {tabs.length > 0 ? (
            <div
              role="group"
              aria-label={t('folders')}
              className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-1 lg:px-0"
            >
              <div className="flex w-max gap-1.5">
                {tabs.map((item) => {
                  const pressed = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      aria-pressed={pressed}
                      className={cn(
                        'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 pointer-coarse:h-11',
                        pressed ? 'bg-brand text-brand-fg' : 'bg-surface-sunken text-fg-secondary hover:bg-brand-soft hover:text-fg',
                      )}
                    >
                      {item.name}
                      <span className={cn('tabular text-xs', pressed ? 'text-brand-fg/80' : 'text-fg-muted')}>{format.number(item.count)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-4 lg:ms-auto">
            <div className="min-w-0 flex-1 lg:w-64 lg:flex-none">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs">
                <span className="font-medium text-fg">{t('allowance')}</span>
                <span className="tabular text-fg-muted">
                  {t('allowanceLeft', { left: formatBytes(remaining, locale), total: formatBytes(capBytes, locale) })}
                </span>
              </div>
              <Meter value={remainingPercent} label={t('allowance')} tone={meterTone} size="sm" className="mt-1.5" />
            </div>
            <Button icon={Download} onClick={() => setBatchOpen(true)} disabled={Boolean(blocked)} aria-describedby={blocked ? reasonId : undefined}>
              {tab === 'all' ? t('downloadAll') : t('downloadFolder')}
            </Button>
          </div>
        </div>
        {blocked ? (
          <p id={reasonId} className="mx-auto flex max-w-screen-2xl items-center gap-1.5 px-4 pb-3 text-xs font-medium text-fg-secondary sm:px-6 lg:justify-end lg:px-8">
            <Info size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            {blocked}
          </p>
        ) : null}
      </div>

      {notice ? (
        <div className="mx-auto max-w-screen-2xl px-4 pt-4 sm:px-6 lg:px-8">
          <NoticeBar notice={notice} message={message} onClose={() => setNotice(null)} />
        </div>
      ) : null}

      <section aria-labelledby="photos-heading" className="mx-auto max-w-screen-2xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="photos-heading" className="text-lg font-semibold text-fg">
            {activeTab && tab !== 'all' ? activeTab.name : t('photosHeading')}
          </h2>
          <p className="text-xs text-fg-muted">{t('allowanceHelp')}</p>
        </div>

        {files.length === 0 ? (
          <EmptyState icon={Images} title={t('empty')} />
        ) : (
          <ul className="mt-4 columns-2 gap-2 sm:columns-3 sm:gap-3 lg:columns-4 2xl:columns-5">
            {files.map((file, index) => (
              <li key={file.id} className="mb-2 break-inside-avoid sm:mb-3">
                <Tile
                  ref={(el) => {
                    if (el) tileRefs.current.set(file.id, el);
                    else tileRefs.current.delete(file.id);
                  }}
                  file={file}
                  done={downloaded.has(file.id)}
                  onOpen={() => setViewing(index)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewing !== null ? (
        <Viewer
          files={files}
          index={viewing}
          onIndex={setViewing}
          onClose={closeViewer}
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

function Tile({ file, done, onOpen, ref }: { file: ClientFile; done: boolean; onOpen: () => void; ref: React.Ref<HTMLButtonElement> }) {
  const t = useTranslations('Client.gallery');
  const locale = useLocale();
  const ratio = file.width && file.height ? `${file.width} / ${file.height}` : '1 / 1';
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-md bg-surface-sunken text-start focus-visible:outline-offset-3"
      aria-label={done ? `${t('open', { name: file.name })}, ${t('saved')}` : t('open', { name: file.name })}
    >
      {file.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img
          src={file.previewUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="block w-full object-cover"
          style={{
            aspectRatio: ratio,
            ...(file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})`, backgroundSize: 'cover' } : {}),
          }}
        />
      ) : (
        <span className="flex aspect-square flex-col items-center justify-center gap-2 p-4 text-center">
          <FileImage size={22} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
          <span className="line-clamp-2 text-sm font-medium break-all text-fg-secondary">{file.name}</span>
          <span className="tabular text-xs text-fg-muted" dir="ltr">
            {formatBytes(file.sizeBytes, locale)}
          </span>
        </span>
      )}
      <span aria-hidden className="absolute inset-0 bg-black/0 transition-colors duration-150 group-hover:bg-black/10" />
      {done ? (
        <Badge tone="success" dot className="absolute end-2 top-2 shadow-xs">
          {t('saved')}
        </Badge>
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
  const cap = notice.kind === 'cap';
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center',
        cap ? 'border-warning/25 bg-warning-soft' : 'border-danger/25 bg-danger-soft',
      )}
    >
      <p className={cn('flex flex-1 items-start gap-2 text-sm font-medium', cap ? 'text-warning' : 'text-danger')}>
        <AlertTriangle size={18} strokeWidth={1.75} aria-hidden className="mt-px shrink-0" />
        {noticeText(notice, t, locale)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {cap && message ? (
          <WhatsAppButton href={message} size="sm">
            {t('messagePhotographer')}
          </WhatsAppButton>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('dismiss')}
        </Button>
      </div>
    </div>
  );
}
