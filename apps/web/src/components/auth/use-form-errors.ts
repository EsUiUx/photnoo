'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ZodType } from 'zod';
import { ApiError } from '@/lib/api';

type FieldErrors = Record<string, string | undefined>;

/**
 * Validates with the same zod schema the API uses, then maps both client and server errors to
 * translated messages. Server wording never reaches the user; codes and field paths do.
 */
export function useFormErrors() {
  const t = useTranslations('Errors');
  const [fields, setFields] = useState<FieldErrors>({});
  const [form, setForm] = useState<string | undefined>();

  function fieldMessage(path: string): string {
    const known = ['email', 'password', 'newPassword', 'phone', 'name', 'city', 'portfolioUrl', 'code', 'clientName', 'clientPhone'];
    return known.includes(path) ? t(`field.${path}`) : t('field.generic');
  }

  function validate<T>(schema: ZodType<T>, value: unknown): T | null {
    const result = schema.safeParse(value);
    if (result.success) {
      setFields({});
      setForm(undefined);
      return result.data;
    }
    const next: FieldErrors = {};
    for (const issue of result.error.issues) {
      const path = String(issue.path[0] ?? '');
      next[path] ??= fieldMessage(path);
    }
    setFields(next);
    setForm(undefined);
    return null;
  }

  function fromError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setForm(t('generic'));
      return;
    }
    if (error.code === 'validation_failed' && error.fields.length > 0) {
      const next: FieldErrors = {};
      for (const field of error.fields) {
        next[field.path] = field.path === 'password' || field.path === 'newPassword' ? t('passwordWeak') : fieldMessage(field.path);
      }
      setFields(next);
      return;
    }
    const byCode: Record<string, string> = {
      invalid_credentials: t('invalidCredentials'),
      account_locked: t('accountLocked'),
      account_suspended: t('accountSuspended'),
      invite_invalid: t('inviteInvalid'),
      account_exists: t('accountExists'),
      reset_invalid: t('resetInvalid'),
      network_error: t('network'),
      rate_limited: t('rateLimited'),
    };
    setForm(byCode[error.code] ?? t('generic'));
  }

  function clear() {
    setFields({});
    setForm(undefined);
  }

  return { fields, form, validate, fromError, clear, setForm };
}
