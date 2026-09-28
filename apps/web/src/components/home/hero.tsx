import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Figma "Frame 1": full-bleed photo, green-tinted gradient, headline bottom-start. */
export function Hero() {
  const t = useTranslations('Hero');
  return (
    <section id="top" className="relative isolate flex min-h-[640px] items-end overflow-hidden sm:min-h-[100svh] lg:max-h-[1080px]">
      <Image
        src="/home/hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[60%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 rtl:-scale-x-100"
        style={{ backgroundImage: 'linear-gradient(-71.28deg, rgba(0,0,0,0) 38.8%, rgb(0,43,8) 115.15%)' }}
      />
      <div className="mx-auto w-full max-w-[1920px] px-4 pb-16 sm:px-8 sm:pb-24 xl:px-[9.6%] xl:pb-[10.5%]">
        <div className="max-w-[974px] text-white">
          <h1 className="text-[40px] leading-[1.15] font-medium sm:text-[56px] xl:text-[70px]">{t('title')}</h1>
          <p className="mt-6 max-w-[880px] text-lg font-medium sm:text-2xl">{t('subtitle')}</p>
          <div className="mt-10 flex flex-wrap gap-[13px] xl:mt-14">
            <Link
              href="/login"
              className="flex h-12 w-[188px] items-center justify-center bg-primary-400 text-lg font-bold text-primary-50 hover:bg-primary-500"
            >
              {t('login')}
            </Link>
            <Link
              href="/apply"
              className="flex h-12 w-[188px] items-center justify-center border border-primary-200 bg-[rgba(231,240,232,0.27)] text-lg font-bold text-primary-50 hover:bg-[rgba(231,240,232,0.4)]"
            >
              {t('trial')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
