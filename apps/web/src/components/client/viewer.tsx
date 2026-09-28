'use client';

import { ChevronLeft, ChevronRight, Download, FileImage, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ClientFile } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';

type Props = {
  files: ClientFile[];
  index: number;
  onIndex: (index: number) => void;
  /** The gallery returns focus to the tile of the photo that was last shown. */
  onClose: () => void;
  onDownload: (file: ClientFile) => void;
  busy: string | null;
  downloaded: Set<string>;
  disabled: boolean;
  /** Cap or failure message, repeated here because the viewer covers the page notice. */
  message?: string;
};

type Zoom = { scale: number; x: number; y: number };
const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };
const MAX_SCALE = 4;
const KEY_STEP = 1.5;

/**
 * C-06 full-screen viewer on the native modal <dialog>: the page behind is inert and Tab cannot
 * leave it. Swipe, arrow keys or the edge buttons move between photos; double-tap, pinch or the
 * + − 0 keys zoom the preview; drag pans while zoomed; the bottom bar downloads the original.
 */
export function Viewer(props: Props) {
  const { files, index, onClose } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rtl = useLocale() === 'ar';
  const t = useTranslations('Client.viewer');

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      if (dialog?.open) dialog.close();
    };
  }, []);

  const file = files[index];
  if (!file) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-label={t('label', { name: file.name })}
      data-surface="dark"
      onCancel={(event) => {
        // Escape goes through React state so the gallery can restore focus to the tile.
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-black p-0 text-white backdrop:bg-black open:flex open:flex-col"
    >
      {/* Remount the stage per photo so zoom resets without an effect. */}
      <ViewerFrame key={file.id} {...props} file={file} closeRef={closeRef} rtl={rtl} />
    </dialog>
  );
}

function ViewerFrame({
  files,
  index,
  onIndex,
  onClose,
  onDownload,
  busy,
  downloaded,
  disabled,
  message,
  file,
  closeRef,
  rtl,
}: Props & { file: ClientFile; closeRef: React.RefObject<HTMLButtonElement | null>; rtl: boolean }) {
  const t = useTranslations('Client.viewer');
  const locale = useLocale();
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const [dragX, setDragX] = useState(0);
  const [touching, setTouching] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; pinch?: number; base: Zoom }>({ startX: 0, startY: 0, base: NO_ZOOM });
  const lastTap = useRef(0);

  const hasPrev = index > 0;
  const hasNext = index < files.length - 1;
  const prev = files[index - 1];
  const next = files[index + 1];
  const zoomable = Boolean(file.previewUrl);
  const zoomed = zoom.scale > 1;

  function zoomBy(factor: number) {
    if (!zoomable) return;
    setZoom((current) => {
      const scale = Math.min(MAX_SCALE, Math.max(1, current.scale * factor));
      if (scale === 1) return NO_ZOOM;
      // Scale the pan with the zoom so the same point stays centred.
      const ratio = scale / current.scale;
      return { scale, x: current.x * ratio, y: current.y * ratio };
    });
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      // Arrow keys follow the screen, not the reading direction.
      const back = rtl ? 'ArrowRight' : 'ArrowLeft';
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      if (event.key === forward && hasNext) onIndex(index + 1);
      else if (event.key === back && hasPrev) onIndex(index - 1);
      else if (event.key === '+' || event.key === '=') zoomBy(KEY_STEP);
      else if (event.key === '-' || event.key === '_') zoomBy(1 / KEY_STEP);
      else if (event.key === '0') setZoom(NO_ZOOM);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function toggleZoom(clientX: number, clientY: number, target: HTMLElement) {
    if (zoomed) {
      setZoom(NO_ZOOM);
      return;
    }
    const box = target.getBoundingClientRect();
    const scale = 2.5;
    // Keep the tapped point under the finger.
    const x = (box.left + box.width / 2 - clientX) * (scale - 1);
    const y = (box.top + box.height / 2 - clientY) * (scale - 1);
    setZoom({ scale, x, y });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setTouching(true);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    g.startX = event.clientX;
    g.startY = event.clientY;
    g.base = zoom;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2 && g.pinch) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const scale = Math.min(MAX_SCALE, Math.max(1, g.base.scale * (distance / g.pinch)));
      setZoom(scale === 1 ? NO_ZOOM : { ...g.base, scale });
      return;
    }
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (zoom.scale > 1) setZoom({ ...g.base, x: g.base.x + dx, y: g.base.y + dy });
    else setDragX(dx);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const wasPinch = pointers.current.size > 1;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setTouching(false);
    if (wasPinch) {
      gesture.current.pinch = undefined;
      return;
    }
    const g = gesture.current;
    const dx = event.clientX - g.startX;
    const moved = Math.abs(dx) > 10 || Math.abs(event.clientY - g.startY) > 10;
    setDragX(0);
    if (zoom.scale === 1 && Math.abs(dx) > 60) {
      // Swiping towards the reading start goes forward.
      const forward = rtl ? dx > 0 : dx < 0;
      if (forward && hasNext) onIndex(index + 1);
      if (!forward && hasPrev) onIndex(index - 1);
      return;
    }
    if (moved) return;
    const now = event.timeStamp;
    if (now - lastTap.current < 300 && file.previewUrl) {
      lastTap.current = 0;
      toggleZoom(event.clientX, event.clientY, event.currentTarget);
    } else {
      lastTap.current = now;
    }
  }

  const isBusy = busy === file.id;

  return (
    <>
      <div className="relative z-10 flex items-center gap-2 bg-linear-to-b from-black/70 to-transparent px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-4">
        <ControlButton ref={closeRef} label={t('close')} onClick={onClose}>
          <X size={20} strokeWidth={1.75} aria-hidden />
        </ControlButton>
        <p className="min-w-0 flex-1 truncate text-center text-sm text-white/80" dir="ltr">
          {file.name}
        </p>
        {zoomable ? (
          <ControlButton label={zoomed ? t('zoomOut') : t('zoomIn')} onClick={() => (zoomed ? setZoom(NO_ZOOM) : zoomBy(2.5))}>
            {zoomed ? <ZoomOut size={20} strokeWidth={1.75} aria-hidden /> : <ZoomIn size={20} strokeWidth={1.75} aria-hidden />}
          </ControlButton>
        ) : (
          <span className="size-11" aria-hidden />
        )}
      </div>

      <div
        className="relative -mt-16 flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {file.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img
            src={file.previewUrl}
            alt={file.name}
            draggable={false}
            className="max-h-full max-w-full object-contain"
            style={{
              transform: zoomed ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` : `translateX(${dragX}px)`,
              transition: touching ? 'none' : 'transform 200ms var(--ease-out-expo)',
              ...(file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})`, backgroundSize: 'cover' } : {}),
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-white/10">
              <FileImage size={22} strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-base text-white/80">{t('noPreview')}</p>
          </div>
        )}

        {hasPrev ? (
          <NavButton side="start" label={t('previous')} onClick={() => onIndex(index - 1)} />
        ) : null}
        {hasNext ? <NavButton side="end" label={t('next')} onClick={() => onIndex(index + 1)} /> : null}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-3 bg-linear-to-t from-black/80 to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {message ? (
          <p role="alert" className="max-w-md rounded-md bg-warning-soft px-3 py-2 text-center text-sm text-warning">
            {message}
          </p>
        ) : null}
        <div className="flex w-full max-w-md items-center gap-3">
          <p className="tabular min-w-12 text-sm text-white/80" aria-live="polite" aria-atomic="true">
            {t('position', { current: index + 1, total: files.length })}
          </p>
          <Button
            variant="inverse"
            size="lg"
            icon={Download}
            pending={isBusy}
            disabled={disabled}
            onClick={() => onDownload(file)}
            className="flex-1"
            aria-describedby={`viewer-meta-${file.id}`}
          >
            {downloaded.has(file.id) ? t('downloadAgain') : t('download')}
          </Button>
          <span className="min-w-12" aria-hidden />
        </div>
        <p id={`viewer-meta-${file.id}`} className="tabular text-xs text-white/70" dir="ltr">
          {formatBytes(file.sizeBytes, locale)}
          {file.width && file.height ? ` · ${file.width}×${file.height}` : ''}
        </p>
      </div>

      {/* Warm the neighbours so swiping feels instant. */}
      <div className="hidden" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- preload */}
        {prev?.previewUrl ? <img src={prev.previewUrl} alt="" /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- preload */}
        {next?.previewUrl ? <img src={next.previewUrl} alt="" /> : null}
      </div>
    </>
  );
}

type ControlProps = { label: string; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'>;

function ControlButton({ label, children, className, ref, ...rest }: ControlProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-md bg-black/40 text-white backdrop-blur-sm transition-colors duration-150 hover:bg-black/60', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 44px edge buttons, visible on phones too; the swipe still works around them. */
function NavButton({ side, label, onClick }: { side: 'start' | 'end'; label: string; onClick: () => void }) {
  const Icon = side === 'start' ? ChevronLeft : ChevronRight;
  return (
    <ControlButton
      label={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className={cn('absolute top-1/2 -translate-y-1/2 sm:size-12', side === 'start' ? 'start-2 sm:start-4' : 'end-2 sm:end-4')}
    >
      <Icon size={22} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
    </ControlButton>
  );
}
