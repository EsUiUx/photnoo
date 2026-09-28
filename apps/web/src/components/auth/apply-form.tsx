'use client';

import { applicationSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { api, normalisePhone } from '@/lib/api';
import { TextLink } from './fields';
import { useFormErrors } from './use-form-errors';

const EMPTY = { name: '', studioName: '', city: '', phone: '', email: '', portfolioUrl: '' };

/** "Request access" (PRD P-01). Photnoo is invite-only: staff review every request. */
export function ApplyForm() {
  const t = useTranslations('Apply');
  const errors = useFormErrors();
  const [values, setValues] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const sentRef = useRef<HTMLDivElement>(null);

  // The form disappears on success; move focus to the confirmation so it is not lost.
  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  const set = (key: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const portfolio = values.portfolioUrl.trim();
    const input = errors.validate(applicationSchema, {
      ...values,
      studioName: values.studioName.trim() || undefined,
      phone: normalisePhone(values.phone),
      portfolioUrl: portfolio && !/^https?:\/\//i.test(portfolio) ? `https://${portfolio}` : portfolio,
    });
    if (!input) return;
    setPending(true);
    try {
      await api('/v1/applications', { body: input });
      setSent(true);
    } catch (error) {
      errors.fromError(error);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div ref={sentRef} tabIndex={-1} className="flex flex-col gap-6 outline-none">
        <Alert tone="success" title={t('sentTitle')}>
          {t('sent')}
        </Alert>
        <ButtonLink href="/" variant="secondary" size="lg" block>
          {t('home')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.form ? <Alert key={errors.attempt}>{errors.form}</Alert> : null}
      <div className="flex flex-col gap-5">
        <TextField
          id={errors.id('name')}
          label={t('name')}
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          error={errors.fields.name}
        />
        <TextField
          id={errors.id('studioName')}
          label={t('studio')}
          optional
          autoComplete="organization"
          value={values.studioName}
          onChange={set('studioName')}
          error={errors.fields.studioName}
        />
        <TextField
          id={errors.id('city')}
          label={t('city')}
          autoComplete="address-level2"
          value={values.city}
          onChange={set('city')}
          error={errors.fields.city}
        />
        <TextField
          id={errors.id('phone')}
          label={t('phone')}
          hint={t('phoneHint')}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          ltr
          value={values.phone}
          onChange={set('phone')}
          error={errors.fields.phone}
        />
        <TextField
          id={errors.id('email')}
          label={t('email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          ltr
          value={values.email}
          onChange={set('email')}
          error={errors.fields.email}
        />
        <TextField
          id={errors.id('portfolioUrl')}
          label={t('portfolio')}
          hint={t('portfolioHint')}
          type="url"
          inputMode="url"
          autoComplete="url"
          ltr
          value={values.portfolioUrl}
          onChange={set('portfolioUrl')}
          error={errors.fields.portfolioUrl}
        />
      </div>
      <Button type="submit" size="lg" block pending={pending}>
        {t('submit')}
      </Button>
      <p className="text-sm text-fg-muted">
        {t('haveAccount')} <TextLink href="/login">{t('login')}</TextLink>
      </p>
    </form>
  );
}
