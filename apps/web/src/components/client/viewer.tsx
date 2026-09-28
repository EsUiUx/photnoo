'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { ClientFile } from '@/lib/client-api';
import { formatBytes } from '@/lib/format';

type Props = {
  files: ClientFile[];
  index: number;
  onIndex: (index: number) => void;
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

/**
 * C-06 full-screen viewer: swipe or arrow keys between photos, double-tap or pinch to zoom the
 * preview, drag to pan while zoomed, and a download button for the original.
 */
export function Viewer(props: Props) {
  const { files, index, onIndex, onClose } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const rtl = useLocale() === 'ar';

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      // Arrow keys follow the screen, not the reading direction.
      if (event.key === 'ArrowRight' && index < files.length - 1 && !rtl) onIndex(index + 1);
      if (event.key === 'ArrowRight' && index > 0 && rtl) onIndex(index - 1);
      if (event.key === 'ArrowLeft' && index > 0 && !rtl) onIndex(index - 1);
      if (event.key === 'ArrowLeft' && index < files.length - 1 && rtl) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [files.length, index, onClose, onIndex, rtl]);

  const file = files[index];
  if (!file) return null;
  // Remount the stage per photo so zoom resets without an effect.
  return <ViewerFrame key={file.id} {...props} file={file} closeRef={closeRef} rtl={rtl} />;
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

  function toggleZoom(clientX: number, clientY: number, target: HTMLElement) {
    if (zoom.scale > 1) {
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
    <div role="dialog" aria-modal="true" aria-label={t('label', { name: file.name })} className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <button ref={closeRef} type="button" onClick={onClose} className="flex h-11 items-center rounded-full bg-white/10 px-4 font-semibold hover:bg-white/20">
          {t('close')}
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm text-white/80" dir="ltr">
          {file.name}
        </p>
        <span className="text-sm text-white/70" aria-live="polite">
          {t('position', { current: index + 1, total: files.length })}
        </span>
      </div>

      <div
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden select-none"
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
              transform: zoom.scale > 1 ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` : `translateX(${dragX}px)`,
              transition: touching ? 'none' : 'transform 200ms ease-out',
              ...(file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})`, backgroundSize: 'cover' } : {}),
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma placeholder */}
            <img src="/app/media-placeholder.svg" alt="" className="size-24 opacity-90" />
            <p className="text-white/80">{t('noPreview')}</p>
          </div>
        )}

        <NavButton side="start" hidden={!hasPrev} label={t('previous')} onClick={() => onIndex(index - 1)} />
        <NavButton side="end" hidden={!hasNext} label={t('next')} onClick={() => onIndex(index + 1)} />
      </div>

      <div className="flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => onDownload(file)}
          disabled={isBusy || disabled}
          className="flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-full bg-white px-8 text-lg font-semibold text-primary-900 hover:bg-primary-50 disabled:opacity-50"
        >
          {isBusy ? <span className="size-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-900" /> : null}
          {downloaded.has(file.id) ? t('downloadAgain') : t('download')}
        </button>
        {message ? (
          <p role="alert" className="max-w-[420px] text-center text-sm text-[#ffd98a]">
            {message}
          </p>
        ) : null}
        <p className="text-xs text-white/60" dir="ltr">
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
    </div>
  );
}

function NavButton({ side, hidden, label, onClick }: { side: 'start' | 'end'; hidden: boolean; label: string; onClick: () => void }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      aria-label={label}
      className={`absolute top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl hover:bg-white/25 sm:flex ${
        side === 'start' ? 'start-4' : 'end-4'
      }`}
    >
      <span aria-hidden="true" className={side === 'start' ? 'rtl:rotate-180' : 'ltr:rotate-180'}>
        ‹
      </span>
    </button>
  );
}
