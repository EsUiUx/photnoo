'use client';

import { ExternalLink, Globe, LayoutGrid, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useSyncExternalStore } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Badge, Card, CopyButton } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { usePortfolio, usePublishPortfolio } from '@/lib/queries-insights';
import type { Portfolio } from '@/lib/types-insights';
import { PortfolioGrid } from './portfolio-grid';
import { PortfolioUploader } from './portfolio-uploader';

const noop = () => () => {};

/** Photographer portfolio manager: publish switch and public link, uploads, and the arrangeable grid. */
export function PortfolioView() {
  const t = useTranslations('App.portfolio');
  const portfolio = usePortfolio();
  const data = portfolio.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        {data?.slug ? (
          <ButtonLink href={`/p/${data.slug}`} variant="secondary" iconEnd={ExternalLink} target="_blank">
            {t('viewPublic')}
          </ButtonLink>
        ) : null}
      </div>

      {portfolio.isError && !data ? (
        <Card>
          <ErrorState onRetry={() => void portfolio.refetch()} />
        </Card>
      ) : !data ? (
        <LoadingState />
      ) : (
        <>
          <PublishCard data={data} />
          <section aria-labelledby="portfolio-images" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="portfolio-images" className="text-lg font-semibold text-fg">
                {t('gridLabel')}
              </h2>
              <p className="tabular text-sm text-fg-muted">
                {t('count', { count: data.items.length, max: data.maxItems })}
                <span className="mx-2" aria-hidden>
                  ·
                </span>
                {t('allowanceNote')}
              </p>
            </div>
            <PortfolioUploader remaining={data.maxItems - data.items.length} max={data.maxItems} />
            {data.items.length === 0 ? (
              <Card>
                <EmptyState icon={LayoutGrid} title={t('emptyTitle')} body={t('emptyBody')} />
              </Card>
            ) : (
              <div>
                <p className="mb-3 text-sm text-fg-muted">{t('reorderHint')}</p>
                <PortfolioGrid items={data.items} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PublishCard({ data }: { data: Portfolio }) {
  const t = useTranslations('App.portfolio');
  const publish = usePublishPortfolio();
  const labelId = useId();
  const hintId = useId();
  // The absolute link needs the browser origin; the server render shows the path only.
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => '');
  const published = publish.isPending ? Boolean(publish.variables) : data.published;
  const url = data.slug ? `${origin}/p/${data.slug}` : null;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
            <Globe size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={labelId} className="text-base font-semibold text-fg">
                {t('publishLabel')}
              </h2>
              <Badge tone={data.published ? 'success' : 'neutral'} dot>
                {data.published ? t('published') : t('hidden')}
              </Badge>
            </div>
            <p id={hintId} className="mt-1 text-sm text-fg-muted">
              {published ? t('publishOnHint') : t('publishOffHint')}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={published}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          disabled={!data.slug || publish.isPending}
          onClick={() => publish.mutate(!data.published)}
          className="group inline-flex h-11 shrink-0 items-center rounded-md px-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={cn(
              'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-150',
              published ? 'bg-brand' : 'bg-border-strong',
            )}
          >
            <span
              className={cn(
                'absolute top-1 size-5 rounded-full bg-surface shadow-xs transition-[inset-inline-start] duration-200 ease-[var(--ease-out-expo)]',
                published ? 'start-6' : 'start-1',
              )}
            />
          </span>
        </button>
      </div>

      {publish.isError ? (
        <Alert className="mt-4">{t('publishFailed')}</Alert>
      ) : null}

      {url ? (
        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-fg-muted sm:w-32">{t('pageAddress')}</p>
          <p dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-surface-subtle px-3 py-2.5 text-start text-sm text-fg">
            {url.replace(/^https?:\/\//, '')}
          </p>
          <CopyButton value={url} />
        </div>
      ) : (
        <Alert tone="info" title={t('noSlugTitle')} className="mt-5">
          <p>{t('noSlugBody')}</p>
          <ButtonLink href="/settings" size="sm" variant="secondary" icon={Settings} className="mt-3">
            {t('openSettings')}
          </ButtonLink>
        </Alert>
      )}
    </Card>
  );
}

function LoadingState() {
  return (
    <>
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="flex flex-wrap gap-3">
        {[16, 11, 16, 24, 11, 16].map((w, i) => (
          <div key={i} className="grow" style={{ flexBasis: `${w}rem` }}><Skeleton className="h-44 w-full rounded-md" /></div>
        ))}
      </div>
    </>
  );
}
