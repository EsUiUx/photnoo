'use client';

import { loginSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PasswordField, TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { TextLink } from './fields';
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
      {errors.form ? <Alert key={errors.attempt}>{errors.form}</Alert> : null}
      <div className="flex flex-col gap-5">
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
        <div className="flex flex-col gap-1">
          <PasswordField
            id={errors.id('password')}
            label={t('password')}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.fields.password}
          />
          <TextLink href="/forgot-password" className="inline-flex min-h-10 items-center self-end text-sm">
            {t('forgot')}
          </TextLink>
        </div>
      </div>
      <Button type="submit" size="lg" block pending={pending}>
        {t('submit')}
      </Button>
      <p className="text-sm text-fg-muted">
        {t('noAccount')} <TextLink href="/apply">{t('apply')}</TextLink>
      </p>
    </form>
  );
}
