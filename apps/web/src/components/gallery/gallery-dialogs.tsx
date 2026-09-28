'use client';

import { createFolderSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { useCreateFolder, useDeleteGallery } from '@/lib/queries';
import { useMoveFiles, useUpdateFolder } from '@/lib/queries-galleries';
import type { GalleryDetail } from '@/lib/types';

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

export function RenameFolderDialog({
  galleryId,
  folder,
  onClose,
}: {
  galleryId: string;
  folder: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const t = useTranslations('App.newFolder');
  const tc = useTranslations('Common');
  const formId = useId();
  const update = useUpdateFolder(galleryId);
  return (
    <Dialog
      open={folder !== null}
      onClose={onClose}
      title={t('renameTitle')}
      size="sm"
      dismissible={!update.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form={formId} pending={update.isPending}>
            {t('rename')}
          </Button>
        </>
      }
    >
      {folder ? <RenameFolderForm formId={formId} folder={folder} update={update} onClose={onClose} /> : null}
    </Dialog>
  );
}

function RenameFolderForm({
  formId,
  folder,
  update,
  onClose,
}: {
  formId: string;
  folder: { id: string; name: string };
  update: ReturnType<typeof useUpdateFolder>;
  onClose: () => void;
}) {
  const t = useTranslations('App.newFolder');
  const errors = useFormErrors();
  const [name, setName] = useState(folder.name);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = errors.validate(createFolderSchema, { name });
    if (!input) return;
    if (input.name === folder.name) return onClose();
    try {
      await update.mutateAsync({ id: folder.id, name: input.name });
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'folder_exists') errors.setFieldError('name', t('exists'));
      else errors.fromError(error);
    }
  }

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.form ? <Alert>{errors.form}</Alert> : null}
      <TextField
        id={errors.id('name')}
        label={t('name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.fields.name}
        autoComplete="off"
        autoFocus
        maxLength={60}
        required
      />
    </form>
  );
}

/** Pick where the selected files go: the top level of the gallery or one of its folders. */
export function MoveFilesDialog({
  gallery,
  fileIds,
  onClose,
  onMoved,
}: {
  gallery: GalleryDetail;
  fileIds: string[] | null;
  onClose: () => void;
  onMoved: () => void;
}) {
  const t = useTranslations('App.gallery');
  const tc = useTranslations('Common');
  const move = useMoveFiles(gallery.id);
  const name = useId();
  const [target, setTarget] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const count = fileIds?.length ?? 0;
  // With one file, its current folder is shown as where it already is.
  const current = count === 1 ? (gallery.files.find((f) => f.id === fileIds![0])?.folderId ?? '') : null;

  function dismiss() {
    setError(null);
    setTarget('');
    onClose();
  }

  async function onMove() {
    if (!fileIds) return;
    setError(null);
    try {
      await move.mutateAsync({ fileIds, folderId: target || null });
      setTarget('');
      onMoved();
    } catch {
      setError(t('moveFailed'));
    }
  }

  const options = [{ id: '', name: t('topLevel', { gallery: gallery.name }) }, ...gallery.folders];

  return (
    <Dialog
      open={fileIds !== null}
      onClose={dismiss}
      title={t('moveTitle', { count })}
      size="sm"
      dismissible={!move.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss} disabled={move.isPending}>
            {tc('cancel')}
          </Button>
          <Button onClick={() => void onMove()} pending={move.isPending} disabled={current !== null && target === current}>
            {t('moveConfirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <Alert>{error}</Alert> : null}
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 text-sm text-fg-secondary">{t('moveTo')}</legend>
          {options.map((option) => (
            <label
              key={option.id || 'top'}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-sm text-fg hover:bg-surface-subtle has-checked:bg-brand-soft"
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={target === option.id}
                onChange={() => setTarget(option.id)}
                className="size-4 accent-brand"
              />
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              {current === option.id ? <span className="text-xs text-fg-muted">{t('currentFolder')}</span> : null}
            </label>
          ))}
        </fieldset>
      </div>
    </Dialog>
  );
}
