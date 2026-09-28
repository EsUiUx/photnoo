'use client';

import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/primitives';
import { formatDate, isolate } from '@/lib/format';
import { fetchInvoiceUrl } from '@/lib/queries';
import type { BillingPayment } from '@/lib/types';
import { DocumentNotice, PAYMENT_TONES, useDocumentOpener, useMoney } from './billing-shared';

/** Every payment with its status and invoice PDF: a table on md+, stacked cards on phones. */
export function PaymentHistory({ payments }: { payments: BillingPayment[] }) {
  const t = useTranslations('App.billing.history');
  const locale = useLocale();
  const money = useMoney();
  const opener = useDocumentOpener();

  const date = (p: BillingPayment) => formatDate(p.decidedAt ?? p.createdAt, locale);
  const plan = (p: BillingPayment) => `${isolate(p.plan.label)} · ${t(`cycle.${p.plan.cycle}`)}`;

  const status = (p: BillingPayment) => (
    <>
      <Badge tone={PAYMENT_TONES[p.status]} dot>
        {t(`status.${p.status}`)}
      </Badge>
      {p.rejectReason ? <span className="mt-1 block text-xs text-danger">{t('rejectReason', { reason: p.rejectReason })}</span> : null}
    </>
  );

  const invoice = (p: BillingPayment) =>
    p.invoice ? (
      <Button
        variant="ghost"
        size="sm"
        icon={FileText}
        pending={opener.pendingId === p.invoice.id}
        aria-label={t('openInvoice', { number: p.invoice.number })}
        onClick={() => void opener.open(p.invoice!.id, () => fetchInvoiceUrl(p.invoice!.id))}
        className="-ms-3 font-mono text-brand hover:text-brand"
      >
        <span dir="ltr">{p.invoice.number}</span>
      </Button>
    ) : (
      <span className="text-sm text-fg-muted">
        <span aria-hidden>—</span>
        <span className="sr-only">{t('noInvoice')}</span>
      </span>
    );

  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title" className="text-lg font-semibold text-fg">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">{t('intro')}</p>

      <DocumentNotice failed={opener.failed} fallbackUrl={opener.fallbackUrl} className="mt-4" />

      <Card as="div" className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-subtle">
            <tr>
              {(['date', 'reference', 'plan', 'amount', 'status', 'invoice'] as const).map((key) => (
                <th key={key} scope="col" className={`px-4 py-3 text-xs font-medium text-fg-muted ${key === 'amount' ? 'text-end' : 'text-start'}`}>
                  {t(`columns.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-fg-secondary tabular">{date(p)}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap text-fg">
                  <span dir="ltr">{p.reference}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-fg">{plan(p)}</span>
                  <span className="block text-xs text-fg-muted">{t(`kind.${p.kind}`)}</span>
                </td>
                <td className="px-4 py-3 text-end font-medium whitespace-nowrap text-fg tabular">{money(p.amountEgp)}</td>
                <td className="px-4 py-3">{status(p)}</td>
                <td className="px-4 py-2">{invoice(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="mt-5 flex flex-col gap-3 md:hidden">
        {payments.map((p) => (
          <li key={p.id}>
            <Card as="article" className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fg">{plan(p)}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {t(`kind.${p.kind}`)} · <span className="tabular">{date(p)}</span>
                  </p>
                </div>
                <p className="text-base font-semibold whitespace-nowrap text-fg tabular">{money(p.amountEgp)}</p>
              </div>
              <div className="mt-3">{status(p)}</div>
              <dl className="mt-3 grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
                <dt className="text-fg-muted">{t('columns.reference')}</dt>
                <dd className="font-mono text-fg">
                  <span dir="ltr">{p.reference}</span>
                </dd>
                <dt className="text-fg-muted">{t('columns.invoice')}</dt>
                <dd>{invoice(p)}</dd>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
