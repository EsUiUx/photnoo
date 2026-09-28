'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Clock, Download, Eye, HardDrive, ImagePlus, Images, Plus, SearchX, TrendingDown, TrendingUp, Upload, Users } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { DateRangeFilter, type DateRange, SearchInput, useDebounced } from '@/components/gallery/gallery-filters';
import { GalleryTable } from '@/components/gallery/gallery-table';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, Meter } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatBytes, percent } from '@/lib/format';
import { useDashboard, useGalleries, useMe } from '@/lib/queries';
import type { ActivityItem, Dashboard, Trend } from '@/lib/types';
import { CreateGalleryDialog, type CreateIntent } from './create-gallery-dialog';

const ACTIVITY_PREVIEW = 5;

/** Studio overview: greeting, quick actions, four numbers with trends, activity and recent galleries. */
export function DashboardView() {
  const t = useTranslations('App.dashboard');
  const format = useFormatter();
  const me = useMe();
  const dashboard = useDashboard();
  const [creating, setCreating] = useState<CreateIntent | null>(null);
  const data = dashboard.data;
  const firstName = me.data?.name.split(' ')[0];

  return (
    <div className="flex flex-col gap-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{firstName ? t('hello', { name: firstName }) : t('title')}</h1>
        {/* The server and the browser may disagree about "today" around midnight. */}
        <p className="mt-1 text-sm text-fg-muted" suppressHydrationWarning>
          {format.dateTime(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' })}
        </p>
      </div>

      <section aria-labelledby="quick-actions-title" className="flex flex-col gap-3">
        <h2 id="quick-actions-title" className="text-lg font-semibold text-fg">
          {t('quickActions')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <QuickAction icon={ImagePlus} title={t('createGallery')} body={t('createGalleryBody')} onClick={() => setCreating('gallery')} />
          <QuickAction icon={Upload} title={t('uploadProject')} body={t('uploadProjectBody')} onClick={() => setCreating('upload')} />
        </div>
      </section>

      {dashboard.isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void dashboard.refetch()} />
        </Card>
      ) : (
        <>
          <section aria-labelledby="overview-title" className="flex flex-col gap-3">
            <h2 id="overview-title" className="text-lg font-semibold text-fg">
              {t('overview')}
            </h2>
            <div className="grid items-start gap-6 xl:grid-cols-3">
              <ul className="grid grid-cols-1 content-start gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:col-span-2">
                <Stat icon={Users} label={t('clients')} value={data?.clients} trend={data?.trends.clients} href="/clients" />
                <Stat icon={Download} label={t('downloadsCycle')} value={data?.downloads} trend={data?.trends.downloads} />
                <Stat icon={Images} label={t('activeGalleries')} value={data?.activeGalleries} trend={data?.trends.activeGalleries} trendLabel={t('trendShared')} />
                <AllowanceStat data={data} loading={dashboard.isPending} />
              </ul>
              <ActivityCard data={data} />
            </div>
          </section>

          <RecentGalleries hasAny={data ? data.recentGalleries.length > 0 : undefined} onCreate={() => setCreating('gallery')} />
        </>
      )}

      <CreateGalleryDialog open={creating !== null} intent={creating ?? 'gallery'} onClose={() => setCreating(null)} />
    </div>
  );
}

function QuickAction({ icon: Icon, title, body, onClick }: { icon: LucideIcon; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-24 items-center gap-4 rounded-lg border border-dashed border-brand/40 bg-brand-soft/60 p-5 text-start transition-colors duration-150 hover:border-brand hover:bg-brand-soft"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg">
        <Icon size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-sm text-fg-secondary">{body}</span>
      </span>
      <ArrowRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-brand transition-transform duration-150 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
    </button>
  );
}

/** Change of the last 30 days against the 30 before. Nothing to compare with means no badge. */
function Delta({ trend, label, neutral }: { trend?: Trend; label: string; neutral?: boolean }) {
  const t = useTranslations('App.dashboard');
  const format = useFormatter();
  if (!trend || trend.previous === 0) return null;
  const change = (trend.current - trend.previous) / trend.previous;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  const tone = neutral || change === 0 ? 'bg-surface-sunken text-fg-secondary' : up ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger';
  const value = format.number(change, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });
  return (
    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span className={cn('tabular inline-flex h-6 items-center gap-1 rounded-full px-2 font-medium', tone)}>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
        <span dir="ltr">{value}</span>
      </span>
      <span>{label || t('trendLabel')}</span>
    </span>
  );
}

function StatShell({ icon: Icon, label, children, href }: { icon: LucideIcon; label: string; children: React.ReactNode; href?: string }) {
  return (
    <li className="relative rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        {href ? (
          <Link href={href} className="rounded-md text-sm font-medium text-fg-muted after:absolute after:inset-0 after:content-[''] hover:text-fg">
            {label}
          </Link>
        ) : (
          <p className="text-sm font-medium text-fg-muted">{label}</p>
        )}
        <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      {children}
    </li>
  );
}

function Stat({ icon, label, value, trend, trendLabel, href }: { icon: LucideIcon; label: string; value?: number; trend?: Trend; trendLabel?: string; href?: string }) {
  const format = useFormatter();
  return (
    <StatShell icon={icon} label={label} href={href}>
      {value === undefined ? (
        <Skeleton className="mt-3 h-9 w-20" />
      ) : (
        <>
          <p className="tabular mt-3 text-3xl font-semibold tracking-tight text-fg">{format.number(value)}</p>
          <Delta trend={trend} label={trendLabel ?? ''} />
        </>
      )}
    </StatShell>
  );
}

function AllowanceStat({ data, loading }: { data?: Dashboard; loading: boolean }) {
  const t = useTranslations('App.dashboard');
  const locale = useLocale();
  const storage = data?.storage;
  const used = storage ? percent(storage.usedBytes, storage.allowanceBytes) : 0;
  return (
    <StatShell icon={HardDrive} label={t('allowance')}>
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
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Link href="/billing" className="relative rounded-md text-xs text-fg-muted hover:text-fg">
              {t(`plan.${storage.state}` as 'plan.active')}
            </Link>
            {used > 80 ? (
              <Link href="/billing" className="relative inline-flex items-center gap-1 rounded-md text-xs font-medium text-brand hover:text-brand-hover">
                {t('upgrade')}
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
              </Link>
            ) : null}
          </div>
          <Delta trend={data?.trends.allowance} label={t('trendUploads')} neutral />
        </>
      ) : (
        <Link href="/billing" className="mt-3 inline-block rounded-md text-sm font-medium text-brand hover:text-brand-hover">
          {t('noPlan')}
        </Link>
      )}
    </StatShell>
  );
}

const ACTIVITY: Record<ActivityItem['type'], { icon: LucideIcon; tone: string }> = {
  viewed: { icon: Eye, tone: 'bg-info-soft text-info' },
  downloaded: { icon: Download, tone: 'bg-success-soft text-success' },
  expiring: { icon: Clock, tone: 'bg-warning-soft text-warning' },
};

function ActivityCard({ data }: { data?: Dashboard }) {
  const t = useTranslations('App.dashboard');
  const [all, setAll] = useState(false);
  const [now] = useState(() => Date.now());
  const items = data?.activity ?? [];
  const shown = all ? items : items.slice(0, ACTIVITY_PREVIEW);
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h3 id="recent-activity" className="text-base font-semibold text-fg">
          {t('recentActivity')}
        </h3>
        {items.length > ACTIVITY_PREVIEW ? (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            aria-expanded={all}
            className="h-9 rounded-md px-2 text-sm font-medium text-brand hover:bg-brand-soft pointer-coarse:h-11"
          >
            {all ? t('showLess') : t('viewAll')}
          </button>
        ) : null}
      </div>
      {!data ? (
        <RowsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Eye} title={t('noActivityTitle')} body={t('noActivity')} className="py-10" />
      ) : (
        <ul className="divide-y divide-border" aria-labelledby="recent-activity">
          {shown.map((item, index) => (
            <ActivityRow key={`${item.type}-${item.galleryId}-${index}`} item={item} now={now} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityRow({ item, now }: { item: ActivityItem; now: number }) {
  const t = useTranslations('App.dashboard');
  const format = useFormatter();
  const { icon: Icon, tone } = ACTIVITY[item.type];
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', tone)}>
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg-secondary">
          {t.rich(`activity.${item.type}`, {
            client: item.clientName ?? t('yourClient'),
            gallery: item.galleryName,
            b: (chunks) => <span className="font-medium text-fg">{chunks}</span>,
          })}
        </p>
        <time dateTime={item.at} className="mt-0.5 block text-xs text-fg-muted">
          {format.relativeTime(new Date(item.at), now)}
        </time>
      </div>
      <ButtonLink href={`/galleries/${item.galleryId}`} variant="soft" size="sm" aria-label={t('viewDetailsFor', { gallery: item.galleryName })}>
        {t('viewDetails')}
      </ButtonLink>
    </li>
  );
}

/** The newest galleries as a table, with search and a created-date range. */
function RecentGalleries({ hasAny, onCreate }: { hasAny?: boolean; onCreate: () => void }) {
  const t = useTranslations('App.dashboard');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [now] = useState(() => Date.now());
  const q = useDebounced(search.trim());
  const filters = useMemo(() => ({ q, from: range.from || undefined, to: range.to || undefined, take: 8 }), [q, range]);
  const galleries = useGalleries(filters);
  const items = galleries.data?.pages[0]?.items ?? [];
  const filtered = Boolean(q || range.from || range.to);

  let body: React.ReactNode;
  if (galleries.isPending) body = <RowsSkeleton thumb />;
  else if (galleries.isError && !galleries.data) body = <ErrorState onRetry={() => void galleries.refetch()} />;
  else if (items.length === 0 && !filtered && hasAny !== true) {
    body = (
      <EmptyState
        icon={Images}
        title={t('emptyTitle')}
        body={t('empty')}
        action={
          <Button icon={Plus} onClick={onCreate}>
            {t('createFirst')}
          </Button>
        }
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('noMatchTitle')}
        body={t('noMatch')}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setRange({ from: '', to: '' });
            }}
          >
            {t('clearFilters')}
          </Button>
        }
      />
    );
  } else {
    body = (
      <div aria-busy={galleries.isFetching || undefined}>
        <GalleryTable galleries={items} now={now} caption={t('recentGalleries')} />
      </div>
    );
  }

  return (
    <Card aria-labelledby="recent-galleries">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recent-galleries" className="text-lg font-semibold text-fg">
            {t('recentGalleries')}
          </h2>
          <Link href="/galleries" className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-brand hover:text-brand-hover lg:hidden">
            {t('viewAll')}
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
          </Link>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchInput value={search} onChange={setSearch} label={t('searchGalleries')} placeholder={t('searchPlaceholder')} className="sm:w-64" />
          <DateRangeFilter value={range} onChange={setRange} />
          <Link
            href="/galleries"
            className="hidden h-10 items-center gap-1 rounded-md px-2 text-sm font-medium whitespace-nowrap text-brand hover:text-brand-hover lg:inline-flex"
          >
            {t('viewAll')}
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
          </Link>
        </div>
      </div>
      {body}
    </Card>
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
          <Skeleton className={thumb ? 'h-10 w-14' : 'size-8 rounded-full'} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
