'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { CheckboxField } from '@/components/ui/field';
import { Segmented } from '@/components/ui/primitives';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useUpdatePreferences, useUpdateProfile } from '@/lib/queries-account';
import type { NotificationPreferences, Profile } from '@/lib/types-account';
import { SaveStatus, SettingsSection, useRequestError, useSavedFlash } from './settings-shared';

/** Photographer.locale: emails follow it; the app switches to it right away. */
export function LanguageSection({ profile }: { profile: Profile }) {
  const t = useTranslations('App.settings');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const pathname = usePathname();
  const update = useUpdateProfile();
  const requestError = useRequestError();
  const [value, setValue] = useState<'ar' | 'en'>(profile.locale);
  const [failed, setFailed] = useState<string>();

  function choose(next: 'ar' | 'en') {
    const previous = value;
    setValue(next);
    setFailed(undefined);
    update.mutate(
      { locale: next },
      {
        onSuccess: () => {
          if (next !== locale) router.replace(`${pathname}#language`, { locale: next });
        },
        onError: (error) => {
          setValue(previous);
          setFailed(requestError(error));
        },
      },
    );
  }

  return (
    <SettingsSection id="language" title={t('language.title')} description={t('language.description')}>
      <Segmented
        label={t('language.label')}
        value={value}
        onChange={choose}
        options={[
          { value: 'en', label: <span lang="en">{t('language.english')}</span> },
          { value: 'ar', label: <span lang="ar">{t('language.arabic')}</span> },
        ]}
      />
      <div className="mt-3">
        <SaveStatus state={failed ? 'error' : 'idle'} error={failed} />
      </div>
    </SettingsSection>
  );
}

const OPTIONS: Array<{ key: keyof NotificationPreferences; label: 'firstOpen' | 'fullDownload' | 'expiring' | 'orders' }> = [
  { key: 'notifyFirstOpen', label: 'firstOpen' },
  { key: 'notifyFullDownload', label: 'fullDownload' },
  { key: 'notifyExpiring', label: 'expiring' },
  { key: 'notifyOrders', label: 'orders' },
];

/** Each switch saves on its own; a failed save puts the box back. */
export function NotificationPreferencesSection({ profile }: { profile: Profile }) {
  const t = useTranslations('App.settings');
  const update = useUpdatePreferences();
  const requestError = useRequestError();
  const { saved, flash } = useSavedFlash();
  const [prefs, setPrefs] = useState(profile.notifications);
  const [failed, setFailed] = useState<string>();

  function toggle(key: keyof NotificationPreferences, on: boolean) {
    setPrefs((p) => ({ ...p, [key]: on }));
    setFailed(undefined);
    update.mutate(
      { [key]: on },
      {
        onSuccess: (next) => {
          setPrefs(next);
          flash();
        },
        onError: (error) => {
          setPrefs((p) => ({ ...p, [key]: !on }));
          setFailed(requestError(error));
        },
      },
    );
  }

  return (
    <SettingsSection id="notifications" title={t('notifications.title')} description={t('notifications.description')}>
      <fieldset>
        <legend className="sr-only">{t('notifications.title')}</legend>
        <div className="flex flex-col">
          {OPTIONS.map(({ key, label }) => (
            <CheckboxField key={key} label={t(`notifications.${label}`)} checked={prefs[key]} onChange={(e) => toggle(key, e.target.checked)} />
          ))}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <CheckboxField
            label={
              <>
                <span className="block font-medium text-fg">{t('notifications.byEmail')}</span>
                <span className="block text-fg-muted">{t('notifications.byEmailHint')}</span>
              </>
            }
            checked={prefs.notifyByEmail}
            onChange={(e) => toggle('notifyByEmail', e.target.checked)}
          />
        </div>
      </fieldset>
      <div className="mt-3">
        <SaveStatus state={failed ? 'error' : saved ? 'saved' : 'idle'} error={failed} />
      </div>
    </SettingsSection>
  );
}
