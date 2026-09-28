'use client';

import { useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label: string;
  invalid?: boolean;
};

/**
 * Figma "We Have Sent You OTP": six rounded boxes. Typing advances, Backspace goes back, and a
 * pasted or autofilled code fills every box. Digits always run left-to-right, even in Arabic.
 */
export function OtpInput({ value, onChange, length = 6, label, invalid }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  function setFrom(index: number, raw: string) {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) return;
    const next = (value.slice(0, index) + incoming).slice(0, length);
    onChange(next);
    refs.current[Math.min(next.length, length - 1)]?.focus();
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const cut = digits[index] ? index : Math.max(index - 1, 0);
      onChange(value.slice(0, cut));
      refs.current[cut]?.focus();
    } else if (event.key === 'ArrowLeft') {
      refs.current[Math.max(index - 1, 0)]?.focus();
    } else if (event.key === 'ArrowRight') {
      refs.current[Math.min(index + 1, length - 1)]?.focus();
    }
  }

  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div dir="ltr" className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            value={digit}
            onChange={(event) => setFrom(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            aria-label={`${label} ${index + 1}`}
            aria-invalid={invalid || undefined}
            className={`aspect-[62.5/61.6] w-full min-w-0 rounded-[26.4px] border text-center text-2xl text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 ${
              digit ? 'border-primary-300 bg-white' : 'border-primary-100 bg-field-muted'
            } ${invalid ? 'border-danger' : ''}`}
          />
        ))}
      </div>
    </fieldset>
  );
}
