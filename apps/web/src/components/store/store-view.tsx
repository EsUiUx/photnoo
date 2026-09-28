'use client';

import { Banknote, Clock, ExternalLink, ImageIcon, Package, Pencil, Plus, Receipt, ShoppingBag } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ListStagger } from '@/components/app/app-motion';
import { DevelopImg } from '@/components/motion/develop';
import { staggerItem } from '@/components/motion/stagger-item';
import { StatCard, Switch, useMoney } from '@/components/orders/commerce-ui';
import { OrdersPanel } from '@/components/orders/orders-panel';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, Card, CopyButton, Segmented } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { Link } from '@/i18n/navigation';
import { useCommerceSettings, useProducts, useStoreStats, useUpdateCommerceSettings } from '@/lib/queries-commerce';
import type { CommerceSettings, Product } from '@/lib/types-commerce';
import { ProductDrawer } from './product-drawer';

type Tab = 'products' | 'orders';

/** Store (Figma 0:4111 products, 0:4179 orders). */
export function StoreView({ initialTab = 'products', initialOrderId }: { initialTab?: Tab; initialOrderId?: string }) {
  const t = useTranslations('App.store');
  const format = useFormatter();
  const money = useMoney();
  const stats = useStoreStats();
  const settings = useCommerceSettings();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const s = stats.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('intro')}</p>
        </div>
        {tab === 'products' ? (
          <Button icon={Plus} onClick={() => setEditing('new')}>
            {t('addProduct')}
          </Button>
        ) : null}
      </div>

      <ShopSwitch settings={settings.data} loading={settings.isPending} failed={settings.isError} onRetry={() => void settings.refetch()} />

      <section aria-labelledby="store-stats">
        <h2 id="store-stats" className="sr-only">
          {t('statsTitle')}
        </h2>
        {stats.isError && !s ? (
          <Card>
            <ErrorState onRetry={() => void stats.refetch()} className="py-8" />
          </Card>
        ) : (
          <ListStagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard index={0} icon={Package} label={t('stats.products')} value={s ? format.number(s.products.value) : undefined} delta={s?.products.delta} />
            <StatCard index={1} icon={Receipt} label={t('stats.orders')} value={s ? format.number(s.orders.value) : undefined} delta={s?.orders.delta} />
            <StatCard
              index={2}
              icon={Banknote}
              label={t('stats.revenue')}
              value={s ? money(s.revenueEgp.value) : undefined}
              delta={s?.revenueEgp.delta}
              hint={t('stats.revenueHint')}
            />
            <StatCard index={3} icon={Clock} label={t('stats.pending')} value={s ? format.number(s.pending) : undefined} />
          </ListStagger>
        )}
      </section>

      <Card className="p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-fg">{t('overview')}</h2>
          <Segmented
            label={t('overview')}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'products', label: t('tabs.products') },
              { value: 'orders', label: t('tabs.orders') },
            ]}
          />
        </div>
        {tab === 'products' ? (
          <ProductGrid slug={settings.data?.slug ?? null} onAdd={() => setEditing('new')} onEdit={setEditing} />
        ) : (
          <OrdersPanel kind="store" initialOrderId={initialOrderId} />
        )}
      </Card>

      <ProductDrawer open={editing !== null} product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function ShopSwitch({ settings, loading, failed, onRetry }: { settings?: CommerceSettings; loading: boolean; failed: boolean; onRetry: () => void }) {
  const t = useTranslations('App.store');
  const locale = useLocale();
  const update = useUpdateCommerceSettings();
  if (loading) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (failed || !settings) {
    return (
      <Card>
        <ErrorState onRetry={onRetry} className="py-8" />
      </Card>
    );
  }
  const shopHref = settings.shopPath ? `/${locale}${settings.shopPath}` : null;
  return (
    <Card className="p-5">
      <Switch
        checked={settings.storeEnabled}
        disabled={update.isPending}
        onChange={(storeEnabled) => update.mutate({ storeEnabled })}
        label={t('enable')}
        description={settings.storeEnabled ? t('enabledHint') : t('disabledHint')}
      />
      <div className="mt-4 border-t border-border pt-4">
        {settings.slug ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 basis-full text-sm text-fg-secondary sm:basis-0 sm:flex-1">
              {t('shopLives')}{' '}
              <span dir="ltr" className="font-medium break-words text-fg">
                {settings.shopUrl}
              </span>
            </p>
            {settings.storeEnabled && shopHref ? (
              <>
                <CopyButton value={typeof window === 'undefined' ? shopHref : `${window.location.origin}${shopHref}`} label={t('copyShopLink')} />
                <ButtonLink href={shopHref} external variant="secondary" icon={ExternalLink}>
                  {t('openShop')}
                </ButtonLink>
              </>
            ) : null}
          </div>
        ) : (
          <Alert tone="info">
            {t.rich('noSlug', {
              link: (chunks) => (
                <Link href="/settings" className="font-medium underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </Alert>
        )}
      </div>
      {update.isError ? <Alert className="mt-3">{t('saveFailed')}</Alert> : null}
    </Card>
  );
}

function ProductGrid({ slug, onAdd, onEdit }: { slug: string | null; onAdd: () => void; onEdit: (product: Product) => void }) {
  const t = useTranslations('App.store');
  const products = useProducts();
  if (products.isPending) {
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-2 h-5 w-1/3" />
          </li>
        ))}
      </ul>
    );
  }
  if (products.isError) return <ErrorState onRetry={() => void products.refetch()} />;
  if (products.data.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t('emptyTitle')}
        body={t('empty')}
        action={
          <Button icon={Plus} onClick={onAdd}>
            {t('addFirst')}
          </Button>
        }
      />
    );
  }
  return (
    <ListStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.data.map((product, index) => (
        <ProductCard key={product.id} index={index} product={product} slug={slug} onEdit={() => onEdit(product)} />
      ))}
    </ListStagger>
  );
}

/** Product card (Figma 0:5750). */
function ProductCard({ index, product, slug, onEdit }: { index: number; product: Product; slug: string | null; onEdit: () => void }) {
  const t = useTranslations('App.store');
  const locale = useLocale();
  const money = useMoney();
  const onSale = product.salePriceEgp !== null;
  const path = slug ? `/${locale}/p/${slug}/shop?product=${product.id}` : null;
  return (
    <li {...staggerItem(index)} className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        {product.previewUrl ? (
          <DevelopImg src={product.previewUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-fg-muted">
            <ImageIcon size={22} strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <Badge tone={product.inStock ? 'success' : 'neutral'} className="absolute start-2 top-2 shadow-xs">
          {product.inStock ? t('inStock') : t('outOfStock')}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-fg">{product.name}</h3>
        <p className="flex flex-wrap items-baseline gap-x-2">
          {onSale ? (
            <>
              <span className="tabular text-base font-semibold text-brand">{money(product.salePriceEgp!)}</span>
              <s className="tabular text-sm text-fg-muted">
                <span className="sr-only">{t('wasPrice')} </span>
                {money(product.priceEgp)}
              </s>
            </>
          ) : (
            <span className="tabular text-base font-semibold text-fg">{money(product.priceEgp)}</span>
          )}
        </p>
        <div className="mt-auto flex gap-2 pt-3">
          <Button variant="soft" icon={Pencil} onClick={onEdit} className="flex-1" aria-label={t('editNamed', { name: product.name })}>
            {t('edit')}
          </Button>
          {path ? <CopyButton value={typeof window === 'undefined' ? path : `${window.location.origin}${path}`} label={t('copyLink')} /> : null}
        </div>
      </div>
    </li>
  );
}
