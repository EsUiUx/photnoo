import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { EngineSection } from '@/components/home/engine-section';
import { Hero } from '@/components/home/hero';
import { Pricing } from '@/components/home/pricing';
import { SiteFooter } from '@/components/home/site-footer';
import { SiteHeader } from '@/components/home/site-header';
import { WhySection } from '@/components/home/why-section';
import { WorkflowTimeline } from '@/components/home/workflow-timeline';

type Props = { params: Promise<{ locale: string }> };

/** Homepage, Figma frame "pattern 2" (node 0:2354). */
export default function HomePage({ params }: Props) {
  setRequestLocale(use(params).locale);
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <EngineSection />
        <WorkflowTimeline />
        <Pricing />
        <WhySection />
      </main>
      <SiteFooter />
    </>
  );
}
