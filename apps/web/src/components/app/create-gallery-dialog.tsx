'use client';

import { createGallerySchema, LinkDays } from '@photnoo/shared';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { type ClientChoice, clientPayload, ClientPicker } from '@/components/clients/client-picker';
import { Button, ButtonLink } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { ApiError, normalisePhone } from '@/lib/api';
import { useCreateGallery } from '@/lib/queries';

/** "gallery" opens the new gallery; "upload" lands on its upload area with the file picker ready. */
export type CreateIntent = 'gallery' | 'upload';

/**
 * New gallery (PRD P-05): name and client (existing or new), then straight into the gallery.
 * The link duration (1 to 10 days) is chosen when the gallery is shared, because the clock
 * only starts then.
 */
export function CreateGalleryDialog({ open, onClose, intent = 'gallery' }: { open: boolean; onClose: () => void; intent?: CreateIntent }) {
  const t = useTranslations('App.create');
  const create = useCreateGallery();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={intent === 'upload' ? t('titleUpload') : t('title')}
      description={intent === 'upload' ? t('descriptionUpload') : t('description')}
      dismissible={!create.isPending}
    >
      {/* Mounted only while open, so every visit starts with an empty form. */}
      <CreateGalleryForm create={create} onClose={onClose} intent={intent} />
    </Dialog>
  );
}

function CreateGalleryForm({ create, onClose, intent }: { create: ReturnType<typeof useCreateGallery>; onClose: () => void; intent: CreateIntent }) {
  const t = useTranslations('App.create');
  const tc = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const errors = useFormErrors();
  const [inactive, setInactive] = useState(false);
  const [name, setName] = useState('');
  const [client, setClient] = useState<ClientChoice>({ mode: 'search' });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setInactive(false);
    if (client.mode === 'search') {
      if (!name.trim()) errors.validate(createGallerySchema, { name });
      else errors.setFieldError('clientId', t('chooseClient'));
      return;
    }
    const input = errors.validate(createGallerySchema, { name, ...clientPayload(client, normalisePhone) });
    if (!input) return;
    try {
      const gallery = await create.mutateAsync(input);
      onClose();
      router.push(intent === 'upload' ? `/galleries/${gallery.id}?upload=1` : `/galleries/${gallery.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'subscription_inactive') {
        errors.clear();
        setInactive(true);
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setClient({ mode: 'search' });
        errors.setFieldError('clientId', t('clientGone'));
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

      <TextField
        id={errors.id('name')}
        label={t('name')}
        placeholder={t('namePlaceholder')}
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={f.name}
        autoFocus
        maxLength={80}
        autoComplete="off"
      />
      <ClientPicker
        value={client}
        onChange={(next) => {
          setClient(next);
          if (f.clientId) errors.clear();
        }}
        errors={{
          clientId: f.clientId,
          clientName: f.clientName,
          clientPhone: f.clientPhone ?? f.phone,
          clientEmail: f.clientEmail || f.email ? tErrors('field.email') : undefined,
        }}
        ids={{ search: errors.id('clientId'), name: errors.id('clientName'), phone: errors.id('clientPhone'), email: errors.id('clientEmail') }}
      />

      <p className="flex items-start gap-2 rounded-md bg-surface-subtle px-3.5 py-3 text-sm text-fg-secondary">
        <CalendarClock size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-fg-muted" />
        {t('durationNote', { min: LinkDays.min, max: LinkDays.max, days: LinkDays.default })}
      </p>

      <div className="-mx-6 mt-1 -mb-6 flex flex-wrap justify-end gap-3 rounded-b-xl border-t border-border bg-surface-subtle px-6 py-4">
        <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" pending={create.isPending}>
          {intent === 'upload' ? t('submitUpload') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
