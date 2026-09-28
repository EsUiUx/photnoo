'use client';

import { Menu as MenuIcon, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const SECTIONS = [
  { href: '#how', key: 'how' },
  { href: '#clients', key: 'clients' },
  { href: '#pricing', key: 'pricing' },
  { href: '#faq', key: 'faq' },
] as const;

export function LanguageLink({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === 'ar' ? 'en' : 'ar';
  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      hrefLang={other}
      className={cn('inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors', className)}
    >
      {other === 'ar' ? 'العربية' : 'English'}
    </Link>
  );
}

/**
 * Transparent over the hero photo, then a solid white bar once the page scrolls, so links stay
 * legible on any photo. Phones get a sheet menu on a native <dialog> (focus trap, Escape).
 */
export function SiteHeader() {
  const t = useTranslations('Home.nav');
  const common = useTranslations('Common');
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const light = !solid;
  const linkTone = light ? 'text-white/90 hover:text-white hover:bg-white/10' : 'text-fg-secondary hover:text-fg hover:bg-surface-subtle';

  return (
    <header
      data-surface={light ? 'dark' : undefined}
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ease-out-expo motion-reduce:duration-150',
        solid ? 'border-b border-border bg-surface/95 shadow-xs backdrop-blur-md' : 'border-b border-transparent bg-gradient-to-b from-black/35 to-transparent backdrop-blur-none',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:h-18 lg:px-8">
        <Link href="/" className="me-auto flex items-center rounded-md" aria-label="Photnoo">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark SVG */}
          <img src={light ? '/brand/logo-white.svg' : '/brand/logo-green.svg'} alt="" width={140} height={26} className="h-6 w-auto" />
        </Link>

        <nav aria-label={t('label')} className="hidden items-center gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <a key={s.key} href={s.href} className={cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', linkTone)}>
              {t(s.key)}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageLink className={linkTone} />
          <Link href="/login" className={cn('inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors', linkTone)}>
            {t('login')}
          </Link>
          <ButtonLink href="/apply" variant={light ? 'inverse' : 'primary'} size="md">
            {t('cta')}
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={common('openMenu')}
          aria-expanded={open}
          className={cn('flex size-11 items-center justify-center rounded-md lg:hidden', linkTone)}
        >
          <MenuIcon size={22} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <dialog
        ref={sheet}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        onClick={(e) => e.target === sheet.current && setOpen(false)}
        aria-label={t('label')}
        className="m-0 ms-auto h-dvh max-h-dvh w-full max-w-sm bg-surface p-0 text-fg backdrop:bg-overlay"
      >
        {open ? (
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark SVG */}
              <img src="/brand/logo-green.svg" alt="Photnoo" width={120} height={22} className="h-5 w-auto" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={common('closeMenu')}
                className="flex size-11 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-subtle"
              >
                <X size={22} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <nav aria-label={t('label')} className="flex flex-col p-3">
              {SECTIONS.map((s) => (
                <a key={s.key} href={s.href} onClick={() => setOpen(false)} className="flex h-12 items-center rounded-md px-3 text-base font-medium text-fg hover:bg-surface-subtle">
                  {t(s.key)}
                </a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 border-t border-border p-4">
              <ButtonLink href="/apply" block size="lg">
                {t('cta')}
              </ButtonLink>
              <ButtonLink href="/login" block size="lg" variant="secondary">
                {t('login')}
              </ButtonLink>
              <LanguageLink className="justify-center text-fg-secondary hover:bg-surface-subtle" />
            </div>
          </div>
        ) : null}
      </dialog>
    </header>
  );
}
