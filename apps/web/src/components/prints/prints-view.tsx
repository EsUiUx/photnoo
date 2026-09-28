'use client';

import { Banknote, CheckCircle2, Clock, Factory, Frame, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ListStagger } from '@/components/app/app-motion';
import { DevelopImg } from '@/components/motion/develop';
import { staggerItem } from '@/components/motion/stagger-item';
import { StatCard, Switch, useMoney } from '@/components/orders/commerce-ui';
import { OrdersPanel } from '@/components/orders/orders-panel';
import { Button, IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Badge, Card, Segmented } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { useDeletePrintItem, usePrintItems, usePrintSettings, usePrintStats, useSetPrintsEnabled } from '@/lib/queries-commerce';
import { PRINT_TYPES, type PrintItem, type PrintType } from '@/lib/types-commerce';
import { PrintDrawer } from './print-drawer';

type Tab = 'catalog' | 'orders';

/** Prints (Figma 0:4259 catalog, 0:4327 orders). */
export function PrintsView({ initialTab = 'catalog', initialOrderId }: { initialTab?: Tab; initialOrderId?: string }) {
  const t = useTranslations('App.prints');
  const format = useFormatter();
  const money = useMoney();
  const stats = usePrintStats();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [editing, setEditing] = useState<{ item: PrintItem | null; type?: PrintType } | null>(null);
  const s = stats.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('intro')}</p>
        </div>
        {tab === 'catalog' ? (
          <Button icon={Plus} onClick={() => setEditing({ item: null })}>
            {t('addPrint')}
          </Button>
        ) : null}
      </div>

      <OfferSwitch />

      <section aria-labelledby="prints-stats">
        <h2 id="prints-stats" className="sr-only">
          {t('statsTitle')}
        </h2>
        {stats.isError && !s ? (
          <Card>
            <ErrorState onRetry={() => void stats.refetch()} className="py-8" />
          </Card>
        ) : (
          <ListStagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard index={0} icon={Clock} label={t('stats.pending')} value={s ? format.number(s.pending) : undefined} />
            <StatCard index={1} icon={Factory} label={t('stats.inProduction')} value={s ? format.number(s.inProduction) : undefined} />
            <StatCard index={2} icon={CheckCircle2} label={t('stats.delivered')} value={s ? format.number(s.delivered) : undefined} />
            <StatCard index={3} icon={Banknote} label={t('stats.revenue')} value={s ? money(s.revenueEgp.value) : undefined} delta={s?.revenueEgp.delta} hint={t('stats.revenueHint')} />
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
              { value: 'catalog', label: t('tabs.catalog') },
              { value: 'orders', label: t('tabs.orders') },
            ]}
          />
        </div>
        {tab === 'catalog' ? (
          <Catalog onAdd={(type) => setEditing({ item: null, type })} onEdit={(item) => setEditing({ item })} />
        ) : (
          <OrdersPanel kind="print" initialOrderId={initialOrderId} />
        )}
      </Card>

      <PrintDrawer open={editing !== null} item={editing?.item ?? null} defaultType={editing?.type} onClose={() => setEditing(null)} />
    </div>
  );
}

/** "Offer prints in client galleries" (Photographer.printsEnabled). Galleries can opt out one by one. */
function OfferSwitch() {
  const t = useTranslations('App.prints');
  const settings = usePrintSettings();
  const update = useSetPrintsEnabled();
  if (settings.isPending) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (settings.isError) {
    return (
      <Card>
        <ErrorState onRetry={() => void settings.refetch()} className="py-8" />
      </Card>
    );
  }
  const data = settings.data;
  return (
    <Card className="p-5">
      <Switch
        checked={data.printsEnabled}
        disabled={update.isPending}
        onChange={(enabled) => update.mutate(enabled)}
        label={t('offer')}
        description={data.printsEnabled ? t('offerOn') : t('offerOff')}
      />
      {data.printsEnabled && data.availableItems === 0 ? (
        <Alert tone="warning" className="mt-4">
          {t('offerNoItems')}
        </Alert>
      ) : null}
      {data.printsEnabled && data.galleriesOptedOut > 0 ? (
        <p className="mt-3 text-sm text-fg-muted">{t('optedOut', { count: data.galleriesOptedOut })}</p>
      ) : null}
      {update.isError ? <Alert className="mt-3">{t('saveFailed')}</Alert> : null}
    </Card>
  );
}

function Catalog({ onAdd, onEdit }: { onAdd: (type?: PrintType) => void; onEdit: (item: PrintItem) => void }) {
  const t = useTranslations('App.prints');
  const tType = useTranslations('App.prints.types');
  const items = usePrintItems();
  if (items.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i}>
            <Skeleton className="h-5 w-24" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.isError) return <ErrorState onRetry={() => void items.refetch()} />;
  if (items.data.length === 0) {
    return (
      <EmptyState
        icon={Frame}
        title={t('emptyTitle')}
        body={t('empty')}
        action={
          <Button icon={Plus} onClick={() => onAdd()}>
            {t('addFirst')}
          </Button>
        }
      />
    );
  }
  const groups = PRINT_TYPES.map((type) => ({ type, items: items.data.filter((i) => i.type === type) })).filter((g) => g.items.length > 0);
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.type} aria-labelledby={`type-${group.type}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 id={`type-${group.type}`} className="text-base font-semibold text-fg">
              {tType(group.type)}
            </h3>
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => onAdd(group.type)} aria-label={t('addTo', { type: tType(group.type) })}>
              {t('add')}
            </Button>
          </div>
          <ListStagger className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item, index) => (
              <PrintRow key={item.id} index={index} item={item} onEdit={() => onEdit(item)} />
            ))}
          </ListStagger>
        </section>
      ))}
    </div>
  );
}

function PrintRow({ index, item, onEdit }: { index: number; item: PrintItem; onEdit: () => void }) {
  const t = useTranslations('App.prints');
  const money = useMoney();
  const remove = useDeletePrintItem();
  const { confirm, dialog } = useConfirm();

  async function onDelete() {
    const ok = await confirm({
      title: t('deleteTitle', { name: `${item.name} ${item.size}` }),
      body: t('deleteBody'),
      confirmLabel: t('delete'),
    });
    if (ok) remove.mutate(item.id);
  }

  return (
    <li {...staggerItem(index)} className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle p-3">
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-soft text-brand">
        {item.previewUrl ? (
          <DevelopImg src={item.previewUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <Frame size={20} strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{item.name}</p>
        <p className="truncate text-xs text-fg-muted" dir="auto">
          {item.size}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="tabular text-sm font-semibold text-fg">{money(item.priceEgp)}</span>
          {!item.available ? <Badge>{t('unavailable')}</Badge> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <IconButton icon={Pencil} label={t('editNamed', { name: `${item.name} ${item.size}` })} onClick={onEdit} />
        <IconButton icon={Trash2} variant="danger-ghost" label={t('deleteNamed', { name: `${item.name} ${item.size}` })} onClick={() => void onDelete()} disabled={remove.isPending} />
      </div>
      {dialog}
    </li>
  );
}
