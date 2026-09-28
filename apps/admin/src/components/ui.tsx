'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Tone = 'primary' | 'ghost' | 'danger';

export function Button({
  children,
  tone = 'primary',
  pending,
  disabled,
  onClick,
  type = 'button',
  small,
}: {
  children: React.ReactNode;
  tone?: Tone;
  pending?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  small?: boolean;
}) {
  const tones: Record<Tone, string> = {
    primary: 'bg-primary-400 text-white hover:bg-primary-500',
    ghost: 'border border-line bg-white text-ink hover:border-primary-300',
    danger: 'bg-danger text-white hover:bg-[#912018]',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm'
      } ${tones[tone]}`}
    >
      {pending ? <span className="size-4 animate-spin rounded-full border-2 border-current/40 border-t-current" /> : null}
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white p-5 ${className}`}>{children}</section>;
}

const BADGES: Record<string, string> = {
  green: 'bg-[#dfffd7] text-[#2f6f05]',
  amber: 'bg-[#ffe9cc] text-[#8a4204]',
  red: 'bg-[#ffd6d6] text-[#8a0003]',
  grey: 'bg-[#e4e4e4] text-[#404040]',
  purple: 'bg-[#ece0ff] text-[#5b19a8]',
  blue: 'bg-[#d9e3ff] text-[#1b2d8f]',
};

export function Badge({ children, color = 'grey' }: { children: React.ReactNode; color?: keyof typeof BADGES }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${BADGES[color]}`}>{children}</span>;
}

const STATE_COLORS: Record<string, keyof typeof BADGES> = {
  active: 'green',
  approved: 'green',
  open: 'amber',
  pending: 'amber',
  awaiting_proof: 'amber',
  pending_payment: 'amber',
  trial: 'purple',
  draft: 'blue',
  soft_locked: 'red',
  suspended: 'red',
  rejected: 'red',
  actioned: 'red',
  dormant: 'grey',
  closed: 'grey',
  dismissed: 'grey',
  cancelled: 'grey',
  purged: 'grey',
};

export function StateBadge({ state }: { state: string }) {
  return <Badge color={STATE_COLORS[state] ?? 'grey'}>{state.replace(/_/g, ' ')}</Badge>;
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mb-4 inline-flex rounded-lg border border-line bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-md px-3 text-sm font-semibold ${value === o.value ? 'bg-primary-400 text-white' : 'text-ink-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line bg-primary-50 text-xs tracking-wide text-ink-muted uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty ? <p className="px-4 py-10 text-center text-ink-muted">Nothing here.</p> : null}
    </div>
  );
}

export function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-ink-muted">Loading…</p>;
}

type Prompt = { title: string; body?: string; confirm: string; tone: Tone; resolve: (reason: string | null) => void };

/**
 * Every admin action records a reason (PRD A-05, A-08). `ask()` opens a modal and resolves
 * to the reason, or null when the admin cancels.
 */
export function useReasonPrompt() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const ask = (title: string, options: { body?: string; confirm?: string; tone?: Tone } = {}) =>
    new Promise<string | null>((resolve) =>
      setPrompt({ title, body: options.body, confirm: options.confirm ?? 'Confirm', tone: options.tone ?? 'primary', resolve }),
    );
  const element = prompt ? (
    <ReasonDialog
      prompt={prompt}
      onDone={(reason) => {
        prompt.resolve(reason);
        setPrompt(null);
      }}
    />
  ) : null;
  return { ask, element };
}

function ReasonDialog({ prompt, onDone }: { prompt: Prompt; onDone: (reason: string | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [reason, setReason] = useState('');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const valid = reason.trim().length >= 3;
  return (
    <dialog ref={ref} onClose={() => onDone(null)} aria-labelledby={`${id}-t`} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 backdrop:bg-primary-900/50">
      <form
        method="dialog"
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onDone(reason.trim());
        }}
      >
        <h2 id={`${id}-t`} className="text-lg font-bold text-primary-900">
          {prompt.title}
        </h2>
        {prompt.body ? <p className="text-sm text-ink-muted">{prompt.body}</p> : null}
        <label htmlFor={id} className="text-sm font-medium">
          Reason (saved in the audit log)
        </label>
        <textarea
          id={id}
          autoFocus
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 focus:border-primary-300 focus:ring-2 focus:ring-primary-200 focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <Button tone="ghost" onClick={() => onDone(null)}>
            Cancel
          </Button>
          <Button type="submit" tone={prompt.tone} disabled={!valid}>
            {prompt.confirm}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
