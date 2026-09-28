/** Shapes returned by the store, prints and orders API (apps/api/src/store, prints, orders). */

export type PrintType = 'album' | 'frame' | 'canvas' | 'magazine' | 'wooden' | 'other';
export const PRINT_TYPES: PrintType[] = ['album', 'frame', 'canvas', 'magazine', 'wooden', 'other'];

export type OrderStatus = 'pending' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
export type OrderKind = 'store' | 'print';

/** A number with its change against the previous 30 days; delta is null when there is nothing to compare. */
export type Trend = { value: number; delta: number | null };

export type CommerceSettings = {
  slug: string | null;
  storeEnabled: boolean;
  printsEnabled: boolean;
  shopPath: string | null;
  shopUrl: string | null;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  priceEgp: number;
  salePriceEgp: number | null;
  inStock: boolean;
  imageUrl: string | null;
  previewUrl: string | null;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type StoreStats = { products: Trend; orders: Trend; revenueEgp: Trend; pending: number };

export type PrintItem = {
  id: string;
  type: PrintType;
  name: string;
  size: string;
  priceEgp: number;
  available: boolean;
  imageUrl: string | null;
  previewUrl: string | null;
  createdAt: string;
};

export type PrintStats = { pending: number; inProduction: number; ready: number; delivered: number; orders: Trend; revenueEgp: Trend };

export type PrintSettings = { printsEnabled: boolean; availableItems: number; galleriesOptedOut: number };

export type OrderItem = {
  id: string;
  name: string;
  detail: string | null;
  unitPriceEgp: number;
  quantity: number;
  lineTotalEgp: number;
  productId: string | null;
  printItemId: string | null;
  printType: PrintType | null;
  fileId: string | null;
  fileName: string | null;
  blurDataUrl: string | null;
  thumbnailUrl: string | null;
};

export type Order = {
  id: string;
  number: number;
  kind: OrderKind;
  status: OrderStatus;
  allowedStatuses: OrderStatus[];
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  note: string | null;
  totalEgp: number;
  paidAt: string | null;
  clientId: string | null;
  gallery: { id: string; name: string } | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type OrdersPage = { items: Order[]; total: number; page: number; pageSize: number };

export type OrdersFilter = { kind: OrderKind; q?: string; from?: string; to?: string; page?: number };

// ---------- public ----------

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  priceEgp: number;
  salePriceEgp: number | null;
  inStock: boolean;
  imageUrl: string | null;
  previewUrl: string | null;
};

export type PublicShop = {
  photographer: {
    name: string;
    studioName: string | null;
    slug: string | null;
    city: string | null;
    bio: string | null;
    whatsapp: string | null;
    avatarUrl: string | null;
  };
  products: PublicProduct[];
};

export type PublicOrderReceipt = {
  number: number;
  totalEgp: number;
  status: OrderStatus;
  items: Array<{ name: string; quantity: number; unitPriceEgp: number }>;
  photographer: { name: string; whatsapp: string | null };
};

export type PrintOffer = {
  enabled: boolean;
  items: Array<{ id: string; type: PrintType; name: string; size: string; priceEgp: number; previewUrl: string | null }>;
  customer: { name: string | null; phone: string | null };
};

export type PrintOrderReceipt = { number: number; totalEgp: number; status: OrderStatus };
