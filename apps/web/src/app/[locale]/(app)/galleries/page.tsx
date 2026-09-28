import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GalleriesView } from '@/components/app/galleries-view';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.galleries' });
  return { title: t('metaTitle') };
}

export default function GalleriesPage() {
  return <GalleriesView />;
}
