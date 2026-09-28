'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/** English / العربية, each named in its own language, with lang and hreflang for assistive tech. */
export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations('Common');
  const locale = useLocale();
  const pathname = usePathname();
  const names: Record<string, string> = { en: t('english'), ar: t('arabic') };

  return (
    <nav aria-label={t('language')} className={cn('flex items-center gap-1', className)}>
      {routing.locales.map((code) => {
        const current = code === locale;
        return (
          <Link
            key={code}
            href={pathname}
            locale={code}
            lang={code}
            hrefLang={code}
            aria-current={current ? 'true' : undefined}
            className={cn(
              'inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11',
              current ? 'bg-surface-subtle text-fg' : 'text-fg-muted hover:bg-surface-subtle hover:text-fg',
            )}
          >
            {names[code]}
          </Link>
        );
      })}
    </nav>
  );
}
