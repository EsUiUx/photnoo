'use client';

import { useId } from 'react';
import { Link } from '@/i18n/navigation';

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  label: string;
  error?: string;
  /** Emails, phones and passwords stay left-to-right inside Arabic pages. */
  ltr?: boolean;
};

/** Figma "Component 65-68": 53px bordered field, placeholder as the visible label. */
export function TextField({ label, error, ltr, id, ...input }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        placeholder={label}
        dir={ltr ? 'ltr' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-[53px] w-full border bg-white px-[22px] text-lg text-ink placeholder:text-[rgba(51,51,51,0.5)] focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:bg-field-muted disabled:text-ink-muted sm:text-xl ${
          ltr ? 'placeholder:text-start rtl:text-right' : ''
        } ${error ? 'border-danger' : 'border-field-border'}`}
        {...input}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Figma "Component 122": full-width primary action. */
export function SubmitButton({ children, pending }: { children: React.ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="flex h-[53px] w-full items-center justify-center bg-primary-400 text-xl font-medium text-on-primary transition-colors hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <span className="size-5 animate-spin rounded-full border-2 border-on-primary/40 border-t-on-primary" /> : children}
    </button>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
      {message}
    </p>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  return <p className="border border-primary-200 bg-primary-50 px-4 py-3 text-ink-body">{children}</p>;
}

/** Green underlined text link used for "Forgot password", "Sign up now", "Back". */
export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-lg leading-[1.4] font-semibold text-primary-300 underline underline-offset-2">
      {children}
    </Link>
  );
}

export function TextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-lg leading-[1.4] font-semibold text-primary-300 underline underline-offset-2"
    >
      {children}
    </button>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  error,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 text-base leading-[1.4] text-ink-body">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-invalid={error || undefined}
        className="mt-1 size-4 shrink-0 accent-primary-400"
      />
      <span>{label}</span>
    </label>
  );
}
