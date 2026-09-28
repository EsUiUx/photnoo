'use client';

import { Phone, Search, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDebounced } from '@/components/gallery/gallery-filters';
import { Button } from '@/components/ui/button';
import { controlClasses, TextField } from '@/components/ui/field';
import { Spinner } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { useClients } from '@/lib/queries-galleries';
import { ClientAvatar } from './client-avatar';

export type PickedClient = { id: string; name: string; phone: string; email: string | null };

/** Either a managed client, a new one typed in place, or nothing chosen yet. */
export type ClientChoice =
  | { mode: 'existing'; client: PickedClient }
  | { mode: 'new'; name: string; phone: string; email: string }
  | { mode: 'search' };

export type ClientPickerErrors = { clientId?: string; clientName?: string; clientPhone?: string; clientEmail?: string };

/**
 * Client field for gallery forms: search existing clients (combobox) or add a new one with
 * name, phone and optional email. New clients are matched by phone on the server, so typing a
 * known number attaches the existing client instead of creating a duplicate.
 */
export function ClientPicker({
  value,
  onChange,
  errors = {},
  ids,
}: {
  value: ClientChoice;
  onChange: (value: ClientChoice) => void;
  errors?: ClientPickerErrors;
  /** Element ids for error focus: `ids.search`, `ids.name`, `ids.phone`, `ids.email`. */
  ids?: { search?: string; name?: string; phone?: string; email?: string };
}) {
  const t = useTranslations('App.clients.picker');

  if (value.mode === 'existing') {
    const { client } = value;
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-fg">{t('label')}</p>
        <div className="flex items-center gap-3 rounded-md border border-border-strong bg-surface px-3 py-2.5 shadow-xs">
          <ClientAvatar name={client.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{client.name}</p>
            <p className="truncate text-xs text-fg-muted" dir="ltr">
              {client.phone}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onChange({ mode: 'search' })}>
            {t('change')}
          </Button>
        </div>
      </div>
    );
  }

  if (value.mode === 'new') {
    const set = (key: 'name' | 'phone' | 'email') => (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: event.target.value });
    return (
      <fieldset className="flex flex-col gap-4 rounded-lg border border-border bg-surface-subtle p-4">
        <legend className="-ms-1 px-1 text-sm font-medium text-fg">{t('newClient')}</legend>
        <TextField id={ids?.name} label={t('name')} placeholder={t('namePlaceholder')} value={value.name} onChange={set('name')} error={errors.clientName} autoComplete="off" maxLength={100} />
        <TextField
          id={ids?.phone}
          label={t('phone')}
          placeholder={t('phonePlaceholder')}
          hint={t('phoneHint')}
          value={value.phone}
          onChange={set('phone')}
          error={errors.clientPhone}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          ltr
        />
        <TextField
          id={ids?.email}
          label={t('email')}
          placeholder={t('emailPlaceholder')}
          value={value.email}
          onChange={set('email')}
          error={errors.clientEmail}
          type="email"
          inputMode="email"
          autoComplete="off"
          optional
          ltr
        />
        <button type="button" onClick={() => onChange({ mode: 'search' })} className="self-start rounded-md text-sm font-medium text-brand hover:text-brand-hover">
          {t('pickExisting')}
        </button>
      </fieldset>
    );
  }

  return <ClientSearch onChange={onChange} error={errors.clientId ?? errors.clientName ?? errors.clientPhone} inputId={ids?.search} />;
}

function looksLikePhone(text: string) {
  return /^[+\d][\d\s-]{5,}$/.test(text.trim());
}

function ClientSearch({ onChange, error, inputId }: { onChange: (value: ClientChoice) => void; error?: string; inputId?: string }) {
  const t = useTranslations('App.clients.picker');
  const auto = useId();
  const id = inputId ?? auto;
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const q = useDebounced(query.trim(), 250);
  const clients = useClients(q);
  const results = useMemo(() => (clients.data?.pages[0]?.items ?? []).slice(0, 6), [clients.data]);
  // The last option always adds a new client, prefilled from what was typed.
  const count = results.length + 1;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function choose(index: number) {
    const client = results[index];
    if (client) {
      onChange({ mode: 'existing', client: { id: client.id, name: client.name, phone: client.phone, email: client.email } });
      return;
    }
    const typed = query.trim();
    onChange({ mode: 'new', name: looksLikePhone(typed) ? '' : typed, phone: looksLikePhone(typed) ? typed : '', email: '' });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      setOpen(true);
      setActive((i) => (open ? (i + 1) % count : 0));
    } else if (event.key === 'ArrowUp') {
      setOpen(true);
      setActive((i) => (i - 1 + count) % count);
    } else if (event.key === 'Enter' && open) {
      choose(active);
    } else if (event.key === 'Escape' && open) {
      setOpen(false);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <div ref={wrapper} className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {t('label')}
      </label>
      <div className="relative">
        <Search size={18} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? optionId(active) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('searchPlaceholder')}
          autoComplete="off"
          className={controlClasses(Boolean(error), 'h-11 ps-10 pe-10')}
        />
        {clients.isFetching ? <Spinner size={16} className="absolute end-3 top-1/2 -translate-y-1/2 text-fg-muted" /> : null}
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={t('results')}
            className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-popover"
          >
            {results.map((client, i) => (
              <li
                key={client.id}
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(i)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5', active === i && 'bg-surface-subtle')}
              >
                <ClientAvatar name={client.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{client.name}</span>
                  <span className="flex items-center gap-1 text-xs text-fg-muted">
                    <Phone size={16} strokeWidth={1.75} aria-hidden />
                    <span dir="ltr">{client.phone}</span>
                  </span>
                </span>
              </li>
            ))}
            {results.length === 0 && q && !clients.isFetching ? (
              <li role="presentation" className="px-2.5 py-2 text-sm text-fg-muted">
                {t('noMatch', { query: q })}
              </li>
            ) : null}
            <li
              id={optionId(results.length)}
              role="option"
              aria-selected={active === results.length}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(results.length)}
              onMouseEnter={() => setActive(results.length)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 text-sm font-medium text-brand',
                active === results.length && 'bg-brand-soft',
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft">
                <UserPlus size={16} strokeWidth={1.75} aria-hidden />
              </span>
              {query.trim() ? t('addNamed', { name: query.trim() }) : t('addNew')}
            </li>
          </ul>
        ) : null}
        {query && !open ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clear')}
            className="absolute end-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-surface-subtle"
          >
            <X size={16} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {t('hint')}
        </p>
      )}
    </div>
  );
}

/** The client part of a gallery create/update body. Phones are normalised to E.164 (Egypt by default). */
export function clientPayload(choice: ClientChoice, normalise: (phone: string) => string) {
  if (choice.mode === 'existing') return { clientId: choice.client.id };
  if (choice.mode === 'new') {
    const email = choice.email.trim();
    return { clientName: choice.name, clientPhone: normalise(choice.phone), clientEmail: email || undefined };
  }
  return {};
}
