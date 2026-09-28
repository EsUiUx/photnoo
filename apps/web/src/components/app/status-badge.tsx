import { useTranslations } from 'next-intl';
import type { Gallery } from '@/lib/types';

export type BadgeKind = 'active' | 'draft' | 'expired' | 'delivered' | 'attention';

// Figma "Component 97" variants.
const STYLES: Record<BadgeKind, string> = {
  active: 'bg-[#dfffd7] text-[#368605]',
  draft: 'bg-[#ffe2c8] text-[#904704]',
  expired: 'bg-[#ffc2c3] text-[#820002]',
  delivered: 'bg-[#c8d4ff] text-[#000276]',
  attention: 'bg-[#c9c9c9] text-[#404040]',
};

export function galleryBadge(gallery: Pick<Gallery, 'state' | 'suspended' | 'closedReason'>): BadgeKind {
  if (gallery.state === 'draft') return 'draft';
  if (gallery.state === 'active') return gallery.suspended ? 'attention' : 'active';
  return gallery.closedReason === 'cap_used' ? 'delivered' : 'expired';
}

export function StatusBadge({ kind }: { kind: BadgeKind }) {
  const t = useTranslations('App.status');
  return (
    <span className={`inline-flex h-8 min-w-[98px] items-center justify-center rounded-[7px] px-2 text-xs ${STYLES[kind]}`}>
      {t(kind)}
    </span>
  );
}
