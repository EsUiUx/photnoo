import { ArrowDown, CalendarClock, Download, Eye } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { ButtonLink } from '@/components/ui/button';
import hero from '../../../public/photos/hero-rooftop-golden.jpg';
import heroPortrait from '../../../public/photos/hero-rooftop-golden-portrait.jpg';
import thumb from '../../../public/photos/engagement-citadel-4.jpg';

/**
 * Approved comp "B · image-led": one editorial photograph owns the first screen, the promise
 * sits bottom-start, and a floating card proves the mechanism (views, downloads, allowance,
 * days left). The card rows arrive once, in sequence: the page's one authored motion.
 */
export function Hero() {
  const t = useTranslations('Home.hero');
  return (
    <section data-surface="dark" className="relative isolate flex min-h-[max(640px,100svh)] flex-col justify-end overflow-hidden bg-primary-900 text-white">
      {/* Art-directed: a landscape frame from sm up, a portrait frame that keeps the couple on phones. */}
      <Image
        src={hero}
        alt={t('imageAlt')}
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="-z-20 object-cover object-[100%_30%] max-sm:hidden rtl:-scale-x-100"
      />
      <Image
        src={heroPortrait}
        alt={t('imageAlt')}
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="-z-20 object-cover object-[50%_20%] sm:hidden"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-primary-900/90 via-primary-900/20 to-black/25" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-primary-900/65 via-primary-900/5 to-transparent max-sm:hidden rtl:bg-gradient-to-l" />

      <div className="mx-auto grid w-full max-w-7xl items-end gap-10 px-4 pt-32 pb-12 sm:px-6 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:pb-20">
        <div className="max-w-3xl">
          <h1 className="text-5xl leading-[1.04] font-semibold tracking-[-0.03em] sm:text-6xl lg:text-7xl">{t('title')}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl">{t('subtitle')}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/apply" variant="inverse" size="lg">
              {t('primary')}
            </ButtonLink>
            <a
              href="#clients"
              className="inline-flex h-12 items-center gap-2 rounded-md border border-white/60 px-6 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              {t('secondary')}
              <ArrowDown size={18} strokeWidth={1.75} aria-hidden />
            </a>
          </div>
        </div>
        <ActivityCard />
      </div>
    </section>
  );
}

function ActivityCard() {
  const t = useTranslations('Home.card');
  const format = useFormatter();
  const row = 'flex items-center gap-3 text-sm text-fg-secondary opacity-0 animate-[card-row_600ms_var(--ease-out-expo)_forwards] motion-reduce:animate-none motion-reduce:opacity-100';
  return (
    <figure
      aria-label={t('label')}
      className="w-full rounded-xl bg-surface p-4 text-fg shadow-overlay ring-1 ring-black/5 sm:p-5 lg:mb-2"
    >
      <div className="flex items-center gap-3.5 border-b border-border pb-3 sm:pb-4">
        <Image src={thumb} alt="" width={56} height={56} className="size-12 rounded-md object-cover sm:size-14" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{t('title')}</p>
          <p className="text-sm text-fg-muted">{t('photos')}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3 pt-3 sm:gap-3.5 sm:pt-4">
        <li className={row} style={{ animationDelay: '500ms' }}>
          <Eye size={18} strokeWidth={1.75} className="text-brand" aria-hidden />
          {t('viewed')}
        </li>
        <li className={`${row} max-sm:hidden`} style={{ animationDelay: '700ms' }}>
          <Download size={18} strokeWidth={1.75} className="text-brand" aria-hidden />
          {t('downloaded')}
        </li>
        <li className={`${row} flex-col items-stretch gap-2`} style={{ animationDelay: '900ms' }}>
          <span className="flex justify-between text-sm">
            <span className="text-fg-secondary">{t('allowance')}</span>
            <span className="tabular text-fg-muted">{t('allowanceLeft', { value: format.number(0.62, { style: 'percent' }) })}</span>
          </span>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full w-[62%] rounded-full bg-brand" />
          </span>
        </li>
        <li className={`${row} border-t border-border pt-3.5 max-sm:hidden`} style={{ animationDelay: '1100ms' }}>
          <CalendarClock size={18} strokeWidth={1.75} className="text-brand" aria-hidden />
          {t('open')}
        </li>
      </ul>
      <figcaption className="mt-3 text-xs text-fg-muted sm:mt-4">{t('label')}</figcaption>
      <style>{`@keyframes card-row { from { opacity: 0; transform: translateY(6px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }`}</style>
    </figure>
  );
}
