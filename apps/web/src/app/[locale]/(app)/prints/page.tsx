import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PrintsView } from '@/components/prints/prints-view';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; order?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.prints' });
  return { title: t('metaTitle') };
}

/** `?tab=orders&order=<id>` opens an order directly (links from notifications). */
export default async function PrintsPage({ searchParams }: Props) {
  const { tab, order } = await searchParams;
  const initialTab = tab === 'orders' || order ? 'orders' : 'catalog';
  return <PrintsView initialTab={initialTab} initialOrderId={order} />;
}
