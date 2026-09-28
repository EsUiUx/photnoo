'use client';

import { passwordSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { Checkbox, FormAlert, FormNotice, SubmitButton, TextField, TextLink } from './fields';
import { useFormErrors } from './use-form-errors';

type Invite = { name: string; email: string };

const formSchema = z.object({
  password: passwordSchema,
  acceptTerms: z.literal(true),
  acceptContentDeclaration: z.literal(true),
});

/**
 * Figma "Join Photno Now!". Photnoo is invite-only, so name and email come from the approved
 * application and cannot be edited; the photographer only chooses a password and accepts terms.
 */
export function InviteForm({ token }: { token: string }) {
  const t = useTranslations('Invite');
  const router = useRouter();
  const errors = useFormErrors();
  const [invite, setInvite] = useState<Invite | 'loading' | 'invalid'>('loading');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptContent, setAcceptContent] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Invite>(`/v1/auth/invites/${encodeURIComponent(token)}`)
      .then((data) => !cancelled && setInvite(data))
      .catch(() => !cancelled && setInvite('invalid'));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (invite === 'loading') {
    return <div className="h-60 animate-pulse bg-field-muted" aria-busy="true" />;
  }
  if (invite === 'invalid') {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <FormNotice>{t('invalid')}</FormNotice>
        <TextLink href="/login">{t('backToLogin')}</TextLink>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = errors.validate(formSchema, {
      password,
      acceptTerms,
      acceptContentDeclaration: acceptContent,
    });
    if (!input) return;
    setPending(true);
    try {
      await api('/v1/auth/accept-invite', { body: { token, ...input } });
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'invite_invalid') setInvite('invalid');
      errors.fromError(error);
      setPending(false);
    }
  }

  const termsError = Boolean(errors.fields.acceptTerms || errors.fields.acceptContentDeclaration);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <FormAlert message={errors.form} />
          <TextField label={t('name')} value={invite.name} disabled readOnly />
          <TextField label={t('email')} value={invite.email} disabled readOnly ltr />
          <TextField
            label={t('password')}
            type="password"
            autoComplete="new-password"
            ltr
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.fields.password}
          />
          <p className="text-sm text-ink-muted">{t('passwordHint')}</p>
          <div className="mt-2 flex flex-col gap-3">
            <Checkbox checked={acceptTerms} onChange={setAcceptTerms} error={termsError} label={t('terms')} />
            <Checkbox
              checked={acceptContent}
              onChange={setAcceptContent}
              error={termsError}
              label={t('contentDeclaration')}
            />
            {termsError ? <p className="text-sm text-danger">{t('mustAccept')}</p> : null}
          </div>
        </div>
        <SubmitButton pending={pending}>{t('submit')}</SubmitButton>
      </div>
      <p className="text-center text-lg leading-[1.4] text-ink-body">
        {t('haveAccount')} <TextLink href="/login">{t('backToLogin')}</TextLink>
      </p>
    </form>
  );
}
