import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DashboardView } from '@/components/app/dashboard-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.dashboard' });
  return { title: t('metaTitle') };
}

export default function DashboardPage() {
  return <DashboardView />;
}
