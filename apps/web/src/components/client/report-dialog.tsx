'use client';

import { reportGallerySchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextareaField, TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { clientApi } from '@/lib/client-api';

/** C-10: anyone with the link can flag it; reports go to the admin abuse queue. */
export function ReportDialog({ token, open, onClose }: { token: string; open: boolean; onClose: () => void }) {
  const t = useTranslations('Client.report');
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title={t('title')} size="sm" dismissible={!pending}>
      <ReportForm token={token} onClose={onClose} onPending={setPending} />
    </Dialog>
  );
}

function ReportForm({ token, onClose, onPending }: { token: string; onClose: () => void; onPending: (pending: boolean) => void }) {
  const t = useTranslations('Client.report');
  const reasonId = useId();
  const emailId = useId();
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; email?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  function busy(value: boolean) {
    setPending(value);
    onPending(value);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = reportGallerySchema.safeParse({ reason, email: email.trim() || undefined });
    if (!parsed.success) {
      const paths = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      const next = { reason: paths.has('reason') ? t('reasonError') : undefined, email: paths.has('email') ? t('emailError') : undefined };
      setErrors(next);
      document.getElementById(next.reason ? reasonId : emailId)?.focus();
      return;
    }
    busy(true);
    setErrors({});
    try {
      await clientApi.report(token, parsed.data.reason, parsed.data.email);
      setSent(true);
    } catch {
      setErrors({ form: t('failed') });
    } finally {
      busy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-6">
        <Alert tone="success">{t('thanks')}</Alert>
        <div className="flex justify-end">
          <Button onClick={onClose} autoFocus>
            {t('close')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-sm text-fg-secondary">{t('intro')}</p>
      {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
      <TextareaField
        id={reasonId}
        label={t('reason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={1000}
        error={errors.reason}
      />
      <TextField
        id={emailId}
        label={t('email')}
        optional
        hint={t('emailHint')}
        type="email"
        inputMode="email"
        autoComplete="email"
        ltr
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          {t('cancel')}
        </Button>
        <Button type="submit" pending={pending}>
          {t('send')}
        </Button>
      </div>
    </form>
  );
}
