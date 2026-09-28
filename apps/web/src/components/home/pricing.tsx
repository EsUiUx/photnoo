'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Stagger } from '@/components/motion/reveal';
import { staggerItem } from '@/components/motion/stagger-item';
import { ButtonLink, IconButton } from '@/components/ui/button';
import { Segmented } from '@/components/ui/primitives';
import { contact, tiers } from '@/content/site';
import { cn } from '@/lib/cn';
import { isolate } from '@/lib/format';

type Cycle = 'annual' | 'monthly';

/**
 * B-01: annual pre-selected; every plan has every feature and only the yearly delivery size
 * changes, so the cards say exactly that. Every size sits on one snap-scrolling rail that opens
 * on the featured plan. Prices come from content/site.ts (owner to confirm).
 */
export function Pricing() {
  const t = useTranslations('Home.pricing');
  const format = useFormatter();
  const [cycle, setCycle] = useState<Cycle>('annual');
  const featuredIndex = Math.max(0, tiers.findIndex((tier) => tier.featured));

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

        <PlanRail label={t('railLabel')} prevLabel={t('prev')} nextLabel={t('next')} count={tiers.length + 1} featuredIndex={featuredIndex}>
          {tiers.map((tier, i) => {
            const price = cycle === 'annual' ? tier.annualEgp : tier.monthlyEgp;
            return (
              <li
                key={tier.key}
                data-plan-card=""
                {...staggerItem(i)}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-surface p-6 shadow-card transition-[box-shadow,border-color] duration-200 sm:p-7 w-[82%] shrink-0 snap-center min-[480px]:w-[62%] sm:w-[44%] lg:w-[31%] xl:w-[27%]',
                  tier.featured ? 'border-brand ring-1 ring-brand' : 'border-border hover:border-border-strong',
                )}
              >
                <h3 className="text-lg font-semibold tracking-tight">{isolate(tier.label)}</h3>
                <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5">
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
          <li
            data-plan-card=""
            {...staggerItem(tiers.length)}
            className="flex flex-col rounded-xl border border-dashed border-border-strong bg-surface-subtle p-6 sm:p-7 w-[82%] shrink-0 snap-center min-[480px]:w-[62%] sm:w-[44%] lg:w-[31%] xl:w-[27%]"
          >
            <h3 className="text-lg font-semibold tracking-tight">{t('enterpriseTitle')}</h3>
            <p className="mt-5 text-2xl font-semibold tracking-tight">{t('enterprisePrice')}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">{t('enterprise')}</p>
            <ButtonLink href={`mailto:${contact.email}`} block size="lg" variant="secondary" className="mt-8">
              {t('enterpriseCta')}
            </ButtonLink>
          </li>
        </PlanRail>

        <div className="mx-auto mt-8 flex max-w-6xl flex-col items-center gap-2 text-center text-sm text-fg-muted">
          <p className="max-w-2xl">{t('note')}</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Horizontal plan rail. Native scroll with snap points (touch, trackpad, shift-wheel and arrow
 * keys all work), faded edges that show there is more, arrow buttons from md up and position
 * dots everywhere. Opens centred on the featured plan; direction-aware for Arabic.
 */
function PlanRail({
  children,
  label,
  prevLabel,
  nextLabel,
  count,
  featuredIndex,
}: {
  children: React.ReactNode;
  label: string;
  prevLabel: string;
  nextLabel: string;
  count: number;
  featuredIndex: number;
}) {
  const rail = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(featuredIndex);
  const [edges, setEdges] = useState({ start: false, end: true });

  const cards = () => Array.from(rail.current?.querySelectorAll<HTMLElement>('[data-plan-card]') ?? []);

  function scrollToCard(index: number, behavior: ScrollBehavior = 'smooth') {
    const el = rail.current;
    const card = cards()[index];
    if (!el || !card) return;
    const railBox = el.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    // Works in both directions: move by the card's offset from the rail's centre.
    const delta = cardBox.left + cardBox.width / 2 - (railBox.left + railBox.width / 2);
    el.scrollBy({ left: delta, behavior });
  }

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    // Open on the featured plan only when the rail actually overflows.
    if (el.scrollWidth > el.clientWidth + 4) scrollToCard(featuredIndex, 'instant');
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const pos = Math.abs(el.scrollLeft); // scrollLeft is negative in RTL
      const rtl = getComputedStyle(el).direction === 'rtl';
      const atStart = pos <= 8;
      const atEnd = pos >= max - 8;
      setEdges(rtl ? { start: !atStart, end: !atEnd } : { start: !atStart, end: !atEnd });
      const box = el.getBoundingClientRect();
      const center = box.left + box.width / 2;
      let best = 0;
      let bestDistance = Infinity;
      cards().forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - center);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      setActive(best);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure once on mount, then on scroll/resize
  }, []);

  const step = (delta: number) => scrollToCard(Math.min(count - 1, Math.max(0, active + delta)));
  const fade = edges.start && edges.end ? 'both' : edges.end ? 'end' : edges.start ? 'start' : 'none';

  return (
    <div className="relative mt-12">
      <Stagger as="div" className="plan-rail -mx-4 sm:-mx-6 lg:-mx-8" data-fade={fade}>
        <ul
          ref={rail}
          aria-label={label}
          tabIndex={0}
          className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto scroll-smooth px-4 pt-2 pb-6 [scrollbar-width:none] sm:scroll-px-6 sm:gap-5 sm:px-6 lg:px-8 motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
        >
          {children}
        </ul>
      </Stagger>

      <div className="mt-2 flex items-center justify-center gap-4">
        <IconButton
          label={prevLabel}
          icon={ChevronLeft}
          variant="secondary"
          onClick={() => step(-1)}
          disabled={!edges.start}
          className="max-md:hidden rtl:[&_svg]:-scale-x-100"
        />
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span
              key={i}
              className={cn('h-1.5 rounded-full transition-all duration-300 ease-[var(--ease-out-expo)]', i === active ? 'w-6 bg-brand' : 'w-1.5 bg-border-strong')}
            />
          ))}
        </div>
        <IconButton
          label={nextLabel}
          icon={ChevronRight}
          variant="secondary"
          onClick={() => step(1)}
          disabled={!edges.end}
          className="max-md:hidden rtl:[&_svg]:-scale-x-100"
        />
      </div>
      <style>{`
        .plan-rail[data-fade='both'] { mask-image: linear-gradient(to right, transparent, #000 5%, #000 95%, transparent); }
        .plan-rail[data-fade='end'] { mask-image: linear-gradient(to right, #000 90%, transparent); }
        .plan-rail[data-fade='start'] { mask-image: linear-gradient(to left, #000 90%, transparent); }
        [dir='rtl'] .plan-rail[data-fade='end'] { mask-image: linear-gradient(to left, #000 90%, transparent); }
        [dir='rtl'] .plan-rail[data-fade='start'] { mask-image: linear-gradient(to right, #000 90%, transparent); }
      `}</style>
    </div>
  );
}
