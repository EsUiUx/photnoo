import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { DashboardPlaceholder } from '@/components/dashboard/dashboard-placeholder';

export default function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale(use(params).locale);
  return <DashboardPlaceholder />;
}
