import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { InviteForm } from '@/components/auth/invite-form';

type Props = { params: Promise<{ locale: string; token: string }> };

// Invite links carry a secret token: keep them out of search engines and referrers.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Invite' });
  return { title: t('metaTitle'), robots: { index: false }, referrer: 'no-referrer' };
}

export default function InvitePage({ params }: Props) {
  const { locale, token } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('Invite');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')} photo="bouquet">
      <InviteForm token={token} />
    </AuthShell>
  );
}
