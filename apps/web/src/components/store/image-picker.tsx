'use client';

import { Eye, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';

const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png'];

/**
 * Picture field for products and print options (Figma 0:6370 / 0:6455): a drop zone when empty,
 * and Delete / Replace / View on the picture. `value` is undefined for "unchanged", a File for a
 * new picture and null for "remove".
 */
export function ImagePicker({
  label,
  currentUrl,
  value,
  onChange,
  optional,
}: {
  label: string;
  currentUrl: string | null;
  value: File | null | undefined;
  onChange: (value: File | null | undefined) => void;
  optional?: boolean;
}) {
  const t = useTranslations('App.store.image');
  const tCommon = useTranslations('Common');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState(false);
  // One local preview per chosen file; the drawer is short-lived, so it is not revoked (a
  // cleanup revoke would break the preview under Strict Mode's double effects).
  const objectUrl = useMemo(() => (value instanceof File ? URL.createObjectURL(value) : null), [value]);

  const shown = value === null ? null : (objectUrl ?? (value === undefined ? currentUrl : null));

  function pick(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError(t('type'));
    if (file.size > MAX_BYTES) return setError(t('tooLarge'));
    setError(null);
    onChange(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p id={`${id}-label`} className="text-sm font-medium text-fg">
        {label}
        {optional ? <span className="ms-1.5 font-normal text-fg-muted">({tCommon('optional')})</span> : null}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {shown ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL or local preview */}
          <img src={shown} alt={t('previewAlt')} className="aspect-[4/3] w-full object-cover" />
          <div className="flex flex-wrap gap-2 border-t border-border bg-surface p-2">
            <Button variant="ghost" size="sm" icon={Eye} onClick={() => setViewing(true)}>
              {t('view')}
            </Button>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => inputRef.current?.click()}>
              {t('replace')}
            </Button>
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => onChange(currentUrl ? null : undefined)} className="ms-auto text-danger hover:bg-danger-soft hover:text-danger">
              {t('delete')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files[0]);
          }}
          className={cn(
            'flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 text-center transition-colors duration-150',
            dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-surface-subtle hover:border-brand hover:bg-brand-soft',
          )}
        >
          <ImagePlus size={22} strokeWidth={1.75} aria-hidden className="text-brand" />
          <span className="text-sm font-medium text-fg">{t('add')}</span>
          <span id={`${id}-hint`} className="text-xs text-fg-muted">
            {t('hint')}
          </span>
        </button>
      )}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Dialog open={viewing} onClose={() => setViewing(false)} title={t('viewTitle')} size="lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL or local preview */}
        {shown ? <img src={shown} alt={t('previewAlt')} className="max-h-[70dvh] w-full rounded-md object-contain" /> : null}
      </Dialog>
    </div>
  );
}
