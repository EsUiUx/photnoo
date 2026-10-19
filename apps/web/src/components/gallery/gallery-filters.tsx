'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { controlClasses } from '@/components/ui/field';
import { cn } from '@/lib/cn';

/** Waits until typing pauses, so search does not send a request per keystroke. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations('App.table');
  const id = useId();
  return (
    <div className={cn('relative w-full', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={controlClasses(false, 'h-10 ps-10 pe-10 pointer-coarse:h-11 [&::-webkit-search-cancel-button]:hidden')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('clearSearch')}
          className="absolute end-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-surface-subtle hover:text-fg pointer-coarse:size-10"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export type DateRange = { from: string; to: string };

/** Created-from / created-to, as two labelled native date inputs (YYYY-MM-DD). */
export function DateRangeFilter({ value, onChange, className }: { value: DateRange; onChange: (value: DateRange) => void; className?: string }) {
  const t = useTranslations('App.table');
  const fromId = useId();
  const toId = useId();
  const input = controlClasses(false, 'h-10 w-full min-w-0 px-2.5 pointer-coarse:h-11 sm:w-40');
  return (
    // One row from sm up: the search box beside it shrinks instead of pushing "to" under "from".
    <fieldset className={cn('flex min-w-0 flex-wrap items-end gap-2 sm:shrink-0 sm:flex-nowrap', className)}>
      <legend className="sr-only">{t('createdRange')}</legend>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
        <label htmlFor={fromId} className="text-xs font-medium text-fg-muted">
          {t('createdFrom')}
        </label>
        <input
          id={fromId}
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className={input}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
        <label htmlFor={toId} className="text-xs font-medium text-fg-muted">
          {t('createdTo')}
        </label>
        <input
          id={toId}
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className={input}
        />
      </div>
      {value.from || value.to ? (
        <button
          type="button"
          onClick={() => onChange({ from: '', to: '' })}
          className="h-10 rounded-md px-3 text-sm font-medium whitespace-nowrap text-brand hover:bg-brand-soft pointer-coarse:h-11"
        >
          {t('clearDates')}
        </button>
      ) : null}
    </fieldset>
  );
}
