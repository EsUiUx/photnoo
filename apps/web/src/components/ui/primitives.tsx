'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-fg-secondary',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

const DOTS: Record<Tone, string> = {
  neutral: 'bg-fg-muted',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Status label: text always carries the meaning, the dot only reinforces it. */
export function Badge({ tone = 'neutral', dot, children, className }: { tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {dot ? <span aria-hidden className={cn('size-1.5 rounded-full', DOTS[tone])} /> : null}
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'section',
  ...rest
}: { children: React.ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  return (
    <Tag className={cn('rounded-lg border border-border bg-surface shadow-xs', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Labelled horizontal meter for allowance, storage and upload progress. */
export function Meter({ value, label, tone = 'brand', className, size = 'md' }: { value: number; label: string; tone?: 'brand' | 'warning' | 'danger' | 'inverse'; className?: string; size?: 'sm' | 'md' }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fills = { brand: 'bg-brand', warning: 'bg-warning', danger: 'bg-danger', inverse: 'bg-white' };
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('w-full overflow-hidden rounded-full', tone === 'inverse' ? 'bg-white/20' : 'bg-surface-sunken', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-expo)]', fills[tone])} style={{ width: `${clamped}%` }} />
    </div>
  );
}

type Option<T extends string> = { value: T; label: React.ReactNode };

/**
 * Radio group styled as a segmented control, with roving focus and arrow keys
 * (WAI-ARIA radio group pattern).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  // The selected pill slides between options instead of jumping (measured, so labels of any
  // length and either writing direction work).
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[index];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const group = refs.current[index]?.parentElement;
    if (!group || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [index, options.length]);

  function move(event: React.KeyboardEvent, current: number) {
    const rtl = document.documentElement.dir === 'rtl';
    const forward = ['ArrowDown', rtl ? 'ArrowLeft' : 'ArrowRight'];
    const back = ['ArrowUp', rtl ? 'ArrowRight' : 'ArrowLeft'];
    let next = current;
    if (forward.includes(event.key)) next = (current + 1) % options.length;
    else if (back.includes(event.key)) next = (current - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className={cn('relative isolate inline-flex rounded-md bg-surface-sunken p-1', className)}>
      {pill ? (
        <span
          aria-hidden
          className="absolute inset-y-1 -z-10 rounded-[7px] bg-surface shadow-xs transition-[left,width] duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none"
          style={{ left: pill.left, width: pill.width }}
        />
      ) : null}
      {options.map((option, i) => {
        const checked = i === index;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-[7px] px-3.5 font-medium whitespace-nowrap transition-colors duration-150',
              size === 'sm' ? 'h-8 text-sm' : 'h-9 text-sm pointer-coarse:h-10',
              checked ? cn('text-fg', !pill && 'bg-surface shadow-xs') : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Copies text and confirms in place and to screen readers; reports failure instead of pretending. */
export function CopyButton({ value, label, className, variant = 'secondary' }: { value: string; label?: string; className?: string; variant?: 'secondary' | 'primary' }) {
  const t = useTranslations('Common');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors duration-150 pointer-coarse:h-11',
        variant === 'primary' ? 'bg-brand text-brand-fg hover:bg-brand-hover' : 'border border-border-strong bg-surface text-fg shadow-xs hover:bg-surface-subtle',
        className,
      )}
    >
      {state === 'copied' ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={1.75} aria-hidden />}
      <span>{state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : (label ?? t('copy'))}</span>
      <span aria-live="polite" className="sr-only">
        {state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : ''}
      </span>
    </button>
  );
}

/** Definition list row used in detail panels; wraps instead of forcing fixed label widths. */
export function DetailList({ items, className }: { items: Array<{ label: React.ReactNode; value: React.ReactNode }>; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]', className)}>
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-sm text-fg-muted">{item.label}</dt>
          <dd className="text-sm font-medium text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
