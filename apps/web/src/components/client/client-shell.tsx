'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { ReportDialog } from './report-dialog';

/**
 * Frame for every client page: language toggle on top, "Delivered with Photnoo" and the
 * report link (C-10) at the bottom. The photographer's gallery is the focus, not our brand.
 */
export function ClientShell({ children, token, wide }: { children: React.ReactNode; token?: string; wide?: boolean }) {
  const t = useTranslations('Client');
  const locale = useLocale();
  const pathname = usePathname();
  const [reporting, setReporting] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-[#fbfaf7] text-ink">
      <header className={`mx-auto flex w-full items-center justify-end px-4 pt-4 ${wide ? 'max-w-[1400px] sm:px-8' : 'max-w-[520px]'}`}>
        <Link
          href={pathname}
          locale={locale === 'ar' ? 'en' : 'ar'}
          replace
          className="rounded-full border border-field-border bg-white px-4 py-1.5 text-sm font-medium text-ink-body hover:border-primary-300"
        >
          {t('otherLanguage')}
        </Link>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="mt-10 flex flex-col items-center gap-2 px-4 pb-8 text-sm text-ink-subtle">
        <p className="flex items-center gap-2">
          {t('deliveredWith')}
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src="/brand/logo-green.svg" alt="Photnoo" className="h-5 w-auto" />
        </p>
        {token ? (
          <button type="button" onClick={() => setReporting(true)} className="underline underline-offset-2 hover:text-ink-body">
            {t('report.link')}
          </button>
        ) : null}
      </footer>
      {token ? <ReportDialog token={token} open={reporting} onClose={() => setReporting(false)} /> : null}
    </div>
  );
}

/** Photographer mark until logo upload exists: initials on the brand green. */
export function PhotographerMark({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const box = size === 'lg' ? 'size-20 text-2xl' : 'size-12 text-lg';
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-primary-400 font-semibold text-primary-50 ${box}`}>
      {initials}
    </span>
  );
}

export function WhatsAppButton({ href, children, tone = 'solid' }: { href: string; children: React.ReactNode; tone?: 'solid' | 'outline' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold ${
        tone === 'solid' ? 'bg-[#25d366] text-white hover:bg-[#1fb957]' : 'border-2 border-[#25d366] text-[#128c4a] hover:bg-[#e9fbef]'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- brand icon */}
      <img src="/icons/whatsapp.svg" alt="" className={`size-5 ${tone === 'solid' ? 'brightness-0 invert' : ''}`} />
      {children}
    </a>
  );
}
