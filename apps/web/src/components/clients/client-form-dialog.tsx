'use client';

import { type ClientInput, clientSchema, updateClientSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useFormErrors } from '@/components/auth/use-form-errors';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextareaField, TextField } from '@/components/ui/field';
import { Alert } from '@/components/ui/state';
import { ApiError, normalisePhone } from '@/lib/api';
import { useCreateClient, useUpdateClient } from '@/lib/queries-galleries';
import type { Client } from '@/lib/types-galleries';

/** Add client (no `client`) or edit one. A phone already used by another client is refused. */
export function ClientFormDialog({
  open,
  client,
  onClose,
  onSaved,
}: {
  open: boolean;
  client?: Client;
  onClose: () => void;
  onSaved?: (client: Client) => void;
}) {
  const t = useTranslations('App.clients.form');
  const tc = useTranslations('Common');
  const formId = useId();
  const create = useCreateClient();
  const update = useUpdateClient(client?.id ?? '');
  const pending = create.isPending || update.isPending;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client ? t('editTitle') : t('addTitle')}
      description={client ? undefined : t('addDescription')}
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" form={formId} pending={pending}>
            {client ? t('save') : t('add')}
          </Button>
        </>
      }
    >
      <ClientForm
        formId={formId}
        client={client}
        submit={(input) => (client ? update.mutateAsync(input) : create.mutateAsync(input as ClientInput))}
        onDone={(saved) => {
          onSaved?.(saved);
          onClose();
        }}
      />
    </Dialog>
  );
}

type Values = { name: string; phone: string; email: string; notes: string };

function ClientForm({
  formId,
  client,
  submit,
  onDone,
}: {
  formId: string;
  client?: Client;
  submit: (input: { name?: string; phone?: string; email?: string | null; notes?: string | null }) => Promise<Client>;
  onDone: (client: Client) => void;
}) {
  const t = useTranslations('App.clients.form');
  const tErrors = useTranslations('Errors');
  const errors = useFormErrors();
  const [values, setValues] = useState<Values>({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    notes: client?.notes ?? '',
  });
  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = {
      name: values.name,
      phone: normalisePhone(values.phone),
      email: values.email.trim() || null,
      notes: values.notes.trim() || null,
    };
    const input = errors.validate(client ? updateClientSchema : clientSchema, body);
    if (!input) return;
    try {
      onDone(await submit(input));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'client_exists') {
        errors.setFieldError('phone', t('duplicatePhone'));
        return;
      }
      errors.fromError(error);
    }
  }

  const f = errors.fields;
  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {errors.form ? <Alert key={errors.attempt}>{errors.form}</Alert> : null}
      <TextField
        id={errors.id('name')}
        label={t('name')}
        placeholder={t('namePlaceholder')}
        value={values.name}
        onChange={set('name')}
        error={f.name}
        autoComplete="off"
        autoFocus
        maxLength={100}
      />
      <TextField
        id={errors.id('phone')}
        label={t('phone')}
        placeholder={t('phonePlaceholder')}
        hint={t('phoneHint')}
        value={values.phone}
        onChange={set('phone')}
        error={f.phone}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        ltr
      />
      <TextField
        id={errors.id('email')}
        label={t('email')}
        placeholder={t('emailPlaceholder')}
        value={values.email}
        onChange={set('email')}
        error={f.email ? tErrors('field.email') : undefined}
        type="email"
        inputMode="email"
        autoComplete="off"
        optional
        ltr
      />
      <TextareaField
        id={errors.id('notes')}
        label={t('notes')}
        placeholder={t('notesPlaceholder')}
        value={values.notes}
        onChange={set('notes')}
        error={f.notes ? t('notesTooLong') : undefined}
        rows={3}
        maxLength={1000}
        optional
      />
    </form>
  );
}
