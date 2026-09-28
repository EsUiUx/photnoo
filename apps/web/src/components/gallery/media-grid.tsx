'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatBytes } from '@/lib/format';
import { useDeleteFile } from '@/lib/queries';
import type { GalleryFile } from '@/lib/types';

/** Figma "Media" cards (235x197, light green). Photos show their preview; other files an icon. */
export function MediaGrid({ files, galleryId, canDelete }: { files: GalleryFile[]; galleryId: string; canDelete: boolean }) {
  const t = useTranslations('App.gallery');
  const locale = useLocale();
  const remove = useDeleteFile(galleryId);

  return (
    <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {files.map((file) => (
        <li key={file.id} className="relative flex h-[197px] flex-col items-center rounded-lg bg-primary-50 px-3 pt-6 pb-3">
          {canDelete && file.status !== 'uploading' ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t('deleteFileConfirm', { name: file.name }))) remove.mutate(file.id);
              }}
              aria-label={t('deleteFile', { name: file.name })}
              className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-md hover:bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
              <img src="/app/delete.svg" alt="" className="size-6" />
            </button>
          ) : null}
          <div className="flex h-[112px] w-full items-center justify-center">
            {file.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img
                src={file.previewUrl}
                alt=""
                loading="lazy"
                className="max-h-[112px] max-w-[140px] rounded-lg object-cover"
                style={file.blurDataUrl ? { backgroundImage: `url(${file.blurDataUrl})`, backgroundSize: 'cover' } : undefined}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- Figma placeholder
              <img src="/app/media-placeholder.svg" alt="" className="size-[98px]" />
            )}
          </div>
          <p className="mt-2 line-clamp-2 w-full text-center text-[15px] leading-[1.4] font-medium break-all text-primary-400" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-ink-muted" dir="ltr">
            {file.status === 'ready' ? formatBytes(file.sizeBytes, locale) : null}
          </p>
          {file.status === 'processing' ? (
            <span className="absolute start-2 top-2 rounded-md bg-white px-2 py-0.5 text-xs text-primary-400">{t('processing')}</span>
          ) : null}
          {file.status === 'uploading' ? (
            <span className="absolute start-2 top-2 rounded-md bg-white px-2 py-0.5 text-xs text-ink-muted">{t('uploading')}</span>
          ) : null}
          {file.status === 'rejected' ? (
            <span className="absolute inset-x-2 bottom-2 rounded-md bg-danger-bg px-2 py-1 text-center text-xs text-danger" title={file.rejectReason ?? undefined}>
              {t('rejected')}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
