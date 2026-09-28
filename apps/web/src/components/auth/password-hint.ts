'use client';

import { useTranslations } from 'next-intl';

export const MIN_PASSWORD_LENGTH = 10;

/**
 * Live strength hint for a new password: the rule before typing, how many characters are still
 * missing while typing, and a confirmation once the length rule is met. The API still has the
 * final say (common and email-like passwords are rejected server side).
 */
export function usePasswordHint(value: string): string {
  const t = useTranslations('AuthShell.password');
  if (value.length === 0) return t('rule');
  const remaining = MIN_PASSWORD_LENGTH - value.length;
  if (remaining > 0) return t('remaining', { remaining, n: String(remaining) });
  return t('ok');
}
