import { useTranslations } from 'next-intl';
import { contact, social } from '@/content/site';
import { Link } from '@/i18n/navigation';

/** Figma "Frame 1618872853". */
export function SiteFooter() {
  const t = useTranslations('Footer');
  const nav = useTranslations('Nav');
  const profiles = social.filter((profile) => profile.href);
  return (
    <footer className="relative overflow-hidden bg-primary-500 text-primary-100">
      {/* eslint-disable @next/next/no-img-element -- Figma brand exports */}
      <img
        src="/home/footer-shape.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute end-[-4.6%] top-[17%] hidden w-[22%] max-w-[424px] lg:block rtl:-scale-x-100"
      />
      <div className="relative mx-auto grid max-w-[1920px] gap-12 px-4 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr] lg:py-[92px] xl:px-[9.6%] xl:pe-[26%]">
        <div>
          <img src="/home/footer-logo.svg" alt="Photnoo" width={381} height={70} className="h-auto w-[210px]" />
          <p className="mt-8 max-w-[382px] text-3xl font-medium text-primary-200 lg:text-[40px] lg:leading-tight">{t('tagline')}</p>
          {profiles.length > 0 ? (
            <ul className="mt-10 flex gap-[22px]">
              {profiles.map((profile) => (
                <li key={profile.key}>
                  <a href={profile.href} target="_blank" rel="noopener noreferrer" aria-label={t(`social.${profile.key}`)}>
                    {/* Figma exports these glyphs upside down and flips them back (except X). */}
                    <img
                      src={`/icons/${profile.key}.svg`}
                      alt=""
                      className={`size-[38px] ${profile.key === 'x' ? '' : '-scale-y-100'}`}
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <h2 className="text-[28px] font-medium lg:text-[32px]">{t('shortLinks')}</h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-10 gap-y-6 text-xl lg:text-2xl">
            <li><a href="#workflow" className="hover:text-white">{nav('workflow')}</a></li>
            <li><a href="#plans" className="hover:text-white">{nav('plans')}</a></li>
            <li><a href="#engine" className="hover:text-white">{nav('engine')}</a></li>
            <li><Link href="/login" className="hover:text-white">{nav('login')}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-[28px] font-medium lg:text-[32px]">{t('contact')}</h2>
          <ul className="mt-10 flex flex-col gap-[27px] text-xl lg:text-2xl">
            <li className="flex items-center gap-4">
              <img src="/icons/call.svg" alt="" className="size-6 shrink-0" />
              <a href={`tel:${contact.phone}`} dir="ltr" className="hover:text-white">{contact.phone}</a>
            </li>
            <li className="flex items-center gap-4">
              <img src="/icons/location.svg" alt="" className="size-6 shrink-0" />
              <span>{t('city')}</span>
            </li>
          </ul>
        </div>
      </div>
      {/* eslint-enable @next/next/no-img-element */}
      <div className="relative bg-primary-300 py-5 text-center text-lg font-semibold text-primary-50">
        {t('rights', { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
