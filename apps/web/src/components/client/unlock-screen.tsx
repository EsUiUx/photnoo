'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { FormAlert } from '@/components/auth/fields';
import { ApiError } from '@/lib/api';
import { type ClientSummary, clientApi, daysLeft } from '@/lib/client-api';
import { PhotographerMark } from './client-shell';

/**
 * C-01 password screen. The API enforces the limits (C-02); this page explains them and keeps
 * the button disabled while the client has to wait.
 */
export function UnlockScreen({ token, summary, onUnlocked }: { token: string; summary: ClientSummary; onUnlocked: () => void }) {
  const t = useTranslations('Client.unlock');
  const inputId = useId();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const days = daysLeft(summary.expiresAt);

  function waitFor(seconds: number) {
    setWaiting(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setWaiting(false), seconds * 1000);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      setError(t('errors.empty'));
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await clientApi.unlock(token, password.trim());
      onUnlocked();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'network_error';
      const retry = err instanceof ApiError && typeof err.details.retryAfterSeconds === 'number' ? err.details.retryAfterSeconds : 0;
      if (retry) waitFor(retry);
      const minutes = Math.max(1, Math.ceil(retry / 60));
      switch (code) {
        case 'wrong_password':
          setError(t('errors.wrong'));
          break;
        case 'slow_down':
          setError(t('errors.slowDown', { seconds: retry }));
          break;
        case 'too_many_attempts':
        case 'link_locked':
          setError(t('errors.locked', { minutes }));
          break;
        case 'gallery_unavailable':
          setError(t('errors.unavailable'));
          break;
        case 'validation_failed':
          setError(t('errors.empty'));
          break;
        default:
          setError(t('errors.generic'));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center px-6 py-12">
      <div className="flex flex-col items-center text-center">
        <PhotographerMark name={summary.photographer.name} size="lg" />
        <p className="mt-4 font-medium text-ink-muted">{summary.photographer.name}</p>
        <h1 className="mt-1 text-3xl leading-tight font-bold text-primary-900">{summary.name}</h1>
        {days !== null ? <p className="mt-2 text-sm text-ink-subtle">{t('daysLeft', { days })}</p> : null}
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-10 flex flex-col gap-4">
        <p className="text-center text-ink-body">{t('intro', { photographer: summary.photographer.name })}</p>
        <FormAlert message={error} />
        <div className="relative">
          <label htmlFor={inputId} className="sr-only">
            {t('password')}
          </label>
          <input
            id={inputId}
            type={visible ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('password')}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            dir="ltr"
            aria-invalid={error ? true : undefined}
            className="h-[53px] w-full rounded-full border border-field-border bg-white ps-6 pe-24 font-mono text-xl tracking-wider text-ink placeholder:font-sans placeholder:tracking-normal placeholder:text-[rgba(51,51,51,0.5)] focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:outline-none rtl:text-right"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="absolute inset-y-0 end-2 my-auto h-9 rounded-full px-3 text-sm font-semibold text-primary-400 hover:bg-primary-50"
          >
            {visible ? t('hide') : t('show')}
          </button>
        </div>
        <button
          type="submit"
          disabled={pending || waiting}
          aria-busy={pending || undefined}
          className="flex h-[53px] w-full items-center justify-center rounded-full bg-primary-400 text-xl font-medium text-on-primary transition-colors hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <span className="size-5 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" /> : t('open')}
        </button>
        <p className="text-center text-sm text-ink-subtle">{t('help')}</p>
      </form>
    </section>
  );
}
