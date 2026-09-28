'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { formatBytes, percent } from '@/lib/format';
import { useDashboard } from '@/lib/queries';
import { CreateGalleryDialog } from './create-gallery-dialog';
import { GalleriesTable } from './galleries-table';

/** Figma dashboard (frame "Frame 1618872901"): quick actions, overview, recent galleries. */
export function DashboardView() {
  const t = useTranslations('App.dashboard');
  const locale = useLocale();
  const format = useFormatter();
  const dashboard = useDashboard();
  const [creating, setCreating] = useState(false);
  const data = dashboard.data;

  return (
    <div className="mx-auto flex max-w-[1504px] flex-col gap-10">
      <section>
        <h2 className="text-2xl font-medium text-primary-900">{t('quickActions')}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:gap-6">
          <QuickAction icon="/app/qa-gallery.svg" label={t('createGallery')} onClick={() => setCreating(true)} />
          <QuickAction icon="/app/qa-upload.svg" label={t('uploadProject')} onClick={() => setCreating(true)} />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-medium text-primary-900">{t('overview')}</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1.2fr] xl:gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
            <Stat icon="/app/stat-clients.svg" label={t('clients')} value={data?.clients} unit={t('clientUnit')} />
            <Stat icon="/app/stat-galleries.svg" label={t('activeGalleries')} value={data?.activeGalleries} unit={t('galleryUnit')} />
            <Stat icon="/app/stat-downloads.svg" label={t('downloads')} value={data?.downloads} unit={t('downloadUnit')} />
            <Card>
              <p className="text-lg font-medium text-primary-900">{t('storage')}</p>
              {data?.storage ? (
                <>
                  <p className="mt-6 text-sm font-medium text-ink-body" dir="ltr">
                    {formatBytes(data.storage.usedBytes, locale)} / {formatBytes(data.storage.allowanceBytes, locale)}
                  </p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#d9d9d9]" role="progressbar" aria-valuenow={percent(data.storage.usedBytes, data.storage.allowanceBytes)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${percent(data.storage.usedBytes, data.storage.allowanceBytes)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">{t(`plan.${data.storage.state}`)}</p>
                </>
              ) : (
                <Skeleton />
              )}
            </Card>
          </div>
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-lg font-medium text-primary-900">{t('recentActivity')}</p>
              <Link href="/galleries" className="text-base font-semibold text-primary-500 underline">
                {t('viewAll')}
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-line">
              {(data?.activity ?? []).map((item, index) => (
                <li key={`${item.type}-${item.galleryId}-${index}`} className="flex items-center gap-3 py-3">
                  <span
                    className="flex size-[43px] shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundImage: 'linear-gradient(138.6deg, #1a2f25 45.5%, #33895e 98.4%)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
                    <img src="/app/activity-bell.svg" alt="" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-primary-400">
                      {t(`activity.${item.type}`, { client: item.clientName ?? t('yourClient'), gallery: item.galleryName })}
                    </p>
                    <p className="text-xs text-ink-subtle">{format.relativeTime(new Date(item.at))}</p>
                  </div>
                  <Link
                    href={`/galleries/${item.galleryId}`}
                    className="flex h-9 shrink-0 items-center rounded-3xl bg-primary-300 px-4 text-xs font-semibold text-primary-50 hover:bg-primary-400"
                  >
                    {t('viewDetails')}
                  </Link>
                </li>
              ))}
              {data && data.activity.length === 0 ? <li className="py-6 text-center text-ink-muted">{t('noActivity')}</li> : null}
            </ul>
          </Card>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="text-lg font-medium text-primary-900">{t('recentGalleries')}</h2>
          <Link href="/galleries" className="text-base font-semibold text-primary-500 underline">
            {t('viewAll')}
          </Link>
        </div>
        {data ? (
          data.recentGalleries.length > 0 ? (
            <GalleriesTable items={data.recentGalleries} />
          ) : (
            <p className="px-6 pb-8 text-ink-muted">{t('noGalleries')}</p>
          )
        ) : (
          <div className="px-6 pb-6">
            <Skeleton />
          </div>
        )}
      </section>

      <CreateGalleryDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[139px] flex-col items-center justify-center gap-2 rounded-[17px] border-3 border-dashed border-primary-200 bg-primary-100 transition-colors hover:bg-primary-200"
    >
      <span className="flex size-[58px] items-center justify-center rounded-full bg-primary-500">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
        <img src={icon} alt="" className="size-[30px]" />
      </span>
      <span className="text-[21px] leading-[1.4] font-semibold text-primary-500">{label}</span>
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">{children}</div>;
}

function Stat({ icon, label, value, unit }: { icon: string; label: string; value?: number; unit: string }) {
  const format = useFormatter();
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-[33px] w-[31px] items-center justify-center rounded-md bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
          <img src={icon} alt="" className="size-6" />
        </span>
        <p className="text-lg font-medium text-primary-900">{label}</p>
      </div>
      {value === undefined ? (
        <Skeleton />
      ) : (
        <>
          <p className="mt-4 text-5xl leading-none font-medium text-[#231f20]">{format.number(value)}</p>
          <p className="mt-2 text-base text-neutral-500">{unit}</p>
        </>
      )}
    </Card>
  );
}

function Skeleton() {
  return <div className="mt-4 h-12 animate-pulse rounded bg-neutral-100" aria-hidden="true" />;
}
