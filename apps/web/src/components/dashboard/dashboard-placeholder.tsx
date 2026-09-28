'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';

type Me = {
  name: string;
  email: string;
  subscription: {
    state: string;
    cycleEnd: string;
    allowanceBytes: string;
    usedBytes: string;
  } | null;
};

/** Landing spot after login until the real dashboard (Figma "Hello, Abdelrahman!") is built. */
export function DashboardPlaceholder() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>('/v1/me')
      .then(setMe)
      .catch(() => router.replace('/login'));
  }, [router]);

  async function logout() {
    await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  if (!me) return <main className="min-h-dvh animate-pulse bg-primary-50" aria-busy="true" />;

  const gb = (bytes: string) => format.number(Number(bytes) / 1024 ** 3, { maximumFractionDigits: 1 });
  const sub = me.subscription;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold text-primary-500">{t('hello', { name: me.name })}</h1>
      {sub ? (
        <section className="rounded-card border border-line bg-primary-50 p-6">
          <p className="font-medium">{t(`state.${sub.state}`)}</p>
          <p className="mt-2 text-ink-muted">
            {t('allowance', { used: gb(sub.usedBytes), total: gb(sub.allowanceBytes) })}
          </p>
          {sub.state === 'trial' || sub.state === 'active' ? (
            <p className="mt-1 text-ink-muted">{t('until', { date: format.dateTime(new Date(sub.cycleEnd), { dateStyle: 'long' }) })}</p>
          ) : null}
        </section>
      ) : null}
      <p className="text-ink-muted">{t('comingSoon')}</p>
      <div>
        <button
          type="button"
          onClick={logout}
          className="h-11 border border-primary-400 px-6 font-medium text-primary-500 hover:bg-primary-50"
        >
          {t('logout')}
        </button>
      </div>
    </main>
  );
}
