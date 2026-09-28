import { defineRouting } from 'next-intl/routing';

/** English is the primary language; Arabic is the second, with full RTL (product decision 2026-09-28). */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
});

export type AppLocale = (typeof routing.locales)[number];

export function direction(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
