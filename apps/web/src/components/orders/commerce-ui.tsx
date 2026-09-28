'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { HANDOFF } from '@/components/app/app-motion';
import { staggerItem } from '@/components/motion/stagger-item';
import { Badge, type Tone } from '@/components/ui/primitives';
import { Skeleton } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import type { OrderStatus } from '@/lib/types-commerce';

/** "1,250 EGP" / "1,250 ج.م" with Western digits, like every other number in the app. */
export function useMoney() {
  const format = useFormatter();
  const t = useTranslations('Common');
  return (amount: number) => `${format.number(amount, { numberingSystem: 'latn', maximumFractionDigits: 2 })} ${t('egp')}`;
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** When false, Escape and the backdrop do nothing (while a save runs). */
  dismissible?: boolean;
};

/**
 * Side sheet on the native modal <dialog>: slides in from the inline end, full width on phones.
 * Focus is trapped and restored by the browser; children mount only while open.
 */
export function Drawer({ open, onClose, title, description, children, footer, dismissible = true }: DrawerProps) {
  const t = useTranslations('Common');
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-motion="drawer-end"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) onClose();
      }}
      className={cn(
        'ms-auto me-0 my-0 h-dvh max-h-none w-full max-w-md border-0 border-s border-border bg-surface p-0 text-fg shadow-overlay backdrop:bg-overlay sm:rounded-s-xl',
        'open:flex',
      )}
    >
      {open ? (
        <div className="flex min-h-0 w-full flex-col">
          <div className="flex items-start gap-4 border-b border-border px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold text-fg">
                {title}
              </h2>
              {description ? (
                <div id={descId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </div>
              ) : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className="-me-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-subtle hover:text-fg pointer-coarse:size-11"
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-surface-subtle px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** An on/off switch with a visible label; the whole row is the target. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-fg">
          {label}
        </label>
        {description ? (
          <p id={`${id}-desc`} className="mt-0.5 text-sm text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="group relative flex h-10 w-12 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11"
      >
        <span
          aria-hidden
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors duration-150',
            checked ? 'bg-brand group-hover:bg-brand-hover' : 'bg-border-strong',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-[inset-inline-start] duration-150 ease-[var(--ease-out-expo)]',
              checked ? 'start-5.5' : 'start-0.5',
            )}
          />
        </span>
      </button>
    </div>
  );
}

/** Figma stat card: label, icon, big number, and a change against the previous 30 days when there is one. */
export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  hint,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  delta?: number | null;
  hint?: string;
  /** Position in a staggered list (see ListStagger). */
  index?: number;
}) {
  const t = useTranslations('App.orders');
  const format = useFormatter();
  const up = (delta ?? 0) >= 0;
  return (
    <li {...(index === undefined ? {} : staggerItem(index))} className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-fg-muted">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      {value === undefined ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <div className={cn('mt-3 flex flex-wrap items-center gap-x-2 gap-y-1', HANDOFF)}>
          <p className="tabular text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{value}</p>
          {delta !== undefined && delta !== null ? (
            <Badge tone={up ? 'success' : 'danger'} className="tabular gap-1">
              {up ? <TrendingUp size={14} strokeWidth={1.75} aria-hidden /> : <TrendingDown size={14} strokeWidth={1.75} aria-hidden />}
              <span dir="ltr">{`${up ? '+' : ''}${format.number(delta, { numberingSystem: 'latn', maximumFractionDigits: 1 })}%`}</span>
              <span className="sr-only">{t('vsPrevious')}</span>
            </Badge>
          ) : null}
        </div>
      )}
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </li>
  );
}

export const STATUS_TONES: Record<OrderStatus, Tone> = {
  pending: 'warning',
  in_production: 'info',
  ready: 'brand',
  delivered: 'success',
  cancelled: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('App.orders.status');
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {t(status)}
    </Badge>
  );
}

export function PaidBadge({ paid }: { paid: boolean }) {
  const t = useTranslations('App.orders');
  return <Badge tone={paid ? 'success' : 'neutral'}>{paid ? t('paid') : t('unpaid')}</Badge>;
}
