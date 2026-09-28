import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Login' });
  return { title: t('metaTitle') };
}

export default function LoginPage({ params }: Props) {
  setRequestLocale(use(params).locale);
  const t = useTranslations('Login');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')} photo="bouquet">
      <LoginForm />
    </AuthShell>
  );
}
