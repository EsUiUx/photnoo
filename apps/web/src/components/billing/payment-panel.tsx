'use client';

import { BillingRules } from '@photnoo/shared';
import { CheckCircle2, ExternalLink, FileText, Upload, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Badge, Card, CopyButton, DetailList, Segmented } from '@/components/ui/primitives';
import { Alert } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatBytes, formatDate, isolate } from '@/lib/format';
import { fetchProofUrl, useCancelPayment, useSubmitProof } from '@/lib/queries';
import type { BillingPayment, PaymentDetails, PaymentMethod } from '@/lib/types';
import { DocumentNotice, PAYMENT_TONES, useDocumentOpener, useMoney } from './billing-shared';

const ACCEPT = ['image/jpeg', 'image/png', 'application/pdf'];

/**
 * Manual payment in three steps: note the amount and reference, send the money to one of the
 * methods, upload the receipt. After upload the payment waits for staff review.
 */
export function PaymentPanel({ payment, details }: { payment: BillingPayment; details: PaymentDetails }) {
  const t = useTranslations('App.billing.payment');
  const locale = useLocale();
  const money = useMoney();
  const methods = (Object.keys(details) as PaymentMethod[]).filter((m) => details[m]);
  const [method, setMethod] = useState<PaymentMethod | undefined>(payment.method ?? methods[0]);
  const [replacing, setReplacing] = useState(false);
  const cancel = useCancelPayment();
  const { confirm, dialog } = useConfirm();
  const submitted = payment.status === 'pending';
  const statusKey = payment.status === 'pending' ? 'pending' : 'awaiting_proof';

  async function onCancel() {
    const ok = await confirm({ title: t('cancelTitle'), body: t('cancelConfirm'), confirmLabel: t('cancelYes'), cancelLabel: t('cancelNo') });
    if (ok) cancel.mutate(payment.id);
  }

  return (
    <Card as="section" className="border-brand/40 p-5 sm:p-6">
      <div id="payment-panel" className="scroll-mt-6" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="payment-title" className="text-lg font-semibold text-fg">
            {submitted ? t('reviewTitle') : t('title')}
          </h2>
          <p className="mt-1 text-sm text-fg-secondary">
            {t(`kind.${payment.kind}`, { plan: isolate(payment.plan.label), cycle: t(`cycle.${payment.plan.cycle}`) })}
            <span className="text-fg-muted"> · {t('created', { date: formatDate(payment.createdAt, locale) })}</span>
          </p>
        </div>
        <Badge tone={PAYMENT_TONES[payment.status]} dot>
          {t(`status.${statusKey}`)}
        </Badge>
      </div>

      <ol className="mt-6 flex flex-col">
        <Step n={1} title={t('step1')}>
          <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-10">
            <div>
              <p className="text-sm text-fg-muted">{t('amount')}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-fg tabular">{money(payment.amountEgp)}</p>
            </div>
            <div>
              <p className="text-sm text-fg-muted" id="payment-ref-label">
                {t('reference')}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <output
                  aria-labelledby="payment-ref-label"
                  dir="ltr"
                  className="rounded-md border border-border bg-surface-subtle px-4 py-1.5 font-mono text-2xl font-semibold tracking-wider text-fg"
                >
                  {payment.reference}
                </output>
                <CopyButton value={payment.reference} label={t('copyReference')} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-fg-muted">{t('referenceHelp')}</p>
        </Step>

        <Step n={2} title={t('step2')}>
          {methods.length === 0 ? (
            <Alert>{t('noMethods')}</Alert>
          ) : (
            <>
              <Segmented
                label={t('methodLabel')}
                value={method ?? methods[0]!}
                onChange={setMethod}
                options={methods.map((m) => ({ value: m, label: t(`methods.${m}`) }))}
                className="max-w-full flex-wrap"
              />
              {method ? <MethodDetails method={method} details={details} amount={money(payment.amountEgp)} /> : null}
            </>
          )}
        </Step>

        <Step n={3} title={t('step3')} last>
          {submitted && !replacing ? (
            <ReceiptSummary payment={payment} onReplace={() => setReplacing(true)} />
          ) : (
            <ProofForm payment={payment} method={method} replacing={replacing} onDone={() => setReplacing(false)} />
          )}
        </Step>
      </ol>

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
        {cancel.isError ? <Alert>{t('cancelFailed')}</Alert> : null}
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            pending={cancel.isPending}
            onClick={() => void onCancel()}
            className="text-danger hover:bg-danger-soft hover:text-danger"
          >
            {t('cancel')}
          </Button>
        </div>
      </div>
      {dialog}
    </Card>
  );
}

function Step({ n, title, last, children }: { n: number; title: string; last?: boolean; children: React.ReactNode }) {
  const id = useId();
  return (
    <li aria-labelledby={id} className="grid grid-cols-[2rem_1fr] gap-x-4">
      <div className="flex flex-col items-center">
        <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand tabular">
          {n}
        </span>
        {!last ? <span aria-hidden className="mt-2 w-px flex-1 bg-border" /> : null}
      </div>
      <div className={cn('min-w-0', last ? 'pb-0' : 'pb-8')}>
        <h3 id={id} className="flex min-h-8 items-center text-base font-semibold text-fg">
          <span className="sr-only">{n}. </span>
          {title}
        </h3>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

function MethodDetails({ method, details, amount }: { method: PaymentMethod; details: PaymentDetails; amount: string }) {
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
  const copyable = method !== 'bank_transfer' ? [0] : [2, 3];

  return (
    <div role="region" aria-label={t('detailsFor', { method: t(`methods.${method}`) })} aria-live="polite" className="mt-4 rounded-lg border border-border bg-surface-subtle p-4 sm:p-5">
      <p className="mb-4 text-sm text-fg-secondary">{t('sendExactly', { amount })}</p>
      <DetailList
        className="items-center"
        items={rows
          .map((row, i) => ({ row, i }))
          .filter(({ row: [, value] }) => value)
          .map(({ row: [label, value], i }) => ({
            label,
            value: (
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span dir="ltr" className={cn('break-all', copyable.includes(i) && 'font-mono')}>
                  {value}
                </span>
                <CopyButton value={value!} />
              </span>
            ),
          }))}
      />
    </div>
  );
}

function ReceiptSummary({ payment, onReplace }: { payment: BillingPayment; onReplace: () => void }) {
  const t = useTranslations('App.billing.payment');
  const locale = useLocale();
  const money = useMoney();
  const opener = useDocumentOpener();
  return (
    <div className="rounded-lg border border-success/25 bg-success-soft p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-success" />
        <div className="min-w-0">
          <p className="text-base font-semibold text-fg">{t('received')}</p>
          <p className="mt-1 text-sm text-fg-secondary">
            {t('receivedBody', {
              method: payment.method ? t(`methods.${payment.method}`) : '',
              amount: money(payment.declaredAmountEgp ?? payment.amountEgp),
              date: formatDate(payment.submittedAt, locale),
            })}
          </p>
          {payment.proofName ? (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-muted">
              <FileText size={16} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">{t('fileName')}: </span>
              <span dir="ltr" className="truncate">
                {payment.proofName}
              </span>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={ExternalLink}
              pending={opener.pendingId === payment.id}
              onClick={() => void opener.open(payment.id, () => fetchProofUrl(payment.id))}
            >
              {t('viewReceipt')}
            </Button>
            <Button variant="ghost" size="sm" icon={Upload} onClick={onReplace}>
              {t('replaceReceipt')}
            </Button>
          </div>
          <DocumentNotice failed={opener.failed} fallbackUrl={opener.fallbackUrl} className="mt-4" />
        </div>
      </div>
    </div>
  );
}

type FieldErrors = { method?: string; amount?: string; file?: string; form?: string };

function ProofForm({ payment, method, replacing, onDone }: { payment: BillingPayment; method?: PaymentMethod; replacing: boolean; onDone: () => void }) {
  const t = useTranslations('App.billing.payment');
  const locale = useLocale();
  const fileId = useId();
  const amountId = useId();
  const labelId = useId();
  const submit = useSubmitProof(payment.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [amount, setAmount] = useState(String(payment.declaredAmountEgp ?? payment.amountEgp));
  const [errors, setErrors] = useState<FieldErrors>({});

  function pick(next: File | null) {
    setFile(next);
    setErrors((e) => ({ ...e, file: undefined }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: FieldErrors = {};
    if (!method) next.method = t('errors.method');
    const declared = Number(amount.replace(/,/g, ''));
    if (!amount.trim() || !Number.isFinite(declared) || declared <= 0) next.amount = t('errors.amount');
    if (!file) next.file = t('errors.file');
    else if (file.size > BillingRules.proofMaxBytes) next.file = t('errors.proof_too_large');
    else if (file.type && !ACCEPT.includes(file.type)) next.file = t('errors.unsupported_proof');
    setErrors(next);
    if (next.amount) return document.getElementById(amountId)?.focus();
    if (next.file) return fileRef.current?.focus();
    if (next.method || !method || !file) return;
    try {
      await submit.mutateAsync({ file, method, declaredAmountEgp: declared });
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'generic';
      const message = t.has(`errors.${code}`) ? t(`errors.${code}`) : t('errors.generic');
      if (code === 'proof_too_large' || code === 'unsupported_proof' || code === 'proof_required') {
        setErrors({ file: message });
        fileRef.current?.focus();
      } else setErrors({ form: message });
    }
  }

  const describedBy = [`${fileId}-help`, errors.file ? `${fileId}-error` : null].filter(Boolean).join(' ');

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      {errors.form ? <Alert>{errors.form}</Alert> : null}

      <div>
        <p className="text-sm font-medium text-fg">{t('paidBy')}</p>
        <p className="mt-1 text-base text-fg">{method ? t(`methods.${method}`) : '—'}</p>
        {errors.method ? (
          <p role="alert" className="mt-1 text-sm font-medium text-danger">
            {errors.method}
          </p>
        ) : (
          <p className="mt-1 text-sm text-fg-muted">{t('paidByHint')}</p>
        )}
      </div>

      <TextField
        id={amountId}
        label={t('amountSent')}
        hint={t('amountHint')}
        error={errors.amount}
        inputMode="decimal"
        autoComplete="off"
        ltr
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          if (errors.amount) setErrors((x) => ({ ...x, amount: undefined }));
        }}
        className="max-w-xs"
        inputClassName="tabular"
        trailing={<span className="pe-3 text-sm font-medium text-fg-muted">{t('egp')}</span>}
      />

      <div className="flex flex-col gap-1.5">
        <p id={labelId} className="text-sm font-medium text-fg">
          {t('receipt')}
        </p>
        <label
          htmlFor={fileId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors duration-150',
            'has-[:focus-visible]:border-brand has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/15',
            errors.file ? 'border-danger bg-danger-soft/40' : dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface hover:bg-surface-subtle',
          )}
        >
          <input
            ref={fileRef}
            id={fileId}
            type="file"
            accept={ACCEPT.join(',')}
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            aria-invalid={errors.file ? true : undefined}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <>
              <FileText size={22} strokeWidth={1.75} aria-hidden className="text-brand" />
              <span className="max-w-full truncate text-sm font-medium text-fg" dir="ltr">
                {file.name}
              </span>
              <span className="text-xs text-fg-muted tabular">{formatBytes(file.size, locale)}</span>
              <span className="text-sm font-medium text-brand underline underline-offset-2">{t('dropReplace')}</span>
            </>
          ) : (
            <>
              <Upload size={22} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
              <span className="text-sm font-medium text-fg">{t('dropTitle')}</span>
            </>
          )}
        </label>
        {errors.file ? (
          <p id={`${fileId}-error`} className="text-sm font-medium text-danger">
            {errors.file}
          </p>
        ) : null}
        <p id={`${fileId}-help`} className="text-sm text-fg-muted">
          {t('receiptHelp')}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" pending={submit.isPending} icon={Upload}>
          {t('submit')}
        </Button>
        {replacing ? (
          <Button variant="ghost" onClick={onDone} disabled={submit.isPending}>
            {t('keepCurrent')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
