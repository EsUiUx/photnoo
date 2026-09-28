import { ImageOff } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button';

/** Unknown handle or unpublished portfolio: one friendly answer for both. */
export default async function PublicProfileNotFound() {
  const t = await getTranslations('PublicProfile');
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:py-32">
      <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
        <ImageOff size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('notFoundTitle')}</h1>
      <p className="mt-3 text-base text-fg-muted">{t('notFoundBody')}</p>
      <ButtonLink href="/" variant="secondary" className="mt-8">
        {t('home')}
      </ButtonLink>
    </div>
  );
}
