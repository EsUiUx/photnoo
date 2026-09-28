import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SettingsView } from '@/components/settings/settings-view';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'App.settings' });
  return { title: t('metaTitle') };
}

export default function SettingsPage() {
  return <SettingsView />;
}
