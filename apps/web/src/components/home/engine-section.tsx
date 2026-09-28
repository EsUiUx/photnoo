import Image from 'next/image';
import { useTranslations } from 'next-intl';

const MODULES = ['galleries', 'websiteBuilder', 'store', 'prints'] as const;

/**
 * Figma "Frame 15": product modules on the start side, dashboard mockup on the end side.
 * Only Galleries ships in v1 (PRD section 3); the other modules are labelled "coming soon".
 */
export function EngineSection() {
  const t = useTranslations('Engine');
  return (
    <section id="engine" className="relative overflow-hidden bg-white py-16 lg:py-24">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative export */}
      <img
        src="/home/engine-pattern.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute end-0 top-0 hidden h-full w-auto opacity-90 lg:block rtl:-scale-x-100"
      />
      <div className="relative mx-auto max-w-[1920px] px-4 sm:px-8 xl:px-[9.6%]">
        <h2 className="text-4xl font-semibold text-primary-500 lg:text-5xl">{t('title')}</h2>
        <p className="mt-6 max-w-[896px] text-lg font-medium text-ink-muted lg:text-2xl">{t('subtitle')}</p>

        <div className="mt-12 flex flex-col gap-10 lg:mt-16 lg:flex-row lg:items-center lg:gap-12">
          <ul className="flex shrink-0 flex-row flex-wrap gap-x-8 gap-y-4 lg:w-[240px] lg:flex-col lg:gap-[72px]">
            {MODULES.map((key, index) => {
              const live = index === 0;
              return (
                <li key={key}>
                  <p className={`text-2xl font-medium lg:text-[32px] ${live ? 'text-primary-400' : 'text-neutral-500'}`}>
                    {t(`modules.${key}`)}
                  </p>
                  {live ? (
                    <div aria-hidden="true" className="mt-4 hidden flex-col gap-[26px] lg:flex">
                      <span className="h-0.5 w-11 bg-primary-300" />
                      <span className="h-0.5 w-[72px] bg-primary-300" />
                      <span className="h-0.5 w-11 bg-primary-300" />
                    </div>
                  ) : (
                    <p className="mt-1 text-sm font-semibold tracking-wide text-primary-300 uppercase">{t('soon')}</p>
                  )}
                </li>
              );
            })}
          </ul>
          <figure className="min-w-0 flex-1">
            <Image
              src="/home/engine-mockup.png"
              alt={t('mockupAlt')}
              width={1349}
              height={788}
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="h-auto w-full rounded-card shadow-[0_24px_60px_rgba(20,32,27,0.18)]"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
