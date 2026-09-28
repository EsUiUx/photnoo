import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { ApplyForm } from '@/components/auth/apply-form';
import { AuthShell } from '@/components/auth/auth-shell';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Apply' });
  return { title: t('metaTitle') };
}

export default function ApplyPage({ params }: Props) {
  setRequestLocale(use(params).locale);
  const t = useTranslations('Apply');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')} photo="photographer">
      <ApplyForm />
    </AuthShell>
  );
}
