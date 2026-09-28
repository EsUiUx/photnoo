'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Dialog, PillButton } from '@/components/app/dialog';
import { FormAlert } from '@/components/auth/fields';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  fetchLink,
  useActivate,
  useCloseGallery,
  useMe,
  useRegeneratePassword,
} from '@/lib/queries';
import type { GalleryDetail } from '@/lib/types';

/**
 * PRD P-10 / P-11 / P-13. Draft: explain the 7-day window and share. Active: copy or send the
 * link, make a new password, or close the gallery. The password is shown only right after it
 * is created; it cannot be read back later, only replaced.
 */
export function ShareDialog({
  gallery,
  open,
  onClose,
}: {
  gallery: GalleryDetail;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('App.share');
  // Dialog mounts its children only while open, so a shown password never survives a reopen.
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={gallery.state === 'draft' ? t('titleDraft') : t('title')}
    >
      <ShareBody gallery={gallery} onClose={onClose} />
    </Dialog>
  );
}

function ShareBody({ gallery, onClose }: { gallery: GalleryDetail; onClose: () => void }) {
  const t = useTranslations('App.share');
  const locale = useLocale();
  const me = useMe();
  const activate = useActivate(gallery.id);
  const regenerate = useRegeneratePassword(gallery.id);
  const close = useCloseGallery(gallery.id);
  const shared = useQuery({
    queryKey: ['gallery', gallery.id, 'link'],
    queryFn: () => fetchLink(gallery.id),
    enabled: gallery.state === 'active',
  });
  const [created, setCreated] = useState<{ link: string; password: string } | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [confirmClose, setConfirmClose] = useState(false);
  const link = created?.link ?? shared.data?.link ?? null;
  const password = created?.password ?? newPassword;

  const photographer = me.data?.studioName ?? me.data?.name ?? '';
  const phone = gallery.clientPhone?.replace(/\D/g, '') ?? '';
  const whatsapp = (text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  async function share() {
    setError(undefined);
    try {
      const result = await activate.mutateAsync();
      setCreated({ link: result.link, password: result.password });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'generic';
      setError(
        t(`errors.${['uploads_in_progress', 'gallery_empty'].includes(code) ? code : 'generic'}`),
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <FormAlert message={error} />

      {gallery.state === 'draft' && !password ? (
        <>
          <p className="text-lg text-ink-body">{t('draftIntro', { days: 7 })}</p>
          <ul className="list-disc space-y-1 ps-6 text-ink-muted">
            <li>{t('draftPoint1')}</li>
            <li>{t('draftPoint2')}</li>
            <li>{t('draftPoint3')}</li>
          </ul>
          <div className="flex justify-center">
            <PillButton onClick={() => void share()} pending={activate.isPending}>
              {t('shareNow')}
            </PillButton>
          </div>
        </>
      ) : null}

      {gallery.state === 'closed' ? <p className="text-lg text-ink-body">{t('closed')}</p> : null}

      {(gallery.state === 'active' || password) && link ? (
        <>
          {gallery.expiresAt ? (
            <p className="text-ink-muted">
              {t('expires', { date: formatDate(gallery.expiresAt, locale) })}
            </p>
          ) : null}
          <CopyRow label={t('link')} value={link} ltr />
          <a
            href={whatsapp(t('linkMessage', { photographer, gallery: gallery.name, link }))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[42px] items-center justify-center rounded-3xl bg-[#25d366] px-6 text-lg font-semibold text-white hover:bg-[#1fb957]"
          >
            {t('sendLink')}
          </a>

          {password ? (
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
              <CopyRow label={t('password')} value={password} ltr mono />
              <p className="mt-2 text-sm text-ink-muted">{t('passwordOnce')}</p>
              <a
                href={whatsapp(t('passwordMessage', { password }))}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-[42px] items-center justify-center rounded-3xl border-2 border-[#25d366] px-6 font-semibold text-[#128c4a] hover:bg-[#e9fbef]"
              >
                {t('sendPassword')}
              </a>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-ink-muted">{t('lostPassword')}</p>
              <PillButton
                tone="ghost"
                pending={regenerate.isPending}
                onClick={() =>
                  void regenerate.mutateAsync().then((r) => setNewPassword(r.password))
                }
              >
                {t('newPassword')}
              </PillButton>
            </div>
          )}

          <div className="border-t border-line pt-4">
            {confirmClose ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 text-sm text-danger">{t('closeWarning')}</p>
                <PillButton
                  tone="danger"
                  pending={close.isPending}
                  onClick={() => void close.mutateAsync().then(onClose)}
                >
                  {t('closeConfirm')}
                </PillButton>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                className="text-sm font-semibold text-danger underline"
              >
                {t('closeNow')}
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function CopyRow({
  label,
  value,
  ltr,
  mono,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  mono?: boolean;
}) {
  const t = useTranslations('App.share');
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[#6c757d]">{label}</p>
      <div className="flex items-center gap-2">
        <output
          dir={ltr ? 'ltr' : undefined}
          className={`h-[53px] min-w-0 flex-1 truncate rounded-[23px] border border-field-border bg-white px-5 leading-[53px] ${mono ? 'font-mono text-xl tracking-wider' : 'text-base'}`}
        >
          {value}
        </output>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="h-[53px] shrink-0 rounded-[23px] bg-primary-300 px-5 font-semibold text-primary-50 hover:bg-primary-400"
        >
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
    </div>
  );
}
