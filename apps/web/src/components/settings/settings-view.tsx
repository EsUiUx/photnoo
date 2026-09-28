'use client';

import { Bell, Globe, Languages, LogOut, Palette, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { ErrorState, Skeleton } from '@/components/ui/state';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useProfile } from '@/lib/queries-account';
import { BrandingSection } from './branding-section';
import { LanguageSection, NotificationPreferencesSection } from './preferences-sections';
import { ProfileSection } from './profile-section';
import { PublicSection } from './public-section';
import { SecuritySection } from './security-section';

type SectionKey = 'profile' | 'public' | 'branding' | 'language' | 'notifications' | 'security';

const SECTIONS: Array<{ key: SectionKey; icon: LucideIcon }> = [
  { key: 'profile', icon: UserRound },
  { key: 'public', icon: Globe },
  { key: 'branding', icon: Palette },
  { key: 'language', icon: Languages },
  { key: 'notifications', icon: Bell },
  { key: 'security', icon: ShieldCheck },
];

/** Settings: anchored sections with a sticky index on wide screens, each saving on its own. */
export function SettingsView() {
  const t = useTranslations('App.settings');
  const profile = useProfile();
  const router = useRouter();
  const active = useActiveSection(profile.isSuccess);
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('intro')}</p>
        </div>
        <Button variant="secondary" size="sm" icon={LogOut} pending={leaving} onClick={() => void logout()}>
          {t('logout')}
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label={t('sectionsLabel')} className="lg:sticky lg:top-24 lg:self-start">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible">
            {SECTIONS.map(({ key, icon: Icon }) => (
              <li key={key} className="shrink-0">
                <a
                  href={`#${key}`}
                  aria-current={active === key ? 'true' : undefined}
                  className={cn(
                    'flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 pointer-coarse:min-h-11',
                    active === key ? 'bg-brand-soft text-brand' : 'text-fg-secondary hover:bg-surface-subtle hover:text-fg',
                  )}
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                  {t(`sections.${key}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-8">
          {profile.isPending ? (
            <SettingsSkeleton />
          ) : profile.isError ? (
            <Card>
              <ErrorState title={t('loadFailedTitle')} body={t('loadFailed')} onRetry={() => void profile.refetch()} />
            </Card>
          ) : (
            <>
              <ProfileSection profile={profile.data} />
              <PublicSection profile={profile.data} />
              <BrandingSection profile={profile.data} />
              <LanguageSection profile={profile.data} />
              <NotificationPreferencesSection profile={profile.data} />
              <SecuritySection />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The section nearest the top of the viewport, for the index highlight. */
function useActiveSection(ready: boolean): SectionKey {
  const [active, setActive] = useState<SectionKey>('profile');
  useEffect(() => {
    if (!ready) return;
    const elements = SECTIONS.map(({ key }) => document.getElementById(key)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id as SectionKey);
      },
      { rootMargin: '-96px 0px -60% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ready]);
  return active;
}

function SettingsSkeleton() {
  const t = useTranslations('App.settings');
  return (
    <div role="status" className="flex flex-col gap-8">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1].map((i) => (
        <Card key={i} as="div" className="p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          <div className="mt-8 flex items-center gap-4">
            <Skeleton className="size-24 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-9 w-28" />
            </div>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((j) => (
              <div key={j}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-11 w-full" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
