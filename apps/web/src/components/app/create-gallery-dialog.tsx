'use client';

import { createGallerySchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormAlert } from '@/components/auth/fields';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { useRouter } from '@/i18n/navigation';
import { normalisePhone } from '@/lib/api';
import { useCreateGallery } from '@/lib/queries';
import { Dialog, PillButton } from './dialog';

/** Figma "Creating New Gallery" (PRD P-05). Opens the new gallery so uploads can start. */
export function CreateGalleryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('App.create');
  const router = useRouter();
  const errors = useFormErrors();
  const create = useCreateGallery();
  const [values, setValues] = useState({ name: '', clientName: '', clientPhone: '' });

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = errors.validate(createGallerySchema, { ...values, clientPhone: normalisePhone(values.clientPhone) });
    if (!input) return;
    try {
      const gallery = await create.mutateAsync(input);
      setValues({ name: '', clientName: '', clientPhone: '' });
      onClose();
      router.push(`/galleries/${gallery.id}`);
    } catch (error) {
      errors.fromError(error);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('title')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <FormAlert message={errors.form} />
        <Field label={t('name')} placeholder={t('namePlaceholder')} value={values.name} onChange={set('name')} error={errors.fields.name} />
        <Field label={t('client')} placeholder={t('clientPlaceholder')} value={values.clientName} onChange={set('clientName')} error={errors.fields.clientName} />
        <Field
          label={t('phone')}
          placeholder={t('phonePlaceholder')}
          value={values.clientPhone}
          onChange={set('clientPhone')}
          error={errors.fields.clientPhone ?? errors.fields.phone}
          type="tel"
          ltr
        />
        <p className="text-base text-ink-muted">{t('expiryNote')}</p>
        <div className="flex justify-center">
          <PillButton type="submit" pending={create.isPending}>
            {t('submit')}
          </PillButton>
        </div>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  error,
  ltr,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; ltr?: boolean }) {
  return (
    <label className="flex flex-col gap-3">
      <span className="text-xl font-medium text-[#6c757d]">{label}</span>
      <input
        {...input}
        dir={ltr ? 'ltr' : undefined}
        aria-invalid={error ? true : undefined}
        className={`h-[53px] rounded-[23px] border bg-white px-[22px] text-lg text-ink placeholder:text-neutral-500 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:outline-none rtl:text-right ${
          error ? 'border-danger' : 'border-field-border'
        }`}
      />
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </label>
  );
}
