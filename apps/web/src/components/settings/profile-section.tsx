'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextareaField, TextField } from '@/components/ui/field';
import { ApiError, normalisePhone } from '@/lib/api';
import { useProfileImage, useUpdateProfile } from '@/lib/queries-account';
import type { Profile } from '@/lib/types-account';
import { ImagePicker, initials, SaveStatus, SettingsSection, useRequestError, useSavedFlash } from './settings-shared';

type Errors = Partial<Record<'name' | 'phone' | 'studioName' | 'city' | 'bio', string>>;

/** Photo, name, studio, phone, city and bio. */
export function ProfileSection({ profile }: { profile: Profile }) {
  const t = useTranslations('App.settings');
  const update = useUpdateProfile();
  const avatar = useProfileImage('avatar');
  const requestError = useRequestError();
  const { saved, flash, reset } = useSavedFlash();
  const [form, setForm] = useState({
    name: profile.name,
    studioName: profile.studioName ?? '',
    phone: profile.phone,
    city: profile.city ?? '',
    bio: profile.bio ?? '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState<string>();

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    reset();
  };

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const phone = normalisePhone(form.phone);
    const next: Errors = {};
    if (form.name.trim().length < 2) next.name = t('profile.nameRequired');
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) next.phone = t('profile.phoneInvalid');
    if (form.bio.length > 600) next.bio = t('profile.bioTooLong');
    setErrors(next);
    setFailed(undefined);
    if (Object.keys(next).length) return;

    update.mutate(
      { name: form.name.trim(), studioName: form.studioName.trim() || null, phone, city: form.city.trim() || null, bio: form.bio.trim() || null },
      {
        onSuccess: (p) => {
          setForm({ name: p.name, studioName: p.studioName ?? '', phone: p.phone, city: p.city ?? '', bio: p.bio ?? '' });
          flash();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'phone_taken') {
            setErrors({ phone: t('profile.phoneTaken') });
            return;
          }
          if (error instanceof ApiError && error.fields.length) {
            const mapped: Errors = {};
            for (const f of error.fields) if (f.path in form) mapped[f.path as keyof Errors] = t('fieldInvalid');
            setErrors(mapped);
          }
          setFailed(requestError(error));
        },
      },
    );
  }

  return (
    <SettingsSection id="profile" title={t('profile.title')} description={t('profile.description')}>
      <ImagePicker
        label={t('profile.photo')}
        hint={t('profile.photoHint')}
        alt={t('profile.photoAlt')}
        src={profile.avatarUrl}
        shape="round"
        mutations={avatar}
        removeTitle={t('profile.removePhotoTitle')}
        removeBody={t('profile.removePhotoBody')}
        fallback={<span className="text-2xl font-semibold text-brand">{initials(profile.name)}</span>}
      />

      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label={t('profile.name')} value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" required maxLength={100} />
          <TextField
            label={t('profile.studioName')}
            hint={t('profile.studioHint')}
            value={form.studioName}
            onChange={set('studioName')}
            error={errors.studioName}
            autoComplete="organization"
            optional
            maxLength={100}
          />
          <TextField
            label={t('profile.phone')}
            hint={t('profile.phoneHint')}
            value={form.phone}
            onChange={set('phone')}
            error={errors.phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            ltr
            required
          />
          <TextField label={t('profile.city')} value={form.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" optional maxLength={80} />
          <TextField label={t('profile.email')} hint={t('profile.emailHint')} value={profile.email} readOnly ltr className="sm:col-span-2" />
        </div>
        <TextareaField label={t('profile.bio')} hint={t('profile.bioHint')} value={form.bio} onChange={set('bio')} error={errors.bio} optional rows={4} maxLength={600} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SaveStatus state={failed ? 'error' : saved ? 'saved' : 'idle'} error={failed} />
          <Button type="submit" pending={update.isPending}>
            {t('save')}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
