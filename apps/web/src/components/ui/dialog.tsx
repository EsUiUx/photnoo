'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** When false, Escape and the backdrop do nothing (e.g. while a download or save runs). */
  dismissible?: boolean;
};

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

/**
 * Modal on the native <dialog>: focus is trapped and restored by the browser and the page
 * behind is inert. Escape goes through onCancel so React state never falls out of sync.
 * Children mount only while open, so forms start fresh each time.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: DialogProps) {
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
        'm-auto w-[calc(100%-2rem)] rounded-xl border border-border bg-surface p-0 text-fg shadow-overlay backdrop:bg-overlay backdrop:backdrop-blur-[2px]',
        'open:animate-[dialog-in_220ms_var(--ease-out-expo)] motion-reduce:open:animate-none',
        WIDTHS[size],
      )}
    >
      {open ? (
        <div className="flex max-h-[min(90dvh,860px)] flex-col">
          <div className="flex items-start gap-4 px-6 pt-6 pb-4">
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
                className="-me-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-subtle hover:text-fg"
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div> : null}
          {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-surface-subtle px-6 py-4 rounded-b-xl">{footer}</div> : null}
        </div>
      ) : null}
      <style>{`@keyframes dialog-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>
    </dialog>
  );
}

type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
};

/**
 * Replaces window.confirm: `const { confirm, dialog } = useConfirm()`, render {dialog}, then
 * `if (await confirm({...})) doIt()`. The destructive button names the action.
 */
export function useConfirm() {
  const t = useTranslations('Common');
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );
  const finish = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const dialog = (
    <Dialog
      open={Boolean(state)}
      onClose={() => finish(false)}
      title={state?.title ?? ''}
      description={state?.body}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => finish(false)}>
            {state?.cancelLabel ?? t('cancel')}
          </Button>
          <Button variant={state?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => finish(true)} autoFocus>
            {state?.confirmLabel}
          </Button>
        </>
      }
    />
  );
  return { confirm, dialog };
}
