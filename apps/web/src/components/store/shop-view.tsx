'use client';

import { CheckCircle2, ImageIcon, MapPin, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PhotographerMark, WhatsAppButton } from '@/components/client/client-shell';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextareaField, TextField } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { Alert, EmptyState } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { whatsappLink } from '@/lib/client-api';
import { shopApi } from '@/lib/queries-commerce';
import type { PublicOrderReceipt, PublicProduct, PublicShop } from '@/lib/types-commerce';

const MAX_QUANTITY = 20;

function useMoney() {
  const format = useFormatter();
  const t = useTranslations('Common');
  return (amount: number) => `${format.number(amount, { numberingSystem: 'latn', maximumFractionDigits: 2 })} ${t('egp')}`;
}

/** The photographer's public shop: who they are, what they sell, and an order form per product. */
export function ShopView({ slug, shop, initialProductId }: { slug: string; shop: PublicShop; initialProductId?: string }) {
  const t = useTranslations('Shop');
  const [selected, setSelected] = useState<PublicProduct | null>(() => shop.products.find((p) => p.id === initialProductId) ?? null);
  const p = shop.photographer;
  const name = p.studioName ?? p.name;
  const wa = whatsappLink(p.whatsapp, t('whatsappHello'));

  return (
    <div className="bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:px-6 sm:py-10 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img src={p.avatarUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
            ) : (
              <PhotographerMark name={name} size="lg" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg-muted">{t('eyebrow')}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{name}</h1>
              {p.studioName && p.studioName !== p.name ? <p className="text-sm text-fg-secondary">{p.name}</p> : null}
              {p.city ? (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-fg-muted">
                  <MapPin size={16} strokeWidth={1.75} aria-hidden />
                  {p.city}
                </p>
              ) : null}
            </div>
          </div>
          {wa ? (
            <WhatsAppButton href={wa} tone="secondary">
              {t('contact')}
            </WhatsAppButton>
          ) : null}
        </div>
        {p.bio ? <p className="mx-auto max-w-6xl px-4 pb-8 text-base text-fg-secondary sm:px-6 lg:px-8">{p.bio}</p> : null}
      </header>

      <section aria-labelledby="products" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="products" className="text-lg font-semibold text-fg">
            {t('products')}
          </h2>
          <p className="text-sm text-fg-muted">{t('howItWorks')}</p>
        </div>
        {shop.products.length === 0 ? (
          <EmptyState icon={ShoppingBag} title={t('emptyTitle')} body={t('empty')} />
        ) : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {shop.products.map((product) => (
              <li key={product.id}>
                <ProductTile product={product} onOpen={() => setSelected(product)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-fg-muted sm:px-6 lg:px-8">{t('footer')}</footer>

      <ProductSheet slug={slug} product={selected} photographer={{ name, whatsapp: p.whatsapp }} onClose={() => setSelected(null)} />
    </div>
  );
}

function Price({ product, large }: { product: PublicProduct; large?: boolean }) {
  const t = useTranslations('Shop');
  const money = useMoney();
  const size = large ? 'text-xl' : 'text-base';
  return product.salePriceEgp !== null ? (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={`tabular font-semibold text-brand ${size}`}>{money(product.salePriceEgp)}</span>
      <s className="tabular text-sm text-fg-muted">
        <span className="sr-only">{t('wasPrice')} </span>
        {money(product.priceEgp)}
      </s>
    </p>
  ) : (
    <p className={`tabular font-semibold text-fg ${size}`}>{money(product.priceEgp)}</p>
  );
}

function ProductTile({ product, onOpen }: { product: PublicProduct; onOpen: () => void }) {
  const t = useTranslations('Shop');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-start shadow-xs transition-shadow duration-150 hover:shadow-card"
    >
      <span className="relative block aspect-square w-full bg-surface-sunken">
        {product.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={product.previewUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-fg-muted">
            <ImageIcon size={22} strokeWidth={1.75} aria-hidden />
          </span>
        )}
        {!product.inStock ? (
          <Badge className="absolute start-2 top-2 shadow-xs">{t('soldOut')}</Badge>
        ) : product.salePriceEgp !== null ? (
          <Badge tone="brand" className="absolute start-2 top-2 shadow-xs">
            {t('sale')}
          </Badge>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <span className="line-clamp-2 text-sm font-semibold text-fg sm:text-base">{product.name}</span>
        <Price product={product} />
      </span>
    </button>
  );
}

function ProductSheet({
  slug,
  product,
  photographer,
  onClose,
}: {
  slug: string;
  product: PublicProduct | null;
  photographer: { name: string; whatsapp: string | null };
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<PublicOrderReceipt | null>(null);
  const t = useTranslations('Shop');
  const close = () => {
    setReceipt(null);
    onClose();
  };
  return (
    <Dialog open={Boolean(product)} onClose={close} title={receipt ? t('doneTitle') : (product?.name ?? '')} dismissible={!busy} size="lg">
      {product ? (
        receipt ? (
          <Receipt receipt={receipt} onClose={close} />
        ) : (
          <ProductDetail slug={slug} product={product} photographer={photographer} onBusy={setBusy} onDone={setReceipt} />
        )
      ) : null}
    </Dialog>
  );
}

function ProductDetail({
  slug,
  product,
  photographer,
  onBusy,
  onDone,
}: {
  slug: string;
  product: PublicProduct;
  photographer: { name: string; whatsapp: string | null };
  onBusy: (busy: boolean) => void;
  onDone: (receipt: PublicOrderReceipt) => void;
}) {
  const t = useTranslations('Shop');
  const money = useMoney();
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const unit = product.salePriceEgp ?? product.priceEgp;
  const wa = whatsappLink(photographer.whatsapp, t('whatsappAbout', { product: product.name }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = t('nameRequired');
    if (phone.replace(/\D/g, '').length < 8) next.phone = t('phoneInvalid');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('emailInvalid');
    setErrors(next);
    setFailed(null);
    if (Object.keys(next).length) return;
    setPending(true);
    onBusy(true);
    try {
      onDone(
        await shopApi.order(slug, {
          name: name.trim(),
          phone: phone.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          items: [{ productId: product.id, quantity }],
        }),
      );
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'network_error';
      if (code === 'validation_failed' && error instanceof ApiError) {
        setErrors(
          Object.fromEntries(
            error.fields.map((f) => [f.path, f.path === 'phone' ? t('phoneInvalid') : f.path === 'email' ? t('emailInvalid') : f.message]),
          ),
        );
      } else if (code === 'rate_limited') setFailed(t('rateLimited'));
      else if (code === 'out_of_stock') setFailed(t('outOfStock'));
      else if (code === 'product_not_found' || code === 'shop_not_found') setFailed(t('gone'));
      else setFailed(t('failed'));
    } finally {
      setPending(false);
      onBusy(false);
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <div className="overflow-hidden rounded-lg bg-surface-sunken">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
          ) : (
            <span className="flex aspect-square items-center justify-center text-fg-muted">
              <ImageIcon size={22} strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </div>
        <div className="mt-4">
          <Price product={product} large />
        </div>
        {product.description ? <p className="mt-3 text-sm whitespace-pre-line text-fg-secondary">{product.description}</p> : null}
      </div>

      {product.inStock ? (
        <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
          <h3 className="text-base font-semibold text-fg">{t('orderTitle')}</h3>
          <div>
            <p id="shop-qty" className="text-sm font-medium text-fg">
              {t('quantity')}
            </p>
            <div role="group" aria-labelledby="shop-qty" className="mt-1.5 flex items-center gap-3">
              <Button variant="secondary" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label={t('less')} className="w-11 px-0">
                <Minus size={18} strokeWidth={1.75} aria-hidden />
              </Button>
              <output aria-live="polite" className="tabular min-w-8 text-center text-base font-semibold text-fg">
                {quantity}
              </output>
              <Button variant="secondary" onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))} disabled={quantity >= MAX_QUANTITY} aria-label={t('more')} className="w-11 px-0">
                <Plus size={18} strokeWidth={1.75} aria-hidden />
              </Button>
              <p className="tabular ms-auto text-sm text-fg-secondary">
                {t('total')} <span className="font-semibold text-fg">{money(unit * quantity)}</span>
              </p>
            </div>
          </div>
          <TextField label={t('name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoComplete="name" maxLength={100} />
          <TextField label={t('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} hint={t('phoneHint')} type="tel" inputMode="tel" autoComplete="tel" ltr />
          <TextField label={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} type="email" autoComplete="email" optional ltr />
          <TextareaField label={t('note')} value={note} onChange={(e) => setNote(e.target.value)} optional rows={2} maxLength={1000} />
          <p className="text-xs text-fg-muted">{t('paymentNote', { photographer: photographer.name })}</p>
          {failed ? <Alert>{failed}</Alert> : null}
          <Button type="submit" size="lg" pending={pending} block>
            {t('placeOrder')}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <Alert tone="info" title={t('soldOutTitle')}>
            {t('soldOutBody')}
          </Alert>
          {wa ? <WhatsAppButton href={wa}>{t('askPhotographer')}</WhatsAppButton> : null}
        </div>
      )}
    </div>
  );
}

function Receipt({ receipt, onClose }: { receipt: PublicOrderReceipt; onClose: () => void }) {
  const t = useTranslations('Shop');
  const money = useMoney();
  const wa = whatsappLink(receipt.photographer.whatsapp, t('whatsappOrder', { number: receipt.number }));
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-2 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-base font-semibold text-fg">{t('doneHeading', { number: receipt.number })}</p>
      <p className="max-w-sm text-sm text-fg-secondary">{t('doneBody', { photographer: receipt.photographer.name })}</p>
      <ul className="w-full max-w-sm divide-y divide-border rounded-lg border border-border text-start">
        {receipt.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3 p-3 text-sm">
            <span className="min-w-0 truncate text-fg">
              {item.name} <span className="tabular text-fg-muted">× {item.quantity}</span>
            </span>
            <span className="tabular text-fg">{money(item.unitPriceEgp * item.quantity)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 bg-surface-subtle p-3 text-sm font-semibold">
          <span>{t('total')}</span>
          <span className="tabular">{money(receipt.totalEgp)}</span>
        </li>
      </ul>
      <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {wa ? <WhatsAppButton href={wa}>{t('message', { photographer: receipt.photographer.name })}</WhatsAppButton> : null}
        <Button onClick={onClose}>{t('done')}</Button>
      </div>
    </div>
  );
}
