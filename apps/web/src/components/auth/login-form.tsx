'use client';

import { loginSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { FormAlert, SubmitButton, TextField, TextLink } from './fields';
import { useFormErrors } from './use-form-errors';

export function LoginForm() {
  const t = useTranslations('Login');
  const router = useRouter();
  const errors = useFormErrors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = errors.validate(loginSchema, { email, password });
    if (!input) return;
    setPending(true);
    try {
      await api('/v1/auth/login', { body: input });
      router.replace('/dashboard');
    } catch (error) {
      errors.fromError(error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <FormAlert message={errors.form} />
          <div className="flex flex-col gap-3">
            <TextField
              label={t('email')}
              type="email"
              autoComplete="email"
              ltr
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.fields.email}
            />
            <TextField
              label={t('password')}
              type="password"
              autoComplete="current-password"
              ltr
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.fields.password}
            />
          </div>
          <div>
            <TextLink href="/forgot-password">{t('forgot')}</TextLink>
          </div>
        </div>
        <SubmitButton pending={pending}>{t('submit')}</SubmitButton>
      </div>
      <p className="text-center text-lg leading-[1.4] text-ink-body">
        {t('noAccount')} <TextLink href="/apply">{t('apply')}</TextLink>
      </p>
    </form>
  );
}
