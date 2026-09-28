import { Store } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';

/** Unknown handle or a store that is switched off: one friendly page for both. */
export default async function ShopNotFound() {
  const t = await getTranslations('Shop');
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Store size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('notFoundTitle')}</h1>
        <p className="mt-2 text-base text-fg-secondary">{t('notFoundBody')}</p>
        <ButtonLink href="/" variant="secondary" className="mt-6">
          {t('notFoundHome')}
        </ButtonLink>
      </div>
    </div>
  );
}
