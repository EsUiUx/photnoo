'use client';

import { annualSavingPercent } from '@photnoo/shared';
import { Check, Mail, MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ListStagger } from '@/components/app/app-motion';
import { staggerItem } from '@/components/motion/stagger-item';
import { contact } from '@/content/site';
import { Button, buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Card, DetailList, Segmented } from '@/components/ui/primitives';
import { Alert } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatBytes, formatDate, isolate } from '@/lib/format';
import { useCheckout, useNextPlan } from '@/lib/queries';
import type { CatalogPlan, Cycle, Subscription } from '@/lib/types';
import { useMoney, useNumber } from './billing-shared';

type PaidAction = 'subscribe' | 'renew' | 'upgrade';

/**
 * Plan choice: Annual pre-selected with its saving shown, one card per tier. The action on each
 * card is whatever the API offer says is possible now. Paid actions go through a review dialog
 * before a payment is created.
 */
export function PlanPicker({ plans, subscription, paymentOpen }: { plans: CatalogPlan[]; subscription: Subscription; paymentOpen: boolean }) {
  const t = useTranslations('App.billing');
  const number = useNumber();
  const [cycle, setCycle] = useState<Cycle>(subscription.plan?.cycle ?? 'annual');
  const [error, setError] = useState<string>();
  const [review, setReview] = useState<CatalogPlan | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const checkout = useCheckout();
  const nextPlan = useNextPlan();

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

  const message = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'generic';
    return t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic');
  };

  const schedule = (planId: string | null, cardId: string) => {
    setError(undefined);
    setBusyPlan(cardId);
    nextPlan.mutate(planId, { onError: (err) => setError(message(err)), onSettled: () => setBusyPlan(null) });
  };

  const startPayment = () => {
    if (!review) return;
    checkout.mutate(review.id, {
      onSuccess: () => {
        setReview(null);
        setError(undefined);
        requestAnimationFrame(() => document.getElementById('payment-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      },
    });
  };

  return (
    <section aria-labelledby="plans-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="plans-title" className="text-lg font-semibold text-fg">
            {paid ? t('changePlan') : t('choosePlan')}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">{t('plansIntro')}</p>
        </div>
        <Segmented
          label={t('cycleLabel')}
          value={cycle}
          onChange={setCycle}
          options={(['annual', 'monthly'] as const).map((value) => ({
            value,
            label: (
              <>
                {t(`cycle.${value}`)}
                {value === 'annual' && saving > 0 ? (
                  <Badge tone="brand" className="h-5 px-2">
                    {t('save', { percent: number(saving) })}
                  </Badge>
                ) : null}
              </>
            ),
          }))}
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 empty:hidden">
        {paymentOpen ? <Alert tone="info">{t('finishPaymentFirst')}</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}
      </div>

      {visible.length === 0 ? (
        <Card className="mt-5 p-6">
          <p className="text-sm text-fg-muted">{t('noPlans')}</p>
        </Card>
      ) : null}
      <ListStagger className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((plan, index) => (
          <li key={plan.id} {...staggerItem(index)}>
            <PlanCard
              plan={plan}
              subscription={subscription}
              paymentOpen={paymentOpen}
              busy={busyPlan === plan.id}
              locked={checkout.isPending || nextPlan.isPending}
              onReview={() => {
                setError(undefined);
                checkout.reset();
                setReview(plan);
              }}
              onSchedule={(planId) => schedule(planId, plan.id)}
            />
          </li>
        ))}
        <li {...staggerItem(visible.length)}>
          <EnterpriseCard />
        </li>
      </ListStagger>

      <ReviewDialog
        plan={review}
        subscription={subscription}
        pending={checkout.isPending}
        error={checkout.isError ? message(checkout.error) : undefined}
        onClose={() => setReview(null)}
        onContinue={startPayment}
      />
    </section>
  );
}

function PlanCard({
  plan,
  subscription,
  paymentOpen,
  busy,
  locked,
  onReview,
  onSchedule,
}: {
  plan: CatalogPlan;
  subscription: Subscription;
  paymentOpen: boolean;
  busy: boolean;
  locked: boolean;
  onReview: () => void;
  onSchedule: (planId: string | null) => void;
}) {
  const t = useTranslations('App.billing');
  const locale = useLocale();
  const money = useMoney();
  const { offer } = plan;
  const current = subscription.plan?.id === plan.id;
  const amount = money(offer.amountEgp ?? plan.priceEgp);
  const renewalDate = formatDate(subscription.cycleEnd, locale);

  let action: React.ReactNode;
  let note: React.ReactNode = null;
  switch (offer.action) {
    case 'subscribe':
      action = (
        <Button block onClick={onReview} disabled={paymentOpen || locked}>
          {t('actions.subscribe')}
        </Button>
      );
      break;
    case 'renew':
      action = (
        <Button block onClick={onReview} disabled={paymentOpen || locked}>
          {t('actions.renew', { amount })}
        </Button>
      );
      break;
    case 'upgrade':
      action = (
        <Button block onClick={onReview} disabled={paymentOpen || locked}>
          {t('actions.upgrade', { amount })}
        </Button>
      );
      note = t('notes.upgrade', { date: renewalDate });
      break;
    case 'switch': {
      const keep = offer.reason === 'keep_current';
      action = (
        <Button block variant="secondary" pending={busy} disabled={locked && !busy} onClick={() => onSchedule(keep ? null : plan.id)}>
          {keep ? t('actions.keep') : t('actions.switch')}
        </Button>
      );
      note = keep ? null : t('notes.switch', { date: renewalDate });
      break;
    }
    case 'scheduled':
      action = (
        <Button block variant="secondary" disabled>
          {t('actions.scheduled')}
        </Button>
      );
      note = offer.availableFrom ? t('notes.renewOpens', { date: formatDate(offer.availableFrom, locale) }) : t('notes.renewalPaid');
      break;
    case 'current':
      action = (
        <Button block variant="secondary" disabled>
          {t('actions.current')}
        </Button>
      );
      if (offer.availableFrom) note = t('notes.renewOpens', { date: formatDate(offer.availableFrom, locale) });
      if (offer.reason === 'renewal_paid') note = t('notes.renewalPaid');
      break;
    default:
      action = (
        <Button block variant="secondary" disabled>
          {t('actions.unavailable')}
        </Button>
      );
      if (offer.reason === 'renewal_paid') note = t('notes.renewalPaid');
  }

  return (
    <Card as="article" className={cn('flex h-full flex-col p-6', current && 'border-brand ring-1 ring-brand')}>
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-fg">{isolate(plan.label)}</h3>
        {current ? (
          <Badge tone="brand" dot>
            {t('yourPlan')}
          </Badge>
        ) : null}
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1">
        <span className="text-3xl font-semibold tracking-tight text-fg tabular">{money(plan.priceEgp)}</span>
        <span className="text-sm text-fg-muted">{t(plan.cycle === 'annual' ? 'perYear' : 'perMonth')}</span>
      </p>
      <p className="mt-2 text-sm text-fg-secondary">
        {plan.cycle === 'annual'
          ? t('allowanceYear', { amount: formatBytes(plan.cycleAllowanceBytes, locale) })
          : t('allowanceMonth', { amount: formatBytes(plan.cycleAllowanceBytes, locale) })}
      </p>
      <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-5">
        {(['f1', 'f2', 'f3'] as const).map((key) => (
          <li key={key} className="flex items-start gap-2.5 text-sm text-fg-secondary">
            <Check size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-brand" />
            {t(`features.${key}`)}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        {action}
        {note ? <p className="text-center text-xs text-fg-muted">{note}</p> : null}
        {offer.action === 'scheduled' && subscription.nextPlan?.id === plan.id ? (
          <Button variant="ghost" size="sm" pending={busy} disabled={locked && !busy} onClick={() => onSchedule(null)}>
            {t('actions.cancelSwitch')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function ReviewDialog({
  plan,
  subscription,
  pending,
  error,
  onClose,
  onContinue,
}: {
  plan: CatalogPlan | null;
  subscription: Subscription;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations('App.billing');
  const tr = useTranslations('App.billing.review');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const money = useMoney();
  const action = plan?.offer.action as PaidAction | undefined;
  const renewalDate = formatDate(subscription.cycleEnd, locale);

  return (
    <Dialog
      open={Boolean(plan)}
      onClose={onClose}
      dismissible={!pending}
      title={tr('title')}
      description={tr('description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tc('cancel')}
          </Button>
          <Button onClick={onContinue} pending={pending} autoFocus>
            {tr('continue')}
          </Button>
        </>
      }
    >
      {plan && action ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-surface-subtle p-4">
            <DetailList
              items={[
                { label: tr('plan'), value: isolate(plan.label) },
                { label: tr('cycle'), value: t(`cycle.${plan.cycle}`) },
                {
                  label: tr('allowance'),
                  value:
                    plan.cycle === 'annual'
                      ? t('allowanceYear', { amount: formatBytes(plan.cycleAllowanceBytes, locale) })
                      : t('allowanceMonth', { amount: formatBytes(plan.cycleAllowanceBytes, locale) }),
                },
                {
                  label: tr('amount'),
                  value: <span className="text-base font-semibold tabular">{money(plan.offer.amountEgp ?? plan.priceEgp)}</span>,
                },
              ]}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">{tr('whatHappens')}</p>
            <p className="mt-1 text-sm text-fg-secondary">
              {action === 'upgrade' ? tr('upgrade', { date: renewalDate }) : action === 'renew' ? tr('renew', { date: renewalDate }) : tr('subscribe')}
            </p>
          </div>
          {error ? <Alert>{error}</Alert> : null}
        </div>
      ) : null}
    </Dialog>
  );
}

function EnterpriseCard() {
  const t = useTranslations('App.billing.enterprise');
  const whatsapp = `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(t('message'))}`;
  const email = `mailto:${contact.email}?subject=${encodeURIComponent(t('subject'))}`;
  return (
    <Card as="article" className="flex h-full flex-col bg-surface-subtle p-6">
      <h3 className="text-base font-semibold text-fg">{t('title')}</h3>
      <p className="mt-4 text-xl font-semibold tracking-tight text-fg">{t('price')}</p>
      <p className="mt-2 text-sm text-fg-secondary">{t('body')}</p>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'secondary', block: true })}>
          <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
          {t('whatsapp')}
        </a>
        <a href={email} className={buttonClasses({ variant: 'ghost', block: true })}>
          <Mail size={18} strokeWidth={1.75} aria-hidden />
          {t('email')}
        </a>
      </div>
    </Card>
  );
}
