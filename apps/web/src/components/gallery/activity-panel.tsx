'use client';

import type { LucideIcon } from 'lucide-react';
import { Activity, Download, Eye, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { useGalleryActivity } from '@/lib/queries';
import type { GalleryActivity } from '@/lib/types';

type Entry = {
  key: string;
  kind: 'open' | 'password_ok' | 'password_fail' | 'download';
  at: string;
  device: string | null;
  country: string | null;
  files: Array<{ name: string; bytes: number }>;
};

const ICONS: Record<Entry['kind'], { icon: LucideIcon; className: string }> = {
  open: { icon: Eye, className: 'bg-info-soft text-info' },
  password_ok: { icon: ShieldCheck, className: 'bg-surface-sunken text-fg-secondary' },
  password_fail: { icon: ShieldAlert, className: 'bg-warning-soft text-warning' },
  download: { icon: Download, className: 'bg-brand-soft text-brand' },
};

// Downloads from the same device within this window read as one visit.
const SESSION_GAP = 15 * 60 * 1000;
const PAGE = 12;

/** Newest first; consecutive downloads from one device collapse into a single entry. */
function toEntries(data: GalleryActivity | undefined): Entry[] {
  if (!data) return [];
  const raw: Entry[] = [
    // "Password accepted" always pairs with "Gallery opened"; show the open only, and keep failed attempts.
    ...data.accesses.filter((a) => a.type !== 'password_ok').map((a, i) => ({ key: `a${i}-${a.at}`, kind: a.type, at: a.at, device: a.deviceType, country: a.country, files: [] })),
    ...data.receipts.map((r) => ({
      key: r.receiptId,
      kind: 'download' as const,
      at: r.at,
      device: r.deviceType,
      country: r.country,
      files: [{ name: r.fileName, bytes: Number(r.bytes) }],
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const entries: Entry[] = [];
  let previousAt = 0;
  for (const entry of raw) {
    const last = entries[entries.length - 1];
    const at = new Date(entry.at).getTime();
    if (
      last &&
      entry.kind === 'download' &&
      last.kind === 'download' &&
      last.device === entry.device &&
      last.country === entry.country &&
      previousAt - at < SESSION_GAP
    ) {
      last.files.push(...entry.files);
    } else {
      entries.push({ ...entry, files: [...entry.files] });
    }
    previousAt = at;
  }
  return entries;
}

/** PRD P-12: opens, password attempts and download receipts. Proof for disputes. */
export function ActivityPanel({ galleryId }: { galleryId: string }) {
  const t = useTranslations('App.activity');
  const activity = useGalleryActivity(galleryId, true);
  const [showAll, setShowAll] = useState(false);
  const entries = toEntries(activity.data);
  const visible = showAll ? entries : entries.slice(0, PAGE);

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-fg">{t('title')}</h2>
      <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>

      <div className="mt-5">
        {activity.isLoading ? (
          <div className="flex flex-col gap-4" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activity.isError ? (
          <ErrorState className="py-8" onRetry={() => void activity.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState className="px-2 py-8" icon={Activity} title={t('emptyTitle')} body={t('emptyBody')} />
        ) : (
          <>
            <ol className="flex flex-col">
              {visible.map((entry, i) => (
                <Row key={entry.key} entry={entry} last={i === visible.length - 1} />
              ))}
            </ol>
            {entries.length > PAGE ? (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t('showLess') : t('showAll', { count: entries.length })}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

function Row({ entry, last }: { entry: Entry; last: boolean }) {
  const t = useTranslations('App.activity');
  const locale = useLocale();
  const format = useFormatter();
  const { icon: Icon, className } = ICONS[entry.kind];
  const bytes = entry.files.reduce((a, f) => a + f.bytes, 0);
  const device = t(`devices.${entry.device && ['mobile', 'tablet', 'desktop'].includes(entry.device) ? entry.device : 'unknown'}`);
  const title =
    entry.kind === 'download'
      ? entry.files.length === 1
        ? t('events.downloadOne', { file: entry.files[0]!.name })
        : t('events.downloadMany', { count: entry.files.length })
      : t(`events.${entry.kind}`);

  return (
    <li className="relative flex gap-3 pb-5">
      {!last ? <span aria-hidden className="absolute start-4 top-9 bottom-1 w-px bg-border" /> : null}
      <span className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-full', className)}>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-medium break-words text-fg">{title}</p>
        <p className="tabular mt-0.5 text-xs text-fg-muted">
          <time dateTime={entry.at}>{format.dateTime(new Date(entry.at), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' })}</time>
          {' · '}
          {device}
          {entry.country ? ` · ${entry.country}` : ''}
          {entry.kind === 'download' ? ` · ${formatBytes(bytes, locale)}` : ''}
        </p>
        {entry.files.length > 1 ? (
          <details className="mt-1.5 text-xs">
            <summary className="inline-flex min-h-10 cursor-pointer items-center rounded-md font-medium text-brand">{t('showFiles')}</summary>
            <ul className="mt-1 flex flex-col gap-1 text-fg-secondary">
              {entry.files.map((file, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">{file.name}</span>
                  <span className="tabular shrink-0 text-fg-muted">{formatBytes(file.bytes, locale)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </li>
  );
}
