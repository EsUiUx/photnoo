import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ClientsView } from '@/components/clients/clients-view';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.clients' });
  return { title: t('metaTitle') };
}

export default function ClientsPage() {
  return <ClientsView />;
}
