import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitch } from './language-switch';

const PHOTOS = {
  bouquet: { src: '/photos/auth-bouquet-villa.jpg', position: 'object-[30%_50%]' },
  photographer: { src: '/photos/auth-photographer-at-work.jpg', position: 'object-[40%_40%]' },
} as const;

export type AuthPhoto = keyof typeof PHOTOS;

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  photo?: AuthPhoto;
  /** Lets a multi-step flow move focus to the heading when the step changes. */
  titleRef?: React.Ref<HTMLHeadingElement>;
};

/**
 * Split auth layout. The form column sits on the start side; on lg+ a full-height photograph
 * fills the end side (sticky, so long forms scroll past it). Below lg only the form shows, with
 * the green logo on top. Every auth page renders its single <main id="main"> and <h1> here.
 */
export function AuthShell({ title, subtitle, children, photo = 'bouquet', titleRef }: Props) {
  const t = useTranslations('AuthShell');
  return (
    <div className="flex min-h-dvh items-start bg-canvas">
      <div className="flex min-h-dvh w-full flex-col lg:w-1/2">
        <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10 lg:py-6">
          <Link href="/" aria-label={t('homeLabel')} className="-ms-1 inline-flex min-h-10 items-center rounded-md px-1 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/logo-green.svg" alt="" width={175} height={32} className="h-7 w-auto" />
          </Link>
          <Link
            href="/"
            className="-ms-2 hidden h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-fg lg:inline-flex"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
            {t('backHome')}
          </Link>
          <LanguageSwitch className="-me-2" />
        </header>

        <main id="main" className="flex flex-1 items-center justify-center px-4 pt-6 pb-12 sm:px-6 lg:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="text-2xl font-semibold tracking-tight text-fg outline-none sm:text-3xl">
                {title}
              </h1>
              {subtitle ? <p className="mt-2 text-base leading-relaxed text-fg-muted">{subtitle}</p> : null}
            </div>
            {children}
          </div>
        </main>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-6 text-sm text-fg-muted sm:px-6 lg:px-10">
          <span>{t('copyright')}</span>
          <a href="mailto:hello@photnoo.com" className="inline-flex min-h-10 items-center hover:text-fg">
            {t('contact')}
          </a>
          <a href="mailto:support@photnoo.com" className="inline-flex min-h-10 items-center hover:text-fg">
            {t('help')}
          </a>
        </footer>
      </div>

      <PhotoPanel photo={photo} />
    </div>
  );
}

function PhotoPanel({ photo }: { photo: AuthPhoto }) {
  const t = useTranslations('AuthShell');
  const { src, position } = PHOTOS[photo];
  return (
    <aside aria-hidden className="sticky top-0 hidden h-dvh overflow-hidden bg-surface-sunken lg:block lg:w-1/2">
      <Image src={src} alt="" fill priority sizes="50vw" className={`object-cover ${position}`} />
      <div className="absolute inset-0 bg-linear-to-t from-fg/80 via-fg/15 to-fg/35" />
      <div className="absolute inset-0 flex flex-col justify-between p-10 xl:p-12">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
        <img src="/brand/logo-white.svg" alt="" width={175} height={32} className="h-8 w-auto self-start" />
        <div className="max-w-md">
          <p className="text-3xl leading-tight font-semibold tracking-tight text-balance text-white">{t('brandLine')}</p>
        </div>
      </div>
    </aside>
  );
}
