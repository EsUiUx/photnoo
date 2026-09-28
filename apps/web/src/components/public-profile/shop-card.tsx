import { ArrowRight, Store } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Entry to the photographer's shop (built by the store area under /p/<slug>/shop). */
export async function ShopCard({ slug, name, locale }: { slug: string; name: string; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'PublicProfile' });
  return (
    <Link
      href={`/p/${slug}/shop`}
      className="group mx-auto flex w-full max-w-xl items-center gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs transition-colors duration-150 hover:border-border-strong hover:bg-surface-subtle"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
        <Store size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-fg">{t('shopTitle')}</span>
        <span className="mt-0.5 block text-sm text-fg-muted" dir="auto">
          {t('shopBody', { name })}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
        <span className="hidden sm:inline">{t('shopCta')}</span>
        <ArrowRight size={18} strokeWidth={1.75} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
      </span>
    </Link>
  );
}
