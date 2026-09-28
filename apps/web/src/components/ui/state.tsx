'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

export function Spinner({ size = 18, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin motion-reduce:animate-none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/** Centered page or section loader with a spoken label. */
export function Loading({ label, className }: { label?: string; className?: string }) {
  const t = useTranslations('Common');
  return (
    <div className={cn('flex items-center justify-center py-16 text-fg-muted', className)}>
      <Spinner size={22} label={label ?? t('loading')} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-sunken motion-reduce:animate-none', className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <p className="text-base font-semibold text-fg">{title}</p>
      {body ? <p className="mt-1.5 max-w-md text-sm text-fg-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** A failed load: says what broke and offers a retry instead of an empty or endless state. */
export function ErrorState({ title, body, onRetry, className }: { title?: string; body?: string; onRetry?: () => void; className?: string }) {
  const t = useTranslations('Common');
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="text-base font-semibold text-fg">{title ?? t('loadFailedTitle')}</p>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">{body ?? t('loadFailedBody')}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg shadow-xs hover:bg-surface-subtle"
        >
          {t('retry')}
        </button>
      ) : null}
    </div>
  );
}

export function Alert({ tone = 'danger', title, children, className }: { tone?: 'danger' | 'warning' | 'info' | 'success'; title?: string; children?: React.ReactNode; className?: string }) {
  const tones = {
    danger: 'border-danger/25 bg-danger-soft text-danger',
    warning: 'border-warning/25 bg-warning-soft text-warning',
    info: 'border-info/25 bg-info-soft text-info',
    success: 'border-success/25 bg-success-soft text-success',
  };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-md border px-4 py-3 text-sm', tones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-0.5' : undefined}>{children}</div> : null}
    </div>
  );
}
