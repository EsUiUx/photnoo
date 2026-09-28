'use client';

import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

export type MenuItem =
  | { type?: 'button'; label: string; icon?: LucideIcon; onSelect: () => void; tone?: 'danger'; disabled?: boolean }
  | { type: 'link'; label: string; icon?: LucideIcon; href: string; locale?: string }
  | { type: 'separator' };

/**
 * Menu button (WAI-ARIA menu pattern): Enter/Space/ArrowDown opens and focuses the first item,
 * arrows move, Home/End jump, Escape and Tab close and return focus to the trigger.
 */
export function Menu({
  trigger,
  label,
  items,
  align = 'end',
  className,
}: {
  trigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  label: string;
  items: MenuItem[];
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const focusables = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    if (!open) return;
    focusables()[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!listRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) buttonRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const list = focusables();
    const current = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') list[(current + 1) % list.length]?.focus();
    else if (event.key === 'ArrowUp') list[(current - 1 + list.length) % list.length]?.focus();
    else if (event.key === 'Home') list[0]?.focus();
    else if (event.key === 'End') list[list.length - 1]?.focus();
    else if (event.key === 'Escape') close();
    else if (event.key === 'Tab') return close(false);
    else return;
    event.preventDefault();
  }

  const itemClass = 'flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-start text-sm outline-none focus:bg-surface-subtle hover:bg-surface-subtle';

  return (
    <div className={cn('relative', className)}>
      {trigger({
        ref: buttonRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        'aria-label': label,
        onClick: () => setOpen((o) => !o),
        onKeyDown: (event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        },
      })}
      {open ? (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cn(
            'absolute top-full z-50 mt-2 min-w-52 rounded-lg border border-border bg-surface p-1.5 shadow-popover',
            'animate-[menu-in_160ms_var(--ease-out-expo)] motion-reduce:animate-none',
            align === 'end' ? 'end-0' : 'start-0',
          )}
        >
          {items.map((item, i) => {
            if (item.type === 'separator') return <div key={i} role="separator" className="my-1.5 h-px bg-border" />;
            const Icon = item.icon;
            const icon = Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-muted" /> : null;
            if (item.type === 'link') {
              return (
                <Link key={i} role="menuitem" tabIndex={-1} href={item.href} locale={item.locale} onClick={() => close(false)} className={cn(itemClass, 'text-fg')}>
                  {icon}
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (item.disabled) return;
                  close();
                  item.onSelect();
                }}
                className={cn(itemClass, item.tone === 'danger' ? 'text-danger' : 'text-fg', item.disabled && 'cursor-not-allowed opacity-50')}
              >
                {icon}
                {item.label}
              </button>
            );
          })}
          <style>{`@keyframes menu-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
        </div>
      ) : null}
    </div>
  );
}
