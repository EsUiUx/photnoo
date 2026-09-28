'use client';

import { useQuery } from '@tanstack/react-query';
import { Languages, MessageCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useState } from 'react';
import { buttonClasses, type ButtonSize } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { type ClientBranding, clientApi } from '@/lib/client-api';
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
  // Same query (and cache entry) as ClientGalleryApp's summary; it carries the P-15 branding.
  const summary = useQuery({
    queryKey: ['g', token, 'summary'],
    queryFn: () => clientApi.summary(token!),
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
  });
  const branding: ClientBranding = summary.data?.photographer ?? {};
  const dark = branding.theme === 'dark';

  return (
    <BrandingContext.Provider value={branding}>
      <div data-client-theme={dark ? 'dark' : undefined} className="relative isolate flex min-h-dvh flex-col bg-canvas text-fg">
        {dark ? <style>{DARK_THEME}</style> : null}
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
    </BrandingContext.Provider>
  );
}

const BrandingContext = createContext<ClientBranding>({});

/**
 * PRD P-15 dark gallery theme: the semantic tokens redefined for this subtree (dialogs rendered
 * inside it follow too). Values meet AA on the dark surfaces. Candidate to move into globals.css
 * as a [data-client-theme="dark"] block.
 */
const DARK_THEME = `
[data-client-theme="dark"], [data-client-theme="dark"] dialog {
  color-scheme: dark;
  --color-canvas: #0f1512; --color-surface: #161e1a; --color-surface-subtle: #1c2520; --color-surface-sunken: #243029;
  --color-overlay: rgb(0 0 0 / 0.65);
  --color-border: #2c3832; --color-border-strong: #3f4c45;
  --color-fg: #eef3ef; --color-fg-secondary: #c6d0ca; --color-fg-muted: #9aa8a0; --color-fg-inverse: #0f1512;
  --color-brand: #93c297; --color-brand-hover: #a8cfab; --color-brand-active: #bcdabe;
  --color-brand-soft: #1f3325; --color-brand-soft-strong: #2b4632; --color-brand-fg: #0f1512;
  --color-success: #86d191; --color-success-soft: #16301c; --color-warning: #f2b766; --color-warning-soft: #3a2a12;
  --color-danger: #ff8f85; --color-danger-hover: #ff7469; --color-danger-soft: #3a1a17; --color-info: #8dbde3; --color-info-soft: #15283a;
}
body:has([data-client-theme="dark"]) { background: #0f1512; }
`;

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

/**
 * The photographer's mark (PRD P-15): their studio logo, else their photo, else initials on the
 * brand green. Branding comes from the surrounding ClientShell.
 */
export function PhotographerMark({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { logoUrl, avatarUrl } = useContext(BrandingContext);
  const image = logoUrl ?? avatarUrl;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const box = { sm: 'size-9 text-sm', md: 'size-12 text-base', lg: 'size-16 text-xl' }[size];
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0 rounded-full', box, logoUrl ? 'bg-white object-contain p-1.5' : 'object-cover', className)}
      />
    );
  }
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
