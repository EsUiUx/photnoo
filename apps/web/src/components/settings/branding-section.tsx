'use client';

import { ImagePlus, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Segmented } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useProfileImage, useUpdateProfile } from '@/lib/queries-account';
import type { Profile } from '@/lib/types-account';
import { ImagePicker, initials, SaveStatus, SettingsSection, useRequestError, useSavedFlash } from './settings-shared';

/** PRD P-15: studio logo and light/dark theme for the client password screen and gallery. */
export function BrandingSection({ profile }: { profile: Profile }) {
  const t = useTranslations('App.settings');
  const logo = useProfileImage('logo');
  const update = useUpdateProfile();
  const requestError = useRequestError();
  const { saved, flash } = useSavedFlash();
  const [theme, setTheme] = useState(profile.galleryTheme);
  const [failed, setFailed] = useState<string>();
  const displayName = profile.studioName ?? profile.name;

  function chooseTheme(next: 'light' | 'dark') {
    const previous = theme;
    setTheme(next);
    setFailed(undefined);
    update.mutate(
      { galleryTheme: next },
      {
        onSuccess: flash,
        onError: (error) => {
          setTheme(previous);
          setFailed(requestError(error));
        },
      },
    );
  }

  return (
    <SettingsSection id="branding" title={t('branding.title')} description={t('branding.description')}>
      <div className="flex flex-col gap-8">
        <ImagePicker
          label={t('branding.logo')}
          hint={t('branding.logoHint')}
          alt={t('branding.logoAlt')}
          src={profile.logoUrl}
          shape="wide"
          icon={ImagePlus}
          mutations={logo}
          removeTitle={t('branding.removeLogoTitle')}
          removeBody={t('branding.removeLogoBody')}
          fallback={<span className="px-3 text-center text-xs text-fg-muted">{t('branding.noLogo')}</span>}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p id="gallery-theme-label" className="text-sm font-medium text-fg">
              {t('branding.theme')}
            </p>
            <p className="mt-0.5 max-w-md text-sm text-fg-muted">{t('branding.themeHint')}</p>
            <Segmented
              label={t('branding.theme')}
              value={theme}
              onChange={chooseTheme}
              className="mt-3"
              options={[
                {
                  value: 'light',
                  label: (
                    <>
                      <Sun size={16} strokeWidth={1.75} aria-hidden />
                      {t('branding.light')}
                    </>
                  ),
                },
                {
                  value: 'dark',
                  label: (
                    <>
                      <Moon size={16} strokeWidth={1.75} aria-hidden />
                      {t('branding.dark')}
                    </>
                  ),
                },
              ]}
            />
            <div className="mt-3">
              <SaveStatus state={failed ? 'error' : saved ? 'saved' : 'idle'} error={failed} />
            </div>
          </div>
          <ThemePreview theme={theme} name={displayName} logoUrl={profile.logoUrl} label={t('branding.preview', { theme: t(`branding.${theme}`) })} />
        </div>
      </div>
    </SettingsSection>
  );
}

/** A miniature client gallery header and grid in the chosen theme. Decorative. */
function ThemePreview({ theme, name, logoUrl, label }: { theme: 'light' | 'dark'; name: string; logoUrl: string | null; label: string }) {
  const dark = theme === 'dark';
  return (
    <figure aria-label={label} className={cn('w-full max-w-xs shrink-0 overflow-hidden rounded-lg border p-3 transition-colors duration-200', dark ? 'border-fg bg-fg' : 'border-border bg-canvas')}>
      <div className="flex items-center gap-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={logoUrl} alt="" className={cn('h-6 w-auto max-w-24 rounded-sm object-contain', dark && 'bg-surface p-0.5')} />
        ) : (
          <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-fg">
            {initials(name)}
          </span>
        )}
        <span className={cn('truncate text-xs font-medium', dark ? 'text-canvas' : 'text-fg')}>{name}</span>
      </div>
      <div aria-hidden className="mt-3 grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={cn('aspect-square rounded-sm', dark ? (i % 2 ? 'bg-fg-secondary' : 'bg-fg-muted') : i % 2 ? 'bg-surface-sunken' : 'bg-brand-soft-strong')} />
        ))}
      </div>
    </figure>
  );
}
