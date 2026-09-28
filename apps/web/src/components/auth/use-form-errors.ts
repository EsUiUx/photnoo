'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import type { ZodType } from 'zod';
import { ApiError } from '@/lib/api';

type FieldErrors = Record<string, string | undefined>;

/**
 * Validates with the same zod schema the API uses, then maps both client and server errors to
 * translated messages. Server wording never reaches the user; codes and field paths do.
 *
 * Focus: give each control `id={errors.id('email')}`. After a failed submit, focus moves to the
 * first invalid control in document order, so its label and error are read out together.
 * `attempt` increases on every failure; use it as the `key` of the form-level Alert so the same
 * message is announced again on a repeat failure.
 */
export function useFormErrors() {
  const t = useTranslations('Errors');
  const prefix = useId();
  const [fields, setFields] = useState<FieldErrors>({});
  const [form, setFormState] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);

  const id = useCallback((name: string) => `${prefix}-${name}`, [prefix]);

  const focusFirstInvalid = useCallback(
    (errorFields: FieldErrors = fields) => {
      if (typeof document === 'undefined') return false;
      const elements = Object.keys(errorFields)
        .filter((name) => errorFields[name])
        .map((name) => document.getElementById(id(name)))
        .filter((element): element is HTMLElement => element !== null);
      if (elements.length === 0) return false;
      elements.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      elements[0].focus();
      return true;
    },
    [fields, id],
  );

  // Runs after the error text has rendered, so aria-describedby already points at it.
  useEffect(() => {
    if (focusRequest > 0) focusFirstInvalid();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new failed submit
  }, [focusRequest]);

  function fail(nextFields: FieldErrors, nextForm: string | undefined) {
    setFields(nextFields);
    setFormState(nextForm);
    setAttempt((n) => n + 1);
    if (Object.values(nextFields).some(Boolean)) setFocusRequest((n) => n + 1);
  }

  function fieldMessage(path: string): string {
    const known = ['email', 'password', 'newPassword', 'phone', 'name', 'city', 'portfolioUrl', 'code', 'clientName', 'clientPhone'];
    return known.includes(path) ? t(`field.${path}`) : t('field.generic');
  }

  function validate<T>(schema: ZodType<T>, value: unknown): T | null {
    const result = schema.safeParse(value);
    if (result.success) {
      setFields({});
      setFormState(undefined);
      return result.data;
    }
    const next: FieldErrors = {};
    for (const issue of result.error.issues) {
      const path = String(issue.path[0] ?? '');
      next[path] ??= fieldMessage(path);
    }
    fail(next, undefined);
    return null;
  }

  function fromError(error: unknown) {
    if (!(error instanceof ApiError)) {
      fail({}, t('generic'));
      return;
    }
    if (error.code === 'validation_failed' && error.fields.length > 0) {
      const next: FieldErrors = {};
      for (const field of error.fields) {
        next[field.path] = field.path === 'password' || field.path === 'newPassword' ? t('passwordWeak') : fieldMessage(field.path);
      }
      fail(next, undefined);
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
      subscription_inactive: t('subscriptionInactive'),
    };
    fail({}, byCode[error.code] ?? t('generic'));
  }

  /** Shows a form-level message (announced by the Alert that renders it). */
  function setForm(message: string | undefined) {
    if (message) fail({}, message);
    else setFormState(undefined);
  }

  /** Marks one field invalid with a custom message and moves focus to it. */
  function setFieldError(path: string, message: string) {
    fail({ [path]: message }, undefined);
  }

  function clear() {
    setFields({});
    setFormState(undefined);
  }

  return { fields, form, attempt, id, validate, fromError, clear, setForm, setFieldError, focusFirstInvalid };
}
