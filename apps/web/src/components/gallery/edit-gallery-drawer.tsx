'use client';

import { ExtendDays, updateGallerySchema } from '@photnoo/shared';
import { CalendarPlus, Check, Eye, ImageOff, LockKeyhole } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { galleryBadge, StatusBadge } from '@/components/app/status-badge';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { type ClientChoice, ClientPicker } from '@/components/clients/client-picker';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { Switch } from '@/components/orders/commerce-ui';
import { Drawer } from '@/components/ui/drawer';
import { controlClasses, TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { ApiError, normalisePhone } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useCloseGallery, useUpdateGallery } from '@/lib/queries';
import { useGalleryPrints, usePrintSettings, useSetGalleryPrints } from '@/lib/queries-commerce';
import { useExtendGallery } from '@/lib/queries-galleries';
import type { GalleryDetail, GalleryFile } from '@/lib/types';

const DAY = 86_400_000;

function initialClient(gallery: GalleryDetail): ClientChoice {
  if (gallery.clientId && gallery.clientName && gallery.clientPhone) {
    return { mode: 'existing', client: { id: gallery.clientId, name: gallery.clientName, phone: gallery.clientPhone, email: gallery.clientEmail } };
  }
  if (gallery.clientName || gallery.clientPhone) {
    return { mode: 'new', name: gallery.clientName ?? '', phone: gallery.clientPhone ?? '', email: gallery.clientEmail ?? '' };
  }
  return { mode: 'search' };
}

/** Edit side sheet (Figma "Edit Gallery"): cover, name, client, link expiry and status. */
export function EditGalleryDrawer({ gallery, open, onClose }: { gallery: GalleryDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.editGallery');
  const tc = useTranslations('Common');
  const formId = useId();
  const update = useUpdateGallery(gallery.id);
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('note')}
      size="lg"
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
      <EditGalleryForm formId={formId} gallery={gallery} update={update} onClose={onClose} />
    </Drawer>
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
  const tErrors = useTranslations('Errors');
  const errors = useFormErrors();
  const [name, setName] = useState(gallery.name);
  const [client, setClient] = useState<ClientChoice>(() => initialClient(gallery));
  const [cover, setCover] = useState<string | null>(gallery.coverFileId);
  const open = gallery.state === 'draft' || gallery.state === 'active';

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (client.mode === 'search') {
      errors.setFieldError('clientId', t('chooseClient'));
      return;
    }
    const clientPart =
      client.mode === 'existing'
        ? client.client.id === gallery.clientId
          ? {}
          : { clientId: client.client.id }
        : { clientName: client.name, clientPhone: normalisePhone(client.phone), clientEmail: client.email.trim() || null };
    const input = errors.validate(updateGallerySchema, {
      name,
      ...clientPart,
      ...(cover !== gallery.coverFileId && cover ? { coverFileId: cover } : {}),
    });
    if (!input) return;
    try {
      await update.mutateAsync(input);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) errors.setForm(t('saveGone'));
      else errors.fromError(error);
    }
  }

  const f = errors.fields;

  return (
    <div className="flex flex-col gap-7">
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {errors.form ? <Alert key={errors.attempt}>{errors.form}</Alert> : null}
        <CoverPicker files={gallery.files} value={cover} onChange={setCover} />
        <TextField
          id={errors.id('name')}
          label={t('name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={f.name}
          autoComplete="off"
          maxLength={80}
          required
        />
        <ClientPicker
          value={client}
          onChange={setClient}
          errors={{
            clientId: f.clientId,
            clientName: f.clientName,
            clientPhone: f.clientPhone,
            clientEmail: f.clientEmail ? tErrors('field.email') : undefined,
          }}
          ids={{ search: errors.id('clientId'), name: errors.id('clientName'), phone: errors.id('clientPhone'), email: errors.id('clientEmail') }}
        />
      </form>

      {gallery.state === 'active' ? <ExpirySection gallery={gallery} /> : null}
      {gallery.state !== 'closed' ? <PrintsSection galleryId={gallery.id} /> : null}
      <StatusSection gallery={gallery} canClose={open} onClosed={onClose} />
    </div>
  );
}

/** Radio group of the gallery's own photos; each can be opened large before choosing. */
function CoverPicker({ files, value, onChange }: { files: GalleryFile[]; value: string | null; onChange: (id: string) => void }) {
  const t = useTranslations('App.editGallery');
  const name = useId();
  const [viewing, setViewing] = useState<GalleryFile | null>(null);
  const photos = files.filter((file) => file.status === 'ready' && file.previewUrl);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-fg">{t('cover')}</legend>
      {photos.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md bg-surface-subtle px-3.5 py-3 text-sm text-fg-muted">
          <ImageOff size={18} strokeWidth={1.75} aria-hidden />
          {t('noPhotos')}
        </p>
      ) : (
        <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4">
          {photos.map((file) => {
            const checked = value === file.id;
            return (
              <li key={file.id} className="relative">
                <label
                  className={cn(
                    'block aspect-4/3 cursor-pointer overflow-hidden rounded-md bg-surface-sunken ring-offset-2 ring-offset-surface has-focus-visible:ring-2 has-focus-visible:ring-brand',
                    checked ? 'ring-2 ring-brand' : 'ring-1 ring-border',
                  )}
                >
                  <input type="radio" name={name} value={file.id} checked={checked} onChange={() => onChange(file.id)} className="sr-only" />
                  <span className="sr-only">{t('useAsCover', { name: file.name })}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                  <img src={file.previewUrl!} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                  {checked ? (
                    <span className="absolute start-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-brand text-brand-fg shadow-xs">
                      <Check size={16} strokeWidth={2} aria-hidden />
                    </span>
                  ) : null}
                </label>
                <IconButton
                  icon={Eye}
                  size="sm"
                  variant="inverse"
                  label={t('viewPhoto', { name: file.name })}
                  onClick={() => setViewing(file)}
                  className="absolute end-1 bottom-1"
                />
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.name ?? ''} size="lg">
        {viewing?.previewUrl ? (
          <div className="flex flex-col gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={viewing.previewUrl} alt={viewing.name} className="max-h-[60dvh] w-full rounded-md object-contain" />
            <div className="flex justify-end">
              <Button
                icon={Check}
                onClick={() => {
                  onChange(viewing.id);
                  setViewing(null);
                }}
              >
                {t('chooseThis')}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </fieldset>
  );
}

/** PRD P-14: an active link may be extended once, by 1 to 3 days. */
function ExpirySection({ gallery }: { gallery: GalleryDetail }) {
  const t = useTranslations('App.editGallery');
  const locale = useLocale();
  const extend = useExtendGallery(gallery.id);
  const { confirm, dialog } = useConfirm();
  const selectId = useId();
  const [days, setDays] = useState<number>(ExtendDays.max);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const expires = gallery.expiresAt ? new Date(gallery.expiresAt).getTime() : null;
  const newDate = expires ? new Date(expires + days * DAY).toISOString() : null;

  async function onExtend() {
    const ok = await confirm({
      title: t('extendTitle'),
      body: t('extendBody', { count: days, date: formatDate(newDate, locale) }),
      confirmLabel: t('extendConfirm', { count: days }),
      tone: 'primary',
    });
    if (!ok) return;
    setError(null);
    try {
      await extend.mutateAsync(days);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'already_extended' ? t('extendUsed') : t('extendFailed'));
    }
  }

  return (
    <section aria-labelledby={`${selectId}-title`} className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 id={`${selectId}-title`} className="text-base font-semibold text-fg">
        {t('expiry')}
      </h3>
      <p className="text-sm text-fg-secondary">{t('expiresOn', { date: formatDate(gallery.expiresAt, locale) })}</p>
      {error ? <Alert>{error}</Alert> : null}
      {done ? <Alert tone="success">{t('extended', { date: formatDate(gallery.expiresAt, locale) })}</Alert> : null}
      {gallery.extendedAt ? (
        !done ? <p className="text-sm text-fg-muted">{t('extendedOnce', { date: formatDate(gallery.extendedAt, locale) })}</p> : null
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5 sm:w-48">
            <label htmlFor={selectId} className="text-sm font-medium text-fg">
              {t('extendBy')}
            </label>
            <select id={selectId} value={days} onChange={(event) => setDays(Number(event.target.value))} className={controlClasses(false, 'h-11')}>
              {Array.from({ length: ExtendDays.max - ExtendDays.min + 1 }, (_, i) => ExtendDays.min + i).map((n) => (
                <option key={n} value={n}>
                  {t('days', { count: n })}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" icon={CalendarPlus} pending={extend.isPending} onClick={() => void onExtend()}>
            {t('extend')}
          </Button>
        </div>
      )}
      {!gallery.extendedAt ? <p className="text-xs text-fg-muted">{t('extendHint', { date: formatDate(newDate, locale) })}</p> : null}
      {dialog}
    </section>
  );
}

/** The status changes on its own (shared, expired, fully downloaded); the only manual step is closing early. */
function StatusSection({ gallery, canClose, onClosed }: { gallery: GalleryDetail; canClose: boolean; onClosed: () => void }) {
  const t = useTranslations('App.editGallery');
  const tShare = useTranslations('App.share');
  const close = useCloseGallery(gallery.id);
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  async function onClose() {
    const ok = await confirm({
      title: tShare('closeTitle', { name: gallery.name }),
      body: tShare('closeWarning'),
      confirmLabel: tShare('closeConfirm'),
    });
    if (!ok) return;
    setError(null);
    try {
      await close.mutateAsync();
      onClosed();
    } catch {
      setError(tShare('closeFailed'));
    }
  }

  return (
    <section aria-labelledby="edit-status-title" className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 id="edit-status-title" className="text-base font-semibold text-fg">
          {t('status')}
        </h3>
        <StatusBadge kind={galleryBadge(gallery)} />
      </div>
      <p className="text-sm text-fg-muted">{t('statusHint')}</p>
      {error ? <Alert>{error}</Alert> : null}
      {canClose ? (
        <Button variant="secondary" icon={LockKeyhole} pending={close.isPending} onClick={() => void onClose()} className="self-start text-danger">
          {tShare('closeNow')}
        </Button>
      ) : null}
      {dialog}
    </section>
  );
}

/** Per-gallery override of "offer prints in client galleries"; hidden while prints are off account-wide. */
function PrintsSection({ galleryId }: { galleryId: string }) {
  const t = useTranslations('App.editGallery');
  const settings = usePrintSettings();
  const prints = useGalleryPrints(galleryId);
  const set = useSetGalleryPrints(galleryId);
  if (!settings.data?.printsEnabled || !prints.data) return null;
  return (
    <section aria-labelledby="edit-prints-title" className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 id="edit-prints-title" className="text-base font-semibold text-fg">
        {t('printsTitle')}
      </h3>
      <Switch
        checked={set.isPending ? Boolean(set.variables) : prints.data.printsEnabled}
        onChange={(value) => set.mutate(value)}
        disabled={set.isPending}
        label={t('printsLabel')}
        description={t('printsHint')}
      />
      {set.isError ? <Alert>{t('printsFailed')}</Alert> : null}
    </section>
  );
}
