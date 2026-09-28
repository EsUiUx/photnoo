'use client';

import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Banknote, ChartNoAxesColumn, Download, Eye, ImageIcon, Link2, Minus, Share2, ShoppingBag, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ANALYTICS_RANGES } from '@photnoo/shared';
import { HANDOFF, ListStagger } from '@/components/app/app-motion';
import { CountUp } from '@/components/motion/count-up';
import { DevelopImg } from '@/components/motion/develop';
import { staggerItem } from '@/components/motion/stagger-item';
import { Button, ButtonLink } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/field';
import { Card, CopyButton, DetailList, Segmented } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { fetchLink } from '@/lib/queries';
import { useAnalyticsOverview, useAnalyticsTimeseries, useTopClients, useTopGalleries } from '@/lib/queries-insights';
import type { AnalyticsRange, Metric, TopGallery } from '@/lib/types-insights';
import { ViewsChart } from './views-chart';

function useNumbers() {
  const t = useTranslations('App.analytics');
  const format = useFormatter();
  return {
    number: (n: number) => format.number(n, { numberingSystem: 'latn' }),
    money: (n: number) => t('money', { amount: format.number(n, { numberingSystem: 'latn', maximumFractionDigits: 2 }) }),
    percent: (n: number) => format.number(n, { style: 'percent', maximumFractionDigits: 1, numberingSystem: 'latn' }),
  };
}

/** Figma "Analytics": four KPIs, the views and downloads chart, top clients, the most viewed gallery, devices and countries. */
export function AnalyticsView() {
  const t = useTranslations('App.analytics');
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const overview = useAnalyticsOverview(range);
  const series = useAnalyticsTimeseries(range);
  const clients = useTopClients(range);
  const galleries = useTopGalleries(range);
  const failed = overview.isError && !overview.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        {/* Four options do not fit a phone row: a select there, the segmented control from sm up. */}
        <SelectField label={t('rangeLabel')} value={range} onChange={(e) => setRange(e.target.value as AnalyticsRange)} className="w-full sm:hidden">
          {ANALYTICS_RANGES.map((r) => (
            <option key={r} value={r}>
              {t(`ranges.${r}`)}
            </option>
          ))}
        </SelectField>
        <div className="hidden sm:block">
          <Segmented
            label={t('rangeLabel')}
            value={range}
            onChange={setRange}
            options={ANALYTICS_RANGES.map((r) => ({ value: r, label: t(`ranges.${r}`) }))}
          />
        </div>
      </div>

      {failed ? (
        <Card>
          <ErrorState
            onRetry={() => {
              void overview.refetch();
              void series.refetch();
              void clients.refetch();
              void galleries.refetch();
            }}
          />
        </Card>
      ) : (
        <>
          <section aria-labelledby="kpi-title">
            <h2 id="kpi-title" className="sr-only">
              {t('kpis')}
            </h2>
            <ListStagger className={cn('grid grid-cols-2 gap-3 transition-opacity sm:gap-4 xl:grid-cols-4', overview.isPlaceholderData && 'opacity-60')}>
              <Kpi index={0} icon={Eye} label={t('views')} metric={overview.data?.views} />
              <Kpi index={1} icon={Download} label={t('downloads')} metric={overview.data?.downloads} />
              <Kpi index={2} icon={ShoppingBag} label={t('orders')} metric={overview.data?.orders} />
              <Kpi index={3} icon={Banknote} label={t('revenue')} metric={overview.data?.revenueEgp} money />
            </ListStagger>
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2 sm:p-6">
              <h2 className="text-base font-semibold text-fg">{t('chartTitle')}</h2>
              <div className={cn('mt-4 transition-opacity', series.isPlaceholderData && 'opacity-60')}>
                {series.isError && !series.data ? (
                  <ErrorState onRetry={() => void series.refetch()} className="py-10" />
                ) : !series.data ? (
                  <Skeleton className="h-72 w-full" />
                ) : series.data.points.every((p) => p.views === 0 && p.downloads === 0) ? (
                  <EmptyState icon={ChartNoAxesColumn} title={t('chartEmpty')} className="py-16" />
                ) : (
                  <ViewsChart data={series.data} />
                )}
              </div>
            </Card>

            <Card className="lg:col-span-1">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-fg">{t('topClients')}</h2>
                <p className="mt-0.5 text-xs text-fg-muted">{t('topClientsHint')}</p>
              </div>
              <TopClients query={clients} />
            </Card>
          </div>

          <MostViewed query={galleries} />

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-semibold text-fg">{t('devices')}</h2>
              {!overview.data ? (
                <BarsSkeleton />
              ) : overview.data.devices.length === 0 ? (
                <p className="mt-4 text-sm text-fg-muted">{t('noDevices')}</p>
              ) : (
                <Bars
                  rows={overview.data.devices.map((d) => ({
                    key: d.deviceType,
                    label: t(`device.${(['mobile', 'tablet', 'desktop'].includes(d.deviceType) ? d.deviceType : 'unknown') as 'mobile'}`),
                    value: d.downloads,
                  }))}
                />
              )}
            </Card>
            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-semibold text-fg">{t('countries')}</h2>
              <p className="mt-0.5 text-xs text-fg-muted">{t('countriesHint')}</p>
              {!overview.data ? (
                <BarsSkeleton />
              ) : overview.data.countries.length === 0 ? (
                <p className="mt-4 text-sm text-fg-muted">{t('noCountries')}</p>
              ) : (
                <CountryBars rows={overview.data.countries} />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ index, icon: Icon, label, metric, money }: { index: number; icon: LucideIcon; label: string; metric?: Metric; money?: boolean }) {
  const t = useTranslations('App.analytics');
  const n = useNumbers();
  const show = (v: number) => (money ? n.money(v) : n.number(v));
  const change = metric?.change;
  const tone = change === null || change === undefined ? 'neutral' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const DeltaIcon = tone === 'up' ? ArrowUpRight : tone === 'down' ? ArrowDownRight : Minus;
  const text =
    !metric || change === undefined
      ? ''
      : change === null
        ? t('changeNew')
        : change === 0
          ? t('changeFlat')
          : t(change > 0 ? 'changeUp' : 'changeDown', { value: n.percent(Math.abs(change)) });

  return (
    <li {...staggerItem(index)} className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      {!metric ? (
        <>
          <Skeleton className="mt-3 h-9 w-24" />
          <Skeleton className="mt-2 h-5 w-32" />
        </>
      ) : (
        <>
          <p className={cn('tabular mt-3 font-semibold tracking-tight text-fg', money ? 'text-2xl' : 'text-3xl', HANDOFF)}>
            <CountUp value={metric.value} format={show} />
          </p>
          <p
            className={cn(
              'mt-2 inline-flex items-start gap-1 text-xs font-medium',
              HANDOFF,
              tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-fg-muted',
            )}
            title={t('previousValue', { value: show(metric.previous) })}
          >
            <DeltaIcon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span>{text}</span>
          </p>
        </>
      )}
    </li>
  );
}

function TopClients({ query }: { query: ReturnType<typeof useTopClients> }) {
  const t = useTranslations('App.analytics');
  if (query.isError && !query.data) return <ErrorState onRetry={() => void query.refetch()} className="py-8" />;
  if (!query.data) {
    return (
      <ul className="divide-y divide-border">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </li>
        ))}
      </ul>
    );
  }
  if (query.data.items.length === 0) return <EmptyState icon={Users} title={t('noClients')} className="py-10" />;
  return (
    <ListStagger as="ol" className={cn('divide-y divide-border transition-opacity', query.isPlaceholderData && 'opacity-60')}>
      {query.data.items.map((client, index) => (
        <li key={`${client.rank}-${client.name}`} {...staggerItem(index)} className="flex items-center gap-3 px-5 py-3">
          <span
            className={cn(
              'tabular flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
              client.rank === 1 ? 'bg-brand text-brand-fg' : 'bg-surface-sunken text-fg-secondary',
            )}
          >
            <span className="sr-only">{t('rank', { rank: client.rank })}</span>
            <span aria-hidden>{client.rank}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg" dir="auto">
              {client.name}
            </p>
            <p className="tabular truncate text-xs text-fg-muted">{t('clientStats', { downloads: client.downloads, views: client.views })}</p>
          </div>
        </li>
      ))}
    </ListStagger>
  );
}

function MostViewed({ query }: { query: ReturnType<typeof useTopGalleries> }) {
  const t = useTranslations('App.analytics');
  const [sharing, setSharing] = useState<TopGallery | null>(null);
  const gallery = query.data?.items[0];

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-fg">{t('mostViewed')}</h2>
      {query.isError && !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} className="py-8" />
      ) : !query.data ? (
        <div className="mt-4 flex flex-col gap-5 sm:flex-row">
          <Skeleton className="aspect-[4/3] w-full rounded-md sm:w-72" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
      ) : !gallery ? (
        <EmptyState icon={ImageIcon} title={t('noGallery')} className="py-10" />
      ) : (
        <div className={cn('mt-4 flex flex-col gap-5 transition-opacity sm:flex-row sm:items-stretch', HANDOFF, query.isPlaceholderData && 'opacity-60')}>
          <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-sunken text-fg-muted sm:w-72">
            {gallery.coverUrl ? (
              <DevelopImg src={gallery.coverUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            ) : (
              <ImageIcon size={22} strokeWidth={1.75} aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <DetailList
              items={[
                { label: t('galleryName'), value: <span dir="auto">{gallery.name}</span> },
                { label: t('views'), value: <span className="tabular">{t('viewsCount', { count: gallery.views })}</span> },
                { label: t('downloads'), value: <span className="tabular">{t('downloadsCount', { count: gallery.downloads })}</span> },
                { label: t('clientName'), value: <span dir="auto">{gallery.clientName ?? '—'}</span> },
                { label: t('clientPhone'), value: <span dir="ltr" className="tabular">{gallery.clientPhone ?? '—'}</span> },
              ]}
            />
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button variant="soft" icon={Link2} onClick={() => setSharing(gallery)} disabled={!gallery.shareable} title={gallery.shareable ? undefined : t('shareClosed')}>
                {t('shareLink')}
              </Button>
              <ButtonLink href={`/galleries/${gallery.id}`} variant="primary">
                {t('viewGallery')}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
      {gallery && !gallery.shareable ? <p className="mt-3 text-xs text-fg-muted">{t('shareClosed')}</p> : null}
      <ShareDialog gallery={sharing} onClose={() => setSharing(null)} />
    </Card>
  );
}

function ShareDialog({ gallery, onClose }: { gallery: TopGallery | null; onClose: () => void }) {
  const t = useTranslations('App.analytics');
  return (
    <Dialog open={Boolean(gallery)} onClose={onClose} title={t('shareTitle')} description={gallery?.name} size="sm">
      {gallery ? <ShareBody galleryId={gallery.id} name={gallery.name} /> : null}
    </Dialog>
  );
}

function ShareBody({ galleryId, name }: { galleryId: string; name: string }) {
  const t = useTranslations('App.analytics');
  const query = useQuery({ queryKey: ['gallery', galleryId, 'link'], queryFn: () => fetchLink(galleryId), staleTime: 0, retry: false });
  const state = { link: query.data?.link };

  if (query.isError) return <Alert>{t('shareFailed')}</Alert>;
  if (!state.link) return <Skeleton className="h-11 w-full" />;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-fg-secondary">{t('shareBody')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <p dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-surface-subtle px-3 py-2.5 text-start text-sm text-fg">
          {state.link}
        </p>
        <CopyButton value={state.link} variant="primary" />
      </div>
      {canShare ? (
        <Button variant="secondary" icon={Share2} onClick={() => void navigator.share({ title: name, url: state.link }).catch(() => {})}>
          {t('shareNative')}
        </Button>
      ) : null}
    </div>
  );
}

function BarsSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

/** Magnitude bars in one hue; the label and number carry the meaning, the bar only its size. */
function Bars({ rows }: { rows: Array<{ key: string; label: string; value: number }> }) {
  const t = useTranslations('App.analytics');
  const n = useNumbers();
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ListStagger className="group/bars mt-4 flex flex-col gap-4">
      {rows.map((row, index) => (
        <li key={row.key} {...staggerItem(index)}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-fg" dir="auto">
              {row.label}
            </span>
            <span className="tabular text-fg-secondary">
              {n.number(row.value)}
              <span className="ms-2 text-xs text-fg-muted">{t('share', { value: n.percent(total ? row.value / total : 0) })}</span>
            </span>
          </div>
          <div aria-hidden className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            {/* Grows from the start edge (right in Arabic) once, as the list arrives. */}
            <div
              className="h-full origin-left rounded-full bg-brand transition-[scale] duration-700 ease-[var(--ease-out-expo)] [scale:0_1] group-data-revealed/bars:[scale:1] group-[:not([data-stagger])]/bars:[scale:1] motion-reduce:transition-none rtl:origin-right"
              style={{ width: `${(row.value / max) * 100}%`, transitionDelay: `${Math.min(index, 8) * 45}ms` }}
            />
          </div>
        </li>
      ))}
    </ListStagger>
  );
}

function CountryBars({ rows }: { rows: Array<{ country: string; views: number }> }) {
  const locale = useLocale();
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }
  return <Bars rows={rows.map((r) => ({ key: r.country, label: names?.of(r.country) ?? r.country, value: r.views }))} />;
}
