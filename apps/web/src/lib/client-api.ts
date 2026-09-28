import { api } from './api';

/** Shapes returned by the public, link-scoped client API (apps/api/src/client). */

/** PRD P-15 branding: the photographer's logo or photo and the gallery theme. */
export type ClientBranding = { logoUrl?: string | null; avatarUrl?: string | null; theme?: 'light' | 'dark' };

export type ClientSummary = {
  state: 'open' | 'closed' | 'unavailable';
  name: string;
  photographer: { name: string; whatsapp: string | null } & ClientBranding;
  expiresAt: string | null;
};

export type ClientFile = {
  id: string;
  folderId: string | null;
  name: string;
  sizeBytes: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  previewUrl: string | null;
};

export type ClientContent = {
  name: string;
  photographer: { name: string; whatsapp: string | null } & ClientBranding;
  expiresAt: string | null;
  coverFileId: string | null;
  allowance: { capBytes: string; servedBytes: string; remainingBytes: string };
  folders: Array<{ id: string; name: string }>;
  files: ClientFile[];
};

export type DownloadGrant = { url: string; receiptId: string; charged: boolean; remainingBytes: string };

// The client has no account: never try the photographer's refresh flow on a 401.
const base = (token: string) => `/v1/g/${encodeURIComponent(token)}`;

export const clientApi = {
  summary: (token: string) => api<ClientSummary>(base(token), { retry: false }),
  content: (token: string) => api<ClientContent>(`${base(token)}/content`, { retry: false }),
  unlock: (token: string, password: string) =>
    api<{ status: 'unlocked'; expiresAt: string }>(`${base(token)}/session`, { body: { password }, retry: false }),
  download: (token: string, fileId: string) =>
    api<DownloadGrant>(`${base(token)}/files/${fileId}/download`, { method: 'POST', retry: false }),
  report: (token: string, reason: string, email?: string) =>
    api(`${base(token)}/report`, { body: { reason, ...(email ? { email } : {}) }, retry: false }),
};

/** wa.me wants digits only. */
export function whatsappLink(phone: string | null, text?: string): string | null {
  const digits = phone?.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function daysLeft(expiresAt: string | null, now = Date.now()): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000));
}

export function isImage(file: ClientFile): boolean {
  return Boolean(file.previewUrl);
}
