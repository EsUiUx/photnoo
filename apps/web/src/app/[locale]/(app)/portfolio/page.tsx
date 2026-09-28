import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PortfolioView } from '@/components/portfolio/portfolio-view';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.portfolio' });
  return { title: t('metaTitle') };
}

export default function PortfolioPage() {
  return <PortfolioView />;
}
