'use client';

import { linkProblem, normaliseUrl, slugProblem } from '@photnoo/shared';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { useSlugAvailability, useUpdateProfile } from '@/lib/queries-account';
import type { Profile, ProfileLinks } from '@/lib/types-account';
import { SaveStatus, SettingsSection, useRequestError, useSavedFlash } from './settings-shared';

const LINKS: Array<{ key: keyof ProfileLinks; label: 'instagram' | 'behance' | 'website' | 'other'; site?: 'instagram.com' | 'behance.net'; placeholder: string }> = [
  { key: 'instagramUrl', label: 'instagram', site: 'instagram.com', placeholder: 'https://instagram.com/…' },
  { key: 'behanceUrl', label: 'behance', site: 'behance.net', placeholder: 'https://behance.net/…' },
  { key: 'websiteUrl', label: 'website', placeholder: 'https://…' },
  { key: 'otherUrl', label: 'other', placeholder: 'https://…' },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/** Public handle (with a live availability check) and social links. */
export function PublicSection({ profile }: { profile: Profile }) {
  const t = useTranslations('App.settings');
  const update = useUpdateProfile();
  const requestError = useRequestError();
  const { saved, flash, reset } = useSavedFlash();
  const [slug, setSlug] = useState(profile.slug ?? '');
  const [links, setLinks] = useState<Record<keyof ProfileLinks, string>>({
    instagramUrl: profile.links.instagramUrl ?? '',
    behanceUrl: profile.links.behanceUrl ?? '',
    websiteUrl: profile.links.websiteUrl ?? '',
    otherUrl: profile.links.otherUrl ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileLinks | 'slug', string>>>({});
  const [failed, setFailed] = useState<string>();

  const cleanSlug = slug.trim().toLowerCase();
  const debounced = useDebounced(cleanSlug, 400);
  const localProblem = cleanSlug ? slugProblem(cleanSlug) : null;
  const unchanged = cleanSlug === (profile.slug ?? '');
  const check = useSlugAvailability(debounced, Boolean(debounced) && !slugProblem(debounced) && debounced !== (profile.slug ?? ''));
  const settled = debounced === cleanSlug && !check.isFetching;
  const remoteProblem = settled && check.data && !check.data.available ? check.data.reason : undefined;
  const slugIssue = localProblem ?? remoteProblem;

  function linkError(key: keyof ProfileLinks, site?: 'instagram.com' | 'behance.net') {
    const value = links[key].trim();
    if (!value) return undefined;
    const problem = linkProblem(value, site);
    if (problem === 'invalid') return t('public.invalidUrl');
    if (problem === 'wrong_site') return t('public.wrongSite', { site: site ?? '' });
    return undefined;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    for (const link of LINKS) {
      const e = linkError(link.key, link.site);
      if (e) next[link.key] = e;
    }
    if (cleanSlug && slugIssue) next.slug = t(`public.reasons.${slugIssue}`);
    setErrors(next);
    setFailed(undefined);
    if (Object.keys(next).length) return;

    const patch = {
      slug: cleanSlug || null,
      ...Object.fromEntries(LINKS.map(({ key }) => [key, links[key].trim() ? normaliseUrl(links[key]) : null])),
    };
    update.mutate(patch, {
      onSuccess: (p) => {
        setSlug(p.slug ?? '');
        setLinks({
          instagramUrl: p.links.instagramUrl ?? '',
          behanceUrl: p.links.behanceUrl ?? '',
          websiteUrl: p.links.websiteUrl ?? '',
          otherUrl: p.links.otherUrl ?? '',
        });
        flash();
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'slug_taken') setErrors({ slug: t('public.reasons.taken') });
        else if (error instanceof ApiError && error.fields.length) {
          const mapped: typeof errors = {};
          for (const f of error.fields) mapped[f.path as keyof typeof errors] = f.path === 'slug' ? t('public.reasons.characters') : t('public.invalidUrl');
          setErrors(mapped);
        }
        setFailed(requestError(error));
      },
    });
  }

  let slugStatus: React.ReactNode = null;
  if (cleanSlug && !errors.slug) {
    if (slugIssue) {
      slugStatus = (
        <span className="inline-flex items-center gap-1.5 font-medium text-danger">
          <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
          {t(`public.reasons.${slugIssue}`)}
        </span>
      );
    } else if (unchanged) {
      slugStatus = <span className="text-fg-muted">{t('public.yours')}</span>;
    } else if (!settled) {
      slugStatus = (
        <span className="inline-flex items-center gap-1.5 text-fg-muted">
          <Spinner size={14} />
          {t('public.checking')}
        </span>
      );
    } else if (check.data?.available) {
      slugStatus = (
        <span className="inline-flex items-center gap-1.5 font-medium text-success">
          <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
          {t('public.available')}
        </span>
      );
    }
  }

  return (
    <SettingsSection id="public" title={t('public.title')} description={t('public.description')}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <div>
          <TextField
            label={t('public.slug')}
            hint={t('public.slugHint')}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              setErrors((x) => ({ ...x, slug: undefined }));
              reset();
            }}
            error={errors.slug}
            ltr
            optional
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            id="settings-slug"
            inputClassName="font-medium"
            aria-describedby={`${errors.slug ? 'settings-slug-error' : 'settings-slug-hint'} settings-slug-status`}
          />
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span dir="ltr" className="text-fg-muted">
              {t('public.slugPrefix')}
              <span className="font-medium text-fg">{cleanSlug || '…'}</span>
            </span>
            <span id="settings-slug-status" aria-live="polite">
              {slugStatus}
            </span>
          </p>
        </div>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-sm font-medium text-fg">{t('public.links')}</legend>
          <p className="-mt-2 text-sm text-fg-muted">{t('public.linksHint')}</p>
          <div className="grid gap-5 sm:grid-cols-2">
            {LINKS.map(({ key, label, site, placeholder }) => (
              <TextField
                key={key}
                label={t(`public.${label}`)}
                value={links[key]}
                placeholder={placeholder}
                onChange={(e) => {
                  setLinks((l) => ({ ...l, [key]: e.target.value }));
                  setErrors((x) => ({ ...x, [key]: undefined }));
                  reset();
                }}
                onBlur={() => {
                  if (links[key].trim()) setLinks((l) => ({ ...l, [key]: normaliseUrl(l[key]) }));
                  const e = linkError(key, site);
                  if (e) setErrors((x) => ({ ...x, [key]: e }));
                }}
                error={errors[key]}
                type="url"
                inputMode="url"
                ltr
                optional
                maxLength={300}
              />
            ))}
          </div>
        </fieldset>

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
