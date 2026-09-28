'use client';

import { BillingRules } from '@photnoo/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { PillButton } from '@/components/app/dialog';
import { FormAlert } from '@/components/auth/fields';
import { ApiError } from '@/lib/api';
import { formatDate, isolate } from '@/lib/format';
import { fetchProofUrl, useCancelPayment, useSubmitProof } from '@/lib/queries';
import type { BillingPayment, PaymentDetails, PaymentMethod } from '@/lib/types';

/**
 * B-03 manual payment: where to send the money, the reference to write in the transfer note,
 * and the receipt upload. After upload the payment waits for review (A-02).
 */
export function PaymentPanel({ payment, details }: { payment: BillingPayment; details: PaymentDetails }) {
  const t = useTranslations('App.billing.payment');
  const format = useFormatter();
  const locale = useLocale();
  const methods = (Object.keys(details) as PaymentMethod[]).filter((m) => details[m]);
  const [method, setMethod] = useState<PaymentMethod | undefined>(payment.method ?? methods[0]);
  const [replacing, setReplacing] = useState(false);
  const cancel = useCancelPayment();
  const submitted = payment.status === 'pending';

  return (
    <section id="payment-panel" aria-labelledby="payment-title" className="scroll-mt-6 rounded-2xl border-2 border-primary-300 bg-primary-50 p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="payment-title" className="text-2xl font-bold text-primary-900">
            {submitted ? t('reviewTitle') : t('title')}
          </h2>
          <p className="mt-1 text-ink-body">
            {t(`kind.${payment.kind}`, { plan: isolate(payment.plan.label), cycle: t(`cycle.${payment.plan.cycle}`) })}
          </p>
        </div>
        <div className="text-end">
          <p className="text-sm text-ink-muted">{t('amount')}</p>
          <p className="text-3xl font-bold text-primary-500" dir="ltr">
            {format.number(payment.amountEgp)} EGP
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-ink-muted">{t('reference')}</p>
          <div className="mt-2 flex items-center gap-3">
            <output className="rounded-xl bg-white px-4 py-2 font-mono text-2xl font-bold tracking-widest text-primary-900" dir="ltr">
              {payment.reference}
            </output>
            <CopyButton value={payment.reference} />
          </div>
          <p className="mt-2 text-sm text-ink-muted">{t('referenceHelp')}</p>

          {methods.length === 0 ? (
            <p className="mt-6 text-danger">{t('noMethods')}</p>
          ) : (
            <div className="mt-6">
              <p className="text-sm font-medium text-ink-muted">{t('sendTo')}</p>
              <div role="tablist" aria-label={t('sendTo')} className="mt-2 flex flex-wrap gap-2">
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={method === m}
                    onClick={() => setMethod(m)}
                    className={`h-10 rounded-full border px-4 text-sm font-semibold ${
                      method === m ? 'border-primary-400 bg-primary-400 text-white' : 'border-field-border bg-white text-ink-body'
                    }`}
                  >
                    {t(`methods.${m}`)}
                  </button>
                ))}
              </div>
              {method ? <MethodDetails method={method} details={details} /> : null}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-5">
          {submitted && !replacing ? (
            <div className="flex flex-col gap-3">
              <p className="font-semibold text-primary-900">{t('received')}</p>
              <p className="text-ink-body">
                {t('receivedBody', {
                  method: payment.method ? t(`methods.${payment.method}`) : '',
                  amount: format.number(payment.declaredAmountEgp ?? 0),
                  date: formatDate(payment.submittedAt, locale),
                })}
              </p>
              <div className="flex flex-wrap gap-4 text-sm font-semibold">
                <button
                  type="button"
                  className="text-primary-400 underline"
                  onClick={() => void fetchProofUrl(payment.id).then(({ url }) => window.open(url, '_blank', 'noopener'))}
                >
                  {t('viewReceipt')}
                </button>
                <button type="button" className="text-primary-400 underline" onClick={() => setReplacing(true)}>
                  {t('replaceReceipt')}
                </button>
              </div>
            </div>
          ) : (
            <ProofForm payment={payment} method={method} onDone={() => setReplacing(false)} />
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-primary-200 pt-4">
        <button
          type="button"
          disabled={cancel.isPending}
          onClick={() => {
            if (window.confirm(t('cancelConfirm'))) cancel.mutate(payment.id);
          }}
          className="text-sm font-semibold text-danger underline disabled:opacity-60"
        >
          {t('cancel')}
        </button>
      </div>
    </section>
  );
}

function MethodDetails({ method, details }: { method: PaymentMethod; details: PaymentDetails }) {
  const t = useTranslations('App.billing.payment');
  const rows: Array<[string, string | null | undefined]> =
    method === 'instapay'
      ? [[t('fields.handle'), details.instapay?.handle]]
      : method === 'vodafone_cash'
        ? [[t('fields.number'), details.vodafone_cash?.number]]
        : [
            [t('fields.bank'), details.bank_transfer?.bank],
            [t('fields.accountName'), details.bank_transfer?.accountName],
            [t('fields.accountNumber'), details.bank_transfer?.accountNumber],
            [t('fields.iban'), details.bank_transfer?.iban],
          ];
  return (
    <dl role="tabpanel" className="mt-3 flex flex-col gap-2 rounded-xl bg-white p-4">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="flex items-center gap-2 font-semibold text-ink" dir="ltr">
              {value}
              <CopyButton value={value!} small />
            </dd>
          </div>
        ))}
    </dl>
  );
}

function ProofForm({ payment, method, onDone }: { payment: BillingPayment; method?: PaymentMethod; onDone: () => void }) {
  const t = useTranslations('App.billing.payment');
  const fileId = useId();
  const amountId = useId();
  const submit = useSubmitProof(payment.id);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(String(payment.declaredAmountEgp ?? payment.amountEgp));
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!method) return setError(t('errors.method'));
    if (!file) return setError(t('errors.file'));
    if (file.size > BillingRules.proofMaxBytes) return setError(t('errors.proof_too_large'));
    const declared = Number(amount);
    if (!Number.isFinite(declared) || declared <= 0) return setError(t('errors.amount'));
    try {
      await submit.mutateAsync({ file, method, declaredAmountEgp: declared });
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'generic';
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic'));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="font-semibold text-primary-900">{t('uploadTitle')}</p>
      <FormAlert message={error} />
      <div>
        <label htmlFor={amountId} className="text-sm font-medium text-ink-muted">
          {t('amountSent')}
        </label>
        <input
          id={amountId}
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          dir="ltr"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-field-border bg-white px-4 text-lg focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor={fileId} className="text-sm font-medium text-ink-muted">
          {t('receipt')}
        </label>
        <input
          id={fileId}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-primary-100 file:px-4 file:py-2 file:font-semibold file:text-primary-500"
        />
        <p className="mt-1 text-xs text-ink-muted">{t('receiptHelp')}</p>
      </div>
      <div>
        <PillButton type="submit" pending={submit.isPending}>
          {t('submit')}
        </PillButton>
      </div>
    </form>
  );
}

function CopyButton({ value, small }: { value: string; small?: boolean }) {
  const t = useTranslations('App.billing.payment');
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className={`shrink-0 rounded-full bg-primary-300 font-semibold text-primary-50 hover:bg-primary-400 ${small ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'}`}
    >
      {copied ? t('copied') : t('copy')}
    </button>
  );
}
