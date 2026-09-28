import { useFormatter, useTranslations } from 'next-intl';
import { plans } from '@/content/site';
import { Link } from '@/i18n/navigation';

/** Figma pricing cards (Frames 1618872835-37). Prices come from content/site.ts. */
export function Pricing() {
  const t = useTranslations('Plans');
  const format = useFormatter();
  return (
    <section id="plans" className="bg-white pt-16 pb-40 lg:pt-24 lg:pb-[300px]">
      <div className="mx-auto max-w-[1920px] px-4 sm:px-8 xl:px-[9.6%]">
        <h2 className="text-4xl font-semibold text-primary-500 lg:text-5xl">{t('title')}</h2>
        <p className="mt-6 max-w-[896px] text-lg text-ink-muted lg:text-2xl">{t('subtitle')}</p>

        <ul className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
          {plans.map((plan) => {
            const dark = plan.highlighted;
            const features = [
              t('features.allowance', {
                amount: plan.allowanceGb >= 1000 ? `${plan.allowanceGb / 1000} TB` : `${plan.allowanceGb} GB`,
              }),
              t(`tiers.${plan.key}.f1`),
              t(`tiers.${plan.key}.f2`),
              t(`tiers.${plan.key}.f3`),
            ];
            return (
              <li
                key={plan.key}
                className={`flex min-h-[640px] flex-col px-7 pt-10 pb-9 xl:min-h-[855px] ${
                  dark ? 'border-[3px] border-primary-700 bg-primary-500 text-primary-50' : 'bg-primary-100 text-primary-500'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[32px] font-semibold xl:text-[40px]">{t(`tiers.${plan.key}.name`)}</h3>
                  {dark ? (
                    <span className="flex h-[51px] items-center bg-primary-300 px-6 text-lg font-extrabold text-primary-50">
                      {t('bestOffer')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-16 text-center font-semibold xl:mt-[104px]" dir="ltr">
                  <span className="text-[68px] leading-none xl:text-[84px]">{format.number(plan.priceEgp)}</span>
                  <span className="text-[40px] xl:text-[48px]">{t('perMonth')}</span>
                </p>
                <p className={`mt-16 text-xl xl:mt-[100px] xl:text-[22px] ${dark ? 'text-primary-100' : 'text-[#9da4ab]'}`}>
                  {t(`tiers.${plan.key}.description`)}
                </p>
                <ul className="mt-8 flex flex-col gap-6 xl:gap-8">
                  {features.map((feature) => (
                    <li key={feature} className={`flex items-center gap-3 text-lg font-medium xl:text-xl ${dark ? 'text-primary-200' : 'text-[#9da4ab]'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
                      <img src={dark ? '/icons/check-dark.svg' : '/icons/check-light.svg'} alt="" className="size-6 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/apply"
                  className={`mx-auto mt-auto flex h-12 w-full max-w-[287px] items-center justify-center text-lg font-bold ${
                    dark ? 'bg-primary-200 text-primary-500 hover:bg-primary-100' : 'bg-primary-400 text-primary-50 hover:bg-primary-500'
                  }`}
                >
                  {t('cta')}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
