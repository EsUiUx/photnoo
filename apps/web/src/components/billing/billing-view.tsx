'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatBytes, formatDate, isolate, percent } from '@/lib/format';
import { useBilling } from '@/lib/queries';
import type { Subscription } from '@/lib/types';
import { PaymentHistory } from './payment-history';
import { PaymentPanel } from './payment-panel';
import { PlanPicker } from './plan-picker';

const card = 'rounded-lg bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.1)] sm:p-6';

/** Figma "Billing" (0:4523) plus the PRD B-01 to B-07 flows the frame does not show. */
export function BillingView() {
  const t = useTranslations('App.billing');
  const billing = useBilling();

  if (billing.isPending) return <p className="text-ink-muted">{t('loading')}</p>;
  if (billing.isError) return <p className="text-danger">{t('loadFailed')}</p>;
  const { subscription, plans, openPayment, payments, paymentDetails } = billing.data;

  return (
    <div className="mx-auto flex max-w-[1504px] flex-col gap-10">
      <section>
        <h1 className="text-2xl font-bold text-primary-900">{t('title')}</h1>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <CurrentPlanCard subscription={subscription} />
          <AllowanceCard subscription={subscription} />
        </div>
      </section>

      {openPayment ? <PaymentPanel payment={openPayment} details={paymentDetails} /> : null}

      <PlanPicker plans={plans} subscription={subscription} paymentOpen={Boolean(openPayment)} />

      {payments.length > 0 ? <PaymentHistory payments={payments} /> : null}
    </div>
  );
}

function CurrentPlanCard({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('App.billing');
  const locale = useLocale();
  const plan = subscription.plan;
  const title =
    subscription.state === 'trial'
      ? t('trialTitle')
      : plan
        ? t('planTitle', { plan: isolate(plan.label), cycle: t(`cycle.${plan.cycle}`) })
        : t('noPlanTitle');
  const ended = ['soft_locked', 'dormant', 'pending_payment'].includes(subscription.state);

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-medium text-primary-900">{t('currentPlan')}</p>
        <StateBadge state={subscription.state} />
      </div>
      <p className="mt-3 text-3xl font-semibold text-primary-500 sm:text-[40px]">{title}</p>
      {subscription.state !== 'pending_payment' ? (
        <dl className="mt-5 grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-2 text-lg font-medium">
          <dt className="text-neutral-500">{t('started')}</dt>
          <span className="text-neutral-500">:</span>
          <dd className="text-[#202224]">{formatDate(subscription.cycleStart, locale)}</dd>
          <dt className="text-neutral-500">{ended ? t('ended') : subscription.renewalPaid ? t('renews') : t('expires')}</dt>
          <span className="text-neutral-500">:</span>
          <dd className="text-[#202224]">{formatDate(subscription.cycleEnd, locale)}</dd>
        </dl>
      ) : null}
      <div className="mt-4 space-y-1 text-sm text-ink-muted">
        {subscription.nextPlan ? (
          <p>{t('nextPlanNote', { plan: isolate(subscription.nextPlan.label), cycle: t(`cycle.${subscription.nextPlan.cycle}`) })}</p>
        ) : null}
        {subscription.renewalPaid ? <p>{t('renewalPaidNote')}</p> : null}
        {subscription.state === 'soft_locked' && subscription.dormantAt ? (
          <p className="text-danger">{t('softLockedNote', { date: formatDate(subscription.dormantAt, locale) })}</p>
        ) : null}
        {subscription.state === 'dormant' ? <p className="text-danger">{t('dormantNote')}</p> : null}
      </div>
    </div>
  );
}

function AllowanceCard({ subscription }: { subscription: Subscription }) {
  const t = useTranslations('App.billing');
  const locale = useLocale();
  const used = percent(subscription.usedBytes, subscription.allowanceBytes);
  return (
    <div className={card}>
      <p className="text-lg font-medium text-primary-900">{t('allowance')}</p>
      <p className="mt-1 text-sm text-ink-muted">{t('allowanceHelp')}</p>
      <p className="mt-8 text-xl font-semibold text-primary-500" dir="ltr">
        {formatBytes(subscription.usedBytes, locale)} / {formatBytes(subscription.allowanceBytes, locale)}
      </p>
      <div
        className="mt-3 h-[9px] overflow-hidden rounded-full bg-neutral-400"
        role="progressbar"
        aria-label={t('allowance')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={used}
      >
        <div className={`h-full rounded-full ${used >= 95 ? 'bg-danger' : 'bg-primary-500'}`} style={{ width: `${used}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink-muted">{t('allowanceUsed', { percent: used })}</p>
    </div>
  );
}

const STATE_STYLES: Record<Subscription['state'], string> = {
  trial: 'bg-[#e9dcff] text-[#5b19a8]',
  active: 'bg-[#dfffd7] text-[#368605]',
  pending_payment: 'bg-[#ffe2c8] text-[#904704]',
  soft_locked: 'bg-[#ffc2c3] text-[#820002]',
  dormant: 'bg-[#c9c9c9] text-[#404040]',
  suspended: 'bg-[#c9c9c9] text-[#404040]',
};

export function StateBadge({ state }: { state: Subscription['state'] }) {
  const t = useTranslations('App.billing.state');
  return <span className={`inline-flex h-8 items-center rounded-[7px] px-3 text-xs font-semibold ${STATE_STYLES[state]}`}>{t(state)}</span>;
}
