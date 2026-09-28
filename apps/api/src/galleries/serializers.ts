import type { File, Folder, Gallery } from '@photnoo/db';

// API shapes. BigInt byte counts leave as strings so JSON stays exact above 2^53.

export function galleryJson(g: Gallery) {
  return {
    id: g.id,
    name: g.name,
    clientName: g.clientName,
    clientPhone: g.clientPhone,
    clientEmail: g.clientEmail,
    clientId: g.clientId,
    state: g.state,
    suspended: g.suspended,
    activatedAt: g.activatedAt,
    expiresAt: g.expiresAt,
    extendedAt: g.extendedAt,
    closedAt: g.closedAt,
    closedReason: g.closedReason,
    totalBytes: g.totalBytes.toString(),
    capBytes: g.capBytes.toString(),
    servedBytes: g.servedBytes.toString(),
    fileCount: g.fileCount,
    coverFileId: g.coverFileId,
    createdAt: g.createdAt,
  };
}

export function folderJson(f: Folder) {
  return { id: f.id, name: f.name, position: f.position };
}

export function fileJson(f: File) {
  return {
    id: f.id,
    folderId: f.folderId,
    name: f.originalName,
    sizeBytes: f.sizeBytes.toString(),
    mimeType: f.mimeType,
    status: f.status,
    rejectReason: f.rejectReason,
    width: f.width,
    height: f.height,
    hasPreview: Boolean(f.previewKey),
    blurDataUrl: f.blurDataUrl,
    createdAt: f.createdAt,
  };
}
