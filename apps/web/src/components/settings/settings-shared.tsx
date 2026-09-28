'use client';

import type { UseMutationResult } from '@tanstack/react-query';
import { Camera, CircleCheck, Trash2, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Card } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Profile } from '@/lib/types-account';

/** One settings section: an anchored card with a title, a short description and its own save. */
export function SettingsSection({
  id,
  title,
  description,
  children,
  footer,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <Card as="section" id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <header className="border-b border-border px-5 py-5 sm:px-6">
        <h2 id={headingId} className="text-lg font-semibold text-fg">
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-fg-muted">{description}</p> : null}
      </header>
      <div className="px-5 py-6 sm:px-6">{children}</div>
      {footer ? <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface-subtle px-5 py-4 sm:px-6">{footer}</footer> : null}
    </Card>
  );
}

/** Quiet "Saved." that fades after a few seconds, or a form-level failure; announced politely. */
export function SaveStatus({ state, error }: { state: 'idle' | 'saved' | 'error'; error?: string }) {
  const t = useTranslations('App.settings');
  return (
    <p role="status" aria-live="polite" className={cn('me-auto text-sm', state === 'error' ? 'font-medium text-danger' : 'text-success')}>
      {state === 'saved' ? (
        <span className="inline-flex items-center gap-1.5">
          <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
          {t('saved')}
        </span>
      ) : state === 'error' ? (
        (error ?? t('saveFailed'))
      ) : null}
    </p>
  );
}

/** 'saved' for four seconds after `flash()`. */
export function useSavedFlash() {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    saved,
    flash: () => {
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 4000);
    },
    reset: () => setSaved(false),
  };
}

/** A generic, localized message for a failed request; field problems are shown on the fields. */
export function useRequestError() {
  const t = useTranslations('App.settings');
  return (error: unknown) => (error instanceof ApiError && error.code === 'network_error' ? t('networkError') : t('saveFailed'));
}

export function initials(name: string | undefined) {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

type ImageMutations = {
  upload: UseMutationResult<Profile, Error, File>;
  remove: UseMutationResult<Profile, Error, void>;
};

/**
 * Image with Change / Remove (avatar or logo). Picks a file with the native picker, uploads at
 * once and explains a refused file in the page language.
 */
export function ImagePicker({
  label,
  hint,
  alt,
  src,
  fallback,
  shape,
  mutations,
  removeTitle,
  removeBody,
  icon: Icon = Camera,
}: {
  label: string;
  hint: string;
  alt: string;
  src: string | null;
  fallback: React.ReactNode;
  shape: 'round' | 'wide';
  mutations: ImageMutations;
  removeTitle: string;
  removeBody: string;
  icon?: LucideIcon;
}) {
  const t = useTranslations('App.settings');
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const { confirm, dialog } = useConfirm();
  const [problem, setProblem] = useState<string>();
  const busy = mutations.upload.isPending || mutations.remove.isPending;

  function explain(error: unknown) {
    const code = error instanceof ApiError ? error.code : 'network_error';
    const known: Record<string, string> = {
      image_too_large: t('image.tooLarge'),
      image_type: t('image.type'),
      image_unreadable: t('image.unreadable'),
      network_error: t('networkError'),
    };
    setProblem(known[code] ?? t('image.failed'));
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProblem(undefined);
    if (file.size > 15 * 1024 * 1024) return setProblem(t('image.tooLarge'));
    if (!['image/jpeg', 'image/png'].includes(file.type)) return setProblem(t('image.type'));
    mutations.upload.mutate(file, { onError: explain });
  }

  async function onRemove() {
    if (!(await confirm({ title: removeTitle, body: removeBody, confirmLabel: t('profile.remove') }))) return;
    setProblem(undefined);
    mutations.remove.mutate(undefined, { onError: explain });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-surface-subtle',
          shape === 'round' ? 'size-24 rounded-full' : 'h-20 w-44 rounded-lg',
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={src} alt={alt} className={cn('size-full', shape === 'round' ? 'object-cover' : 'object-contain p-2')} />
        ) : (
          fallback
        )}
        {busy ? <span aria-hidden className="absolute inset-0 animate-pulse bg-surface/60 motion-reduce:animate-none" /> : null}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p id={hintId} className="mt-0.5 text-sm text-fg-muted">
          {hint}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={Icon} pending={mutations.upload.isPending} disabled={busy} aria-describedby={hintId} onClick={() => input.current?.click()}>
            {src ? t('profile.change') : t('profile.upload')}
          </Button>
          {src ? (
            <Button variant="ghost" size="sm" icon={Trash2} pending={mutations.remove.isPending} disabled={busy} onClick={() => void onRemove()}>
              {t('profile.remove')}
            </Button>
          ) : null}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
        {problem ? (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {problem}
          </p>
        ) : null}
      </div>
      {dialog}
    </div>
  );
}
