'use client';

import { Ellipsis, FileImage, FileWarning, FolderInput, Images, Star, Trash2, X } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { DevelopImg } from '@/components/motion/develop';
import { Button, IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { Alert, EmptyState, Spinner } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { useDeleteFile } from '@/lib/queries';
import { useSetCover } from '@/lib/queries-galleries';
import type { GalleryDetail, GalleryFile } from '@/lib/types';
import { MoveFilesDialog } from './gallery-dialogs';

// Hover-revealed chrome stays visible on touch screens and whenever a tile holds focus.
const REVEAL = 'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100';

/**
 * Photo-first grid: 4:3 tiles, lazy previews over their blur placeholder, quiet controls.
 * Tiles can be selected to move several files at once; each tile's menu sets the cover,
 * moves the file or deletes it.
 */
export function MediaGrid({
  gallery,
  files,
  canEdit,
  empty,
}: {
  gallery: GalleryDetail;
  files: GalleryFile[];
  canEdit: boolean;
  empty: { title: string; body?: string };
}) {
  const t = useTranslations('App.gallery');
  const format = useFormatter();
  const remove = useDeleteFile(gallery.id);
  const setCover = useSetCover(gallery.id);
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<string[] | null>(null);
  // Deleted tiles leave by fading and shrinking; moved ones (out of this folder) only fade.
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  // Files that left the view (moved, deleted) drop out of the selection.
  const visibleSelection = files.filter((f) => selected.has(f.id)).map((f) => f.id);
  const selecting = visibleSelection.length > 0;
  const canMove = canEdit && (gallery.folders.length > 0 || files.some((f) => f.folderId));
  const movable = (file: GalleryFile) => file.status !== 'uploading';

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onDelete(file: GalleryFile) {
    const ok = await confirm({
      title: t('deleteFileTitle'),
      body: t('deleteFileBody', { name: file.name }),
      confirmLabel: t('deleteFileConfirm'),
    });
    if (!ok) return;
    setError(null);
    setDeleting((current) => new Set(current).add(file.id));
    try {
      await remove.mutateAsync(file.id);
    } catch {
      setDeleting((current) => {
        const next = new Set(current);
        next.delete(file.id);
        return next;
      });
      setError(t('deleteFileFailed', { name: file.name }));
    }
  }

  async function onCover(file: GalleryFile) {
    setError(null);
    try {
      await setCover.mutateAsync(file.id);
    } catch {
      setError(t('coverFailed'));
    }
  }

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState icon={Images} title={empty.title} body={empty.body} />
      </div>
    );
  }

  return (
    <>
      {error ? <Alert className="mb-1">{error}</Alert> : null}
      {selecting ? (
        <div
          role="region"
          aria-label={t('selectionBar')}
          className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 shadow-popover"
        >
          <p className="tabular me-auto text-sm font-medium text-fg" aria-live="polite">
            {t('selected', { count: visibleSelection.length })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(files.filter(movable).map((f) => f.id)))}>
            {t('selectAll', { count: format.number(files.filter(movable).length) })}
          </Button>
          {canMove ? (
            <Button size="sm" icon={FolderInput} onClick={() => setMoving(visibleSelection)}>
              {t('moveSelected')}
            </Button>
          ) : null}
          <IconButton icon={X} size="sm" label={t('clearSelection')} onClick={() => setSelected(new Set())} />
        </div>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <AnimatePresence initial={false}>
          {files.map((file) => {
            const items: MenuItem[] = [];
            if (canEdit && file.status === 'ready' && file.previewUrl && file.id !== gallery.coverFileId) {
              items.push({ label: t('setCover'), icon: Star, onSelect: () => void onCover(file) });
            }
            if (canMove && movable(file)) items.push({ label: t('moveFile'), icon: FolderInput, onSelect: () => setMoving([file.id]) });
            if (canEdit && file.status !== 'uploading') {
              if (items.length) items.push({ type: 'separator' });
              items.push({ label: t('deleteFileAction'), icon: Trash2, tone: 'danger', onSelect: () => void onDelete(file) });
            }
            return (
              <m.li
                key={file.id}
                exit={deleting.has(file.id) ? { opacity: 0, scale: 0.9 } : { opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <Tile
                  file={file}
                  cover={file.id === gallery.coverFileId}
                  selectable={canMove && movable(file)}
                  selected={selected.has(file.id)}
                  selecting={selecting}
                  onToggle={() => toggle(file.id)}
                  menu={items}
                />
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <MoveFilesDialog
        gallery={gallery}
        fileIds={moving}
        onClose={() => setMoving(null)}
        onMoved={() => {
          setMoving(null);
          setSelected(new Set());
        }}
      />
      {dialog}
    </>
  );
}

function Tile({
  file,
  cover,
  selectable,
  selected,
  selecting,
  onToggle,
  menu,
}: {
  file: GalleryFile;
  cover: boolean;
  selectable: boolean;
  selected: boolean;
  selecting: boolean;
  onToggle: () => void;
  menu: MenuItem[];
}) {
  const t = useTranslations('App.gallery');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const size = formatBytes(file.sizeBytes, locale);
  const rejected = file.status === 'rejected';
  const pending = file.status === 'processing' || file.status === 'uploading';
  // The blur placeholder sits behind the photo, which develops over it as it loads.
  const placeholder = !rejected && file.previewUrl && file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})` } : undefined;

  return (
    // The menu sits outside the clipped figure so its popover is not cut off.
    <div className="group relative">
    <figure
      className={cn(
        'relative aspect-4/3 overflow-hidden rounded-md bg-surface-sunken bg-cover bg-center',
        selected && 'ring-2 ring-brand ring-offset-2 ring-offset-canvas',
      )}
      style={placeholder}
    >
      {rejected ? (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-danger-soft p-3 text-center">
          <FileWarning size={20} strokeWidth={1.75} aria-hidden className="text-danger" />
          <p className="text-xs font-semibold text-danger">{t('rejected')}</p>
          <p className="line-clamp-2 text-xs text-fg-secondary">{file.rejectReason ?? t('rejectedUnknown')}</p>
        </div>
      ) : file.previewUrl ? (
        <DevelopImg src={file.previewUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <div
          className="flex size-full items-center justify-center bg-cover bg-center text-fg-muted"
          style={file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})` } : undefined}
        >
          {pending ? null : <FileImage size={22} strokeWidth={1.75} aria-hidden />}
        </div>
      )}

      {pending ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-2.5 text-xs font-medium text-fg-secondary shadow-xs">
            <Spinner size={16} />
            {file.status === 'processing' ? t('processing') : t('uploading')}
          </span>
        </div>
      ) : null}

      {cover ? (
        <span
          className={cn(
            'absolute top-2 inline-flex h-6 items-center gap-1 rounded-full bg-surface/90 px-2 text-xs font-medium text-fg shadow-xs',
            selectable ? 'start-11' : 'start-2',
          )}
        >
          <Star size={16} strokeWidth={1.75} aria-hidden className="fill-current text-brand" />
          {t('cover')}
        </span>
      ) : null}

      {/* Name and size: visible on hover or focus, always read by screen readers. */}
      {!rejected ? (
        <figcaption className={cn('absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pt-8 pb-2 text-white', REVEAL)}>
          <span className="block truncate text-xs font-medium">{file.name}</span>
          <span className="tabular block text-xs text-white/80">{size}</span>
        </figcaption>
      ) : (
        <figcaption className="sr-only">
          {file.name}, {size}
        </figcaption>
      )}
    </figure>

      {selectable ? (
        <label
          className={cn(
            'absolute start-1 top-1 flex size-10 cursor-pointer items-center justify-center rounded-md pointer-coarse:size-11',
            selecting || selected ? 'opacity-100' : REVEAL,
          )}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={t('selectFile', { name: file.name })}
            className="size-5 cursor-pointer rounded border-white accent-brand shadow-xs"
          />
        </label>
      ) : null}

      {menu.length > 0 ? (
        <Menu
          label={t('fileActions', { name: file.name })}
          items={menu}
          className={cn('absolute end-2 top-2', REVEAL, 'has-[[aria-expanded=true]]:opacity-100 focus-within:opacity-100')}
          trigger={(props) => <IconButton {...props} icon={Ellipsis} size="sm" variant="inverse" label={tc('more')} />}
        />
      ) : null}
    </div>
  );
}
