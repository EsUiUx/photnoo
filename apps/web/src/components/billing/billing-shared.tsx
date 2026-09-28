'use client';

import { ExternalLink } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { Alert } from '@/components/ui/state';
import type { Tone } from '@/components/ui/primitives';
import type { PaymentStatus, SubscriptionState } from '@/lib/types';

/** "1,500 EGP" / "1,500 ج.م" with Western digits in both languages. */
export function useMoney() {
  const t = useTranslations('App.billing');
  const format = useFormatter();
  return useCallback(
    (amount: number) => t('money', { amount: format.number(amount, { numberingSystem: 'latn', maximumFractionDigits: 2 }) }),
    [t, format],
  );
}

/** Plain number with Western digits (percentages, counts). */
export function useNumber() {
  const format = useFormatter();
  return useCallback((value: number) => format.number(value, { numberingSystem: 'latn' }), [format]);
}

export const SUBSCRIPTION_TONES: Record<SubscriptionState, Tone> = {
  trial: 'info',
  active: 'success',
  pending_payment: 'warning',
  soft_locked: 'danger',
  dormant: 'neutral',
  suspended: 'danger',
};

export const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  approved: 'success',
  pending: 'info',
  awaiting_proof: 'warning',
  rejected: 'danger',
  cancelled: 'neutral',
};

/**
 * Opens a signed file URL without tripping popup blockers: the tab is opened synchronously in
 * the click, then pointed at the URL once it arrives. If the browser refused the tab, the URL
 * is kept so the page can offer a plain link instead.
 */
export function useDocumentOpener() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const open = useCallback(async (id: string, fetchUrl: () => Promise<{ url: string }>) => {
    setFailed(false);
    setFallbackUrl(null);
    setPendingId(id);
    const tab = window.open('', '_blank');
    try {
      const { url } = await fetchUrl();
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        setFallbackUrl(url);
      }
    } catch {
      tab?.close();
      setFailed(true);
    } finally {
      setPendingId(null);
    }
  }, []);

  const dismiss = useCallback(() => {
    setFailed(false);
    setFallbackUrl(null);
  }, []);

  return { open, pendingId, failed, fallbackUrl, dismiss };
}

export function DocumentNotice({ failed, fallbackUrl, className }: { failed: boolean; fallbackUrl: string | null; className?: string }) {
  const t = useTranslations('App.billing.document');
  if (failed) return <Alert className={className}>{t('failed')}</Alert>;
  if (fallbackUrl)
    return (
      <Alert tone="info" className={className}>
        <span>{t('blocked')} </span>
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
          {t('open')}
          <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
        </a>
      </Alert>
    );
  return null;
}
