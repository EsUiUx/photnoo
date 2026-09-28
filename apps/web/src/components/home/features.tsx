import { CalendarClock, LockKeyhole, ReceiptText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Stagger } from '@/components/motion/reveal';
import { staggerItem } from '@/components/motion/stagger-item';

const ITEMS = [
  { key: 'private', icon: LockKeyhole },
  { key: 'window', icon: CalendarClock },
  { key: 'proof', icon: ReceiptText },
] as const;

/** The three promises from the comp, set as a quiet row rather than boxed cards. */
export function Features() {
  const t = useTranslations('Home.features');
  return (
    <section aria-labelledby="features-title" className="border-b border-border bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <h2 id="features-title" className="sr-only">
          {t('title')}
        </h2>
        <Stagger as="ul" className="grid gap-12 md:grid-cols-3 md:gap-8">
          {ITEMS.map(({ key, icon: Icon }, i) => (
            <li key={key} {...staggerItem(i)} className="flex flex-col items-center text-center md:items-start md:text-start">
              <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Icon size={24} strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{t(`${key}.title`)}</h3>
              <p className="mt-2 max-w-sm text-base leading-relaxed text-fg-muted">{t(`${key}.body`)}</p>
            </li>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
