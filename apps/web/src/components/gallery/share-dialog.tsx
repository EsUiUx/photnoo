'use client';

import { LinkDays } from '@photnoo/shared';
import { CalendarClock, KeyRound, LockKeyhole, Link2, MessageCircle, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, useConfirm } from '@/components/ui/dialog';
import { CopyButton } from '@/components/ui/primitives';
import { controlClasses } from '@/components/ui/field';
import { Alert, Skeleton, Spinner } from '@/components/ui/state';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { fetchLink, useActivate, useCloseGallery, useMe, useRegeneratePassword } from '@/lib/queries';
import type { GalleryDetail } from '@/lib/types';

/**
 * PRD P-10 / P-11 / P-13. Draft: explain the 7-day window and share. Active: copy or send the
 * link, make a new password, or close the gallery. The password is shown only right after it
 * is created; it cannot be read back later, only replaced.
 */
export function ShareDialog({ gallery, open, onClose }: { gallery: GalleryDetail; open: boolean; onClose: () => void }) {
  const t = useTranslations('App.share');
  const [busy, setBusy] = useState(false);
  // Dialog mounts its children only while open, so a shown password never survives a reopen.
  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!busy}
      title={gallery.state === 'draft' ? t('titleDraft') : t('title')}
      description={gallery.state === 'draft' ? t('draftIntroChoose') : undefined}
    >
      <ShareBody gallery={gallery} onClose={onClose} onBusy={setBusy} />
    </Dialog>
  );
}

function ShareBody({ gallery, onClose, onBusy }: { gallery: GalleryDetail; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const t = useTranslations('App.share');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const me = useMe();
  const activate = useActivate(gallery.id);
  const regenerate = useRegeneratePassword(gallery.id);
  const close = useCloseGallery(gallery.id);
  const { confirm, dialog } = useConfirm();
  const shared = useQuery({
    queryKey: ['gallery', gallery.id, 'link'],
    queryFn: () => fetchLink(gallery.id),
    enabled: gallery.state === 'active',
  });
  const [created, setCreated] = useState<{ link: string; password: string; expiresAt: string } | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [days, setDays] = useState<number>(LinkDays.default);
  const [openedAt] = useState(() => Date.now());
  const daysId = useId();
  const link = created?.link ?? shared.data?.link ?? null;
  const password = created?.password ?? newPassword;
  const expiresAt = created?.expiresAt ?? gallery.expiresAt ?? shared.data?.expiresAt ?? null;

  const photographer = me.data?.studioName ?? me.data?.name ?? '';
  const phone = gallery.clientPhone?.replace(/\D/g, '') ?? '';
  const whatsapp = (text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    setError(undefined);
    onBusy(true);
    try {
      return await work();
    } finally {
      onBusy(false);
    }
  }

  async function share() {
    try {
      const result = await run(() => activate.mutateAsync(days));
      if (result) setCreated(result);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'generic';
      setError(t(`errors.${['uploads_in_progress', 'gallery_empty'].includes(code) ? code : 'generic'}`));
    }
  }

  async function makePassword() {
    const ok = await confirm({
      title: t('newPasswordTitle'),
      body: t('newPasswordBody'),
      confirmLabel: t('newPasswordConfirm'),
    });
    if (!ok) return;
    try {
      const result = await run(() => regenerate.mutateAsync());
      if (result) setNewPassword(result.password);
    } catch {
      setError(t('newPasswordFailed'));
    }
  }

  async function closeNow() {
    const ok = await confirm({
      title: t('closeTitle', { name: gallery.name }),
      body: t('closeWarning'),
      confirmLabel: t('closeConfirm'),
    });
    if (!ok) return;
    try {
      await run(() => close.mutateAsync());
      onClose();
    } catch {
      setError(t('closeFailed'));
    }
  }

  if (gallery.state === 'closed' || gallery.state === 'purged' || gallery.state === 'anonymised') {
    return <p className="text-sm text-fg-secondary">{t('closed')}</p>;
  }

  if (gallery.state === 'draft' && !created) {
    const points = [
      { icon: Link2, text: t('draftPoint1') },
      { icon: MessageCircle, text: t('draftPoint2') },
      { icon: CalendarClock, text: t('draftPoint3Choose') },
    ];
    return (
      <div className="flex flex-col gap-5">
        {error ? <Alert>{error}</Alert> : null}
        <ul className="flex flex-col gap-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-fg-secondary">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <Icon size={16} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={daysId} className="text-sm font-medium text-fg">
            {t('duration')}
          </label>
          <select
            id={daysId}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            aria-describedby={`${daysId}-until`}
            className={controlClasses(false, 'h-11')}
          >
            {Array.from({ length: LinkDays.max - LinkDays.min + 1 }, (_, i) => LinkDays.min + i).map((n) => (
              <option key={n} value={n}>
                {t('durationOption', { count: n })}
              </option>
            ))}
          </select>
          <p id={`${daysId}-until`} className="text-sm text-fg-muted">
            {t('worksUntil', { date: formatDate(new Date(openedAt + days * 86_400_000).toISOString(), locale) })}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button variant="secondary" onClick={onClose} disabled={activate.isPending}>
            {tc('cancel')}
          </Button>
          <Button onClick={() => void share()} pending={activate.isPending}>
            {t('shareNow')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert>{error}</Alert> : null}
      {expiresAt ? (
        <p className="flex items-center gap-2 text-sm text-fg-secondary">
          <CalendarClock size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
          {t('worksUntil', { date: formatDate(expiresAt, locale) })}
        </p>
      ) : null}

      <section aria-labelledby="share-link-label" className="flex flex-col gap-2">
        <h3 id="share-link-label" className="text-sm font-medium text-fg">
          {t('link')}
        </h3>
        {link ? (
          <>
            <div className="flex items-center gap-2">
              <output dir="ltr" className="flex h-10 min-w-0 flex-1 items-center truncate rounded-md border border-border bg-surface-subtle px-3.5 text-sm text-fg pointer-coarse:h-11">
                <span className="truncate">{link}</span>
              </output>
              <CopyButton value={link} />
            </div>
            <WhatsAppLink href={whatsapp(t('linkMessage', { photographer, gallery: gallery.name, link }))}>{t('sendLink')}</WhatsAppLink>
          </>
        ) : shared.isError ? (
          <Alert>{t('linkFailed')}</Alert>
        ) : (
          <Skeleton className="h-10 w-full" />
        )}
      </section>

      <section aria-labelledby="share-password-label" className="flex flex-col gap-2">
        <h3 id="share-password-label" className="text-sm font-medium text-fg">
          {t('password')}
        </h3>
        {password ? (
          <div className="rounded-lg border border-brand-soft-strong bg-brand-soft/50 p-4">
            <div className="flex items-center gap-2">
              <output dir="ltr" className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-border bg-surface px-3.5 font-mono text-base tracking-widest text-fg pointer-coarse:h-11">
                {password}
              </output>
              <CopyButton value={password} />
            </div>
            <p className="mt-2 flex items-start gap-2 text-xs text-fg-secondary">
              <KeyRound size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-brand" />
              {t('passwordOnce')}
            </p>
            <div className="mt-3">
              <WhatsAppLink href={whatsapp(t('passwordMessage', { password }))}>{t('sendPassword')}</WhatsAppLink>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
            <p className="flex-1 text-sm text-fg-secondary">{t('lostPassword')}</p>
            <Button variant="secondary" size="sm" icon={RefreshCw} pending={regenerate.isPending} onClick={() => void makePassword()}>
              {t('newPassword')}
            </Button>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-fg-muted">{t('closeHint')}</p>
        <button
          type="button"
          onClick={() => void closeNow()}
          disabled={close.isPending}
          aria-busy={close.isPending || undefined}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-md px-3 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft disabled:opacity-50 pointer-coarse:h-11 sm:self-auto"
        >
          {close.isPending ? <Spinner size={16} /> : <LockKeyhole size={16} strokeWidth={1.75} aria-hidden />}
          {t('closeNow')}
        </button>
      </div>
      {dialog}
    </div>
  );
}

/** WhatsApp brand green as a background with dark text: 6.3:1 contrast. */
function WhatsAppLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-[#25d366] px-4 text-sm font-semibold text-[#0b3d1f] shadow-xs transition-[filter] duration-150 hover:brightness-95 pointer-coarse:h-11"
    >
      <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
      {children}
    </a>
  );
}
