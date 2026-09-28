'use client';

import { BillingRules } from '@photnoo/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import type { Me } from '@/lib/types';

/** PRD B-05 / B-08: renewal reminder from 15 days before the cycle ends, and the lapsed notice. */
export function RenewalBanner({ me }: { me?: Me }) {
  const t = useTranslations('App.banner');
  const locale = useLocale();
  const pathname = usePathname();
  const sub = me?.subscription;
  if (!sub || pathname.startsWith('/billing')) return null;

  let tone: 'warn' | 'danger' | null = null;
  let message = '';
  if (sub.state === 'soft_locked' || sub.state === 'dormant') {
    tone = 'danger';
    message = t('ended');
  } else if (sub.state === 'pending_payment') {
    tone = 'warn';
    message = t('noPlan');
  } else if ((sub.state === 'active' || sub.state === 'trial') && !sub.renewalPaid && sub.daysLeft <= BillingRules.bannerDays) {
    tone = 'warn';
    message = t(sub.state === 'trial' ? 'trialEnds' : 'renewSoon', { days: sub.daysLeft, date: formatDate(sub.cycleEnd, locale) });
  }
  if (!tone) return null;

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-8 xl:px-12 ${
        tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-[#fff8eb] text-ink-body'
      }`}
    >
      <p className="flex-1">{message}</p>
      <Link href="/billing" className="rounded-full bg-primary-400 px-4 py-1.5 font-semibold text-white hover:bg-primary-500">
        {t('cta')}
      </Link>
    </div>
  );
}
