'use client';

import { reportGallerySchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Dialog, PillButton } from '@/components/app/dialog';
import { FormAlert, FormNotice, TextField } from '@/components/auth/fields';
import { clientApi } from '@/lib/client-api';

/** C-10: anyone with the link can flag it; reports go to the admin abuse queue. */
export function ReportDialog({ token, open, onClose }: { token: string; open: boolean; onClose: () => void }) {
  const t = useTranslations('Client.report');
  return (
    <Dialog open={open} onClose={onClose} title={t('title')} width="max-w-[520px]">
      <ReportForm token={token} onClose={onClose} />
    </Dialog>
  );
}

function ReportForm({ token, onClose }: { token: string; onClose: () => void }) {
  const t = useTranslations('Client.report');
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; email?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = reportGallerySchema.safeParse({ reason, email: email.trim() || undefined });
    if (!parsed.success) {
      const paths = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setErrors({ reason: paths.has('reason') ? t('reasonError') : undefined, email: paths.has('email') ? t('emailError') : undefined });
      return;
    }
    setPending(true);
    setErrors({});
    try {
      await clientApi.report(token, parsed.data.reason, parsed.data.email);
      setSent(true);
    } catch {
      setErrors({ form: t('failed') });
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <FormNotice>{t('thanks')}</FormNotice>
        <div className="flex justify-center">
          <PillButton onClick={onClose}>{t('close')}</PillButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-ink-body">{t('intro')}</p>
      <FormAlert message={errors.form} />
      <div>
        <label htmlFor={reasonId} className="sr-only">
          {t('reason')}
        </label>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reason')}
          rows={4}
          maxLength={1000}
          aria-invalid={errors.reason ? true : undefined}
          className={`w-full resize-none border bg-white px-[22px] py-3 text-lg text-ink placeholder:text-[rgba(51,51,51,0.5)] focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:outline-none ${
            errors.reason ? 'border-danger' : 'border-field-border'
          }`}
        />
        {errors.reason ? <p className="mt-1.5 text-sm text-danger">{errors.reason}</p> : null}
      </div>
      <TextField label={t('email')} type="email" ltr value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <div className="flex justify-center">
        <PillButton type="submit" tone="danger" pending={pending}>
          {t('send')}
        </PillButton>
      </div>
    </form>
  );
}
