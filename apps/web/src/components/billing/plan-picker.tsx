'use client';

import { annualSavingPercent } from '@photnoo/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { contact } from '@/content/site';
import { ApiError } from '@/lib/api';
import { formatBytes, formatDate, isolate } from '@/lib/format';
import { useCheckout, useNextPlan } from '@/lib/queries';
import type { CatalogPlan, Cycle, Subscription } from '@/lib/types';

/**
 * B-01 plan choice: Annual pre-selected with its saving shown, one card per tier (Figma
 * "Growth"/"Studio" cards). The button on each card is whatever the API says is possible now.
 */
export function PlanPicker({ plans, subscription, paymentOpen }: { plans: CatalogPlan[]; subscription: Subscription; paymentOpen: boolean }) {
  const t = useTranslations('App.billing');
  const [cycle, setCycle] = useState<Cycle>(subscription.plan?.cycle ?? 'annual');
  const [error, setError] = useState<string>();
  const visible = plans.filter((p) => p.cycle === cycle);
  const saving = Math.max(
    0,
    ...plans
      .filter((p) => p.cycle === 'annual')
      .map((annual) => {
        const monthly = plans.find((p) => p.cycle === 'monthly' && p.tier === annual.tier);
        return monthly ? annualSavingPercent(monthly.priceEgp, annual.priceEgp) : 0;
      }),
  );
  const paid = subscription.state === 'active' && subscription.plan;

  return (
    <section aria-labelledby="plans-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="plans-title" className="text-2xl font-bold text-primary-900">
            {paid ? t('changePlan') : t('choosePlan')}
          </h2>
          <p className="mt-1 text-ink-muted">{t('plansIntro')}</p>
        </div>
        <div role="radiogroup" aria-label={t('cycleLabel')} className="flex rounded-full bg-primary-100 p-1">
          {(['annual', 'monthly'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cycle === value}
              onClick={() => setCycle(value)}
              className={`h-10 rounded-full px-5 text-sm font-semibold ${cycle === value ? 'bg-primary-400 text-white' : 'text-primary-500'}`}
            >
              {t(`cycle.${value}`)}
              {value === 'annual' && saving > 0 ? <span className="ms-2 opacity-80">{t('save', { percent: saving })}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {paymentOpen ? <p className="mt-4 rounded-xl bg-[#fff8eb] p-3 text-sm text-ink-body">{t('finishPaymentFirst')}</p> : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-bg p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-6 text-ink-muted">{t('noPlans')}</p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} subscription={subscription} paymentOpen={paymentOpen} onError={setError} />
            </li>
          ))}
          <li>
            <EnterpriseCard />
          </li>
        </ul>
      )}
    </section>
  );
}

function PlanCard({
  plan,
  subscription,
  paymentOpen,
  onError,
}: {
  plan: CatalogPlan;
  subscription: Subscription;
  paymentOpen: boolean;
  onError: (message?: string) => void;
}) {
  const t = useTranslations('App.billing');
  const locale = useLocale();
  const format = useFormatter();
  const checkout = useCheckout();
  const nextPlan = useNextPlan();
  const { offer } = plan;
  const current = subscription.plan?.id === plan.id;
  const pending = checkout.isPending || nextPlan.isPending;

  const fail = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'generic';
    onError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic'));
  };
  const buy = () => {
    onError(undefined);
    checkout.mutate(plan.id, {
      onSuccess: () => document.getElementById('payment-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      onError: fail,
    });
  };
  const schedule = (planId: string | null) => {
    onError(undefined);
    nextPlan.mutate(planId, { onError: fail });
  };

  let button: React.ReactNode;
  let note: React.ReactNode = null;
  const amount = offer.amountEgp !== undefined ? format.number(offer.amountEgp) : '';
  switch (offer.action) {
    case 'subscribe':
      button = <ActionButton onClick={buy} pending={pending} disabled={paymentOpen}>{t('actions.subscribe')}</ActionButton>;
      break;
    case 'renew':
      button = <ActionButton onClick={buy} pending={pending} disabled={paymentOpen}>{t('actions.renew', { amount })}</ActionButton>;
      break;
    case 'upgrade':
      button = <ActionButton onClick={buy} pending={pending} disabled={paymentOpen}>{t('actions.upgrade', { amount })}</ActionButton>;
      note = t('notes.upgrade', { date: formatDate(subscription.cycleEnd, locale) });
      break;
    case 'switch':
      button = (
        <ActionButton tone="outline" onClick={() => schedule(offer.reason === 'keep_current' ? null : plan.id)} pending={pending}>
          {offer.reason === 'keep_current' ? t('actions.keep') : t('actions.switch')}
        </ActionButton>
      );
      note = offer.reason === 'keep_current' ? null : t('notes.switch', { date: formatDate(subscription.cycleEnd, locale) });
      break;
    case 'scheduled':
      button = <ActionButton disabled>{t('actions.scheduled')}</ActionButton>;
      note = offer.availableFrom ? t('notes.renewOpens', { date: formatDate(offer.availableFrom, locale) }) : t('notes.renewalPaid');
      break;
    case 'current':
      button = <ActionButton disabled>{t('actions.current')}</ActionButton>;
      if (offer.availableFrom) note = t('notes.renewOpens', { date: formatDate(offer.availableFrom, locale) });
      if (offer.reason === 'renewal_paid') note = t('notes.renewalPaid');
      break;
    default:
      button = <ActionButton disabled>{t('actions.unavailable')}</ActionButton>;
      if (offer.reason === 'renewal_paid') note = t('notes.renewalPaid');
  }

  return (
    <article
      className={`flex h-full flex-col bg-primary-100 p-6 sm:p-8 ${current ? 'outline-2 -outline-offset-2 outline-primary-300' : ''}`}
      aria-label={plan.label}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-3xl font-semibold text-primary-500 sm:text-[40px]">{isolate(plan.label)}</h3>
        {current ? <span className="rounded-full bg-primary-300 px-3 py-1 text-xs font-semibold text-white">{t('yourPlan')}</span> : null}
      </div>
      <p className="mt-6 text-center font-semibold text-primary-500">
        <span className="text-6xl leading-none sm:text-[72px]">{format.number(plan.priceEgp)}</span>
        <span className="ms-1 text-3xl sm:text-4xl">{t(plan.cycle === 'annual' ? 'perYear' : 'perMonth')}</span>
      </p>
      <p className="mt-6 text-lg text-[#9da4ab]">
        {plan.cycle === 'annual'
          ? t('allowanceYear', { amount: formatBytes(plan.cycleAllowanceBytes, locale) })
          : t('allowanceMonth', { amount: formatBytes(plan.cycleAllowanceBytes, locale) })}
      </p>
      <ul className="mt-5 flex flex-col gap-3">
        {(['f1', 'f2', 'f3'] as const).map((key) => (
          <li key={key} className="flex items-center gap-3 text-[#6d747b]">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma checkmark */}
            <img src="/icons/check-dark.svg" alt="" className="size-6" />
            {t(`features.${key}`)}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col items-center gap-2 pt-8">
        {button}
        {note ? <p className="text-center text-sm text-ink-muted">{note}</p> : null}
        {offer.action === 'scheduled' && subscription.nextPlan?.id === plan.id ? (
          <button type="button" onClick={() => schedule(null)} className="text-sm font-semibold text-primary-400 underline">
            {t('actions.cancelSwitch')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function EnterpriseCard() {
  const t = useTranslations('App.billing');
  return (
    <article className="flex h-full flex-col border-2 border-dashed border-primary-200 p-6 sm:p-8" aria-label={t('enterprise.title')}>
      <h3 className="text-3xl font-semibold text-primary-500 sm:text-[40px]">{t('enterprise.title')}</h3>
      <p className="mt-6 text-lg text-[#6d747b]">{t('enterprise.body')}</p>
      <div className="mt-auto flex justify-center pt-8">
        <a
          href={`https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(t('enterprise.message'))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full max-w-[345px] items-center justify-center rounded-full border-2 border-primary-300 font-bold text-primary-400 hover:bg-primary-50"
        >
          {t('enterprise.cta')}
        </a>
      </div>
    </article>
  );
}

function ActionButton({
  children,
  onClick,
  pending,
  disabled,
  tone = 'solid',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  pending?: boolean;
  disabled?: boolean;
  tone?: 'solid' | 'outline';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`flex h-12 w-full max-w-[345px] items-center justify-center rounded-full px-4 text-lg font-bold disabled:cursor-not-allowed ${
        tone === 'solid'
          ? 'bg-primary-300 text-primary-50 hover:bg-primary-400 disabled:bg-neutral-400 disabled:text-white'
          : 'border-2 border-primary-300 text-primary-400 hover:bg-primary-50 disabled:opacity-60'
      }`}
    >
      {pending ? <span className="size-5 animate-spin rounded-full border-2 border-current/40 border-t-current" /> : children}
    </button>
  );
}
