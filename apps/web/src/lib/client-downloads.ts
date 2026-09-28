import { ApiError } from './api';
import { type ClientFile, clientApi } from './client-api';

/**
 * Client downloads (PRD C-07, C-08). Every file is charged by the API first, which returns a
 * 5-minute signed URL with the original name as an attachment. Without a chosen folder the
 * browser saves it to Downloads; with one (desktop Chrome and Edge) the bytes are streamed
 * straight into that folder.
 */

type DirectoryHandle = {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<WritableStream<Uint8Array>>;
  }>;
};

type PickerWindow = Window & { showDirectoryPicker?: (options?: { mode?: 'readwrite' }) => Promise<DirectoryHandle> };

export function canPickFolder(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

/** Resolves to null when the client closes the picker without choosing. */
export async function pickFolder(): Promise<DirectoryHandle | null> {
  try {
    return (await (window as PickerWindow).showDirectoryPicker!({ mode: 'readwrite' })) ?? null;
  } catch {
    return null;
  }
}

function saveThroughBrowser(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
}

async function saveIntoFolder(url: string, name: string, folder: DirectoryHandle) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new ApiError(response.status, 'download_failed', 'download_failed');
  const handle = await folder.getFileHandle(name.replace(/[\\/:*?"<>|]/g, '_'), { create: true });
  await response.body.pipeTo(await handle.createWritable());
}

export async function downloadFile(token: string, file: ClientFile, folder?: DirectoryHandle | null) {
  const grant = await clientApi.download(token, file.id);
  if (folder) await saveIntoFolder(grant.url, file.name, folder);
  else saveThroughBrowser(grant.url);
  return grant;
}

export type BatchProgress = {
  total: number;
  done: number;
  current: string | null;
  bytesDone: number;
  bytesTotal: number;
  /** Set when the batch ended early. */
  stoppedBy?: 'cap_reached' | 'gallery_closed' | 'cancelled' | 'error';
  remainingBytes?: string;
};

/**
 * Downloads files one after another. Stops cleanly at the first cap or closed error, leaving
 * the files already saved intact. Browser saves are spaced out so they are not dropped.
 */
export async function downloadAll(
  token: string,
  files: ClientFile[],
  options: { folder?: DirectoryHandle | null; signal: AbortSignal; onProgress: (progress: BatchProgress) => void },
): Promise<BatchProgress> {
  const progress: BatchProgress = {
    total: files.length,
    done: 0,
    current: null,
    bytesDone: 0,
    bytesTotal: files.reduce((sum, f) => sum + Number(f.sizeBytes), 0),
  };
  const emit = () => options.onProgress({ ...progress });

  for (const file of files) {
    if (options.signal.aborted) {
      progress.stoppedBy = 'cancelled';
      break;
    }
    progress.current = file.name;
    emit();
    try {
      const grant = await downloadFile(token, file, options.folder);
      progress.remainingBytes = grant.remainingBytes;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'error';
      progress.stoppedBy = code === 'cap_reached' || code === 'gallery_closed' ? code : 'error';
      if (error instanceof ApiError && typeof error.details.remainingBytes === 'string') {
        progress.remainingBytes = error.details.remainingBytes;
      }
      break;
    }
    progress.done += 1;
    progress.bytesDone += Number(file.sizeBytes);
    emit();
    if (!options.folder) await new Promise((resolve) => setTimeout(resolve, 800));
  }
  progress.current = null;
  emit();
  return progress;
}
