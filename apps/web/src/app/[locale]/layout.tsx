import type { Metadata } from 'next';
import { Geist, Readex_Pro } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { direction, routing } from '@/i18n/routing';
import { SkipLink } from '@/components/ui/skip-link';
import '../globals.css';

// Geist: a precise, neutral grotesk that lets the photographs lead. Readex Pro: a matching
// geometric Arabic with the same x-height feel, so mixed ar/en lines sit on one rhythm.
const latin = Geist({
  subsets: ['latin'],
  variable: '--font-latin',
  display: 'swap',
});
const arabic = Readex_Pro({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Meta' });
  // Pages set their own title; the template keeps the brand on every tab (WCAG 2.4.2).
  return { title: { default: t('title'), template: `%s · Photnoo` }, description: t('description') };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={direction(locale)} className={`${latin.variable} ${arabic.variable}`}>
      <body className="min-h-dvh">
        <div hidden dangerouslySetInnerHTML={{ __html: '<!-- DIRECTION CONTRACT. THESIS: photographs lead, the product frames them; refuses the SaaS hero of gradient blobs and dashboard screenshots. OWN-WORLD: forest green brand (#3a5a40) on warm off-white canvas, Geist and Readex Pro, lucide icons at 1.75 stroke, 10-14px radii, quiet hairline borders, soft card shadows. STORY: an Egyptian photographer sees their work delivered beautifully, trusts the proofing and download flow, and requests access. FIRST VIEWPORT: full-bleed Cairo rooftop couple photo, headline and two CTAs on the leading side, live activity card floating trailing-bottom, transparent header over the image. FORM: canon category standard (Pixieset, Pic-Time), image-led composition B, seed 39ff7672. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->' }} />
        <NextIntlClientProvider>
          <SkipLink />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
