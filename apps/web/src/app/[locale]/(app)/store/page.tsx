import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StoreView } from '@/components/store/store-view';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; order?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.store' });
  return { title: t('metaTitle') };
}

/** `?tab=orders&order=<id>` opens an order directly (links from notifications). */
export default async function StorePage({ searchParams }: Props) {
  const { tab, order } = await searchParams;
  const initialTab = tab === 'orders' || order ? 'orders' : 'products';
  return <StoreView initialTab={initialTab} initialOrderId={order} />;
}
