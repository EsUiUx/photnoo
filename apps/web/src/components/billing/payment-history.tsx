'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { formatDate, isolate } from '@/lib/format';
import { fetchInvoiceUrl } from '@/lib/queries';
import type { BillingPayment } from '@/lib/types';

const STATUS_STYLES: Record<BillingPayment['status'], string> = {
  approved: 'bg-[#dfffd7] text-[#368605]',
  pending: 'bg-[#ffe2c8] text-[#904704]',
  awaiting_proof: 'bg-[#ffe2c8] text-[#904704]',
  rejected: 'bg-[#ffc2c3] text-[#820002]',
  cancelled: 'bg-[#c9c9c9] text-[#404040]',
};

/** B-04: every payment with its invoice PDF. */
export function PaymentHistory({ payments }: { payments: BillingPayment[] }) {
  const t = useTranslations('App.billing.history');
  const format = useFormatter();
  const locale = useLocale();
  const [opening, setOpening] = useState<string | null>(null);

  async function openInvoice(id: string) {
    setOpening(id);
    try {
      const { url } = await fetchInvoiceUrl(id);
      window.open(url, '_blank', 'noopener');
    } finally {
      setOpening(null);
    }
  }

  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className="text-2xl font-bold text-primary-900">
        {t('title')}
      </h2>
      <div className="mt-5 overflow-x-auto rounded-lg bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead className="bg-primary-50 text-ink-muted">
            <tr>
              {(['date', 'reference', 'plan', 'amount', 'status', 'invoice'] as const).map((key) => (
                <th key={key} scope="col" className="px-4 py-3 text-start font-semibold">
                  {t(`columns.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-4 py-3">{formatDate(payment.decidedAt ?? payment.createdAt, locale)}</td>
                <td className="px-4 py-3 font-mono" dir="ltr">
                  {payment.reference}
                </td>
                <td className="px-4 py-3">
                  {isolate(payment.plan.label)} · {t(`cycle.${payment.plan.cycle}`)}
                  <span className="block text-xs text-ink-muted">{t(`kind.${payment.kind}`)}</span>
                </td>
                <td className="px-4 py-3" dir="ltr">
                  {format.number(payment.amountEgp)} EGP
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-[7px] px-2 py-1 text-xs font-semibold ${STATUS_STYLES[payment.status]}`}>
                    {t(`status.${payment.status}`)}
                  </span>
                  {payment.rejectReason ? <span className="mt-1 block text-xs text-danger">{payment.rejectReason}</span> : null}
                </td>
                <td className="px-4 py-3">
                  {payment.invoice ? (
                    <button
                      type="button"
                      onClick={() => void openInvoice(payment.invoice!.id)}
                      disabled={opening === payment.invoice.id}
                      className="font-semibold text-primary-400 underline disabled:opacity-60"
                    >
                      {payment.invoice.number}
                    </button>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
