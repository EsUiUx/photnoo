// Response shapes of the photographer API. Byte counts are strings (BigInt on the server).

export type GalleryState = 'draft' | 'active' | 'closed' | 'purged' | 'anonymised';

export type Gallery = {
  id: string;
  name: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  state: GalleryState;
  suspended: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  totalBytes: string;
  capBytes: string;
  servedBytes: string;
  fileCount: number;
  coverFileId: string | null;
  createdAt: string;
};

export type GalleryListItem = Gallery & { views: number; downloads: number; coverUrl: string | null };

export type Folder = { id: string; name: string; position: number };

export type FileStatus = 'uploading' | 'processing' | 'ready' | 'rejected';

export type GalleryFile = {
  id: string;
  folderId: string | null;
  name: string;
  sizeBytes: string;
  mimeType: string | null;
  status: FileStatus;
  rejectReason: string | null;
  width: number | null;
  height: number | null;
  hasPreview: boolean;
  blurDataUrl: string | null;
  previewUrl: string | null;
  createdAt: string;
};

export type GalleryDetail = GalleryListItem & { folders: Folder[]; files: GalleryFile[] };

export type Me = {
  id: string;
  name: string;
  studioName: string | null;
  email: string;
  phone: string;
  locale: 'ar' | 'en';
  subscription: {
    state: string;
    cycleStart: string;
    cycleEnd: string;
    allowanceBytes: string;
    usedBytes: string;
  } | null;
};

export type ActivityItem = {
  type: 'viewed' | 'downloaded' | 'expiring';
  galleryId: string;
  galleryName: string;
  clientName?: string | null;
  at: string;
};

export type Dashboard = {
  clients: number;
  activeGalleries: number;
  downloads: number;
  storage: { usedBytes: string; allowanceBytes: string; state: string } | null;
  recentGalleries: GalleryListItem[];
  activity: ActivityItem[];
};

export type GalleryActivity = {
  accesses: Array<{ type: 'open' | 'password_ok' | 'password_fail'; country: string | null; deviceType: string | null; at: string }>;
  receipts: Array<{ receiptId: string; fileName: string; bytes: string; country: string | null; deviceType: string | null; at: string }>;
};
