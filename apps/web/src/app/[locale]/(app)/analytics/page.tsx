import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AnalyticsView } from '@/components/analytics/analytics-view';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.analytics' });
  return { title: t('metaTitle') };
}

export default function AnalyticsPage() {
  return <AnalyticsView />;
}
