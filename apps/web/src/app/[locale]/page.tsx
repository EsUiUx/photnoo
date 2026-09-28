import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { ClientExperience } from '@/components/home/client-experience';
import { Faq } from '@/components/home/faq';
import { Features } from '@/components/home/features';
import { FinalCta } from '@/components/home/final-cta';
import { Hero } from '@/components/home/hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { Pricing } from '@/components/home/pricing';
import { SiteFooter } from '@/components/home/site-footer';
import { SiteHeader } from '@/components/home/site-header';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home.meta' });
  return { title: { absolute: t('title') }, description: t('description') };
}

/** Marketing homepage, approved comp `.impeccable/mocks/home-b-image-led.png`. */
export default function HomePage({ params }: Props) {
  setRequestLocale(use(params).locale);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <ClientExperience />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
