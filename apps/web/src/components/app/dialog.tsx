'use client';

import { useEffect, useId, useRef } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
};

/**
 * Modal built on the native <dialog>: focus trapping, Escape and inert background come from
 * the browser. Styled after Figma "Creating New Gallery" (rounded 19px, bold title, X).
 */
export function Dialog({ open, onClose, title, children, width = 'max-w-[686px]' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${width} rounded-[19px] bg-white p-0 text-ink backdrop:bg-primary-900/60`}
    >
      {open ? (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-2xl leading-[1.4] font-bold text-primary-900">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="text-2xl leading-[1.4] font-bold text-primary-900">
              X
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

/** Rounded 42px pill used for dialog actions (Figma "Frame 1618872917"). */
export function PillButton({
  children,
  onClick,
  type = 'button',
  tone = 'primary',
  pending,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  tone?: 'primary' | 'danger' | 'ghost';
  pending?: boolean;
  disabled?: boolean;
}) {
  const tones = {
    primary: 'bg-primary-300 text-primary-50 hover:bg-primary-400',
    danger: 'bg-[#ff5353] text-primary-50 hover:bg-[#e04444]',
    ghost: 'border-2 border-primary-300 bg-primary-100 text-primary-500 hover:bg-primary-200',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex h-[42px] min-w-[160px] items-center justify-center gap-2 rounded-3xl px-6 text-lg font-semibold transition-colors disabled:opacity-60 ${tones[tone]}`}
    >
      {pending ? <span className="size-5 animate-spin rounded-full border-2 border-current/40 border-t-current" /> : children}
    </button>
  );
}
