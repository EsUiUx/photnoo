'use client';

import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckboxField, PasswordField } from '@/components/ui/field';
import { ApiError } from '@/lib/api';
import { useChangePassword } from '@/lib/queries-account';
import { SettingsSection, useRequestError } from './settings-shared';

/** Change password with the current one; optionally end every other login (auth logout-all, minus this device). */
export function SecuritySection() {
  const t = useTranslations('App.settings');
  const change = useChangePassword();
  const requestError = useRequestError();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [logoutOthers, setLogoutOthers] = useState(true);
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; text: string }>();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = t('security.required');
    if (next.length < 10) found.next = t('security.tooShort');
    setErrors(found);
    setResult(undefined);
    if (found.current || found.next) return;

    change.mutate(
      { currentPassword: current, newPassword: next, logoutOtherDevices: logoutOthers },
      {
        onSuccess: ({ otherSessionsEnded }) => {
          setCurrent('');
          setNext('');
          setResult({
            tone: 'success',
            text: otherSessionsEnded > 0 ? t('security.changedLoggedOut', { count: otherSessionsEnded }) : t('security.changed'),
          });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'wrong_password') {
            setErrors({ current: t('security.wrongCurrent') });
          } else if (error instanceof ApiError && error.status === 429) {
            setResult({ tone: 'danger', text: t('security.tooMany') });
          } else if (error instanceof ApiError && error.field('newPassword')) {
            // The server's strength rules (common passwords, email in the password, reuse).
            setErrors({ next: t('security.weak') });
          } else {
            setResult({ tone: 'danger', text: requestError(error) });
          }
        },
      },
    );
  }

  return (
    <SettingsSection id="security" title={t('security.title')} description={t('security.description')}>
      <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
        {/* Lets password managers attach the new password to the right account. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <PasswordField
          label={t('security.current')}
          value={current}
          onChange={(e) => {
            setCurrent(e.target.value);
            setErrors((x) => ({ ...x, current: undefined }));
          }}
          error={errors.current}
          autoComplete="current-password"
          required
        />
        <PasswordField
          label={t('security.new')}
          hint={t('security.newHint')}
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setErrors((x) => ({ ...x, next: undefined }));
          }}
          error={errors.next}
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          required
        />
        <CheckboxField label={t('security.logoutOthers')} checked={logoutOthers} onChange={(e) => setLogoutOthers(e.target.checked)} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p role="status" aria-live="polite" className={`me-auto text-sm font-medium ${result?.tone === 'danger' ? 'text-danger' : 'text-success'}`}>
            {result?.text}
          </p>
          <Button type="submit" icon={KeyRound} pending={change.isPending}>
            {t('security.submit')}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
