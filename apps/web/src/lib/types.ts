// Response shapes of the photographer API. Byte counts are strings (BigInt on the server).

export type GalleryState = 'draft' | 'active' | 'closed' | 'purged' | 'anonymised';

export type Gallery = {
  id: string;
  name: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  /** The managed client; the client fields above are a snapshot of it. */
  clientId: string | null;
  state: GalleryState;
  suspended: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  /** Set once the link was extended (allowed once, PRD P-14). */
  extendedAt: string | null;
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
  /** Public handle, profile photo and unread notification count (account slice). */
  slug?: string | null;
  avatarUrl?: string | null;
  unreadNotifications?: number;
  subscription: Subscription | null;
};

// ---------- Billing ----------

export type SubscriptionState = 'trial' | 'pending_payment' | 'active' | 'soft_locked' | 'dormant' | 'suspended';
export type Cycle = 'annual' | 'monthly';

export type Plan = {
  id: string;
  tier: string;
  label: string;
  cycle: Cycle;
  priceEgp: number;
  annualAllowanceBytes: string;
  cycleAllowanceBytes: string;
};

export type Subscription = {
  id: string;
  state: SubscriptionState;
  plan: Plan | null;
  nextPlan: Plan | null;
  priceEgp: number | null;
  cycleStart: string;
  cycleEnd: string;
  daysLeft: number;
  renewalPaid: boolean;
  allowanceBytes: string;
  usedBytes: string;
  dormantAt: string | null;
};

export type OfferAction = 'subscribe' | 'renew' | 'upgrade' | 'switch' | 'scheduled' | 'current' | 'unavailable';
export type Offer = { action: OfferAction; amountEgp?: number; availableFrom?: string; reason?: string };
export type CatalogPlan = Plan & { offer: Offer };

export type PaymentMethod = 'instapay' | 'vodafone_cash' | 'bank_transfer';
export type PaymentStatus = 'awaiting_proof' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export type BillingPayment = {
  id: string;
  reference: string;
  kind: 'new' | 'renewal' | 'upgrade';
  status: PaymentStatus;
  plan: Plan;
  amountEgp: number;
  declaredAmountEgp: number | null;
  method: PaymentMethod | null;
  hasProof: boolean;
  proofName: string | null;
  rejectReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  invoice: { id: string; number: string } | null;
};

export type PaymentDetails = {
  instapay: { handle: string } | null;
  vodafone_cash: { number: string } | null;
  bank_transfer: { bank: string | null; accountName: string | null; accountNumber: string; iban: string | null } | null;
};

export type BillingOverview = {
  subscription: Subscription;
  plans: CatalogPlan[];
  openPayment: BillingPayment | null;
  payments: BillingPayment[];
  paymentDetails: PaymentDetails;
};

export type ActivityItem = {
  type: 'viewed' | 'downloaded' | 'expiring';
  galleryId: string;
  galleryName: string;
  clientName?: string | null;
  at: string;
};

/** A number over the last 30 days and the 30 days before; the page shows the change. */
export type Trend = { current: number; previous: number };

export type Dashboard = {
  clients: number;
  activeGalleries: number;
  /** Downloads since the current plan cycle started. */
  downloads: number;
  cycleStart: string | null;
  trends: { clients: Trend; activeGalleries: Trend; downloads: Trend; allowance: Trend };
  storage: { usedBytes: string; allowanceBytes: string; state: string } | null;
  recentGalleries: GalleryListItem[];
  activity: ActivityItem[];
};

export type GalleryActivity = {
  accesses: Array<{ type: 'open' | 'password_ok' | 'password_fail'; country: string | null; deviceType: string | null; at: string }>;
  receipts: Array<{ receiptId: string; fileName: string; bytes: string; country: string | null; deviceType: string | null; at: string }>;
};
