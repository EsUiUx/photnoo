import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { ForgotPasswordPage } from '@/components/auth/forgot-password-page';

export default function Page({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale(use(params).locale);
  return <ForgotPasswordPage />;
}
