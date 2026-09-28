'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { formatBytes, percent } from '@/lib/format';
import type { Me } from '@/lib/types';

type Item = { key: string; icon: string; href?: string };

// PRD section 3: Portfolio, Store, Prints and Analytics are hidden in v1; Clients, Notifications
// and Settings are listed but not built yet.
const SECTIONS: Array<{ key: string; items: Item[] }> = [
  {
    key: 'main',
    items: [
      { key: 'dashboard', icon: 'nav-dashboard', href: '/dashboard' },
      { key: 'galleries', icon: 'nav-galleries', href: '/galleries' },
      { key: 'clients', icon: 'nav-clients' },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'billing', icon: 'nav-billing', href: '/billing' },
      { key: 'notifications', icon: 'nav-notifications' },
      { key: 'settings', icon: 'nav-settings' },
    ],
  },
];

/** Figma "Frame 37760": green sidebar with pill navigation and the storage meter at the bottom. */
export function Sidebar({ me, onNavigate }: { me?: Me; onNavigate?: () => void }) {
  const t = useTranslations('App.nav');
  const locale = useLocale();
  const pathname = usePathname();
  const sub = me?.subscription;

  return (
    <div className="flex h-full w-[280px] flex-col border-e border-primary-300 bg-primary-500 xl:w-[321px]">
      <div className="flex h-[88px] items-center justify-center lg:h-[112px]">
        <Link href="/dashboard" aria-label="Photnoo" onClick={onNavigate}>
          {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG */}
          <img src="/app/sidebar-logo.svg" alt="Photnoo" width={175} height={32} className="h-8 w-auto" />
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-3" aria-label={t('label')}>
        {SECTIONS.map((section) => (
          <div key={section.key} className="mb-6">
            <p className="mb-3 px-3 text-base font-medium text-primary-50">{t(`sections.${section.key}`)}</p>
            <ul className="flex flex-col gap-2">
              {section.items.map((item) => {
                const active = item.href && pathname.startsWith(item.href);
                const body = (
                  <>
                    <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-primary-100">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
                      <img src={`/app/${item.icon}.svg`} alt="" className="size-6" />
                    </span>
                    <span className="text-lg">{t(item.key)}</span>
                    {!item.href ? <span className="ms-auto text-xs font-semibold tracking-wide uppercase opacity-70">{t('soon')}</span> : null}
                  </>
                );
                const classes = `flex h-[60px] items-center gap-3 rounded-[20px] px-3 transition-colors ${
                  active ? 'bg-primary-200 font-medium text-primary-700' : 'text-primary-50'
                }`;
                return (
                  <li key={item.key}>
                    {item.href ? (
                      <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`${classes} hover:bg-primary-400`}>
                        {body}
                      </Link>
                    ) : (
                      <span aria-disabled="true" className={`${classes} cursor-not-allowed opacity-60`}>
                        {body}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex h-[87px] items-center gap-3 bg-primary-700 px-6">
        <div className="min-w-0 flex-1 text-[13px] leading-[1.4] font-semibold text-primary-200">
          <p>{t('storage')}</p>
          {sub ? (
            <>
              <p dir="ltr" className="text-start">
                {formatBytes(sub.usedBytes, locale)} / {formatBytes(sub.allowanceBytes, locale)}
              </p>
              <div className="mt-2 h-[7px] w-full max-w-[168px] overflow-hidden rounded-full bg-primary-200/30" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(sub.usedBytes, sub.allowanceBytes)}>
                <div className="h-full rounded-full bg-primary-200" style={{ width: `${percent(sub.usedBytes, sub.allowanceBytes)}%` }} />
              </div>
            </>
          ) : (
            <p>—</p>
          )}
        </div>
      </div>
    </div>
  );
}
