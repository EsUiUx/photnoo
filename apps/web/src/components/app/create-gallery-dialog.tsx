'use client';

import { createGallerySchema } from '@photnoo/shared';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { Button, ButtonLink } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { ApiError, normalisePhone } from '@/lib/api';
import { useCreateGallery } from '@/lib/queries';

/** New gallery (PRD P-05): gallery and client details, then straight into the gallery to upload. */
export function CreateGalleryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('App.create');
  const create = useCreateGallery();
  return (
    <Dialog open={open} onClose={onClose} title={t('title')} description={t('description')} dismissible={!create.isPending}>
      {/* Mounted only while open, so every visit starts with an empty form. */}
      <CreateGalleryForm create={create} onClose={onClose} />
    </Dialog>
  );
}

function CreateGalleryForm({ create, onClose }: { create: ReturnType<typeof useCreateGallery>; onClose: () => void }) {
  const t = useTranslations('App.create');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const errors = useFormErrors();
  const [inactive, setInactive] = useState(false);
  const [values, setValues] = useState({ name: '', clientName: '', clientPhone: '', clientEmail: '' });

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setInactive(false);
    const email = values.clientEmail.trim();
    const input = errors.validate(createGallerySchema, {
      name: values.name,
      clientName: values.clientName,
      clientPhone: normalisePhone(values.clientPhone),
      clientEmail: email || undefined,
    });
    if (!input) return;
    try {
      const gallery = await create.mutateAsync(input);
      onClose();
      router.push(`/galleries/${gallery.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'subscription_inactive') {
        errors.clear();
        setInactive(true);
        return;
      }
      errors.fromError(error);
    }
  }

  const f = errors.fields;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {inactive ? (
        <Alert tone="warning" title={t('inactiveTitle')}>
          <p>{t('inactiveBody')}</p>
          <ButtonLink href="/billing" variant="secondary" size="sm" iconEnd={ArrowRight} className="mt-3" onClick={onClose}>
            {t('goToBilling')}
          </ButtonLink>
        </Alert>
      ) : null}
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}

      <TextField label={t('name')} placeholder={t('namePlaceholder')} value={values.name} onChange={set('name')} error={f.name} autoFocus maxLength={80} />
      <TextField
        label={t('client')}
        placeholder={t('clientPlaceholder')}
        value={values.clientName}
        onChange={set('clientName')}
        error={f.clientName}
        autoComplete="off"
        maxLength={100}
      />
      <TextField
        label={t('phone')}
        placeholder={t('phonePlaceholder')}
        hint={t('phoneHint')}
        value={values.clientPhone}
        onChange={set('clientPhone')}
        error={f.clientPhone ?? f.phone}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        ltr
      />
      <TextField
        label={t('email')}
        placeholder={t('emailPlaceholder')}
        value={values.clientEmail}
        onChange={set('clientEmail')}
        error={f.clientEmail || f.email ? tErrors('field.email') : undefined}
        type="email"
        inputMode="email"
        autoComplete="off"
        optional
        ltr
      />

      <div className="-mx-6 mt-1 -mb-6 flex flex-wrap justify-end gap-3 rounded-b-xl border-t border-border bg-surface-subtle px-6 py-4">
        <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" pending={create.isPending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
