'use client';

import type { LucideIcon } from 'lucide-react';
import { Bell, ChartNoAxesColumn, CreditCard, Frame, Images, LayoutDashboard, LayoutGrid, Settings, ShoppingBag, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Meter } from '@/components/ui/primitives';
import { Skeleton } from '@/components/ui/state';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { formatBytes, percent } from '@/lib/format';
import type { Me } from '@/lib/types';

export type NavKey =
  | 'dashboard'
  | 'galleries'
  | 'portfolio'
  | 'clients'
  | 'store'
  | 'prints'
  | 'analytics'
  | 'billing'
  | 'notifications'
  | 'settings';
export type NavItem = { key: NavKey; href: string; icon: LucideIcon };
export type NavGroup = { key: 'main' | 'business' | 'account'; items: NavItem[] };

// Grouped as in the Figma sidebar: work, selling, account.
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'main',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
      { key: 'galleries', href: '/galleries', icon: Images },
      { key: 'portfolio', href: '/portfolio', icon: LayoutGrid },
      { key: 'clients', href: '/clients', icon: Users },
    ],
  },
  {
    key: 'business',
    items: [
      { key: 'store', href: '/store', icon: ShoppingBag },
      { key: 'prints', href: '/prints', icon: Frame },
      { key: 'analytics', href: '/analytics', icon: ChartNoAxesColumn },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'billing', href: '/billing', icon: CreditCard },
      { key: 'notifications', href: '/notifications', icon: Bell },
      { key: 'settings', href: '/settings', icon: Settings },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Light sidebar: logo, grouped destinations and the delivery allowance, which links to Billing. */
export function Sidebar({ me, loading, onNavigate }: { me?: Me; loading?: boolean; onNavigate?: () => void }) {
  const t = useTranslations('App.nav');
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/dashboard" aria-label={t('home')} onClick={onNavigate} className="inline-flex items-center rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG */}
          <img src="/brand/logo-green.svg" alt="" width={175} height={32} className="h-6 w-auto" />
        </Link>
      </div>
      <nav aria-label={t('label')} className="flex-1 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="pt-4 first:pt-2">
            <p id={`nav-${group.key}`} className="px-3 pb-1.5 text-xs font-medium text-fg-muted">
              {t(`group.${group.key}`)}
            </p>
            <ul aria-labelledby={`nav-${group.key}`} className="flex flex-col gap-0.5">
              {group.items.map(({ key, href, icon: Icon }) => {
                const active = isActivePath(pathname, href);
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11',
                        active ? 'bg-brand-soft text-brand' : 'text-fg-secondary hover:bg-surface-sunken hover:text-fg',
                      )}
                    >
                      <Icon size={18} strokeWidth={1.75} aria-hidden className={active ? 'text-brand' : 'text-fg-muted'} />
                      {t(key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 p-3">
        <AllowanceCard me={me} loading={loading} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function AllowanceCard({ me, loading, onNavigate }: { me?: Me; loading?: boolean; onNavigate?: () => void }) {
  const t = useTranslations('App.nav');
  const tPlan = useTranslations('App.dashboard.plan');
  const locale = useLocale();
  const sub = me?.subscription;
  const used = sub ? percent(sub.usedBytes, sub.allowanceBytes) : 0;

  return (
    <Link
      href="/billing"
      onClick={onNavigate}
      className="block rounded-lg border border-border bg-surface p-4 shadow-xs transition-colors duration-150 hover:border-border-strong"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{t('storage')}</span>
        {sub ? <span className="text-xs text-fg-muted">{tPlan(sub.state)}</span> : null}
      </span>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-5 w-28" />
          <Skeleton className="mt-3 h-1.5 w-full" />
        </>
      ) : sub ? (
        <>
          <span className="tabular mt-1 block text-sm font-medium text-fg">
            {t('storageUsed', { used: formatBytes(sub.usedBytes, locale), total: formatBytes(sub.allowanceBytes, locale) })}
          </span>
          <Meter value={used} label={t('storageMeter')} size="sm" tone={used >= 95 ? 'danger' : used >= 80 ? 'warning' : 'brand'} className="mt-3" />
        </>
      ) : (
        <span className="mt-1 block text-sm font-medium text-fg">{t('noPlan')}</span>
      )}
    </Link>
  );
}
