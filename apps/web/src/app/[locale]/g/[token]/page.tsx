import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientGalleryApp } from '@/components/client/client-gallery-app';

type Props = { params: Promise<{ locale: string; token: string }> };

// Private links: keep them out of search engines and never leak the token as a referrer.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Client.meta' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function ClientGalleryPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return <ClientGalleryApp token={token} />;
}
