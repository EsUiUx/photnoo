'use client';

import { emailSchema, passwordSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { PasswordField, TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { TextButton, TextLink } from './fields';
import { OtpInput } from './otp-input';
import { usePasswordHint } from './password-hint';
import { useFormErrors } from './use-form-errors';

export type Step = 'email' | 'code' | 'password';

const RESEND_COOLDOWN = 30;

const passwordsSchema = z
  .object({ newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'] });

/**
 * Three steps on one page (email → 6-digit code → new password) so the email and code never
 * travel in a URL. The last step resets and signs in.
 */
export function ForgotPasswordFlow({ onStepChange }: { onStepChange: (step: Step, email: string) => void }) {
  const t = useTranslations('Reset');
  const router = useRouter();
  const errors = useFormErrors();
  const [step, setStepState] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const passwordHint = usePasswordHint(newPassword);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function setStep(next: Step, forEmail = email) {
    errors.clear();
    setStepState(next);
    onStepChange(next, forEmail);
  }

  async function sendCode() {
    await api('/v1/auth/password-reset/request', { body: { email } });
  }

  async function onEmail(event: React.FormEvent) {
    event.preventDefault();
    const parsed = errors.validate(z.object({ email: emailSchema }), { email });
    if (!parsed) return;
    setEmail(parsed.email);
    setPending(true);
    try {
      await api('/v1/auth/password-reset/request', { body: parsed });
      setResent(false);
      setCooldown(RESEND_COOLDOWN);
      setStep('code', parsed.email);
    } catch (error) {
      errors.fromError(error);
    } finally {
      setPending(false);
    }
  }

  async function onResend() {
    setResending(true);
    setResent(false);
    try {
      await sendCode();
      setResent(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (error) {
      errors.fromError(error);
    } finally {
      setResending(false);
    }
  }

  function onCode(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      errors.setFieldError('code', t('codeIncomplete'));
      return;
    }
    setStep('password');
  }

  async function onPassword(event: React.FormEvent) {
    event.preventDefault();
    const parsed = errors.validate(passwordsSchema, { newPassword, confirm });
    if (!parsed) return;
    setPending(true);
    try {
      await api('/v1/auth/password-reset/confirm', { body: { email, code, newPassword } });
      await api('/v1/auth/login', { body: { email, password: newPassword } });
      router.replace('/dashboard');
    } catch (error) {
      setPending(false);
      if (error instanceof ApiError && error.code === 'reset_invalid') {
        setCode('');
        setStep('code');
      }
      errors.fromError(error);
    }
  }

  const formAlert = errors.form ? <Alert key={errors.attempt}>{errors.form}</Alert> : null;

  if (step === 'email') {
    return (
      <form onSubmit={onEmail} noValidate className="flex flex-col gap-6">
        {formAlert}
        <TextField
          id={errors.id('email')}
          label={t('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          ltr
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.fields.email}
        />
        <Button type="submit" size="lg" block pending={pending}>
          {t('sendCode')}
        </Button>
        <p className="text-sm text-fg-muted">
          {t('remembered')} <TextLink href="/login">{t('backToLogin')}</TextLink>
        </p>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={onCode} noValidate className="flex flex-col gap-6">
        {formAlert}
        <OtpInput
          id={errors.id('code')}
          value={code}
          onChange={setCode}
          label={t('codeLabel')}
          hint={t('codeHint')}
          error={errors.fields.code}
        />
        <Button type="submit" size="lg" block>
          {t('confirm')}
        </Button>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 text-fg-muted">
            <span>{t('noCode')}</span>
            <TextButton onClick={() => void onResend()} disabled={resending || cooldown > 0}>
              {resending ? t('resending') : cooldown > 0 ? t('resendIn', { seconds: String(cooldown) }) : t('resend')}
            </TextButton>
          </div>
          <p role="status" className="text-fg-muted">
            {resent ? t('resent') : ''}
          </p>
          <TextButton onClick={() => setStep('email')} className="self-start">
            {t('changeEmail')}
          </TextButton>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onPassword} noValidate className="flex flex-col gap-6">
      {formAlert}
      <div className="flex flex-col gap-5">
        <PasswordField
          id={errors.id('newPassword')}
          label={t('newPassword')}
          hint={passwordHint}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.fields.newPassword}
        />
        <PasswordField
          id={errors.id('confirm')}
          label={t('confirmPassword')}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.fields.confirm ? t('mismatch') : undefined}
        />
      </div>
      <Button type="submit" size="lg" block pending={pending}>
        {t('signIn')}
      </Button>
    </form>
  );
}
