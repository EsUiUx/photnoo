import { cn } from '@/lib/cn';

/** First letters of the first two words, e.g. "Mona Adel" → "MA"; works for Arabic names too. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}

const SIZES = { sm: 'size-8 text-xs', md: 'size-12 text-base', lg: 'size-20 text-2xl' };

/** Initials on the brand tint. Decorative: the name is always written next to it. */
export function ClientAvatar({ name, size = 'md', className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand', SIZES[size], className)}>
      {initials(name)}
    </span>
  );
}
