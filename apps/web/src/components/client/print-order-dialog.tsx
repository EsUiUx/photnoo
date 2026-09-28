'use client';

import { CheckCircle2, Frame, Minus, Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextareaField, TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { type ClientFile, whatsappLink } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { clientPrintsApi } from '@/lib/queries-commerce';
import type { PrintOffer, PrintOrderReceipt } from '@/lib/types-commerce';
import { WhatsAppButton } from './client-shell';

const MAX_QUANTITY = 20;

/**
 * A client orders a print of one gallery photo. Nothing is paid here: the order reaches the
 * photographer, who contacts the client about payment and delivery.
 */
export function PrintOrderDialog({
  token,
  file,
  offer,
  photographer,
  onClose,
}: {
  token: string;
  file: ClientFile | null;
  offer: PrintOffer;
  photographer: { name: string; whatsapp: string | null };
  onClose: () => void;
}) {
  const t = useTranslations('ClientPrints');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<PrintOrderReceipt | null>(null);
  const close = () => {
    setReceipt(null);
    onClose();
  };
  return (
    <Dialog
      open={Boolean(file)}
      onClose={close}
      title={receipt ? t('doneTitle') : t('title')}
      description={receipt ? undefined : t('intro')}
      dismissible={!busy}
    >
      {file ? (
        receipt ? (
          <Success receipt={receipt} photographer={photographer} onClose={close} />
        ) : (
          <OrderForm token={token} file={file} offer={offer} onBusy={setBusy} onDone={setReceipt} onCancel={close} />
        )
      ) : null}
    </Dialog>
  );
}

function useMoney() {
  const format = useFormatter();
  const t = useTranslations('Common');
  return (amount: number) => `${format.number(amount, { numberingSystem: 'latn', maximumFractionDigits: 2 })} ${t('egp')}`;
}

function OrderForm({
  token,
  file,
  offer,
  onBusy,
  onDone,
  onCancel,
}: {
  token: string;
  file: ClientFile;
  offer: PrintOffer;
  onBusy: (busy: boolean) => void;
  onDone: (receipt: PrintOrderReceipt) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('ClientPrints');
  const tType = useTranslations('ClientPrints.types');
  const money = useMoney();
  const [itemId, setItemId] = useState(offer.items[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState(offer.customer.name ?? '');
  const [phone, setPhone] = useState(offer.customer.phone ?? '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const item = offer.items.find((i) => i.id === itemId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!item) next.item = t('chooseItem');
    if (name.trim().length < 2) next.name = t('nameRequired');
    if (phone.replace(/\D/g, '').length < 8) next.phone = t('phoneInvalid');
    setErrors(next);
    setFailed(null);
    if (Object.keys(next).length || !item) return;
    setPending(true);
    onBusy(true);
    try {
      const receipt = await clientPrintsApi.order(token, {
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim() || undefined,
        printItemId: item.id,
        fileId: file.id,
        quantity,
      });
      onDone(receipt);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'network_error';
      if (code === 'validation_failed' && error instanceof ApiError) {
        setErrors(Object.fromEntries(error.fields.map((f) => [f.path, f.path === 'phone' ? t('phoneInvalid') : f.message])));
      } else if (code === 'rate_limited') setFailed(t('rateLimited'));
      else if (code === 'print_not_found' || code === 'prints_unavailable') setFailed(t('unavailable'));
      else if (code === 'password_required' || code === 'gallery_closed') setFailed(t('sessionEnded'));
      else setFailed(t('failed'));
    } finally {
      setPending(false);
      onBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-lg bg-surface-subtle p-3">
        <span className="size-16 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
          {file.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img src={file.previewUrl} alt="" className="size-full object-cover" />
          ) : null}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-fg-muted">{t('photo')}</p>
          <p className="truncate text-sm font-medium text-fg" dir="ltr">
            {file.name}
          </p>
        </div>
      </div>

      <fieldset aria-describedby={errors.item ? 'print-item-error' : undefined}>
        <legend className="text-sm font-medium text-fg">{t('option')}</legend>
        <div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto">
          {offer.items.map((option) => {
            const checked = option.id === itemId;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors duration-150',
                  checked ? 'border-brand bg-brand-soft' : 'border-border hover:bg-surface-subtle',
                )}
              >
                <input
                  type="radio"
                  name="print-item"
                  value={option.id}
                  checked={checked}
                  onChange={() => setItemId(option.id)}
                  className="size-5 shrink-0 accent-brand"
                />
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface text-brand">
                  {option.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                    <img src={option.previewUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Frame size={18} strokeWidth={1.75} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{option.name}</span>
                  <span className="block truncate text-xs text-fg-muted">
                    {tType(option.type)} · <span dir="auto">{option.size}</span>
                  </span>
                </span>
                <span className="tabular text-sm font-semibold text-fg">{money(option.priceEgp)}</span>
              </label>
            );
          })}
        </div>
        {errors.item ? (
          <p id="print-item-error" className="mt-1.5 text-sm font-medium text-danger">
            {errors.item}
          </p>
        ) : null}
      </fieldset>

      <div>
        <p id="qty-label" className="text-sm font-medium text-fg">
          {t('quantity')}
        </p>
        <div role="group" aria-labelledby="qty-label" className="mt-1.5 flex items-center gap-3">
          <Button variant="secondary" size="md" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label={t('less')} className="w-11 px-0">
            <Minus size={18} strokeWidth={1.75} aria-hidden />
          </Button>
          <output aria-live="polite" className="tabular min-w-8 text-center text-base font-semibold text-fg">
            {quantity}
          </output>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            disabled={quantity >= MAX_QUANTITY}
            aria-label={t('more')}
            className="w-11 px-0"
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden />
          </Button>
          {item ? (
            <p className="tabular ms-auto text-sm text-fg-secondary">
              {t('total')} <span className="font-semibold text-fg">{money(item.priceEgp * quantity)}</span>
            </p>
          ) : null}
        </div>
      </div>

      <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" maxLength={100} />
      <TextField
        label={t('phone')}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errors.phone}
        hint={t('phoneHint')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        ltr
      />
      <TextareaField label={t('note')} value={note} onChange={(e) => setNote(e.target.value)} optional rows={2} maxLength={1000} placeholder={t('notePlaceholder')} />

      <p className="text-xs text-fg-muted">{t('paymentNote')}</p>
      {failed ? <Alert>{failed}</Alert> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="submit" pending={pending}>
          {t('confirm')}
        </Button>
      </div>
    </form>
  );
}

function Success({ receipt, photographer, onClose }: { receipt: PrintOrderReceipt; photographer: { name: string; whatsapp: string | null }; onClose: () => void }) {
  const t = useTranslations('ClientPrints');
  const money = useMoney();
  const wa = whatsappLink(photographer.whatsapp, t('whatsappText', { number: receipt.number }));
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-2 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-base font-semibold text-fg">{t('doneHeading', { number: receipt.number })}</p>
      <p className="max-w-sm text-sm text-fg-secondary">{t('doneBody', { photographer: photographer.name })}</p>
      <p className="tabular text-sm text-fg-muted">{t('doneTotal', { total: money(receipt.totalEgp) })}</p>
      <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {wa ? <WhatsAppButton href={wa}>{t('message', { photographer: photographer.name })}</WhatsAppButton> : null}
        <Button onClick={onClose}>{t('done')}</Button>
      </div>
    </div>
  );
}
