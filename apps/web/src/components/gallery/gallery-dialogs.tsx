'use client';

import { createFolderSchema, updateGallerySchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { normalisePhone } from '@/lib/api';
import { useCreateFolder, useDeleteGallery, useUpdateGallery } from '@/lib/queries';
import type { GalleryDetail } from '@/lib/types';

export function EditGalleryDialog({ gallery, open, onClose }: { gallery: GalleryDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.editGallery');
  const tc = useTranslations('Common');
  const formId = useId();
  const update = useUpdateGallery(gallery.id);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('note')}
      dismissible={!update.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form={formId} pending={update.isPending}>
            {t('save')}
          </Button>
        </>
      }
    >
      {/* Dialog renders its children only while open, so the form starts from fresh values each time. */}
      <EditGalleryForm formId={formId} gallery={gallery} update={update} onClose={onClose} />
    </Dialog>
  );
}

function EditGalleryForm({
  formId,
  gallery,
  update,
  onClose,
}: {
  formId: string;
  gallery: GalleryDetail;
  update: ReturnType<typeof useUpdateGallery>;
  onClose: () => void;
}) {
  const t = useTranslations('App.editGallery');
  const errors = useFormErrors();
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
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.form ? <Alert>{errors.form}</Alert> : null}
      <TextField label={t('name')} value={values.name} onChange={set('name')} error={errors.fields.name} autoComplete="off" required />
      <TextField label={t('client')} value={values.clientName} onChange={set('clientName')} error={errors.fields.clientName} autoComplete="off" />
      <TextField
        label={t('phone')}
        type="tel"
        inputMode="tel"
        ltr
        value={values.clientPhone}
        onChange={set('clientPhone')}
        error={errors.fields.clientPhone}
        hint={t('phoneHint')}
        autoComplete="off"
      />
    </form>
  );
}

export function DeleteGalleryDialog({ gallery, open, onClose }: { gallery: GalleryDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.deleteGallery');
  const router = useRouter();
  const remove = useDeleteGallery();
  const [error, setError] = useState<string | null>(null);

  function dismiss() {
    setError(null);
    onClose();
  }

  async function onDelete() {
    setError(null);
    try {
      await remove.mutateAsync(gallery.id);
      router.replace('/galleries');
    } catch {
      setError(t('failed'));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      title={t('title', { name: gallery.name })}
      size="sm"
      dismissible={!remove.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss} disabled={remove.isPending}>
            {t('cancel')}
          </Button>
          <Button variant="danger" pending={remove.isPending} onClick={() => void onDelete()}>
            {t('confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <Alert>{error}</Alert> : null}
        <p className="text-sm text-fg-secondary">{t('body')}</p>
        <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm text-fg-secondary marker:text-fg-muted">
          <li>{t('point1')}</li>
          <li>{t('point2')}</li>
          <li>{t('point3')}</li>
        </ul>
      </div>
    </Dialog>
  );
}

export function NewFolderDialog({ galleryId, open, onClose }: { galleryId: string; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.newFolder');
  const tc = useTranslations('Common');
  const formId = useId();
  const create = useCreateFolder(galleryId);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('description')}
      size="sm"
      dismissible={!create.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form={formId} pending={create.isPending}>
            {t('create')}
          </Button>
        </>
      }
    >
      <NewFolderForm formId={formId} create={create} onClose={onClose} />
    </Dialog>
  );
}

function NewFolderForm({ formId, create, onClose }: { formId: string; create: ReturnType<typeof useCreateFolder>; onClose: () => void }) {
  const t = useTranslations('App.newFolder');
  const errors = useFormErrors();
  const [name, setName] = useState('');

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = errors.validate(createFolderSchema, { name });
    if (!input) return;
    try {
      await create.mutateAsync(input.name);
      onClose();
    } catch (error) {
      errors.fromError(error);
    }
  }

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.form ? <Alert>{errors.form}</Alert> : null}
      <TextField
        label={t('name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.fields.name}
        placeholder={t('placeholder')}
        autoComplete="off"
        autoFocus
        required
      />
    </form>
  );
}
