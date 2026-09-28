'use client';

import { Check, ImageIcon, RotateCcw, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { WhatsAppButton } from '@/components/client/client-shell';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { DetailList } from '@/components/ui/primitives';
import { Alert, ErrorState, Loading } from '@/components/ui/state';
import { Link } from '@/i18n/navigation';
import { whatsappLink } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useOrder, useUpdateOrder } from '@/lib/queries-commerce';
import type { Order, OrderStatus } from '@/lib/types-commerce';
import { Drawer, OrderStatusBadge, PaidBadge, Switch, useMoney } from './commerce-ui';

const STEPS: OrderStatus[] = ['pending', 'in_production', 'ready', 'delivered'];

/** Order info (Figma 0:6583) with the actions the photographer needs: WhatsApp, paid, status. */
export function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const t = useTranslations('App.orders');
  const order = useOrder(orderId);
  return (
    <Drawer
      open={Boolean(orderId)}
      onClose={onClose}
      title={order.data ? t('drawerTitle', { number: order.data.number }) : t('drawerTitleLoading')}
    >
      {order.isPending ? (
        <Loading />
      ) : order.isError ? (
        <ErrorState onRetry={() => void order.refetch()} />
      ) : (
        <OrderDetails order={order.data} />
      )}
    </Drawer>
  );
}

function OrderDetails({ order }: { order: Order }) {
  const t = useTranslations('App.orders');
  const tStatus = useTranslations('App.orders.status');
  const locale = useLocale();
  const money = useMoney();
  const update = useUpdateOrder();
  const { confirm, dialog } = useConfirm();
  const [failed, setFailed] = useState(false);

  async function change(data: { status?: OrderStatus; paid?: boolean }) {
    setFailed(false);
    try {
      await update.mutateAsync({ id: order.id, data });
    } catch {
      setFailed(true);
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: t('cancelTitle', { number: order.number }),
      body: t('cancelBody'),
      confirmLabel: t('cancelConfirm'),
      cancelLabel: t('keepOrder'),
    });
    if (ok) await change({ status: 'cancelled' });
  }

  const current = STEPS.indexOf(order.status);
  const forward = order.allowedStatuses.find((s) => STEPS.indexOf(s) === current + 1);
  const back = order.allowedStatuses.find((s) => s !== 'cancelled' && STEPS.indexOf(s) === current - 1);
  const wa = whatsappLink(order.customerPhone, t('whatsappText', { name: order.customerName.split(' ')[0] ?? order.customerName, number: order.number }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaidBadge paid={Boolean(order.paidAt)} />
      </div>

      <DetailList
        items={[
          { label: t('customer'), value: order.customerName },
          {
            label: t('phone'),
            value: (
              <a href={`tel:${order.customerPhone}`} dir="ltr" className="tabular rounded-md text-brand hover:text-brand-hover">
                {order.customerPhone}
              </a>
            ),
          },
          ...(order.customerEmail
            ? [{ label: t('email'), value: <span dir="ltr" className="break-all">{order.customerEmail}</span> }]
            : []),
          { label: t('date'), value: <span className="tabular">{formatDate(order.createdAt, locale)}</span> },
          { label: t('number'), value: <span className="tabular">#{order.number}</span> },
          ...(order.gallery
            ? [
                {
                  label: t('gallery'),
                  value: (
                    <Link href={`/galleries/${order.gallery.id}`} className="rounded-md text-brand hover:text-brand-hover">
                      {order.gallery.name}
                    </Link>
                  ),
                },
              ]
            : []),
          ...(order.note ? [{ label: t('note'), value: <span className="whitespace-pre-line">{order.note}</span> }] : []),
        ]}
      />

      {wa ? (
        <WhatsAppButton href={wa} block>
          {t('whatsapp')}
        </WhatsAppButton>
      ) : null}

      <section aria-labelledby="order-items">
        <h3 id="order-items" className="text-base font-semibold text-fg">
          {t('items')}
        </h3>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-sunken text-fg-muted">
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img
                    src={item.thumbnailUrl}
                    alt={item.fileName ? t('photoAlt', { name: item.fileName }) : ''}
                    className="size-full object-cover"
                    style={item.blurDataUrl ? { backgroundImage: `url(${item.blurDataUrl})`, backgroundSize: 'cover' } : undefined}
                  />
                ) : (
                  <ImageIcon size={18} strokeWidth={1.75} aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{item.name}</p>
                {item.detail ? <p className="truncate text-xs text-fg-muted">{item.detail}</p> : null}
                <p className="tabular mt-0.5 text-xs text-fg-muted">{t('qtyTimes', { quantity: item.quantity, price: money(item.unitPriceEgp) })}</p>
              </div>
              <p className="tabular text-sm font-medium text-fg">{money(item.lineTotalEgp)}</p>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 bg-surface-subtle p-3">
            <span className="text-sm font-semibold text-fg">{t('total')}</span>
            <span className="tabular text-base font-semibold text-fg">{money(order.totalEgp)}</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="order-payment" className="rounded-lg border border-border p-4">
        <h3 id="order-payment" className="sr-only">
          {t('payment')}
        </h3>
        <Switch
          checked={Boolean(order.paidAt)}
          onChange={(paid) => void change({ paid })}
          disabled={update.isPending}
          label={t('markPaid')}
          description={order.paidAt ? t('paidOn', { date: formatDate(order.paidAt, locale) }) : t('paidHint')}
        />
      </section>

      <section aria-labelledby="order-status">
        <h3 id="order-status" className="text-base font-semibold text-fg">
          {t('statusTitle')}
        </h3>
        {order.status === 'cancelled' ? (
          <p className="mt-2 text-sm text-fg-muted">{t('cancelledNote')}</p>
        ) : (
          <ol className="mt-3 grid grid-cols-4 gap-2">
            {STEPS.map((step, index) => {
              const done = index <= current;
              return (
                <li key={step} aria-current={index === current ? 'step' : undefined} className="flex flex-col gap-2">
                  <span className={cn('h-1.5 rounded-full', done ? 'bg-brand' : 'bg-surface-sunken')} aria-hidden />
                  <span className={cn('flex items-center gap-1 text-xs', index === current ? 'font-semibold text-fg' : done ? 'text-fg-secondary' : 'text-fg-muted')}>
                    {done && index < current ? <Check size={14} strokeWidth={2} aria-hidden className="shrink-0 text-brand" /> : null}
                    {tStatus(step)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {forward ? (
            <Button onClick={() => void change({ status: forward })} pending={update.isPending && update.variables?.data.status === forward}>
              {t(`moveTo.${forward}` as 'moveTo.ready')}
            </Button>
          ) : null}
          {back ? (
            <Button variant="secondary" icon={RotateCcw} onClick={() => void change({ status: back })} disabled={update.isPending}>
              {t('backTo', { status: tStatus(back) })}
            </Button>
          ) : null}
          {order.status === 'cancelled' ? (
            <Button variant="secondary" icon={RotateCcw} onClick={() => void change({ status: 'pending' })} pending={update.isPending}>
              {t('reopen')}
            </Button>
          ) : order.allowedStatuses.includes('cancelled') ? (
            <Button variant="ghost" icon={XCircle} onClick={() => void cancel()} disabled={update.isPending} className="text-danger hover:bg-danger-soft hover:text-danger sm:ms-auto">
              {t('cancelOrder')}
            </Button>
          ) : null}
        </div>
        {failed ? <Alert className="mt-3">{t('updateFailed')}</Alert> : null}
      </section>
      {dialog}
    </div>
  );
}
