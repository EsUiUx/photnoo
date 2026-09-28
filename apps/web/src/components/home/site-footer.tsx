import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { contact, social } from '@/content/site';
import { Link } from '@/i18n/navigation';
import { LanguageLink } from './site-header';

export function SiteFooter() {
  const t = useTranslations('Home.footer');
  const nav = useTranslations('Home.nav');
  const whatsapp = social.find((s) => s.key === 'whatsapp')?.href;
  const link = 'inline-flex min-h-10 items-center text-sm text-fg-muted transition-colors hover:text-fg';
  return (
    <footer className="border-t border-border bg-surface-subtle">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark SVG */}
          <img src="/brand/logo-green.svg" alt="Photnoo" width={140} height={26} className="h-6 w-auto" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted">{t('tagline')}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-fg">{t('product')}</h2>
          <ul className="mt-3 flex flex-col">
            <li><a href="#how" className={link}>{nav('how')}</a></li>
            <li><a href="#clients" className={link}>{nav('clients')}</a></li>
            <li><a href="#pricing" className={link}>{nav('pricing')}</a></li>
            <li><a href="#faq" className={link}>{nav('faq')}</a></li>
            <li><Link href="/login" className={link}>{nav('login')}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-fg">{t('contact')}</h2>
          <ul className="mt-3 flex flex-col">
            <li>
              <a href={`tel:${contact.phone}`} className={`${link} gap-2.5`}>
                <Phone size={16} strokeWidth={1.75} aria-hidden />
                <span dir="ltr">{contact.phone}</span>
              </a>
            </li>
            {whatsapp ? (
              <li>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${link} gap-2.5`}>
                  <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
                  {t('whatsapp')}
                </a>
              </li>
            ) : null}
            <li>
              <a href={`mailto:${contact.email}`} className={`${link} gap-2.5`}>
                <Mail size={16} strokeWidth={1.75} aria-hidden />
                <span dir="ltr">{contact.email}</span>
              </a>
            </li>
            <li className={`${link} gap-2.5 hover:text-fg-muted`}>
              <MapPin size={16} strokeWidth={1.75} aria-hidden />
              {contact.city}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-sm text-fg-muted sm:px-6 lg:px-8">
          <p>{t('rights', { year: new Date().getFullYear() })}</p>
          <LanguageLink className="-me-3 text-fg-muted hover:bg-surface-sunken hover:text-fg" />
        </div>
      </div>
    </footer>
  );
}
