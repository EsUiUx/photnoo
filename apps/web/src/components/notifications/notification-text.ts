'use client';

import { BadgeCheck, Bell, CalendarClock, CircleAlert, Download, Eye, HardDrive, ImageUp, Lock, ShoppingBag, type LucideIcon } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMoney } from '@/components/billing/billing-shared';
import { formatBytes, formatDate, isolate } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/lib/types-account';

export type NotificationTone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

const LOOK: Record<NotificationType, { icon: LucideIcon; tone: NotificationTone }> = {
  gallery_opened: { icon: Eye, tone: 'brand' },
  gallery_downloaded: { icon: Download, tone: 'success' },
  gallery_expiring: { icon: CalendarClock, tone: 'warning' },
  gallery_closed: { icon: Lock, tone: 'info' },
  gallery_ready: { icon: ImageUp, tone: 'brand' },
  order_placed: { icon: ShoppingBag, tone: 'success' },
  payment_approved: { icon: BadgeCheck, tone: 'success' },
  payment_rejected: { icon: CircleAlert, tone: 'danger' },
  allowance_warning: { icon: HardDrive, tone: 'warning' },
  renewal_due: { icon: CalendarClock, tone: 'warning' },
};

export const TONE_CLASSES: Record<NotificationTone, string> = {
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

/** Where a notification leads: its gallery, its order, or billing. */
export function notificationHref(n: AppNotification): string | null {
  if (n.type === 'order_placed' && n.orderId) {
    return `${n.data.kind === 'print' ? '/prints' : '/store'}?order=${n.orderId}`;
  }
  if (n.galleryId) return `/galleries/${n.galleryId}`;
  if (n.type === 'payment_approved' || n.type === 'payment_rejected' || n.type === 'allowance_warning' || n.type === 'renewal_due') {
    return '/billing';
  }
  return null;
}

/**
 * Renders a notification from its type and data in the page language, so the same record
 * reads correctly in English and Arabic. Unknown types fall back to a plain bell.
 */
export function useNotificationText() {
  const t = useTranslations('App.notifications');
  const locale = useLocale();
  const format = useFormatter();
  const money = useMoney();
  const dateTime = (iso: string) =>
    format.dateTime(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', numberingSystem: 'latn' });

  return (n: AppNotification): { title: string; body: string; icon: LucideIcon; tone: NotificationTone } => {
    const d = n.data ?? {};
    const text = (key: string) => (d[key] === null || d[key] === undefined ? '' : String(d[key]));
    const gallery = text('gallery');
    const client = text('client') || t('yourClient');
    const look = LOOK[n.type] ?? { icon: Bell, tone: 'brand' as const };
    let title = '';
    let body = '';
    switch (n.type) {
      case 'gallery_opened':
        title = t('types.gallery_opened.title');
        body = t('types.gallery_opened.body', { client, gallery });
        break;
      case 'gallery_downloaded':
        title = t('types.gallery_downloaded.title');
        body = t(text('reason') === 'cap' ? 'types.gallery_downloaded.bodyCap' : 'types.gallery_downloaded.bodyAll', { client, gallery });
        break;
      case 'gallery_expiring':
        title = t('types.gallery_expiring.title');
        body = t('types.gallery_expiring.body', { gallery, date: d.expiresAt ? dateTime(String(d.expiresAt)) : '' });
        break;
      case 'gallery_closed':
        title = t('types.gallery_closed.title');
        body = t('types.gallery_closed.body', { gallery });
        break;
      case 'gallery_ready':
        title = t('types.gallery_ready.title');
        body = t('types.gallery_ready.body', { gallery, files: Number(d.files ?? 0) });
        break;
      case 'order_placed':
        title = t('types.order_placed.title', { number: isolate(text('number')) });
        body = t('types.order_placed.body', { customer: text('customerName') || t('aCustomer'), total: money(Number(d.totalEgp ?? 0)) });
        break;
      case 'payment_approved':
        title = t('types.payment_approved.title');
        body = t('types.payment_approved.body', { reference: isolate(text('reference')), date: formatDate(text('periodEnd') || null, locale) });
        break;
      case 'payment_rejected':
        title = t('types.payment_rejected.title');
        body = t('types.payment_rejected.body', { reference: isolate(text('reference')), reason: text('reason') });
        break;
      case 'allowance_warning':
        title = t('types.allowance_warning.title', { percent: String(d.percent ?? '') });
        body = t('types.allowance_warning.body', {
          used: formatBytes(text('usedBytes') || '0', locale),
          allowance: formatBytes(text('allowanceBytes') || '0', locale),
        });
        break;
      case 'renewal_due':
        title = t('types.renewal_due.title', { trial: Number(d.trial) === 1 ? 'yes' : 'no' });
        body = t('types.renewal_due.body', { days: Number(d.days ?? 0), date: formatDate(text('cycleEnd') || null, locale) });
        break;
      default:
        title = t('title');
    }
    return { title, body, icon: look.icon, tone: look.tone };
  };
}
