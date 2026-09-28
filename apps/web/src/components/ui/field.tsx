'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { forwardRef, useId, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Form fields with a visible label above every control (never placeholder-only), hint and
 * error text linked through aria-describedby, and 16px text so iOS does not zoom on focus.
 */

const control =
  'w-full rounded-md border bg-surface px-3.5 text-base text-fg shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-fg-muted ' +
  'focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-fg-muted';

export function controlClasses(invalid?: boolean, className?: string) {
  return cn(control, invalid ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-border-strong', className);
}

type FieldShellProps = {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  srOnlyLabel?: boolean;
  children: React.ReactNode;
  className?: string;
};

function FieldShell({ id, label, hint, error, optional, srOnlyLabel, children, className }: FieldShellProps) {
  const t = useTranslations('Common');
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium text-fg', srOnlyLabel && 'sr-only')}>
        {label}
        {optional ? <span className="ms-1.5 font-normal text-fg-muted">({t('optional')})</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: React.ReactNode, error?: string) {
  return [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
}

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  srOnlyLabel?: boolean;
  /** Emails, phones, codes and passwords stay left-to-right inside Arabic pages. */
  ltr?: boolean;
  className?: string;
  inputClassName?: string;
  trailing?: React.ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, hint, error, optional, srOnlyLabel, ltr, className, inputClassName, trailing, id, ...input },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} srOnlyLabel={srOnlyLabel} className={className}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          dir={ltr ? 'ltr' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error)}
          className={controlClasses(Boolean(error), cn('h-11', ltr && 'rtl:text-right', trailing ? 'pe-12' : undefined, inputClassName))}
          {...input}
        />
        {trailing ? <div className="absolute inset-y-0 end-1 flex items-center">{trailing}</div> : null}
      </div>
    </FieldShell>
  );
});

export const PasswordField = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing' | 'ltr'>>(function PasswordField(props, ref) {
  const t = useTranslations('Common');
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      ref={ref}
      {...props}
      ltr
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('hidePassword') : t('showPassword')}
          aria-pressed={visible}
          className="flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-subtle hover:text-fg"
        >
          {visible ? <EyeOff size={18} strokeWidth={1.75} aria-hidden /> : <Eye size={18} strokeWidth={1.75} aria-hidden />}
        </button>
      }
    />
  );
});

type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
};

export function TextareaField({ label, hint, error, optional, className, id, rows = 4, ...rest }: TextareaProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={controlClasses(Boolean(error), 'resize-y py-2.5 leading-relaxed')}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

export function SelectField({ label, hint, error, className, id, children, ...rest }: SelectProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={controlClasses(Boolean(error), 'h-11 appearance-none bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pe-10 rtl:bg-[position:left_12px_center]')}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235c6862' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  label: React.ReactNode;
  error?: string;
  className?: string;
};

/** 20px box inside a 44px-tall row; the whole label is the target. */
export function CheckboxField({ label, error, className, id, ...rest }: CheckboxProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm text-fg-secondary">
        <input
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-border-strong accent-brand"
          {...rest}
        />
        <span className="leading-relaxed">{label}</span>
      </label>
      {error ? (
        <p id={`${fieldId}-error`} className="ms-8 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
