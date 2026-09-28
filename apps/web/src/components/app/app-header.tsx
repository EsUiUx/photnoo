'use client';

import { ChevronDown, ChevronRight, CreditCard, Languages, LogOut, Menu as MenuIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { forwardRef } from 'react';
import { IconButton } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types';
import { isActivePath, NAV_ITEMS } from './sidebar';

/**
 * Top bar: where you are on the left, language and account on the right. Below lg it also
 * carries the menu button and the logo, since the sidebar is hidden there.
 */
export function AppHeader({ me, onMenu, menuButtonRef }: { me?: Me; onMenu: () => void; menuButtonRef?: React.Ref<HTMLButtonElement> }) {
  const t = useTranslations('App.header');
  const tNav = useTranslations('App.nav');
  const pathname = usePathname();
  const router = useRouter();

  const section = NAV_ITEMS.find((item) => isActivePath(pathname, item.href));
  const nested = section ? pathname !== section.href : false;

  async function logout() {
    await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <IconButton ref={menuButtonRef} icon={MenuIcon} label={t('openMenu')} onClick={onMenu} className="-ms-2 lg:hidden" />
      <Link href="/dashboard" aria-label={tNav('home')} className="me-2 inline-flex items-center rounded-md lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG */}
        <img src="/brand/logo-green.svg" alt="" width={175} height={32} className="h-5 w-auto" />
      </Link>

      <div className="hidden min-w-0 flex-1 items-center gap-1.5 text-sm lg:flex">
        {section ? (
          <>
            <section.icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-muted" />
            {nested ? (
              <>
                <Link href={section.href} className="rounded-md font-medium text-fg-secondary hover:text-fg">
                  {tNav(section.key)}
                </Link>
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-muted rtl:-scale-x-100" />
              </>
            ) : (
              <span className="font-medium text-fg-secondary">{tNav(section.key)}</span>
            )}
          </>
        ) : null}
      </div>
      <div className="flex-1 lg:hidden" />

      <LanguageToggle />
      <span aria-hidden className="mx-1 h-6 w-px bg-border" />
      <Menu
        label={me ? t('accountMenu', { name: me.name }) : t('accountMenuFallback')}
        items={[
          { type: 'link', label: t('billing'), href: '/billing', icon: CreditCard },
          { type: 'separator' },
          { label: t('logout'), icon: LogOut, onSelect: () => void logout() },
        ]}
        trigger={(props) => <AccountTrigger me={me} {...props} />}
      />
    </header>
  );
}

/** Shows the other language by its own name, marked with its own lang so it is read correctly. */
function LanguageToggle() {
  const t = useTranslations('Common');
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      hrefLang={other}
      className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-fg pointer-coarse:h-11"
    >
      <Languages size={18} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
      {other === 'ar' ? t('arabic') : t('english')}
    </Link>
  );
}

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { me?: Me };

const AccountTrigger = forwardRef<HTMLButtonElement, TriggerProps>(function AccountTrigger({ me, ...props }, ref) {
  const initials = (me?.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className="flex h-10 items-center gap-2.5 rounded-md ps-1 pe-2 text-start transition-colors duration-150 hover:bg-surface-subtle pointer-coarse:h-11"
    >
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
        {initials}
      </span>
      <span className="hidden min-w-0 flex-col md:flex">
        <span className="max-w-44 truncate text-sm leading-tight font-medium text-fg">{me?.name ?? ' '}</span>
        <span dir="ltr" className="max-w-44 truncate text-xs leading-tight text-fg-muted rtl:text-right">
          {me?.email ?? ' '}
        </span>
      </span>
      <ChevronDown size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-muted" />
    </button>
  );
});
