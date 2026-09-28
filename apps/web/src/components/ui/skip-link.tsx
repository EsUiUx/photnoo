import { useTranslations } from 'next-intl';

/** First focusable element on every page (WCAG 2.4.1). Every page renders <main id="main">. */
export function SkipLink() {
  const t = useTranslations('Meta');
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-fg focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100]"
    >
      {t('skip')}
    </a>
  );
}
