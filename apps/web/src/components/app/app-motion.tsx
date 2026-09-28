'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Skeleton → content hand-off: the element fades in the first time it is inserted (CSS
 * @starting-style), so a loaded block replaces its skeleton without a hard cut. Opacity only,
 * so reduced motion keeps it as is and nothing shifts.
 */
export const HANDOFF = 'transition-opacity duration-200 ease-[var(--ease-out-expo)] starting:opacity-0';

type ListStaggerProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'ul' | 'ol' | 'div' | 'tbody';
  id?: string;
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-busy'?: boolean;
  'aria-hidden'?: boolean;
};

/**
 * The toolkit's stagger (same CSS, children spread `staggerItem(i)`) for data lists in the app:
 * it starts as soon as any part of the list is on screen, so long lists on phones never wait on
 * the failsafe, and once the entrance has played it steps aside, so the items' own hover, drag
 * and busy states respond at once instead of inheriting the stagger delay.
 */
export function ListStagger({ as: Tag = 'ul', children, className, ...rest }: ListStaggerProps) {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'done'>('waiting');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      setPhase('playing');
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    // 8 × 45 ms of delay plus the 520 ms settle, with a little room.
    const timer = setTimeout(() => setPhase('done'), 1000);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-stagger={phase === 'done' ? undefined : ''}
      data-revealed={phase === 'playing' ? '' : undefined}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const FILLS = { brand: 'bg-brand', warning: 'bg-warning', danger: 'bg-danger', inverse: 'bg-white' };

/**
 * The shared Meter, with a fill that eases to its value on arrival and on every change. The fill
 * slides with a transform (never width) from the start edge, so it follows the writing direction.
 */
export function EasedMeter({
  value,
  label,
  tone = 'brand',
  className,
  size = 'md',
}: {
  value: number;
  label: string;
  tone?: keyof typeof FILLS;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('w-full overflow-hidden rounded-full', tone === 'inverse' ? 'bg-white/20' : 'bg-surface-sunken', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div
        className={cn('h-full w-full rounded-full transition-[translate] duration-700 ease-[var(--ease-out-expo)] motion-reduce:transition-none', FILLS[tone])}
        style={{ translate: `calc(var(--motion-dir, 1) * ${shown - 100}%) 0` }}
      />
    </div>
  );
}
