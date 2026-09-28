import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function PublicFooter({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'PublicProfile' });
  return (
    <footer className="border-t border-border px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mx-auto flex w-fit items-center gap-2 rounded-md text-xs font-medium text-fg-muted transition-colors duration-150 hover:text-fg"
      >
        <span>{t('deliveredWith')}</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark */}
        <img src="/brand/logo-green.svg" alt="Photnoo" width={110} height={20} className="h-5 w-auto" />
      </Link>
    </footer>
  );
}
