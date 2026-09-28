'use client';

import { createFolderSchema, updateGallerySchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Dialog, PillButton } from '@/components/app/dialog';
import { FormAlert, TextField } from '@/components/auth/fields';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { useRouter } from '@/i18n/navigation';
import { normalisePhone } from '@/lib/api';
import { useCreateFolder, useDeleteGallery, useUpdateGallery } from '@/lib/queries';
import type { GalleryDetail } from '@/lib/types';

export function EditGalleryDialog({ gallery, open, onClose }: { gallery: GalleryDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.editGallery');
  // Dialog renders its children only while open, so the form starts from fresh values each time.
  return (
    <Dialog open={open} onClose={onClose} title={t('title')}>
      <EditGalleryForm gallery={gallery} onClose={onClose} />
    </Dialog>
  );
}

function EditGalleryForm({ gallery, onClose }: { gallery: GalleryDetail; onClose: () => void }) {
  const t = useTranslations('App.editGallery');
  const errors = useFormErrors();
  const update = useUpdateGallery(gallery.id);
  const [values, setValues] = useState({
    name: gallery.name,
    clientName: gallery.clientName ?? '',
    clientPhone: gallery.clientPhone ?? '',
  });

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = errors.validate(updateGallerySchema, { ...values, clientPhone: normalisePhone(values.clientPhone) });
    if (!input) return;
    try {
      await update.mutateAsync(input);
      onClose();
    } catch (error) {
      errors.fromError(error);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={errors.form} />
      <TextField label={t('name')} value={values.name} onChange={set('name')} error={errors.fields.name} />
      <TextField label={t('client')} value={values.clientName} onChange={set('clientName')} error={errors.fields.clientName} />
      <TextField label={t('phone')} type="tel" ltr value={values.clientPhone} onChange={set('clientPhone')} error={errors.fields.clientPhone} />
      <p className="text-sm text-ink-muted">{t('note')}</p>
      <div className="flex justify-center">
        <PillButton type="submit" pending={update.isPending}>
          {t('save')}
        </PillButton>
      </div>
    </form>
  );
}

export function DeleteGalleryDialog({ gallery, open, onClose }: { gallery: GalleryDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.deleteGallery');
  const router = useRouter();
  const remove = useDeleteGallery();
  return (
    <Dialog open={open} onClose={onClose} title={t('title')} width="max-w-[520px]">
      <div className="flex flex-col gap-4">
        <p className="text-lg text-ink-body">{t('body', { name: gallery.name })}</p>
        <ul className="list-disc space-y-1 ps-6 text-ink-muted">
          <li>{t('point1')}</li>
          <li>{t('point2')}</li>
          <li>{t('point3')}</li>
        </ul>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <PillButton tone="ghost" onClick={onClose}>
            {t('cancel')}
          </PillButton>
          <PillButton
            tone="danger"
            pending={remove.isPending}
            onClick={() => void remove.mutateAsync(gallery.id).then(() => router.replace('/galleries'))}
          >
            {t('confirm')}
          </PillButton>
        </div>
      </div>
    </Dialog>
  );
}

export function NewFolderDialog({ galleryId, open, onClose }: { galleryId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.newFolder');
  const errors = useFormErrors();
  const create = useCreateFolder(galleryId);
  const [name, setName] = useState('');

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = errors.validate(createFolderSchema, { name });
    if (!input) return;
    try {
      await create.mutateAsync(input.name);
      setName('');
      onClose();
    } catch (error) {
      errors.fromError(error);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('title')} width="max-w-[520px]">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormAlert message={errors.form} />
        <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.fields.name} autoFocus />
        <div className="flex justify-center">
          <PillButton type="submit" pending={create.isPending}>
            {t('create')}
          </PillButton>
        </div>
      </form>
    </Dialog>
  );
}
