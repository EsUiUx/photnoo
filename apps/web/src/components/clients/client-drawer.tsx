'use client';

import { ChevronLeft, ChevronRight, Images, Mail, MessageCircle, Pencil, Phone, ShoppingBag, Trash2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { galleryBadge, StatusBadge } from '@/components/app/status-badge';
import { Button, IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Badge, type Tone } from '@/components/ui/primitives';
import { Alert, EmptyState, ErrorState, Skeleton } from '@/components/ui/state';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { useClient, useClientOrders, useDeleteClient } from '@/lib/queries-galleries';
import type { ClientDetail, OrderStatus } from '@/lib/types-galleries';
import { ClientAvatar } from './client-avatar';
import { ClientFormDialog } from './client-form-dialog';

const ORDER_TONES: Record<OrderStatus, Tone> = {
  pending: 'warning',
  in_production: 'info',
  ready: 'brand',
  delivered: 'success',
  cancelled: 'neutral',
};

/** Client detail (Figma 0:3918): contact, galleries, purchases, and Edit / Remove. */
export function ClientDrawer({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const t = useTranslations('App.clients');
  const client = useClient(clientId);
  const remove = useDeleteClient();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = client.data;

  async function onRemove() {
    if (!data) return;
    const ok = await confirm({
      title: t('removeTitle', { name: data.name }),
      body: t('removeBody', { count: data.galleries.length }),
      confirmLabel: t('removeConfirm'),
    });
    if (!ok) return;
    setError(null);
    try {
      await remove.mutateAsync(data.id);
      onClose();
    } catch {
      setError(t('removeFailed'));
    }
  }

  return (
    <Drawer
      open={clientId !== null}
      onClose={onClose}
      title={data?.name ?? t('detailTitle')}
      dismissible={!remove.isPending}
      size="lg"
      footer={
        data ? (
          <>
            <Button variant="secondary" icon={Trash2} onClick={() => void onRemove()} pending={remove.isPending} className="me-auto text-danger">
              {t('remove')}
            </Button>
            <Button icon={Pencil} onClick={() => setEditing(true)}>
              {t('editInfo')}
            </Button>
          </>
        ) : undefined
      }
    >
      {client.isPending ? (
        <DetailSkeleton />
      ) : client.isError || !data ? (
        <ErrorState onRetry={() => void client.refetch()} />
      ) : (
        <div className="flex flex-col gap-7">
          {error ? <Alert>{error}</Alert> : null}
          <Contact client={data} />
          <Galleries client={data} />
          <Purchases clientId={data.id} />
        </div>
      )}
      {data ? <ClientFormDialog open={editing} client={data} onClose={() => setEditing(false)} /> : null}
      {dialog}
    </Drawer>
  );
}

function Contact({ client }: { client: ClientDetail }) {
  const t = useTranslations('App.clients');
  const locale = useLocale();
  const digits = client.phone.replace(/\D/g, '');
  return (
    <section aria-label={t('contact')} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ClientAvatar name={client.name} size="lg" />
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">{t('createdOn', { date: formatDate(client.createdAt, locale) })}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-fg">
            <Phone size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
            <span dir="ltr">{client.phone}</span>
          </p>
          {client.email ? (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-fg">
              <Mail size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-muted" />
              <a href={`mailto:${client.email}`} dir="ltr" className="truncate rounded-md hover:text-brand">
                {client.email}
              </a>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {/* WhatsApp brand green as a background with dark text: 6.3:1 contrast. */}
        <a
          href={`https://wa.me/${digits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#25d366] px-4 text-sm font-semibold text-[#0b3d1f] shadow-xs transition-[filter] duration-150 hover:brightness-95 pointer-coarse:h-11"
        >
          <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
          {t('whatsapp')}
        </a>
        <a
          href={`tel:${client.phone}`}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg shadow-xs hover:bg-surface-subtle pointer-coarse:h-11"
        >
          <Phone size={18} strokeWidth={1.75} aria-hidden />
          {t('call')}
        </a>
      </div>
      {client.notes ? <p className="rounded-md bg-surface-subtle px-3.5 py-3 text-sm whitespace-pre-line text-fg-secondary">{client.notes}</p> : null}
    </section>
  );
}

function Galleries({ client }: { client: ClientDetail }) {
  const t = useTranslations('App.clients');
  const locale = useLocale();
  return (
    <section aria-labelledby="client-galleries" className="flex flex-col gap-3">
      <h3 id="client-galleries" className="text-base font-semibold text-fg">
        {t('galleries')}
      </h3>
      {client.galleries.length === 0 ? (
        <EmptyState icon={Images} title={t('noGalleriesTitle')} body={t('noGalleries')} className="rounded-lg border border-border py-8" />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {client.galleries.map((gallery) => (
            <li key={gallery.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle">
              <div className="min-w-0 flex-1">
                <Link href={`/galleries/${gallery.id}`} className="block truncate rounded-md text-sm font-medium text-fg after:absolute after:inset-0 after:content-['']">
                  {gallery.name}
                </Link>
                <p className="tabular text-xs text-fg-muted">
                  {t('galleryDates', {
                    created: formatDate(gallery.createdAt, locale),
                    expires: gallery.expiresAt ? formatDate(gallery.expiresAt, locale) : t('notShared'),
                  })}
                </p>
              </div>
              <StatusBadge kind={galleryBadge(gallery)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Purchases({ clientId }: { clientId: string }) {
  const t = useTranslations('App.clients');
  const locale = useLocale();
  const format = useFormatter();
  const [page, setPage] = useState(1);
  const orders = useClientOrders(clientId, page);
  const data = orders.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section aria-labelledby="client-purchases" className="flex flex-col gap-3">
      <h3 id="client-purchases" className="text-base font-semibold text-fg">
        {t('purchases')}
      </h3>
      {orders.isPending ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : orders.isError && !data ? (
        <ErrorState onRetry={() => void orders.refetch()} className="rounded-lg border border-border py-8" />
      ) : !data || data.total === 0 ? (
        <EmptyState icon={ShoppingBag} title={t('noPurchasesTitle')} body={t('noPurchases')} className="rounded-lg border border-border py-8" />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border" aria-busy={orders.isFetching || undefined}>
            {data.items.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="tabular text-sm font-medium text-fg">
                    {t('orderNumber', { number: order.number })}
                    <span className="ms-2 text-xs font-normal text-fg-muted">{t(`orderKind.${order.kind}`)}</span>
                  </p>
                  <p className="tabular text-xs text-fg-muted">
                    {formatDate(order.createdAt, locale)} · {t('items', { count: order.itemCount })}
                  </p>
                </div>
                <p className="tabular text-sm font-semibold text-fg">
                  {format.number(order.totalEgp, { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 })}
                </p>
                <Badge tone={ORDER_TONES[order.status]}>{t(`orderStatus.${order.status}`)}</Badge>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav aria-label={t('purchasesPages')} className="flex items-center justify-center gap-2">
              <IconButton icon={ChevronLeft} label={t('previousPage')} onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="rtl:-scale-x-100" />
              <p className="tabular text-sm text-fg-secondary" aria-live="polite">
                {t('pageOf', { page, pages })}
              </p>
              <IconButton icon={ChevronRight} label={t('nextPage')} onClick={() => setPage((p) => p + 1)} disabled={page >= pages} className="rtl:-scale-x-100" />
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

function DetailSkeleton() {
  const tc = useTranslations('Common');
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <p role="status" className="sr-only">
        {tc('loading')}
      </p>
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
