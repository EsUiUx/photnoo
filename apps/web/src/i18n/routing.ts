import { defineRouting } from 'next-intl/routing';

/** Arabic is the default market language; English is the second (PRD section 10). */
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
});

export type AppLocale = (typeof routing.locales)[number];

export function direction(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
