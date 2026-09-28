import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

/**
 * Two-column auth layout from Figma (frames "Welcome Back", "Join Photno Now!", "Forgot Password?"):
 * form on the start side, brand panel on the end side. Below lg the brand panel is hidden.
 */
export function AuthShell({ title, subtitle, children }: Props) {
  return (
    <div className="flex min-h-dvh bg-white">
      <div className="relative flex w-full flex-col lg:w-1/2">
        <header className="px-4 pt-6 sm:px-8 lg:ps-[9.9%] lg:pt-[34px]">
          <Link href="/" aria-label="Photnoo">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/logo-green.svg" alt="Photnoo" width={175} height={32} className="h-8 w-auto" />
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-[418.5px]">
            <div className="mb-10 text-center">
              <h1 className="text-[34px] leading-[1.3] font-medium text-primary-500 sm:text-[45px]">{title}</h1>
              {subtitle ? <p className="mt-3 text-lg leading-[1.4] text-ink-body">{subtitle}</p> : null}
            </div>
            {children}
          </div>
        </main>
      </div>
      <BrandPanel />
    </div>
  );
}

function BrandPanel() {
  const t = useTranslations('AuthShell');
  return (
    <aside
      className="relative hidden w-1/2 overflow-hidden lg:block"
      style={{ backgroundImage: 'linear-gradient(131.9deg, #263930 45.6%, #344e41 76.4%)' }}
    >
      {/* Decorative art exported from Figma; positions are percentages of the 960x1080 panel. */}
      {/* eslint-disable @next/next/no-img-element */}
      <img src="/brand/pattern.svg" alt="" className="absolute inset-x-0 top-0 h-[133.9%] w-full opacity-[0.04]" />
      <Shape src="/brand/shape-4.svg" box="left-[-1.83%] top-[-4.54%] w-[36.64%] h-[31.26%]" size="78%" rotate={-24.78} />
      <Shape src="/brand/shape-2.svg" box="left-[-5.6%] top-[-3.85%] w-[39.6%] h-[35.3%]" size="73.8%" rotate={-27.9} />
      <Shape src="/brand/shape-1.svg" box="left-[64.7%] top-[72.96%] w-[35.05%] h-[31.29%]" size="83.5%" rotate={12.8} />
      <Shape src="/brand/shape-3.svg" box="left-[68.82%] top-[73.57%] w-[34.47%] h-[28.8%]" size="82.8%" rotate={15.92} />
      <img src="/brand/logo-white.svg" alt="" className="absolute top-[46.76%] left-[30.21%] w-[39.6%]" />
      {/* eslint-enable @next/next/no-img-element */}
      <nav className="absolute end-[4.5%] top-0 flex gap-6 text-lg font-bold text-white">
        <Link href="/" className="flex size-[100px] items-center justify-center">
          {t('home')}
        </Link>
        <a href="mailto:hello@photnoo.com" className="flex size-[100px] items-center justify-center">
          {t('contact')}
        </a>
        <a href="mailto:support@photnoo.com" className="flex size-[100px] items-center justify-center">
          {t('help')}
        </a>
      </nav>
    </aside>
  );
}

function Shape({ src, box, size, rotate }: { src: string; box: string; size: string; rotate: number }) {
  return (
    <div className={`absolute flex items-center justify-center ${box}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand SVG */}
      <img src={src} alt="" style={{ width: size, transform: `rotate(${rotate}deg)` }} />
    </div>
  );
}
