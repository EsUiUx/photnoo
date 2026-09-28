import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadShop } from '@/components/store/shop-data';
import { ShopView } from '@/components/store/shop-view';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ product?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'Shop' });
  const shop = await loadShop(slug).catch(() => null);
  if (!shop) return { title: t('notFoundMeta'), robots: { index: false, follow: false } };
  const name = shop.photographer.studioName ?? shop.photographer.name;
  const cover = shop.products.find((p) => p.previewUrl)?.previewUrl;
  return {
    title: t('metaTitle', { name }),
    description: t('metaDescription', { name, count: shop.products.length }),
    openGraph: { title: t('metaTitle', { name }), description: t('metaDescription', { name, count: shop.products.length }), images: cover ? [cover] : undefined },
  };
}

/** Public shop at /p/<slug>/shop: server-rendered, mobile-first. `?product=<id>` opens one product. */
export default async function ShopPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { product } = await searchParams;
  setRequestLocale(locale);
  const shop = await loadShop(slug);
  if (!shop) notFound();
  return <ShopView slug={slug} shop={shop} initialProductId={product} />;
}
