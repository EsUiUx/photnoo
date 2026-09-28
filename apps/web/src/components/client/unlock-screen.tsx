'use client';

import { Clock, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { type ClientSummary, clientApi, daysLeft } from '@/lib/client-api';
import { PhotographerMark } from './client-shell';

/** Field-level problems sit under the input; waits and lockouts get an alert above the button. */
type Problem = { where: 'field'; text: string } | { where: 'alert'; text: string; tone: 'warning' | 'danger' };

/**
 * C-01 password screen. The API enforces the limits (C-02); this page explains them and keeps
 * the button disabled while the client has to wait.
 */
export function UnlockScreen({ token, summary, onUnlocked }: { token: string; summary: ClientSummary; onUnlocked: () => void }) {
  const t = useTranslations('Client.unlock');
  const fieldId = useId();
  const alertId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem>();
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const days = daysLeft(summary.expiresAt);

  useEffect(() => () => clearTimeout(timer.current), []);

  function waitFor(seconds: number) {
    setWaiting(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setWaiting(false), seconds * 1000);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      setProblem({ where: 'field', text: t('errors.empty') });
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setProblem(undefined);
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
          setProblem({ where: 'field', text: t('errors.wrong') });
          break;
        case 'validation_failed':
          setProblem({ where: 'field', text: t('errors.empty') });
          break;
        case 'slow_down':
          setProblem({ where: 'alert', tone: 'warning', text: t('errors.slowDown', { seconds: retry }) });
          break;
        case 'too_many_attempts':
        case 'link_locked':
          setProblem({ where: 'alert', tone: 'warning', text: t('errors.locked', { minutes }) });
          break;
        case 'gallery_unavailable':
          setProblem({ where: 'alert', tone: 'danger', text: t('errors.unavailable') });
          break;
        default:
          setProblem({ where: 'alert', tone: 'danger', text: t('errors.generic') });
      }
      inputRef.current?.focus();
    } finally {
      setPending(false);
    }
  }

  const fieldError = problem?.where === 'field' ? problem.text : undefined;
  const alert = problem?.where === 'alert' ? problem : undefined;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <Reveal as="section" className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-col items-center text-center">
          <PhotographerMark name={summary.photographer.name} size="lg" />
          <p className="mt-4 text-sm font-medium text-fg-secondary">{summary.photographer.name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">{summary.name}</h1>
          {days !== null ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 text-xs font-medium text-fg-secondary">
              <Clock size={16} strokeWidth={1.75} aria-hidden />
              {t('daysLeft', { days })}
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
          <p className="text-center text-base text-fg-secondary">{t('intro', { photographer: summary.photographer.name })}</p>
          <PasswordField
            ref={inputRef}
            id={fieldId}
            label={t('password')}
            hint={t('help')}
            error={fieldError}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            inputClassName="tracking-wide"
            // A wait or lockout alert is part of this field's description too.
            {...(alert ? { 'aria-describedby': `${alertId} ${fieldId}-hint` } : {})}
          />
          {alert ? (
            <div id={alertId}>
              <Alert tone={alert.tone}>{alert.text}</Alert>
            </div>
          ) : null}
          <Button type="submit" size="lg" block icon={LockKeyhole} pending={pending} disabled={waiting}>
            {t('open')}
          </Button>
        </form>
      </Reveal>
    </div>
  );
}
