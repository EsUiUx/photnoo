'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Clock, Download, Eye, HardDrive, ImageIcon, Images, Plus, Users } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, Meter } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatBytes, percent } from '@/lib/format';
import { useDashboard, useMe } from '@/lib/queries';
import type { ActivityItem, Dashboard, GalleryListItem } from '@/lib/types';
import { CreateGalleryDialog } from './create-gallery-dialog';
import { daysLeft } from './gallery-card';
import { galleryBadge, StatusBadge } from './status-badge';

/** Studio overview: greeting, four numbers, the latest galleries and what clients did lately. */
export function DashboardView() {
  const t = useTranslations('App.dashboard');
  const format = useFormatter();
  const me = useMe();
  const dashboard = useDashboard();
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => Date.now());
  const data = dashboard.data;
  const firstName = me.data?.name.split(' ')[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{firstName ? t('hello', { name: firstName }) : t('title')}</h1>
          {/* The server and the browser may disagree about "today" around midnight. */}
          <p className="mt-1 text-sm text-fg-muted" suppressHydrationWarning>
            {format.dateTime(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button icon={Plus} onClick={() => setCreating(true)}>
          {t('newGallery')}
        </Button>
      </div>

      {dashboard.isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void dashboard.refetch()} />
        </Card>
      ) : (
        <>
          <section aria-labelledby="overview-title">
            <h2 id="overview-title" className="sr-only">
              {t('overview')}
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <Stat icon={Users} label={t('clients')} value={data?.clients} />
              <Stat icon={Images} label={t('activeGalleries')} value={data?.activeGalleries} />
              <Stat icon={Download} label={t('downloads')} value={data?.downloads} />
              <AllowanceStat data={data} loading={dashboard.isPending} />
            </ul>
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <SectionHeader id="recent-galleries" title={t('recentGalleries')} href="/galleries" />
              {!data ? (
                <RowsSkeleton thumb />
              ) : data.recentGalleries.length === 0 ? (
                <EmptyState
                  icon={Images}
                  title={t('emptyTitle')}
                  body={t('empty')}
                  action={
                    <Button icon={Plus} onClick={() => setCreating(true)}>
                      {t('createFirst')}
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentGalleries.map((gallery) => (
                    <GalleryRow key={gallery.id} gallery={gallery} now={now} />
                  ))}
                </ul>
              )}
            </Card>

            <Card className="lg:col-span-2">
              <SectionHeader id="recent-activity" title={t('recentActivity')} />
              {!data ? (
                <RowsSkeleton />
              ) : data.activity.length === 0 ? (
                <EmptyState icon={Eye} title={t('noActivityTitle')} body={t('noActivity')} className="py-10" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.activity.map((item, index) => (
                    <ActivityRow key={`${item.type}-${item.galleryId}-${index}`} item={item} now={now} />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      <CreateGalleryDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function SectionHeader({ id, title, href }: { id: string; title: string; href?: string }) {
  const t = useTranslations('App.dashboard');
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
      <h2 id={id} className="text-base font-semibold text-fg">
        {title}
      </h2>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-brand hover:text-brand-hover">
          {t('viewAll')}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
        </Link>
      ) : null}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: number }) {
  const format = useFormatter();
  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      {value === undefined ? (
        <Skeleton className="mt-3 h-9 w-20" />
      ) : (
        <p className="tabular mt-3 text-3xl font-semibold tracking-tight text-fg">{format.number(value)}</p>
      )}
    </li>
  );
}

function AllowanceStat({ data, loading }: { data?: Dashboard; loading: boolean }) {
  const t = useTranslations('App.dashboard');
  const locale = useLocale();
  const storage = data?.storage;
  const used = storage ? percent(storage.usedBytes, storage.allowanceBytes) : 0;
  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">{t('allowance')}</p>
        <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <HardDrive size={18} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-7 w-32" />
          <Skeleton className="mt-3 h-2 w-full" />
        </>
      ) : storage ? (
        <>
          <p className="tabular mt-3 text-lg font-semibold text-fg">
            {t('allowanceUsed', { used: formatBytes(storage.usedBytes, locale), total: formatBytes(storage.allowanceBytes, locale) })}
          </p>
          <Meter value={used} label={t('allowanceMeter')} tone={used >= 95 ? 'danger' : used >= 80 ? 'warning' : 'brand'} className="mt-3" />
          <Link href="/billing" className="mt-2 inline-block rounded-md text-xs text-fg-muted hover:text-fg">
            {t(`plan.${storage.state}` as 'plan.active')}
          </Link>
        </>
      ) : (
        <Link href="/billing" className="mt-3 inline-block rounded-md text-sm font-medium text-brand hover:text-brand-hover">
          {t('noPlan')}
        </Link>
      )}
    </li>
  );
}

function GalleryRow({ gallery, now }: { gallery: GalleryListItem; now: number }) {
  const t = useTranslations('App.dashboard');
  const tCard = useTranslations('App.table');
  const format = useFormatter();
  const left = daysLeft(gallery, now);
  return (
    <li className="relative flex items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-surface-subtle">
      <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-sunken text-fg-muted">
        {gallery.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={gallery.coverUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <ImageIcon size={18} strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/galleries/${gallery.id}`} className="block truncate rounded-md text-sm font-medium text-fg after:absolute after:inset-0 after:content-['']">
          {gallery.name}
        </Link>
        <p className="truncate text-xs text-fg-muted">
          {gallery.clientName ?? tCard('noClient')} · {t('photos', { count: gallery.fileCount })}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-4 text-xs text-fg-secondary sm:flex">
        <span className="tabular inline-flex items-center gap-1.5" title={tCard('views', { count: gallery.views })}>
          <Eye size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
          <span className="sr-only">{tCard('views', { count: gallery.views })}</span>
          <span aria-hidden>{format.number(gallery.views)}</span>
        </span>
        <span className="tabular inline-flex items-center gap-1.5" title={tCard('downloads', { count: gallery.downloads })}>
          <Download size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
          <span className="sr-only">{tCard('downloads', { count: gallery.downloads })}</span>
          <span aria-hidden>{format.number(gallery.downloads)}</span>
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge kind={galleryBadge(gallery)} />
        {left !== null ? <span className="text-xs text-fg-muted">{tCard('daysLeft', { days: left })}</span> : null}
      </div>
    </li>
  );
}

const ACTIVITY: Record<ActivityItem['type'], { icon: LucideIcon; tone: string }> = {
  viewed: { icon: Eye, tone: 'bg-info-soft text-info' },
  downloaded: { icon: Download, tone: 'bg-success-soft text-success' },
  expiring: { icon: Clock, tone: 'bg-warning-soft text-warning' },
};

function ActivityRow({ item, now }: { item: ActivityItem; now: number }) {
  const t = useTranslations('App.dashboard');
  const format = useFormatter();
  const { icon: Icon, tone } = ACTIVITY[item.type];
  return (
    <li className="relative flex items-start gap-3 px-5 py-3 transition-colors duration-150 hover:bg-surface-subtle">
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/galleries/${item.galleryId}`} className="block rounded-md text-sm text-fg-secondary after:absolute after:inset-0 after:content-['']">
          {t.rich(`activity.${item.type}`, {
            client: item.clientName ?? t('yourClient'),
            gallery: item.galleryName,
            b: (chunks) => <span className="font-medium text-fg">{chunks}</span>,
          })}
        </Link>
        <time dateTime={item.at} className="mt-0.5 block text-xs text-fg-muted">
          {format.relativeTime(new Date(item.at), now)}
        </time>
      </div>
    </li>
  );
}

function RowsSkeleton({ thumb }: { thumb?: boolean }) {
  const t = useTranslations('Common');
  return (
    <div className="divide-y divide-border">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3">
          <Skeleton className={thumb ? 'h-12 w-16' : 'size-8 rounded-full'} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
