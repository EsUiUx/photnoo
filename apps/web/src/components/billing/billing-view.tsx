'use client';

import { useLocale, useTranslations } from 'next-intl';
import { EasedMeter, ListStagger } from '@/components/app/app-motion';
import { staggerItem } from '@/components/motion/stagger-item';
import { Alert, ErrorState, Skeleton } from '@/components/ui/state';
import { Badge, Card, DetailList } from '@/components/ui/primitives';
import { formatBytes, formatDate, isolate, percent } from '@/lib/format';
import { useBilling } from '@/lib/queries';
import type { Subscription } from '@/lib/types';
import { SUBSCRIPTION_TONES, useMoney, useNumber } from './billing-shared';
import { PaymentHistory } from './payment-history';
import { PaymentPanel } from './payment-panel';
import { PlanPicker } from './plan-picker';

/** Billing: current plan and allowance, the open payment, plans, then payment history. */
export function BillingView() {
  const t = useTranslations('App.billing');
  const billing = useBilling();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
      <header className="-mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t('intro')}</p>
      </header>

      {billing.isPending ? (
        <BillingSkeleton />
      ) : billing.isError ? (
        <Card>
          <ErrorState title={t('loadFailedTitle')} body={t('loadFailed')} onRetry={() => void billing.refetch()} />
        </Card>
      ) : (
        <>
          <ListStagger as="div" className="grid gap-4 lg:grid-cols-2">
            <div {...staggerItem(0)} className="grid">
              <CurrentPlanCard subscription={billing.data.subscription} />
            </div>
            <div {...staggerItem(1)} className="grid">
              <AllowanceCard subscription={billing.data.subscription} />
            </div>
          </ListStagger>

          {billing.data.openPayment ? <PaymentPanel payment={billing.data.openPayment} details={billing.data.paymentDetails} /> : null}

          <PlanPicker plans={billing.data.plans} subscription={billing.data.subscription} paymentOpen={Boolean(billing.data.openPayment)} />

          {billing.data.payments.length > 0 ? <PaymentHistory payments={billing.data.payments} /> : null}
        </>
      )}
    </div>
  );
}

function BillingSkeleton() {
  const t = useTranslations('App.billing');
  return (
    <div role="status" className="flex flex-col gap-12">
      <span className="sr-only">{t('loading')}</span>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} as="div" className="p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-7 w-48" />
            <Skeleton className="mt-6 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </Card>
        ))}
      </div>
      <div>
        <Skeleton className="h-6 w-40" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} as="div" className="p-6">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-5 h-9 w-32" />
              <Skeleton className="mt-5 h-4 w-full" />
              <Skeleton className="mt-3 h-4 w-5/6" />
              <Skeleton className="mt-8 h-11 w-full" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrentPlanCard({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('App.billing');
  const locale = useLocale();
  const money = useMoney();
  const plan = subscription.plan;
  const { state } = subscription;
  const title =
    state === 'trial'
      ? t('trialTitle')
      : plan
        ? t('planTitle', { plan: isolate(plan.label), cycle: t(`cycle.${plan.cycle}`) })
        : t('noPlanTitle');
  const ended = state === 'soft_locked' || state === 'dormant';

  const rows: Array<{ label: React.ReactNode; value: React.ReactNode }> = [];
  if (subscription.priceEgp !== null && plan && state !== 'trial') {
    rows.push({
      label: t('pricePaid'),
      value: <span className="tabular">{t('pricePerCycle', { amount: money(subscription.priceEgp), cycle: plan.cycle })}</span>,
    });
  }
  if (state !== 'pending_payment') {
    rows.push({ label: t('started'), value: <span className="tabular">{formatDate(subscription.cycleStart, locale)}</span> });
    rows.push({
      label: ended ? t('ended') : subscription.renewalPaid ? t('renews') : t('expires'),
      value: (
        <span className="tabular">
          {formatDate(subscription.cycleEnd, locale)}
          {!ended && subscription.daysLeft >= 0 ? (
            <span className="ms-2 font-normal text-fg-muted">({t('daysLeft', { count: subscription.daysLeft })})</span>
          ) : null}
        </span>
      ),
    });
  }
  if (state === 'active') {
    rows.push({ label: t('renewal'), value: subscription.renewalPaid ? t('renewalPaidValue') : t('renewalDueValue') });
  }

  return (
    <Card className="flex flex-col p-6" as="section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-fg-muted">{t('currentPlan')}</h2>
        <Badge tone={SUBSCRIPTION_TONES[state]} dot>
          {t(`state.${state}`)}
        </Badge>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">{title}</p>

      {rows.length > 0 ? <DetailList items={rows} className="mt-5" /> : null}

      <div className="mt-5 flex flex-col gap-3 empty:hidden">
        {state === 'trial' ? <Alert tone="info">{t('trialNote')}</Alert> : null}
        {state === 'pending_payment' ? <Alert tone="info">{t('pendingNote')}</Alert> : null}
        {subscription.nextPlan ? (
          <Alert tone="info">
            {t('nextPlanNote', { plan: isolate(subscription.nextPlan.label), cycle: t(`cycle.${subscription.nextPlan.cycle}`) })}
          </Alert>
        ) : null}
        {state === 'soft_locked' ? (
          <Alert tone="warning" title={t('softLockedTitle')}>
            {subscription.dormantAt ? t('softLockedNote', { date: formatDate(subscription.dormantAt, locale) }) : null}
          </Alert>
        ) : null}
        {state === 'dormant' ? <Alert title={t('dormantTitle')}>{t('dormantNote')}</Alert> : null}
        {state === 'suspended' ? <Alert title={t('suspendedTitle')}>{t('suspendedNote')}</Alert> : null}
      </div>
    </Card>
  );
}

function AllowanceCard({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('App.billing');
  const locale = useLocale();
  const number = useNumber();
  const used = percent(subscription.usedBytes, subscription.allowanceBytes);
  const remaining = Math.max(0, Number(subscription.allowanceBytes) - Number(subscription.usedBytes));
  const tone = used >= 95 ? 'danger' : used >= 80 ? 'warning' : 'brand';

  return (
    <Card className="flex flex-col p-6" as="section">
      <h2 className="text-sm font-medium text-fg-muted">{t('allowance')}</h2>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 tabular">
        <span className="text-2xl font-semibold tracking-tight text-fg">{formatBytes(subscription.usedBytes, locale)}</span>
        <span className="text-sm text-fg-muted">{t('allowanceOf', { total: formatBytes(subscription.allowanceBytes, locale) })}</span>
      </p>
      <EasedMeter value={used} label={t('allowanceMeter')} tone={tone} className="mt-5" />
      <p className={`mt-2 text-sm tabular ${tone === 'danger' ? 'font-medium text-danger' : tone === 'warning' ? 'font-medium text-warning' : 'text-fg-secondary'}`}>
        {t('allowanceUsed', { percent: number(used), remaining: formatBytes(remaining, locale) })}
      </p>
      <p className="mt-4 text-sm text-fg-muted">{t('allowanceHelp')}</p>
      {tone !== 'brand' ? (
        <Alert tone={tone === 'danger' ? 'danger' : 'warning'} className="mt-4">
          {t('allowanceWarning')}
        </Alert>
      ) : null}
    </Card>
  );
}
