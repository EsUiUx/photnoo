import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPublicProfile } from '@/components/public-profile/data';
import { PortfolioShowcase } from '@/components/public-profile/portfolio-showcase';
import { ProfileHeader } from '@/components/public-profile/profile-header';
import { ShopCard } from '@/components/public-profile/shop-card';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'PublicProfile' });
  const profile = await getPublicProfile(slug);
  if (!profile) return { title: t('notFoundMeta'), robots: { index: false, follow: false } };
  const name = profile.studioName || profile.name;
  const description = profile.bio?.slice(0, 200) || t('metaDescription', { name, city: profile.city ?? 'none' });
  const cover = profile.items[0];
  return {
    title: t('metaTitle', { name }),
    description,
    openGraph: {
      type: 'profile',
      title: name,
      description,
      // Signed for an hour; link unfurlers fetch the image right away.
      images: cover ? [{ url: cover.previewUrl, width: cover.width ?? undefined, height: cover.height ?? undefined, alt: cover.caption ?? name }] : undefined,
    },
    twitter: { card: cover ? 'summary_large_image' : 'summary', title: name, description },
  };
}

/** A photographer's public page: identity, contact, portfolio and (when enabled) the shop. */
export default async function PublicProfilePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pt-12 pb-16 sm:gap-16 sm:px-6 sm:pt-16 lg:px-8">
      <ProfileHeader profile={profile} locale={locale} />
      {profile.storeEnabled ? <ShopCard slug={profile.slug} name={profile.studioName || profile.name} locale={locale} /> : null}
      <PortfolioShowcase items={profile.items} categories={profile.categories} />
    </div>
  );
}
