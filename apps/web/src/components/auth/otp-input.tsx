'use client';

import { useId, useRef } from 'react';
import { cn } from '@/lib/cn';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label: string;
  hint?: string;
  error?: string;
  /** Id of the first box, so a failed submit can focus it. */
  id?: string;
};

/**
 * Six 48px code boxes. Typing advances, Backspace goes back, arrows move, and a pasted or
 * autofilled code fills every box. Digits always run left-to-right, even in Arabic.
 */
export function OtpInput({ value, onChange, length = 6, label, hint, error, id }: Props) {
  const auto = useId();
  const baseId = id ?? auto;
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  function fill(index: number, raw: string) {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) return;
    const next = (value.slice(0, index) + incoming).slice(0, length);
    onChange(next);
    refs.current[Math.min(next.length, length - 1)]?.focus();
  }

  function onPaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    // A whole code replaces everything; a fragment continues from the focused box.
    fill(pasted.length >= length ? 0 : index, pasted);
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const cut = digits[index] ? index : Math.max(index - 1, 0);
      onChange(value.slice(0, cut));
      refs.current[cut]?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      refs.current[Math.max(index - 1, 0)]?.focus();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      refs.current[Math.min(index + 1, length - 1)]?.focus();
    }
  }

  return (
    <fieldset aria-describedby={describedBy} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-fg">{label}</legend>
      <div dir="ltr" className="flex gap-2 sm:gap-3">
        {digits.map((digit, index) => (
          <input
            key={index}
            id={index === 0 ? baseId : undefined}
            ref={(element) => {
              refs.current[index] = element;
            }}
            value={digit}
            onChange={(event) => fill(index, event.target.value)}
            onPaste={(event) => onPaste(index, event)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            aria-label={`${label} ${index + 1}/${length}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'tabular size-12 min-w-0 rounded-md border bg-surface text-center text-xl font-semibold text-fg shadow-xs transition-[border-color,box-shadow] duration-150',
              'focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none focus-visible:outline-none',
              error ? 'border-danger focus:border-danger focus:ring-danger/15' : digit ? 'border-fg-muted' : 'border-border-strong',
            )}
          />
        ))}
      </div>
      {hint && !error ? (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
