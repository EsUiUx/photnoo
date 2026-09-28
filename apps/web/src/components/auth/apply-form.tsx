'use client';

import { applicationSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, normalisePhone } from '@/lib/api';
import { FormAlert, FormNotice, SubmitButton, TextField, TextLink } from './fields';
import { useFormErrors } from './use-form-errors';

const EMPTY = { name: '', studioName: '', city: '', phone: '', email: '', portfolioUrl: '' };

/** "Request access" (PRD P-01). No Figma frame yet; built in the style of "Join Photno Now!". */
export function ApplyForm() {
  const t = useTranslations('Apply');
  const errors = useFormErrors();
  const [values, setValues] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

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
      <div className="flex flex-col items-center gap-6 text-center">
        <FormNotice>{t('sent')}</FormNotice>
        <TextLink href="/">{t('home')}</TextLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <FormAlert message={errors.form} />
          <TextField label={t('name')} autoComplete="name" value={values.name} onChange={set('name')} error={errors.fields.name} />
          <TextField label={t('studio')} autoComplete="organization" value={values.studioName} onChange={set('studioName')} />
          <TextField label={t('city')} autoComplete="address-level2" value={values.city} onChange={set('city')} error={errors.fields.city} />
          <TextField
            label={t('phone')}
            type="tel"
            autoComplete="tel"
            ltr
            value={values.phone}
            onChange={set('phone')}
            error={errors.fields.phone}
          />
          <TextField
            label={t('email')}
            type="email"
            autoComplete="email"
            ltr
            value={values.email}
            onChange={set('email')}
            error={errors.fields.email}
          />
          <TextField
            label={t('portfolio')}
            type="url"
            inputMode="url"
            ltr
            value={values.portfolioUrl}
            onChange={set('portfolioUrl')}
            error={errors.fields.portfolioUrl}
          />
        </div>
        <SubmitButton pending={pending}>{t('submit')}</SubmitButton>
      </div>
      <p className="text-center text-lg leading-[1.4] text-ink-body">
        {t('haveAccount')} <TextLink href="/login">{t('backToLogin')}</TextLink>
      </p>
    </form>
  );
}
