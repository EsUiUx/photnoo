'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Drawer, Switch } from '@/components/orders/commerce-ui';
import { ImagePicker } from '@/components/store/image-picker';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { Alert } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { useSavePrintItem } from '@/lib/queries-commerce';
import { PRINT_TYPES, type PrintItem, type PrintType } from '@/lib/types-commerce';

/** Add print (Figma 0:6402), also used to edit one. */
export function PrintDrawer({
  open,
  item,
  defaultType,
  onClose,
}: {
  open: boolean;
  item: PrintItem | null;
  defaultType?: PrintType;
  onClose: () => void;
}) {
  const t = useTranslations('App.prints.drawer');
  const save = useSavePrintItem();
  return (
    <Drawer open={open} onClose={onClose} title={item ? t('editTitle') : t('addTitle')} dismissible={!save.isPending}>
      <PrintForm key={item?.id ?? `new-${defaultType ?? ''}`} item={item} defaultType={defaultType} save={save} onDone={onClose} />
    </Drawer>
  );
}

function PrintForm({
  item,
  defaultType,
  save,
  onDone,
}: {
  item: PrintItem | null;
  defaultType?: PrintType;
  save: ReturnType<typeof useSavePrintItem>;
  onDone: () => void;
}) {
  const t = useTranslations('App.prints.drawer');
  const tType = useTranslations('App.prints.types');
  const tOrders = useTranslations('App.orders');
  const [type, setType] = useState<PrintType>(item?.type ?? defaultType ?? 'frame');
  const [name, setName] = useState(item?.name ?? '');
  const [size, setSize] = useState(item?.size ?? '');
  const [price, setPrice] = useState(item ? String(item.priceEgp) : '');
  const [available, setAvailable] = useState(item?.available ?? true);
  const [image, setImage] = useState<File | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const priceValue = Number(price.replace(/[,\s]/g, ''));
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('nameRequired');
    if (!size.trim()) next.size = t('sizeRequired');
    if (!price.trim() || !Number.isFinite(priceValue) || priceValue <= 0) next.priceEgp = t('priceInvalid');
    setErrors(next);
    setFailed(null);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({ id: item?.id, data: { type, name: name.trim(), size: size.trim(), priceEgp: priceValue, available }, image });
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.fields.length) setErrors(Object.fromEntries(error.fields.map((f) => [f.path, f.message])));
      else if (error instanceof ApiError && error.code.startsWith('image_')) setFailed(t('imageFailed'));
      else setFailed(tOrders('saveFailed'));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
      <SelectField label={t('type')} value={type} onChange={(e) => setType(e.target.value as PrintType)}>
        {PRINT_TYPES.map((value) => (
          <option key={value} value={value}>
            {tType(value)}
          </option>
        ))}
      </SelectField>
      <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder={t('namePlaceholder')} maxLength={120} autoComplete="off" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('size')} value={size} onChange={(e) => setSize(e.target.value)} error={errors.size} placeholder={t('sizePlaceholder')} maxLength={60} autoComplete="off" />
        <TextField
          label={t('price')}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.priceEgp}
          inputMode="decimal"
          ltr
          trailing={<span className="pe-3 text-sm text-fg-muted">{t('currency')}</span>}
        />
      </div>
      <ImagePicker label={t('picture')} currentUrl={item?.previewUrl ?? null} value={image} onChange={setImage} optional />
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <Switch checked={available} onChange={setAvailable} label={t('availability')} description={t('availabilityHint')} className="flex-1" />
        <Badge tone={available ? 'success' : 'neutral'}>{available ? t('available') : t('unavailable')}</Badge>
      </div>
      {failed ? <Alert>{failed}</Alert> : null}
      <Button type="submit" size="lg" pending={save.isPending} block className="sm:ms-auto sm:w-auto">
        {item ? t('save') : t('add')}
      </Button>
    </form>
  );
}
