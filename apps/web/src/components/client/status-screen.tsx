'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CalendarClock, CirclePause, Link2Off, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { whatsappLink } from '@/lib/client-api';
import { PhotographerMark, WhatsAppButton } from './client-shell';

type Kind = 'invalid' | 'closed' | 'unavailable' | 'error';

const ICONS: Record<Kind, LucideIcon> = {
  invalid: Link2Off,
  closed: CalendarClock,
  unavailable: CirclePause,
  error: AlertTriangle,
};

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
  const message = photographer ? whatsappLink(photographer.whatsapp, t('whatsappText', { gallery: gallery ?? '' })) : null;
  const Icon = ICONS[kind];
  const canRetry = Boolean(onRetry) && (kind === 'error' || kind === 'unavailable');
  const canMessage = Boolean(message) && kind !== 'invalid';

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
      <section className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-card sm:p-8">
        {photographer ? (
          <div className="flex flex-col items-center">
            <PhotographerMark name={photographer.name} size="md" />
            <p className="mt-3 text-sm font-medium text-fg-secondary">{photographer.name}</p>
            {gallery ? <p className="mt-0.5 text-sm text-fg-muted">{gallery}</p> : null}
          </div>
        ) : null}
        <span className={`mx-auto flex size-12 items-center justify-center rounded-full ${kind === 'error' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand'} ${photographer ? 'mt-8' : ''}`}>
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">{t(`${kind}.title`)}</h1>
        <p className="mt-2 text-base text-fg-secondary">{t(`${kind}.body`)}</p>
        {canMessage || canRetry ? (
          <div className="mt-8 flex flex-col gap-3">
            {canMessage && message ? (
              <WhatsAppButton href={message} tone="solid" size="lg" block>
                {t('messagePhotographer')}
              </WhatsAppButton>
            ) : null}
            {canRetry ? (
              <Button variant="secondary" size="lg" block icon={RotateCw} onClick={onRetry}>
                {t('retry')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
