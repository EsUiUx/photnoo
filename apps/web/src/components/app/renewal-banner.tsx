'use client';

import { BillingRules } from '@photnoo/shared';
import { AlertTriangle, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { Me } from '@/lib/types';

/** PRD B-05 / B-08: renewal reminder from 15 days before the cycle ends, and the lapsed notice. */
export function RenewalBanner({ me }: { me?: Me }) {
  const t = useTranslations('App.banner');
  const locale = useLocale();
  const pathname = usePathname();
  const sub = me?.subscription;
  if (!sub || pathname.startsWith('/billing')) return null;

  let tone: 'warning' | 'danger' | null = null;
  let message = '';
  if (sub.state === 'soft_locked' || sub.state === 'dormant') {
    tone = 'danger';
    message = t('ended');
  } else if (sub.state === 'pending_payment') {
    tone = 'warning';
    message = t('noPlan');
  } else if ((sub.state === 'active' || sub.state === 'trial') && !sub.renewalPaid && sub.daysLeft <= BillingRules.bannerDays) {
    tone = 'warning';
    message = t(sub.state === 'trial' ? 'trialEnds' : 'renewSoon', { days: sub.daysLeft, date: formatDate(sub.cycleEnd, locale) });
  }
  if (!tone) return null;
  const Icon = tone === 'danger' ? AlertTriangle : Clock;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 text-sm sm:px-6 lg:px-8',
        tone === 'danger' ? 'border-danger/20 bg-danger-soft text-danger' : 'border-warning/20 bg-warning-soft text-warning',
      )}
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1 font-medium">{message}</p>
      <Link
        href="/billing"
        className="inline-flex h-9 items-center rounded-md bg-surface px-3 text-sm font-medium text-fg shadow-xs ring-1 ring-border-strong hover:bg-surface-subtle pointer-coarse:h-11"
      >
        {t('cta')}
      </Link>
    </div>
  );
}
