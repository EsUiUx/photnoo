'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Drawer, Switch } from '@/components/orders/commerce-ui';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { TextareaField, TextField } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { Alert } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { useDeleteProduct, useSaveProduct } from '@/lib/queries-commerce';
import type { Product } from '@/lib/types-commerce';
import { ImagePicker } from './image-picker';

/** Add product (Figma 0:6370) and Edit product (0:6425 / 0:6455). */
export function ProductDrawer({ open, product, onClose }: { open: boolean; product: Product | null; onClose: () => void }) {
  const t = useTranslations('App.store.drawer');
  const save = useSaveProduct();
  return (
    <Drawer open={open} onClose={onClose} title={product ? t('editTitle') : t('addTitle')} dismissible={!save.isPending}>
      <ProductForm key={product?.id ?? 'new'} product={product} onDone={onClose} save={save} />
    </Drawer>
  );
}

function parseMoney(value: string): number | null {
  const normalised = value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,\s]/g, '');
  if (!normalised) return null;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : NaN;
}

function ProductForm({ product, onDone, save }: { product: Product | null; onDone: () => void; save: ReturnType<typeof useSaveProduct> }) {
  const t = useTranslations('App.store.drawer');
  const tErr = useTranslations('App.orders');
  const remove = useDeleteProduct();
  const { confirm, dialog } = useConfirm();
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? String(product.priceEgp) : '');
  const [sale, setSale] = useState(product?.salePriceEgp != null ? String(product.salePriceEgp) : '');
  const [inStock, setInStock] = useState(product?.inStock ?? true);
  const [image, setImage] = useState<File | null | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    const priceValue = parseMoney(price);
    const saleValue = parseMoney(sale);
    if (!name.trim()) next.name = t('nameRequired');
    if (priceValue === null || Number.isNaN(priceValue) || priceValue <= 0) next.priceEgp = t('priceInvalid');
    if (saleValue !== null && (Number.isNaN(saleValue) || saleValue <= 0)) next.salePriceEgp = t('priceInvalid');
    else if (saleValue !== null && priceValue && saleValue >= priceValue) next.salePriceEgp = t('saleTooHigh');
    setErrors(next);
    setFailed(null);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        id: product?.id,
        data: { name: name.trim(), description: description.trim() || null, priceEgp: priceValue!, salePriceEgp: saleValue, inStock },
        image,
      });
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.fields.length) {
        setErrors(Object.fromEntries(error.fields.map((f) => [f.path, f.path === 'salePriceEgp' ? t('saleTooHigh') : f.message])));
      } else if (error instanceof ApiError && error.code.startsWith('image_')) {
        setFailed(t('imageFailed'));
      } else {
        setFailed(tErr('saveFailed'));
      }
    }
  }

  async function onDelete() {
    if (!product) return;
    const archived = product.orderCount > 0;
    const ok = await confirm({
      title: t('deleteTitle', { name: product.name }),
      body: archived ? t('archiveBody') : t('deleteBody'),
      confirmLabel: archived ? t('archive') : t('delete'),
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(product.id);
      onDone();
    } catch {
      setFailed(tErr('saveFailed'));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
      <ImagePicker label={t('picture')} currentUrl={product?.previewUrl ?? null} value={image} onChange={setImage} optional />
      <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={120} required autoComplete="off" />
      <TextareaField
        label={t('description')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        optional
        rows={3}
        maxLength={2000}
        hint={t('descriptionHint')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('price')}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={errors.priceEgp}
          inputMode="decimal"
          ltr
          required
          trailing={<span className="pe-3 text-sm text-fg-muted">{t('currency')}</span>}
        />
        <TextField
          label={t('salePrice')}
          value={sale}
          onChange={(e) => setSale(e.target.value)}
          error={errors.salePriceEgp}
          hint={t('salePriceHint')}
          inputMode="decimal"
          ltr
          optional
          trailing={<span className="pe-3 text-sm text-fg-muted">{t('currency')}</span>}
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <Switch checked={inStock} onChange={setInStock} label={t('availability')} description={t('availabilityHint')} className="flex-1" />
        <Badge tone={inStock ? 'success' : 'neutral'}>{inStock ? t('inStock') : t('outOfStock')}</Badge>
      </div>
      {failed ? <Alert>{failed}</Alert> : null}
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center">
        {product ? (
          <Button variant="ghost" icon={Trash2} onClick={() => void onDelete()} pending={remove.isPending} className="text-danger hover:bg-danger-soft hover:text-danger sm:me-auto">
            {product.orderCount > 0 ? t('archive') : t('delete')}
          </Button>
        ) : null}
        <Button type="submit" size="lg" pending={save.isPending} block className="sm:w-auto sm:ms-auto">
          {product ? t('save') : t('add')}
        </Button>
      </div>
      {dialog}
    </form>
  );
}
