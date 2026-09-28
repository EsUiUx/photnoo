'use client';

import { emailSchema, passwordSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { FormAlert, SubmitButton, TextButton, TextField, TextLink } from './fields';
import { OtpInput } from './otp-input';
import { useFormErrors } from './use-form-errors';

type Step = 'email' | 'code' | 'password';

const passwordsSchema = z
  .object({ newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'] });

/**
 * Figma "Forgot Password?" → "We Have Sent You OTP" → "Create New Password", as three steps on
 * one page so the email and code never travel in a URL. The last step resets and signs in.
 */
export function ForgotPasswordFlow({ onStepChange }: { onStepChange: (step: Step) => void }) {
  const t = useTranslations('Reset');
  const router = useRouter();
  const errors = useFormErrors();
  const [step, setStepState] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState(false);

  function setStep(next: Step) {
    errors.clear();
    setStepState(next);
    onStepChange(next);
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
      setStep('code');
    } catch (error) {
      errors.fromError(error);
    } finally {
      setPending(false);
    }
  }

  function onCode(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      errors.setForm(t('codeIncomplete'));
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

  if (step === 'email') {
    return (
      <form onSubmit={onEmail} noValidate className="flex flex-col items-center gap-6">
        <div className="flex w-full flex-col gap-8">
          <div className="flex flex-col gap-3">
            <FormAlert message={errors.form} />
            <TextField
              label={t('email')}
              type="email"
              autoComplete="email"
              ltr
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.fields.email}
            />
          </div>
          <SubmitButton pending={pending}>{t('sendCode')}</SubmitButton>
        </div>
        <TextLink href="/login">{t('back')}</TextLink>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={onCode} noValidate className="flex flex-col items-center gap-6">
        <div className="flex w-full flex-col gap-8">
          <FormAlert message={errors.form} />
          <OtpInput value={code} onChange={setCode} label={t('codeLabel')} invalid={Boolean(errors.form)} />
          <SubmitButton>{t('confirm')}</SubmitButton>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          {resent ? (
            <p className="text-sm text-ink-muted">{t('resent')}</p>
          ) : (
            <TextButton
              onClick={() => {
                void sendCode().then(() => setResent(true), errors.fromError);
              }}
            >
              {t('resend')}
            </TextButton>
          )}
          <TextButton onClick={() => setStep('email')}>{t('changeEmail')}</TextButton>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onPassword} noValidate className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <FormAlert message={errors.form} />
        <TextField
          label={t('newPassword')}
          type="password"
          autoComplete="new-password"
          ltr
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.fields.newPassword}
        />
        <TextField
          label={t('confirmPassword')}
          type="password"
          autoComplete="new-password"
          ltr
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.fields.confirm ? t('mismatch') : undefined}
        />
      </div>
      <SubmitButton pending={pending}>{t('signIn')}</SubmitButton>
    </form>
  );
}
