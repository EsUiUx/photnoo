'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import { galleryBadge, StatusBadge } from '@/components/app/status-badge';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useDeleteFolder, useGallery } from '@/lib/queries';
import { useUploader } from '@/components/app/providers';
import { ActivityPanel } from './activity-panel';
import { DeleteGalleryDialog, EditGalleryDialog, NewFolderDialog } from './gallery-dialogs';
import { MediaGrid } from './media-grid';
import { ShareDialog } from './share-dialog';
import { UploadPanel } from './upload-panel';

type DialogName = 'share' | 'edit' | 'delete' | 'folder' | null;

/** Figma "Gallery Data" frames (0:3453 empty, 0:3510 with files, 0:3716 inside a folder). */
export function GalleryDetailView({ id }: { id: string }) {
  const t = useTranslations('App.gallery');
  const locale = useLocale();
  const gallery = useGallery(id);
  const uploader = useUploader();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const data = gallery.data;

  const files = useMemo(
    () => (data?.files ?? []).filter((file) => (folderId ? file.folderId === folderId : true)),
    [data?.files, folderId],
  );

  if (gallery.error instanceof ApiError && gallery.error.status === 404) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-2xl font-bold text-primary-300">{t('notFound')}</p>
        <Link href="/galleries" className="font-semibold text-primary-400 underline">
          {t('back')}
        </Link>
      </div>
    );
  }
  if (!data) return <div className="mx-auto h-[224px] max-w-[1509px] animate-pulse rounded-lg bg-neutral-100" aria-busy="true" />;

  const open = data.state === 'draft' || data.state === 'active';
  const folder = data.folders.find((f) => f.id === folderId);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0 || !open) return;
    uploader.add(id, [...list], folderId ?? undefined);
  }

  return (
    <div
      className="mx-auto flex max-w-[1509px] flex-col gap-8"
      onDragOver={(event) => {
        if (!open) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      {/* Gallery data card */}
      <section className="rounded-lg bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/galleries" aria-label={t('back')} className="flex size-6 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon, drawn pointing down */}
                <img src="/app/arrow-left.svg" alt="" className="h-3 w-[17px] rotate-90 -scale-x-100 rtl:-rotate-90" />
              </Link>
              <h1 className="text-2xl leading-[1.4] font-bold text-primary-900">{t('title')}</h1>
              <StatusBadge kind={galleryBadge(data)} />
            </div>
            <div className="mt-6 flex flex-col gap-6 md:flex-row">
              <div className="h-[122px] w-full shrink-0 overflow-hidden rounded-[20px] border-2 border-primary-300 bg-[#d9d9d9] md:w-[295px]">
                {data.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={data.coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-primary-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
                    <img src="/app/media-placeholder.svg" alt="" className="size-14" />
                  </div>
                )}
              </div>
              <dl className="grid flex-1 grid-cols-1 gap-x-10 gap-y-4 text-lg font-medium sm:grid-cols-2">
                <Info label={t('name')} value={data.name} />
                <Info label={t('downloads')} value={String(data.downloads)} />
                <Info label={t('client')} value={data.clientName ?? '—'} />
                <Info label={t('created')} value={formatDate(data.createdAt, locale)} />
                <Info label={t('views')} value={String(data.views)} />
                <Info label={t('expires')} value={data.expiresAt ? formatDate(data.expiresAt, locale) : t('notShared')} />
              </dl>
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-3 xl:flex-col">
            <ActionButton color="bg-[#5053ff] hover:bg-[#3e41e6]" onClick={() => setDialog('share')} disabled={!open && data.state !== 'closed'}>
              {t('share')}
              {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
              <img src="/app/link-white.svg" alt="" className="size-6" />
            </ActionButton>
            <ActionButton color="bg-primary-300 hover:bg-primary-400" onClick={() => setDialog('edit')}>
              {t('edit')}
            </ActionButton>
            <ActionButton color="bg-[#ff5353] hover:bg-[#e04444]" onClick={() => setDialog('delete')}>
              {t('delete')}
            </ActionButton>
          </div>
        </div>
      </section>

      {/* Title, breadcrumb and actions */}
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label={t('breadcrumb')} className="flex flex-1 items-center gap-3 text-xl font-semibold text-primary-900">
          {folder ? (
            <>
              <button type="button" onClick={() => setFolderId(null)} className="hover:underline">
                {data.name}
              </button>
              <span aria-hidden="true" className="rtl:rotate-180">›</span>
              <span className="rounded-lg bg-primary-50 px-3 py-1.5">{folder.name}</span>
            </>
          ) : (
            <span>{data.name}</span>
          )}
        </nav>
        {open ? (
          <>
            {!folder ? (
              <OutlineButton onClick={() => setDialog('folder')} icon="/app/folder.svg">
                {t('newFolder')}
              </OutlineButton>
            ) : null}
            <OutlineButton onClick={() => fileInput.current?.click()} icon="/app/upload-media.svg">
              {t('upload')}
            </OutlineButton>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept=".jpg,.jpeg,.png,.tif,.tiff,.psd,.zip,.cr2,.cr3,.nef,.arw,.raf,.dng,.orf,.rw2"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </>
        ) : (
          <p className="text-sm text-ink-muted">{t('closedNote')}</p>
        )}
      </div>

      <UploadPanel galleryId={id} />

      {/* Folders ("Files" in Figma) */}
      {!folder && data.folders.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-[#6c757d]">{t('folders')}</h2>
          <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {data.folders.map((f) => (
              <FolderRow key={f.id} name={f.name} count={data.files.filter((file) => file.folderId === f.id).length} onOpen={() => setFolderId(f.id)} folderId={f.id} galleryId={id} canDelete={open} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className={`relative rounded-xl transition-colors ${dragging ? 'bg-primary-50 outline-3 outline-dashed outline-primary-300' : ''}`}>
        <h2 className="text-lg font-semibold text-[#6c757d]">{t('media')}</h2>
        {files.length > 0 ? (
          <MediaGrid files={files} galleryId={id} canDelete={open} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma illustration */}
            <img src="/app/empty-state.png" alt="" width={260} height={283} className="h-auto w-[220px]" />
            <p className="text-[32px] leading-[1.4] font-bold text-primary-300">{t('emptyTitle')}</p>
            <p className="text-lg font-medium text-primary-300">{open ? t('emptyDrop') : t('emptyClosed')}</p>
          </div>
        )}
      </section>

      {data.state !== 'draft' ? <ActivityPanel galleryId={id} /> : null}

      <ShareDialog gallery={data} open={dialog === 'share'} onClose={() => setDialog(null)} />
      <EditGalleryDialog gallery={data} open={dialog === 'edit'} onClose={() => setDialog(null)} />
      <DeleteGalleryDialog gallery={data} open={dialog === 'delete'} onClose={() => setDialog(null)} />
      <NewFolderDialog galleryId={id} open={dialog === 'folder'} onClose={() => setDialog(null)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_12px_1fr] items-baseline">
      <dt className="text-neutral-500">{label}</dt>
      <span aria-hidden="true" className="text-neutral-500">
        :
      </span>
      <dd className="truncate text-[#202224]">{value}</dd>
    </div>
  );
}

function ActionButton({ children, color, onClick, disabled }: { children: React.ReactNode; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[52px] w-[208px] items-center justify-center gap-3 rounded-3xl text-lg font-semibold text-primary-50 transition-colors disabled:opacity-50 ${color}`}
    >
      {children}
    </button>
  );
}

function OutlineButton({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[42px] min-w-[182px] items-center justify-center gap-1 rounded-3xl border-2 border-primary-300 bg-primary-100 px-4 text-base font-semibold text-primary-500 hover:bg-primary-200"
    >
      {children}
      {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
      <img src={icon} alt="" className="size-6" />
    </button>
  );
}

type FolderRowProps = { name: string; count: number; onOpen: () => void; folderId: string; galleryId: string; canDelete: boolean };

function FolderRow({ name, count, onOpen, folderId, galleryId, canDelete }: FolderRowProps) {
  const t = useTranslations('App.gallery');
  const remove = useDeleteFolder(galleryId);
  return (
    <li className="flex h-[66px] items-center gap-4 rounded-lg bg-primary-50 px-4">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-start">
        <span className="flex h-[41px] w-[39px] shrink-0 items-center justify-center rounded-[7.5px] bg-primary-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
          <img src="/app/folder.svg" alt="" className="size-6" />
        </span>
        <span className="min-w-0 flex-1 truncate text-lg font-medium text-primary-400">{name}</span>
        <span className="text-sm text-ink-muted">{t('fileCount', { count })}</span>
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t('deleteFolderConfirm', { name }))) remove.mutate(folderId);
          }}
          aria-label={t('deleteFolder', { name })}
          className="flex size-8 items-center justify-center rounded-md hover:bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma icon */}
          <img src="/app/delete.svg" alt="" className="size-6" />
        </button>
      ) : null}
    </li>
  );
}
