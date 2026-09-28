import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GalleryDetailView } from '@/components/gallery/gallery-detail-view';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.gallery' });
  return { title: t('metaTitle') };
}

/** The app shell provides <main id="main">; this page renders a plain root. */
export default async function GalleryPage({ params }: Props) {
  const { id } = await params;
  return <GalleryDetailView id={id} />;
}
