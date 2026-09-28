import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';
import { ButtonLink } from '@/components/ui/button';
import photo from '../../../public/photos/family-first-look.jpg';

export function FinalCta() {
  const t = useTranslations('Home.cta');
  return (
    <section aria-labelledby="cta-title" className="bg-canvas px-4 pb-24 sm:px-6 lg:px-8">
      <div data-surface="dark" className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-xl bg-primary-900 px-6 pt-64 pb-10 text-white sm:px-12 sm:py-24 lg:px-16 lg:py-32">
        <Reveal variant="develop" className="absolute inset-0 -z-20">
          <Image src={photo} alt={t('imageAlt')} fill placeholder="blur" sizes="(min-width: 1280px) 1280px, 100vw" className="object-cover object-[70%_30%] rtl:-scale-x-100" />
        </Reveal>
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-primary-900/95 via-primary-900/50 to-transparent sm:bg-gradient-to-r sm:from-primary-900/90 sm:via-primary-900/45 sm:to-transparent rtl:sm:bg-gradient-to-l" />
        <h2 id="cta-title" className="max-w-md text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t('title')}
        </h2>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-white/85">{t('body')}</p>
        <ButtonLink href="/apply" variant="inverse" size="lg" className="mt-9">
          {t('button')}
        </ButtonLink>
      </div>
    </section>
  );
}
