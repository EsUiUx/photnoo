import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BillingView } from '@/components/billing/billing-view';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.billing' });
  return { title: t('metaTitle') };
}

export default function BillingPage() {
  return <BillingView />;
}
