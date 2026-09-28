import { useTranslations } from 'next-intl';
import { Badge, type Tone } from '@/components/ui/primitives';
import type { Gallery } from '@/lib/types';

export type BadgeKind = 'active' | 'draft' | 'expired' | 'delivered' | 'attention';

// One mapping for every surface that shows a gallery's state; the text carries the meaning.
const TONES: Record<BadgeKind, { tone: Tone; dot?: boolean }> = {
  draft: { tone: 'neutral' },
  active: { tone: 'success', dot: true },
  delivered: { tone: 'info' },
  expired: { tone: 'neutral' },
  attention: { tone: 'warning', dot: true },
};

export function galleryBadge(gallery: Pick<Gallery, 'state' | 'suspended' | 'closedReason'>): BadgeKind {
  if (gallery.state === 'draft') return 'draft';
  if (gallery.state === 'active') return gallery.suspended ? 'attention' : 'active';
  return gallery.closedReason === 'cap_used' ? 'delivered' : 'expired';
}

export function StatusBadge({ kind, className }: { kind: BadgeKind; className?: string }) {
  const t = useTranslations('App.status');
  const { tone, dot } = TONES[kind];
  return (
    <Badge tone={tone} dot={dot} className={className}>
      {t(kind)}
    </Badge>
  );
}
