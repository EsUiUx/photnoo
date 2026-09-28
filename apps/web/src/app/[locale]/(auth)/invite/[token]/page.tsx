import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { InviteForm } from '@/components/auth/invite-form';

// Invite links carry a secret token: keep them out of search engines and referrers.
export const metadata: Metadata = { robots: { index: false }, referrer: 'no-referrer' };

export default function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('Invite');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      <InviteForm token={token} />
    </AuthShell>
  );
}
