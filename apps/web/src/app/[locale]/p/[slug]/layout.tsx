import { setRequestLocale } from 'next-intl/server';
import { PublicFooter } from '@/components/public-profile/public-footer';

type Props = { children: React.ReactNode; params: Promise<{ locale: string; slug: string }> };

/**
 * Shared frame for a photographer's public pages (/p/<slug> and /p/<slug>/shop/...): the single
 * <main id="main"> and the "Delivered with Photnoo" footer. Pages below render only their content.
 */
export default async function PublicProfileLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter locale={locale} />
    </div>
  );
}
