'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import type { Me } from '@/lib/types';

/** Figma "Component 73/Frame 16": greeting and date, language switch, profile with menu. */
export function AppHeader({ me, onMenu }: { me?: Me; onMenu: () => void }) {
  const t = useTranslations('App.header');
  const locale = useLocale();
  const format = useFormatter();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  async function logout() {
    await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  const firstName = me?.name.split(' ')[0] ?? '';
  const initials = (me?.name ?? '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  return (
    <header className="flex h-[88px] items-center gap-4 border-b border-primary-300 bg-[#f6f6f6] px-4 sm:px-8 lg:h-[112px]">
      <button
        type="button"
        onClick={onMenu}
        className="flex size-11 items-center justify-center rounded-xl border border-field-border bg-white lg:hidden"
        aria-label={t('openMenu')}
      >
        <span aria-hidden="true" className="flex w-5 flex-col gap-1">
          <span className="h-0.5 bg-ink" />
          <span className="h-0.5 bg-ink" />
          <span className="h-0.5 bg-ink" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-bold text-[#231f20] lg:text-2xl">{me ? t('hello', { name: firstName }) : ' '}</p>
        {/* The server and the browser may disagree about "today" around midnight. */}
        <p className="mt-2 text-sm font-medium text-ink-subtle" suppressHydrationWarning>
          {format.dateTime(new Date(), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <Link
        href={pathname}
        locale={locale === 'ar' ? 'en' : 'ar'}
        className="hidden h-[53px] items-center gap-3 rounded-xl border border-field-border bg-white px-5 text-xl text-[rgba(51,51,51,0.5)] sm:flex"
      >
        {t('otherLanguage')}
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
        <img src="/app/arrow-down.svg" alt="" className="size-6" />
      </Link>
      <span aria-hidden="true" className="hidden h-[61px] w-px bg-line sm:block" />
      <div ref={menuRef} className="relative flex items-center gap-4">
        <span className="flex size-[55px] items-center justify-center rounded-full bg-primary-200 text-lg font-semibold text-primary-600" aria-hidden="true">
          {initials}
        </span>
        <div className="hidden md:block">
          <p className="max-w-[192px] truncate text-xl leading-none font-medium text-[#121212]">{me?.name}</p>
          <p className="mt-1 text-sm text-ink-subtle">{t('role')}</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={t('accountMenu')}
          className="flex size-8 items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
          <img src="/app/profile-chevron.svg" alt="" className="size-5" />
        </button>
        {menuOpen ? (
          <div role="menu" className="absolute end-0 top-full z-30 mt-2 w-[198px] overflow-hidden rounded-xl bg-white shadow-[0_10px_20px_rgba(0,0,0,0.08)]">
            <span role="menuitem" aria-disabled="true" className="flex h-[38px] items-center gap-2.5 px-3 text-lg text-[#121212] opacity-50">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
              <img src="/app/menu-edit.svg" alt="" className="size-[18px]" />
              {t('editProfile')}
            </span>
            <button type="button" role="menuitem" onClick={logout} className="flex h-[39px] w-full items-center gap-2.5 px-3 text-start text-lg text-[#121212] hover:bg-primary-50">
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
              <img src="/app/menu-logout.svg" alt="" className="size-[19px]" />
              {t('logout')}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
