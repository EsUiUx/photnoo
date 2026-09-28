import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { ApplyForm } from '@/components/auth/apply-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function ApplyPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale(use(params).locale);
  const t = useTranslations('Apply');
  return (
    <AuthShell title={t('title')} subtitle={t('subtitle')}>
      <ApplyForm />
    </AuthShell>
  );
}
