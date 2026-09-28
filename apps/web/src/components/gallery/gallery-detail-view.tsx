'use client';

import { ArrowLeft, CalendarClock, Ellipsis, FolderPlus, ImageOff, Pencil, Phone, Share2, Trash2, X } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { galleryBadge, StatusBadge } from '@/components/app/status-badge';
import { useUploader } from '@/components/app/providers';
import { Button, ButtonLink, IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Menu } from '@/components/ui/menu';
import { Card, Meter } from '@/components/ui/primitives';
import { Alert, ErrorState, Skeleton } from '@/components/ui/state';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatBytes, formatDate, percent } from '@/lib/format';
import { useDeleteFolder, useGallery } from '@/lib/queries';
import type { GalleryDetail } from '@/lib/types';
import { ActivityPanel } from './activity-panel';
import { DeleteGalleryDialog, EditGalleryDialog, NewFolderDialog } from './gallery-dialogs';
import { MediaGrid } from './media-grid';
import { ShareDialog } from './share-dialog';
import { DropZone, UploadPanel } from './upload-panel';

type DialogName = 'share' | 'edit' | 'delete' | 'folder' | null;

const DAY = 86_400_000;

/** Gallery workspace: header, summary strip, folders, uploader, photo grid and activity. */
export function GalleryDetailView({ id }: { id: string }) {
  const t = useTranslations('App.gallery');
  const gallery = useGallery(id);
  const uploader = useUploader();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const data = gallery.data;

  const files = useMemo(
    () => (data?.files ?? []).filter((file) => (folderId ? file.folderId === folderId : true)),
    [data?.files, folderId],
  );

  if (gallery.error instanceof ApiError && gallery.error.status === 404) return <NotFound />;
  if (!data && gallery.error) {
    return (
      <div className="mx-auto max-w-7xl">
        <BackLink />
        <h1 className="sr-only">{t('metaTitle')}</h1>
        <Card className="mt-4">
          <ErrorState title={t('loadFailedTitle')} onRetry={() => void gallery.refetch()} />
        </Card>
      </div>
    );
  }
  if (!data) return <GallerySkeleton />;

  const open = data.state === 'draft' || data.state === 'active';
  // A folder deleted elsewhere falls back to "All photos".
  const folder = data.folders.find((f) => f.id === folderId);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0 || !open) return;
    uploader.add(id, [...list], folder?.id);
  }

  return (
    <div
      className="mx-auto flex max-w-7xl flex-col gap-6"
      onDragOver={(event) => {
        if (!open || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <Header gallery={data} open={open} onDialog={setDialog} />
      <Summary gallery={data} />

      <div className={cn('grid gap-6', data.state !== 'draft' && 'lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]')}>
        <div className="flex min-w-0 flex-col gap-5">
          <Folders
            gallery={data}
            selected={folder?.id ?? null}
            onSelect={setFolderId}
            canEdit={open}
            onNewFolder={() => setDialog('folder')}
          />

          {open ? (
            <DropZone dragging={dragging} compact={data.files.length > 0} folderName={folder?.name} onFiles={addFiles} />
          ) : (
            <Alert tone="info">{t('closedNote')}</Alert>
          )}

          <UploadPanel galleryId={id} />

          <section aria-labelledby="gallery-photos-heading" className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="gallery-photos-heading" className="text-lg font-semibold text-fg">
                {folder ? folder.name : t('photos')}
              </h2>
              <p className="tabular text-sm text-fg-muted">{t('fileCount', { count: files.length })}</p>
            </div>
            <MediaGrid
              files={files}
              galleryId={id}
              canDelete={open}
              coverFileId={data.coverFileId}
              empty={
                folder
                  ? { title: t('emptyFolder'), body: open ? t('emptyFolderBody') : undefined }
                  : { title: t('emptyTitle'), body: open ? t('emptyBody') : t('emptyClosed') }
              }
            />
          </section>
        </div>

        {data.state !== 'draft' ? (
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <ActivityPanel galleryId={id} />
          </aside>
        ) : null}
      </div>

      <ShareDialog gallery={data} open={dialog === 'share'} onClose={() => setDialog(null)} />
      <EditGalleryDialog gallery={data} open={dialog === 'edit'} onClose={() => setDialog(null)} />
      <DeleteGalleryDialog gallery={data} open={dialog === 'delete'} onClose={() => setDialog(null)} />
      <NewFolderDialog galleryId={id} open={dialog === 'folder'} onClose={() => setDialog(null)} />
    </div>
  );
}

function BackLink() {
  const t = useTranslations('App.gallery');
  return (
    <Link
      href="/galleries"
      className="-ms-3 inline-flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-fg-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-fg"
    >
      <ArrowLeft size={18} strokeWidth={1.75} aria-hidden className="rtl:-scale-x-100" />
      {t('back')}
    </Link>
  );
}

function Header({ gallery, open, onDialog }: { gallery: GalleryDetail; open: boolean; onDialog: (name: DialogName) => void }) {
  const t = useTranslations('App.gallery');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const [now] = useState(() => Date.now());

  let timing: string;
  if (gallery.state === 'draft') timing = t('notShared');
  else if (gallery.state === 'active' && gallery.expiresAt) {
    const days = Math.max(0, Math.ceil((new Date(gallery.expiresAt).getTime() - now) / DAY));
    timing = t('daysLeft', { count: days, date: formatDate(gallery.expiresAt, locale) });
  } else timing = t('closedOn', { date: formatDate(gallery.closedAt ?? gallery.expiresAt, locale) });

  return (
    <header className="flex flex-col gap-3">
      <BackLink />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden size-16 shrink-0 overflow-hidden rounded-md bg-surface-sunken sm:block">
            {gallery.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img src={gallery.coverUrl} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words text-fg">{gallery.name}</h1>
              <StatusBadge kind={galleryBadge(gallery)} />
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
              <span className="font-medium text-fg">{gallery.clientName ?? t('noClient')}</span>
              {gallery.clientPhone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
                  <span dir="ltr">{gallery.clientPhone}</span>
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={16} strokeWidth={1.75} aria-hidden className="text-fg-muted" />
                {timing}
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open ? (
            <Button icon={Share2} onClick={() => onDialog('share')}>
              {t('share')}
            </Button>
          ) : null}
          <Menu
            label={t('actions')}
            items={[
              { label: t('edit'), icon: Pencil, onSelect: () => onDialog('edit') },
              { type: 'separator' },
              { label: t('delete'), icon: Trash2, tone: 'danger', onSelect: () => onDialog('delete') },
            ]}
            trigger={(props) => <IconButton {...props} icon={Ellipsis} label={tc('more')} variant="secondary" />}
          />
        </div>
      </div>
    </header>
  );
}

function Summary({ gallery }: { gallery: GalleryDetail }) {
  const t = useTranslations('App.gallery');
  const locale = useLocale();
  const format = useFormatter();
  const served = Number(gallery.servedBytes);
  const cap = Number(gallery.capBytes);
  const used = percent(served, cap);

  const stats: Array<{ label: string; value: string }> = [
    { label: t('files'), value: format.number(gallery.fileCount) },
    { label: t('size'), value: formatBytes(gallery.totalBytes, locale) },
    { label: t('views'), value: format.number(gallery.views) },
    { label: t('downloads'), value: format.number(gallery.downloads) },
    { label: t('created'), value: formatDate(gallery.createdAt, locale) },
    { label: t('expires'), value: gallery.expiresAt ? formatDate(gallery.expiresAt, locale) : t('notShared') },
  ];

  return (
    <Card className="p-5">
      <h2 className="sr-only">{t('summary')}</h2>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:gap-8">
        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="text-xs font-medium text-fg-muted">{stat.label}</dt>
              <dd className="tabular mt-1 truncate text-base font-semibold text-fg">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-border pt-4 xl:w-72 xl:border-t-0 xl:border-s xl:ps-8 xl:pt-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-fg">{t('allowance')}</span>
            <span className="tabular text-fg-muted">{t('allowancePercent', { percent: format.number(used) })}</span>
          </div>
          <Meter
            className="mt-2"
            value={used}
            label={t('allowance')}
            tone={used >= 90 ? 'danger' : used >= 75 ? 'warning' : 'brand'}
          />
          <p className="tabular mt-2 text-xs text-fg-muted">
            {t('allowanceValue', { served: formatBytes(served, locale), cap: formatBytes(cap, locale) })}
          </p>
        </div>
      </div>
    </Card>
  );
}

function Folders({
  gallery,
  selected,
  onSelect,
  canEdit,
  onNewFolder,
}: {
  gallery: GalleryDetail;
  selected: string | null;
  onSelect: (id: string | null) => void;
  canEdit: boolean;
  onNewFolder: () => void;
}) {
  const t = useTranslations('App.gallery');
  const format = useFormatter();
  const remove = useDeleteFolder(gallery.id);
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);

  if (gallery.folders.length === 0 && !canEdit) return null;

  async function onDelete(folder: { id: string; name: string }, count: number) {
    const ok = await confirm({
      title: t('deleteFolderTitle', { name: folder.name }),
      body: t('deleteFolderBody', { count }),
      confirmLabel: t('deleteFolderConfirm'),
    });
    if (!ok) return;
    setError(null);
    try {
      await remove.mutateAsync(folder.id);
      if (selected === folder.id) onSelect(null);
    } catch {
      setError(t('deleteFolderFailed', { name: folder.name }));
    }
  }

  const chipBase = 'inline-flex h-10 items-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors duration-150 pointer-coarse:h-11';
  const chip = (active: boolean) =>
    cn(chipBase, 'px-3.5', active ? 'bg-brand-soft text-brand' : 'text-fg-secondary hover:bg-surface-subtle hover:text-fg');

  return (
    <nav aria-label={t('folders')} className="flex flex-col gap-3">
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className={chip(selected === null)}>
            {t('allFiles')}
            <span className="tabular text-xs text-fg-muted">{format.number(gallery.files.length)}</span>
          </button>
        </li>
        {gallery.folders.map((folder) => {
          const count = gallery.files.filter((file) => file.folderId === folder.id).length;
          const active = selected === folder.id;
          return (
            <li
              key={folder.id}
              className={cn('inline-flex items-center rounded-md transition-colors duration-150', active ? 'bg-brand-soft' : 'hover:bg-surface-subtle')}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(folder.id)}
                className={cn(chipBase, canEdit ? 'ps-3.5 pe-1' : 'px-3.5', active ? 'text-brand' : 'text-fg-secondary hover:text-fg')}
              >
                {folder.name}
                <span className="tabular text-xs text-fg-muted">{format.number(count)}</span>
              </button>
              {canEdit ? (
                <IconButton
                  icon={X}
                  size="sm"
                  variant="danger-ghost"
                  label={t('deleteFolder', { name: folder.name })}
                  onClick={() => void onDelete(folder, count)}
                  disabled={remove.isPending}
                />
              ) : null}
            </li>
          );
        })}
        {canEdit ? (
          <li>
            <Button variant="ghost" size="sm" icon={FolderPlus} onClick={onNewFolder}>
              {t('newFolder')}
            </Button>
          </li>
        ) : null}
      </ul>
      {error ? <Alert>{error}</Alert> : null}
      {dialog}
    </nav>
  );
}

function NotFound() {
  const t = useTranslations('App.gallery');
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-sunken text-fg-muted">
        <ImageOff size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-sm text-fg-muted">{t('notFoundBody')}</p>
      <ButtonLink href="/galleries" variant="secondary" icon={ArrowLeft} className="mt-6 [&>svg]:rtl:-scale-x-100">
        {t('back')}
      </ButtonLink>
    </div>
  );
}

function GallerySkeleton() {
  const tc = useTranslations('Common');
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6" aria-busy="true">
      <p role="status" className="sr-only">
        {tc('loading')}
      </p>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-28" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Skeleton className="hidden size-16 sm:block" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-11 w-36" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="aspect-4/3 w-full" />
        ))}
      </div>
    </div>
  );
}

