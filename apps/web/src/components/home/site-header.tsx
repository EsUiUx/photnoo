import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Figma "Frame 11": transparent bar over the hero with section links and two CTAs. */
export function SiteHeader() {
  const t = useTranslations('Nav');
  const otherLocale = useLocale() === 'ar' ? 'en' : 'ar';
  return (
    <header className="absolute inset-x-0 top-0 z-20 bg-[rgba(1,23,0,0.06)]">
      <div className="mx-auto flex h-[72px] max-w-[1920px] items-center justify-between gap-4 px-4 sm:px-8 lg:h-[100px] xl:ps-[5.5%] xl:pe-[6%]">
        <Link href="/" aria-label="Photnoo">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG */}
          <img src="/home/nav-logo.svg" alt="Photnoo" width={175} height={32} className="h-6 w-auto lg:h-8" />
        </Link>
        <nav aria-label={t('label')} className="hidden items-center gap-6 text-lg font-bold text-white md:flex">
          <a href="#top" className="px-2.5 py-2 hover:text-primary-200">{t('home')}</a>
          <a href="#workflow" className="px-2.5 py-2 hover:text-primary-200">{t('workflow')}</a>
          <a href="#engine" className="px-2.5 py-2 hover:text-primary-200">{t('engine')}</a>
          <a href="#plans" className="px-2.5 py-2 hover:text-primary-200">{t('plans')}</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/" locale={otherLocale} className="px-2 text-sm font-semibold text-white/85 hover:text-white">
            {t('language')}
          </Link>
          <Link
            href="/login"
            className="flex h-10 items-center justify-center bg-primary-400 px-4 text-base font-bold text-primary-50 hover:bg-primary-500 sm:h-12 sm:w-[188px] sm:text-lg"
          >
            {t('login')}
          </Link>
          {/* On phones the hero carries the trial button; the bar keeps only Login. */}
          <Link
            href="/apply"
            className="hidden h-12 w-[188px] items-center justify-center border border-primary-200 bg-[rgba(103,126,106,0.27)] text-lg font-bold text-primary-50 hover:bg-[rgba(103,126,106,0.45)] sm:flex"
          >
            {t('trial')}
          </Link>
        </div>
      </div>
    </header>
  );
}
