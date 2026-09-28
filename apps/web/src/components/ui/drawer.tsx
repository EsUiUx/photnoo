'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/cn';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
  /** When false, Escape and the backdrop do nothing (e.g. while a save runs). */
  dismissible?: boolean;
};

/**
 * Side sheet on the native <dialog>, anchored to the inline end (right in English, left in
 * Arabic). Same contract as Dialog: focus is trapped and restored by the browser, the page
 * behind is inert, and children mount only while open so forms start fresh.
 */
export function Drawer({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: DrawerProps) {
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
        'fixed inset-y-0 start-auto end-0 m-0 h-dvh max-h-dvh w-full max-w-full border-s border-border bg-surface p-0 text-fg shadow-overlay backdrop:bg-overlay backdrop:backdrop-blur-[2px]',
        size === 'lg' ? 'sm:max-w-xl' : 'sm:max-w-md',
      )}
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex items-start gap-4 border-b border-border px-6 pt-5 pb-4">
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
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-surface-subtle px-6 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
