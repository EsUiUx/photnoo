'use client';

import { ChevronLeft, ChevronRight, ImageIcon, Receipt, Search } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { formatDate } from '@/lib/format';
import { useOrders } from '@/lib/queries-commerce';
import type { Order, OrderKind } from '@/lib/types-commerce';
import { OrderStatusBadge, PaidBadge, useMoney } from './commerce-ui';
import { OrderDrawer } from './order-drawer';

/** Orders table (Figma 0:4179 / 0:4327): search, date range, table on desktop, cards on phones. */
export function OrdersPanel({ kind, initialOrderId }: { kind: OrderKind; initialOrderId?: string }) {
  const t = useTranslations('App.orders');
  const format = useFormatter();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<string | null>(initialOrderId ?? null);

  // Search as you type, without a request per key.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const orders = useOrders({ kind, q: q || undefined, from: from || undefined, to: to || undefined, page });
  const data = orders.data;
  const filtered = Boolean(q || from || to);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <TextField
          label={t('search')}
          srOnlyLabel
          type="search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:min-w-64 sm:flex-1"
          trailing={<Search size={16} strokeWidth={1.75} aria-hidden className="me-3 text-fg-muted" />}
        />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <TextField
            label={t('from')}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            ltr
          />
          <TextField
            label={t('to')}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            ltr
          />
        </div>
        {filtered ? (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setQ('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            {t('clearFilters')}
          </Button>
        ) : null}
      </div>

      {orders.isError && !data ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : !data ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filtered ? t('noMatchTitle') : t('emptyTitle')}
          body={filtered ? t('noMatch') : kind === 'store' ? t('emptyStore') : t('emptyPrints')}
        />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {t('count', { count: data.total })}
          </p>
          <OrdersTable orders={data.items} kind={kind} onView={setViewing} />
          <ul className="flex flex-col gap-3 md:hidden">
            {data.items.map((order) => (
              <OrderCard key={order.id} order={order} kind={kind} onView={() => setViewing(order.id)} />
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label={t('pagination')} className="flex items-center justify-between gap-3">
              <p className="tabular text-sm text-fg-muted">{t('pageOf', { page: format.number(page), pages: format.number(pages) })}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="rtl:[&_svg]:-scale-x-100">
                  {t('previous')}
                </Button>
                <Button variant="secondary" size="sm" iconEnd={ChevronRight} onClick={() => setPage((p) => p + 1)} disabled={page >= pages}>
                  {t('next')}
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      <OrderDrawer orderId={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function summary(order: Order) {
  const first = order.items[0];
  if (!first) return '';
  return order.items.length > 1 ? `${first.name} +${order.items.length - 1}` : first.name;
}

function Thumb({ order }: { order: Order }) {
  const url = order.items[0]?.thumbnailUrl;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-sunken text-fg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <ImageIcon size={16} strokeWidth={1.75} aria-hidden />}
    </span>
  );
}

function OrdersTable({ orders, kind, onView }: { orders: Order[]; kind: OrderKind; onView: (id: string) => void }) {
  const t = useTranslations('App.orders');
  const locale = useLocale();
  const money = useMoney();
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
      <table className="w-full text-sm">
        <caption className="sr-only">{kind === 'store' ? t('tableCaptionStore') : t('tableCaptionPrints')}</caption>
        <thead className="bg-surface-subtle text-start text-xs font-medium text-fg-muted">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('number')}</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('date')}</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('customer')}</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('phone')}</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('items')}</th>
            <th scope="col" className="px-4 py-3 text-end font-medium">{t('total')}</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('payment')}</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('statusTitle')}</th>
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">{t('actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface">
          {orders.map((order) => (
            <tr key={order.id} className="transition-colors duration-150 hover:bg-surface-subtle">
              <td className="tabular px-4 py-3 font-medium text-fg">#{order.number}</td>
              <td className="tabular px-4 py-3 text-fg-secondary">{formatDate(order.createdAt, locale)}</td>
              <td className="max-w-40 truncate px-4 py-3 text-fg">{order.customerName}</td>
              <td className="tabular px-4 py-3 text-fg-secondary" dir="ltr">
                <span className="rtl:block rtl:text-end">{order.customerPhone}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {kind === 'print' ? <Thumb order={order} /> : null}
                  <span className="max-w-48 truncate text-fg-secondary">{summary(order)}</span>
                </div>
              </td>
              <td className="tabular px-4 py-3 text-end font-medium text-fg">{money(order.totalEgp)}</td>
              <td className="px-4 py-3">
                <PaidBadge paid={Boolean(order.paidAt)} />
              </td>
              <td className="px-4 py-3">
                <OrderStatusBadge status={order.status} />
              </td>
              <td className="px-4 py-3 text-end">
                <Button size="sm" variant="secondary" onClick={() => onView(order.id)} aria-label={t('viewOrder', { number: order.number })}>
                  {t('view')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderCard({ order, kind, onView }: { order: Order; kind: OrderKind; onView: () => void }) {
  const t = useTranslations('App.orders');
  const locale = useLocale();
  const money = useMoney();
  return (
    <li className="rounded-lg border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-start gap-3">
        {kind === 'print' ? <Thumb order={order} /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="tabular text-sm font-semibold text-fg">#{order.number}</p>
            <p className="tabular text-sm font-semibold text-fg">{money(order.totalEgp)}</p>
          </div>
          <p className="truncate text-sm text-fg">{order.customerName}</p>
          <p className="tabular text-xs text-fg-muted">
            {formatDate(order.createdAt, locale)} · <span dir="ltr">{order.customerPhone}</span>
          </p>
          <p className="mt-1 truncate text-xs text-fg-secondary">{summary(order)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaidBadge paid={Boolean(order.paidAt)} />
        <Button size="sm" variant="secondary" onClick={onView} className="ms-auto" aria-label={t('viewOrder', { number: order.number })}>
          {t('view')}
        </Button>
      </div>
    </li>
  );
}
