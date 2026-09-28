// Shapes returned by /v1/admin. Byte counts are strings (BigInt on the server).

export type AdminRole = 'super_admin' | 'operations' | 'support';
export type AdminMe = { id: string; name: string; email: string; role: AdminRole };

export const ROLE_LEVEL: Record<AdminRole, number> = { support: 1, operations: 2, super_admin: 3 };
export const can = (me: AdminMe | undefined, role: AdminRole) => Boolean(me && ROLE_LEVEL[me.role] >= ROLE_LEVEL[role]);

export type Plan = { id: string; tier: string; label: string; cycle: 'annual' | 'monthly'; priceEgp: number; annualAllowanceBytes: string; cycleAllowanceBytes: string };

export type Overview = {
  payingPhotographers: number;
  trials: number;
  lapsed: number;
  pendingPayments: number;
  awaitingProof: number;
  activeGalleries: number;
  uploadedTodayBytes: string;
  downloadedTodayBytes: string;
  revenueThisMonthEgp: number;
  openAbuseReports: number;
  pendingApplications: number;
  switchesOn: string[];
};

export type Application = {
  id: string;
  name: string;
  studioName: string | null;
  city: string;
  phone: string;
  email: string;
  portfolioUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  grantTrial: boolean;
  decisionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  hadTrial: boolean;
};

export type Payment = {
  id: string;
  reference: string;
  kind: 'new' | 'renewal' | 'upgrade';
  status: string;
  plan: Plan;
  amountEgp: number;
  declaredAmountEgp: number | null;
  method: string | null;
  hasProof: boolean;
  proofName: string | null;
  rejectReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  invoice: { id: string; number: string } | null;
  photographer?: { id: string; name: string; studioName: string | null; email: string; phone: string } | null;
};

export type Subscription = {
  state: string;
  plan: Plan | null;
  nextPlan: Plan | null;
  cycleStart: string;
  cycleEnd: string;
  daysLeft: number;
  renewalPaid: boolean;
  allowanceBytes: string;
  usedBytes: string;
};

export type PhotographerRow = {
  id: string;
  name: string;
  studioName: string | null;
  email: string;
  phone: string;
  city: string | null;
  status: string;
  createdAt: string;
  galleries: number;
  subscription: { state: string; plan: Plan | null; cycleEnd: string; usedBytes: string; allowanceBytes: string } | null;
};

export type PhotographerDetail = {
  id: string;
  name: string;
  studioName: string | null;
  email: string;
  phone: string;
  city: string | null;
  locale: string;
  status: string;
  createdAt: string;
  subscription: Subscription | null;
  galleries: Array<{
    id: string;
    name: string;
    clientName: string | null;
    state: string;
    suspended: boolean;
    suspendedUntil: string | null;
    suspendedReason: string | null;
    totalBytes: string;
    servedBytes: string;
    capBytes: string;
    fileCount: number;
    createdAt: string;
    expiresAt: string | null;
    receipts: number;
  }>;
  logins: Array<{ id: string; createdAt: string; lastUsedAt: string; ip: string | null; userAgent: string | null; active: boolean }>;
  payments: Payment[];
};

export type AbuseReport = {
  id: string;
  reason: string;
  reporterEmail: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  gallery: {
    id: string;
    name: string;
    state: string;
    suspended: boolean;
    fileCount: number;
    totalBytes: string;
    servedBytes: string;
    activatedAt: string | null;
    expiresAt: string | null;
    reports: number;
    photographer: { id: string; name: string; studioName: string | null; email: string; status: string };
  };
};

export type AdminPlan = Plan & { activeFrom: string; activeTo: string | null; onSale: boolean; activeSubscriptions: number };

export type Switch = { key: 'uploads_frozen' | 'downloads_frozen' | 'maintenance'; on: boolean; reason: string | null; setById: string | null; updatedAt: string | null };

export type AuditItem = {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  ip: string | null;
  data: unknown;
  createdAt: string;
};
