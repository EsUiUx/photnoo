'use client';

import { passwordSchema } from '@photnoo/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button, ButtonLink } from '@/components/ui/button';
import { CheckboxField, PasswordField, TextField } from '@/components/ui/field';
import { Alert, Skeleton, Spinner } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { TextLink } from './fields';
import { usePasswordHint } from './password-hint';
import { useFormErrors } from './use-form-errors';

type Invite = { name: string; email: string };

const formSchema = z.object({
  password: passwordSchema,
  acceptTerms: z.literal(true),
  acceptContentDeclaration: z.literal(true),
});

/**
 * Accept an invite. Photnoo is invite-only, so name and email come from the approved request
 * and cannot be edited; the photographer only chooses a password and accepts the terms.
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
  const passwordHint = usePasswordHint(password);

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
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner size={16} label={t('checking')} />
          <span aria-hidden>{t('checking')}</span>
        </p>
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  if (invite === 'invalid') {
    return (
      <div className="flex flex-col gap-6">
        <Alert tone="warning" title={t('invalidTitle')}>
          {t('invalid')}
        </Alert>
        <ButtonLink href="/login" variant="secondary" size="lg" block>
          {t('login')}
        </ButtonLink>
        <p className="text-sm text-fg-muted">
          {t('newHere')} <TextLink href="/apply">{t('requestAccess')}</TextLink>
        </p>
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

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {errors.form ? <Alert key={errors.attempt}>{errors.form}</Alert> : null}
      <div className="flex flex-col gap-5">
        <TextField label={t('name')} value={invite.name} disabled readOnly />
        <TextField label={t('email')} hint={t('emailHint')} value={invite.email} disabled readOnly ltr />
        <PasswordField
          id={errors.id('password')}
          label={t('password')}
          hint={passwordHint}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.fields.password}
        />
        <div className="flex flex-col gap-1">
          <CheckboxField
            id={errors.id('acceptTerms')}
            label={t('terms')}
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            error={errors.fields.acceptTerms ? t('mustAcceptTerms') : undefined}
          />
          <CheckboxField
            id={errors.id('acceptContentDeclaration')}
            label={t('contentDeclaration')}
            checked={acceptContent}
            onChange={(e) => setAcceptContent(e.target.checked)}
            error={errors.fields.acceptContentDeclaration ? t('mustAcceptContent') : undefined}
          />
        </div>
      </div>
      <Button type="submit" size="lg" block pending={pending}>
        {t('submit')}
      </Button>
      <p className="text-sm text-fg-muted">
        {t('haveAccount')} <TextLink href="/login">{t('login')}</TextLink>
      </p>
    </form>
  );
}
