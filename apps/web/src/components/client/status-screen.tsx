'use client';

import { useTranslations } from 'next-intl';
import { whatsappLink } from '@/lib/client-api';
import { PhotographerMark, WhatsAppButton } from './client-shell';

type Kind = 'invalid' | 'closed' | 'unavailable' | 'error';

/** Branded pages for links that cannot be opened (C-09): never a raw error. */
export function StatusScreen({
  kind,
  gallery,
  photographer,
  onRetry,
}: {
  kind: Kind;
  gallery?: string;
  photographer?: { name: string; whatsapp: string | null };
  onRetry?: () => void;
}) {
  const t = useTranslations('Client.status');
  const message = photographer
    ? whatsappLink(photographer.whatsapp, t('whatsappText', { gallery: gallery ?? '' }))
    : null;

  return (
    <section className="mx-auto flex w-full max-w-[520px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      {photographer ? <PhotographerMark name={photographer.name} size="lg" /> : null}
      {photographer ? <p className="mt-4 font-medium text-ink-muted">{photographer.name}</p> : null}
      {gallery ? <p className="mt-1 text-lg font-semibold text-primary-900">{gallery}</p> : null}
      <h1 className="mt-6 text-3xl leading-tight font-bold text-primary-900">{t(`${kind}.title`)}</h1>
      <p className="mt-3 text-lg text-ink-body">{t(`${kind}.body`)}</p>
      <div className="mt-8 flex flex-col items-center gap-3">
        {message && kind !== 'invalid' ? <WhatsAppButton href={message}>{t('messagePhotographer')}</WhatsAppButton> : null}
        {onRetry && (kind === 'error' || kind === 'unavailable') ? (
          <button type="button" onClick={onRetry} className="font-semibold text-primary-400 underline underline-offset-2">
            {t('retry')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
