'use client';

import { FileImage, FileWarning, Images, Star, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Alert, EmptyState, Spinner } from '@/components/ui/state';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { useDeleteFile } from '@/lib/queries';
import type { GalleryFile } from '@/lib/types';

// Hover-revealed chrome stays visible on touch screens and whenever a tile holds focus.
const REVEAL = 'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100';

/** Photo-first grid: 4:3 tiles, lazy previews over their blur placeholder, quiet controls. */
export function MediaGrid({
  files,
  galleryId,
  canDelete,
  coverFileId,
  empty,
}: {
  files: GalleryFile[];
  galleryId: string;
  canDelete: boolean;
  coverFileId: string | null;
  empty: { title: string; body?: string };
}) {
  const t = useTranslations('App.gallery');
  const remove = useDeleteFile(galleryId);
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  async function onDelete(file: GalleryFile) {
    const ok = await confirm({
      title: t('deleteFileTitle'),
      body: t('deleteFileBody', { name: file.name }),
      confirmLabel: t('deleteFileConfirm'),
    });
    if (!ok) return;
    setError(null);
    try {
      await remove.mutateAsync(file.id);
    } catch {
      setError(t('deleteFileFailed', { name: file.name }));
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {files.map((file) => (
          <li key={file.id}>
            <Tile
              file={file}
              cover={file.id === coverFileId}
              onDelete={canDelete && file.status !== 'uploading' ? () => void onDelete(file) : undefined}
            />
          </li>
        ))}
      </ul>
      {dialog}
    </>
  );
}

function Tile({ file, cover, onDelete }: { file: GalleryFile; cover: boolean; onDelete?: () => void }) {
  const t = useTranslations('App.gallery');
  const locale = useLocale();
  const size = formatBytes(file.sizeBytes, locale);
  const rejected = file.status === 'rejected';
  const pending = file.status === 'processing' || file.status === 'uploading';

  return (
    <figure className="group relative aspect-4/3 overflow-hidden rounded-md bg-surface-sunken">
      {rejected ? (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-danger-soft p-3 text-center">
          <FileWarning size={20} strokeWidth={1.75} aria-hidden className="text-danger" />
          <p className="text-xs font-semibold text-danger">{t('rejected')}</p>
          <p className="line-clamp-2 text-xs text-fg-secondary">{file.rejectReason ?? t('rejectedUnknown')}</p>
        </div>
      ) : file.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, already resized by the API
        <img
          src={file.previewUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full bg-cover bg-center object-cover"
          style={file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})` } : undefined}
        />
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
        <span className="absolute start-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-surface/90 px-2 text-xs font-medium text-fg shadow-xs">
          <Star size={16} strokeWidth={1.75} aria-hidden className="fill-current text-brand" />
          {t('cover')}
        </span>
      ) : null}

      {/* Name and size: visible on hover or focus, always read by screen readers. */}
      {!rejected ? (
        <figcaption
          className={cn(
            'absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pt-8 pb-2 text-white',
            REVEAL,
          )}
        >
          <span className="block truncate text-xs font-medium">{file.name}</span>
          <span className="tabular block text-xs text-white/80">{size}</span>
        </figcaption>
      ) : (
        <figcaption className="sr-only">
          {file.name}, {size}
        </figcaption>
      )}

      {onDelete ? (
        <IconButton
          icon={Trash2}
          size="sm"
          variant="inverse"
          label={t('deleteFile', { name: file.name })}
          onClick={onDelete}
          className={cn('absolute end-2 top-2', REVEAL, 'focus-visible:opacity-100')}
        />
      ) : null}
    </figure>
  );
}
