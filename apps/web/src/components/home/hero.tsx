import { ArrowDown, CalendarClock, Download, Eye } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { Fragment } from 'react';
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
    <>
      <section
        data-surface="dark"
        className="relative isolate flex min-h-[max(600px,100svh)] flex-col justify-end overflow-hidden bg-primary-900 text-white"
      >
        {/* Art-directed: a landscape frame from sm up, a portrait frame that keeps the couple on phones. */}
        <Image
          src={hero}
          alt={t('imageAlt')}
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="hero-develop -z-20 object-cover object-[100%_30%] max-sm:hidden rtl:-scale-x-100"
        />
        <Image
          src={heroPortrait}
          alt={t('imageAlt')}
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="hero-develop -z-20 object-cover object-[50%_20%] sm:hidden"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-primary-900/90 via-primary-900/20 to-black/25 max-sm:hidden"
        />
        {/* Phones: the couple owns the top of the frame; the copy sits on a deep fade at the bottom. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 h-[62%] bg-gradient-to-t from-primary-900 via-primary-900/85 to-transparent sm:hidden"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-black/40 to-transparent sm:hidden"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-r from-primary-900/65 via-primary-900/5 to-transparent max-sm:hidden rtl:bg-gradient-to-l"
        />

        <div className="mx-auto grid w-full max-w-7xl items-end gap-10 px-4 pt-32 pb-14 sm:px-6 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <h1
              aria-label={t('title')}
              className="text-[2.5rem] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-6xl lg:text-7xl"
            >
              {t('title')
                .split(' ')
                .map((word, i) => (
                  // Each word rises out of its own mask; the h1 label carries the sentence for screen readers.
                  <Fragment key={i}>
                    <span aria-hidden className="hero-word">
                      <span style={{ animationDelay: `${380 + i * 70}ms` }}>{word}</span>
                    </span>{' '}
                  </Fragment>
                ))}
            </h1>
            <p
              className="hero-rise mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:mt-6 sm:text-xl"
              style={{ animationDelay: '780ms' }}
            >
              {t('subtitle')}
            </p>
            <div
              className="hero-rise mt-6 flex flex-wrap gap-3 sm:mt-9"
              style={{ animationDelay: '1650ms' }}
            >
              <ButtonLink href="/apply" variant="inverse" size="lg">
                {t('primary')}
              </ButtonLink>
              <a
                href="#clients"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/60 px-5 sm:h-12 sm:px-6 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                {t('secondary')}
                <ArrowDown size={18} strokeWidth={1.75} aria-hidden />
              </a>
            </div>
          </div>
          <div className="max-sm:hidden">
            <ActivityCard />
          </div>
        </div>
        <style>{HERO_MOTION}</style>
      </section>
      {/* Phones: the proof card overlaps the photo's bottom edge instead of covering the couple. */}
      <div className="relative z-10 -mt-8 px-4 pb-2 sm:hidden">
        <ActivityCard />
      </div>
    </>
  );
}

function ActivityCard() {
  const t = useTranslations('Home.card');
  const format = useFormatter();
  const row =
    'flex items-center gap-3 text-sm text-fg-secondary opacity-0 animate-[card-row_600ms_var(--ease-out-expo)_forwards] motion-reduce:animate-none motion-reduce:opacity-100';
  return (
    <figure
      style={{ animationDelay: '1080ms' }}
      aria-label={t('label')}
      className="hero-card w-full rounded-xl bg-surface p-4 text-fg shadow-overlay ring-1 ring-black/5 sm:p-5 lg:mb-2"
    >
      <div className="flex items-center gap-3.5 border-b border-border pb-3 sm:pb-4">
        <Image
          src={thumb}
          alt=""
          width={56}
          height={56}
          className="size-12 rounded-md object-cover sm:size-14"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{t('title')}</p>
          <p className="text-sm text-fg-muted">{t('photos')}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3 pt-3 sm:gap-3.5 sm:pt-4">
        <li className={row} style={{ animationDelay: '1350ms' }}>
          <Eye size={18} strokeWidth={1.75} className="text-brand" aria-hidden />
          {t('viewed')}
        </li>
        <li className={`${row} max-sm:hidden`} style={{ animationDelay: '1500ms' }}>
          <Download size={18} strokeWidth={1.75} className="text-brand" aria-hidden />
          {t('downloaded')}
        </li>
        <li className={`${row} flex-col items-stretch gap-2`} style={{ animationDelay: '1650ms' }}>
          <span className="flex justify-between text-sm">
            <span className="text-fg-secondary">{t('allowance')}</span>
            <span className="tabular text-fg-muted">
              {t('allowanceLeft', { value: format.number(0.62, { style: 'percent' }) })}
            </span>
          </span>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-sunken">
            <span className="block h-full w-[62%] rounded-full bg-brand" />
          </span>
        </li>
        <li
          className={`${row} border-t border-border pt-3.5 max-sm:hidden`}
          style={{ animationDelay: '1800ms' }}
        >
          <CalendarClock size={18} strokeWidth={1.75} className="text-brand" aria-hidden />
          {t('open')}
        </li>
      </ul>
      <figcaption className="mt-3 text-xs text-fg-muted sm:mt-4">{t('label')}</figcaption>
      <style>{`@keyframes card-row { from { opacity: 0; transform: translateY(6px); filter: blur(2px); } to { opacity: 1; transform: none; filter: none; } }`}</style>
    </figure>
  );
}

/**
 * The page's one authored sequence (surface brief): the photograph develops out of a soft,
 * desaturated blur, the headline rises word by word, then the proof card lands and its rows
 * arrive in turn. Pure CSS, so it plays before hydration; reduced motion keeps only fades.
 */
const HERO_MOTION = `
.hero-develop { animation: hero-develop 1.8s var(--ease-out-expo) both; }
@keyframes hero-develop {
  from { filter: blur(18px) brightness(0.55) saturate(0.35); scale: 1.08; }
  55% { filter: blur(2px) brightness(0.9) saturate(0.85); }
}
.hero-word { display: inline-block; overflow: hidden; padding-block-end: 0.12em; margin-block-end: -0.12em; vertical-align: top; }
.hero-word > span { display: inline-block; animation: hero-word 900ms var(--ease-out-expo) both; }
@keyframes hero-word { from { translate: 0 105%; } }
.hero-rise { animation: hero-rise 800ms var(--ease-out-expo) both; }
@keyframes hero-rise { from { opacity: 0; translate: 0 14px; } }
.hero-card { animation: hero-card 900ms var(--ease-out-expo) both; }
@keyframes hero-card { from { opacity: 0; translate: 0 28px; scale: 0.97; filter: blur(4px); } }
@media (prefers-reduced-motion: reduce) {
  .hero-develop { animation: hero-fade 600ms ease-out both; }
  .hero-word > span { animation: hero-fade 400ms ease-out both; }
  .hero-rise, .hero-card { animation: hero-fade 400ms ease-out both; }
  @keyframes hero-fade { from { opacity: 0; } }
}
`;
