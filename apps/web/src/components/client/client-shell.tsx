'use client';

import { Languages, MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonClasses, type ButtonSize } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { ReportDialog } from './report-dialog';

type ShellProps = {
  children: React.ReactNode;
  token?: string;
  /**
   * `gallery`: the header floats over the full-bleed cover photo.
   * `tint`: a soft brand-tinted backdrop for the password, loading and status screens.
   */
  variant?: 'gallery' | 'tint';
};

/**
 * Frame for every client page: language toggle on top, "Delivered with Photnoo" and the
 * report link (C-10) at the bottom. The photographer's gallery is the focus, not our brand.
 */
export function ClientShell({ children, token, variant = 'tint' }: ShellProps) {
  const t = useTranslations('Client');
  const [reporting, setReporting] = useState(false);
  const overPhoto = variant === 'gallery';

  return (
    <div className="relative isolate flex min-h-dvh flex-col bg-canvas text-fg">
      {variant === 'tint' ? <Tint /> : null}
      <header
        className={cn(
          'flex w-full items-center justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8',
          overPhoto && 'absolute inset-x-0 top-0 z-30',
        )}
        data-surface={overPhoto ? 'dark' : undefined}
      >
        <LanguageToggle overPhoto={overPhoto} />
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        {children}
      </main>
      <footer className="mt-12 flex flex-col items-center gap-2 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-sm text-fg-muted">
        <p className="flex items-center gap-2">
          {t('deliveredWith')}
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src="/brand/logo-green.svg" alt="Photnoo" className="h-4 w-auto" />
        </p>
        {token ? (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="inline-flex min-h-10 items-center rounded-md px-2 text-fg-muted underline underline-offset-4 hover:text-fg pointer-coarse:min-h-11"
          >
            {t('report.link')}
          </button>
        ) : null}
      </footer>
      {token ? <ReportDialog token={token} open={reporting} onClose={() => setReporting(false)} /> : null}
    </div>
  );
}

/**
 * Quiet canvas behind centered cards. Deliberately plain: before unlock nothing of the
 * gallery may show, and decorative washes would compete with the photographer's name.
 */
function Tint() {
  return <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-surface-subtle" />;
}

function LanguageToggle({ overPhoto }: { overPhoto: boolean }) {
  const t = useTranslations('Client');
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <Link
      href={pathname}
      locale={other}
      replace
      lang={other}
      hrefLang={other}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11',
        overPhoto
          ? 'bg-black/35 text-white backdrop-blur-sm hover:bg-black/55'
          : 'border border-border-strong bg-surface text-fg shadow-xs hover:bg-surface-subtle',
      )}
    >
      <Languages size={16} strokeWidth={1.75} aria-hidden />
      {t('otherLanguage')}
    </Link>
  );
}

/** Photographer mark until logo upload exists: initials on the brand green. */
export function PhotographerMark({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const box = { sm: 'size-9 text-sm', md: 'size-12 text-base', lg: 'size-16 text-xl' }[size];
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-brand-fg', box, className)}>
      {initials}
    </span>
  );
}

/**
 * WhatsApp link. `solid` is the WhatsApp green with dark text (6.3:1); `secondary` is a white
 * button with a green icon. White text on #25d366 fails contrast, so it is never used.
 */
export function WhatsAppButton({
  href,
  children,
  tone = 'secondary',
  size = 'md',
  block,
}: {
  href: string;
  children: React.ReactNode;
  tone?: 'solid' | 'secondary';
  size?: ButtonSize;
  block?: boolean;
}) {
  const heights: Record<ButtonSize, string> = {
    sm: 'h-9 gap-1.5 px-3 text-sm pointer-coarse:h-11',
    md: 'h-11 gap-2 px-4 text-sm',
    lg: 'h-12 gap-2 px-6 text-base',
  };
  const classes =
    tone === 'solid'
      ? cn(
          'inline-flex shrink-0 items-center justify-center rounded-md bg-[#25d366] font-medium whitespace-nowrap text-[#0b3d1f] shadow-xs transition-[filter] duration-150 hover:brightness-95',
          heights[size],
          block && 'w-full',
        )
      : buttonClasses({ variant: 'secondary', size, block });
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      <MessageCircle size={size === 'sm' ? 16 : 18} strokeWidth={1.75} aria-hidden className={tone === 'solid' ? undefined : 'text-[#128c4a]'} />
      {children}
    </a>
  );
}
