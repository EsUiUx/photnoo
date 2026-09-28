'use client';

import { Check } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Segmented } from '@/components/ui/primitives';
import { contact, headlineTiers, tiers } from '@/content/site';
import { cn } from '@/lib/cn';
import { isolate } from '@/lib/format';

type Cycle = 'annual' | 'monthly';

/**
 * B-01: annual pre-selected; every plan has every feature and only the yearly delivery size
 * changes, so the cards say exactly that. Prices come from content/site.ts (owner to confirm).
 */
export function Pricing() {
  const t = useTranslations('Home.pricing');
  const format = useFormatter();
  const [cycle, setCycle] = useState<Cycle>('annual');
  const shown = tiers.filter((tier) => (headlineTiers as readonly string[]).includes(tier.key));
  const others = tiers.filter((tier) => !(headlineTiers as readonly string[]).includes(tier.key));

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 border-t border-border bg-surface-subtle">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="flex flex-col items-center text-center">
          <h2 id="pricing-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-fg-muted">{t('subtitle')}</p>
          <Segmented
            className="mt-8"
            label={t('cycleLabel')}
            value={cycle}
            onChange={setCycle}
            options={[
              {
                value: 'annual',
                label: (
                  <>
                    {t('annual')}
                    <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">{t('save')}</span>
                  </>
                ),
              },
              { value: 'monthly', label: t('monthly') },
            ]}
          />
        </div>

        <ul className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-3">
          {shown.map((tier) => {
            const price = cycle === 'annual' ? tier.annualEgp : tier.monthlyEgp;
            return (
              <li
                key={tier.key}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-surface p-7 shadow-card',
                  tier.featured ? 'border-brand ring-1 ring-brand' : 'border-border',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight">{isolate(tier.label)}</h3>
                </div>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight tabular">{format.number(price)}</span>
                  <span className="text-base font-medium text-fg-secondary">
                    {cycle === 'annual' ? `EGP ${t('perYear')}` : `EGP ${t('perMonth')}`}
                  </span>
                </p>
                <p className="mt-2 text-sm text-fg-muted">{t('allowance', { amount: isolate(tier.label) })}</p>
                <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-border pt-6">
                  {(['f1', 'f2', 'f3', 'f4'] as const).map((key) => (
                    <li key={key} className="flex items-start gap-3 text-sm text-fg-secondary">
                      <Check size={16} strokeWidth={2.25} aria-hidden className="mt-0.5 shrink-0 text-brand" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <ButtonLink href="/apply" block size="lg" variant={tier.featured ? 'primary' : 'secondary'} className="mt-8">
                  {t('cta')}
                </ButtonLink>
              </li>
            );
          })}
        </ul>

        <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center gap-2 text-center text-sm text-fg-muted">
          <p>{t('more', { sizes: others.map((tier) => isolate(tier.label)).join(' · ') })}</p>
          <p>
            {t('enterprise')}{' '}
            <a href={`mailto:${contact.email}`} className="font-medium text-brand underline underline-offset-4 hover:text-brand-hover">
              {t('enterpriseCta')}
            </a>
          </p>
          <p className="mt-4 max-w-2xl">{t('note')}</p>
        </div>
      </div>
    </section>
  );
}
