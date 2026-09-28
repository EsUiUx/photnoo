import { Globe, Link as LinkIcon, MapPin, MessageCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { PublicProfile } from '@/lib/types-insights';
import { BehanceMark, InstagramMark } from './brand-marks';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Identity block: logo or portrait, name, studio, city, bio, WhatsApp and links. */
export async function ProfileHeader({ profile, locale }: { profile: PublicProfile; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'PublicProfile' });
  const title = profile.studioName || profile.name;
  const subtitle = profile.studioName && profile.studioName !== profile.name ? profile.name : null;
  const phone = profile.whatsapp?.replace(/\D/g, '');
  const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(t('whatsappText', { name: profile.name.split(' ')[0]! }))}` : null;

  type SocialLink = { href: string; label: string; icon: React.ReactNode };
  const all: Array<SocialLink | null> = [
    profile.links.instagram ? { href: profile.links.instagram, label: t('instagram'), icon: <InstagramMark /> } : null,
    profile.links.behance ? { href: profile.links.behance, label: t('behance'), icon: <BehanceMark /> } : null,
    profile.links.website ? { href: profile.links.website, label: host(profile.links.website), icon: <Globe size={18} strokeWidth={1.75} aria-hidden /> } : null,
    profile.links.other ? { href: profile.links.other, label: host(profile.links.other), icon: <LinkIcon size={18} strokeWidth={1.75} aria-hidden /> } : null,
  ];
  const links = all.filter((l): l is SocialLink => l !== null);

  return (
    <header className="flex flex-col items-center text-center">
      {profile.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img src={profile.logoUrl} alt="" className="mb-6 h-10 w-auto max-w-48 object-contain" />
      ) : null}
      <span className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-2xl font-semibold text-brand ring-4 ring-surface shadow-card sm:size-28">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={profile.avatarUrl} alt="" width={112} height={112} className="size-full object-cover" />
        ) : (
          <span aria-hidden>{initials(title)}</span>
        )}
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-balance text-fg sm:text-4xl" dir="auto">
        {title}
      </h1>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-fg-muted">
        <span dir="auto">{subtitle ?? t('photographer')}</span>
        {profile.city ? (
          <span className="inline-flex items-center gap-1">
            <MapPin size={16} strokeWidth={1.75} aria-hidden />
            <span dir="auto">{profile.city}</span>
          </span>
        ) : null}
      </p>
      {profile.bio ? (
        <p className="mt-5 max-w-xl text-base leading-relaxed text-pretty whitespace-pre-line text-fg-secondary" dir="auto">
          {profile.bio}
        </p>
      ) : null}

      <div className="mt-7 flex w-full flex-col items-center gap-4 sm:w-auto">
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-6 text-base font-medium text-fg shadow-xs transition-colors duration-150 hover:bg-surface-subtle sm:w-auto"
          >
            <MessageCircle size={20} strokeWidth={1.75} aria-hidden className="text-[#25d366]" />
            {t('whatsapp')}
          </a>
        ) : null}
        {links.length ? (
          <nav aria-label={t('links')}>
            <ul className="flex flex-wrap justify-center gap-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-fg pointer-coarse:h-11"
                  >
                    {link.icon}
                    <span dir="auto">{link.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
