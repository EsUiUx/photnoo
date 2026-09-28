import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { ForgotPasswordPage } from '@/components/auth/forgot-password-page';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Reset' });
  return { title: t('metaTitle') };
}

export default function Page({ params }: Props) {
  setRequestLocale(use(params).locale);
  return <ForgotPasswordPage />;
}
