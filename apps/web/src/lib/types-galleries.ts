// Response and filter shapes for galleries and clients (photographer API).

import type { GallerySort, GalleryStatusFilter } from '@photnoo/shared';
import type { GalleryState } from './types';

export type GalleryFilters = {
  q?: string;
  status?: GalleryStatusFilter;
  sort?: GallerySort;
  /** YYYY-MM-DD, Cairo days, inclusive. */
  from?: string;
  to?: string;
  take?: number;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
};

export type ClientListItem = Client & { galleryCount: number; lastDeliveryAt: string | null };

export type ClientGallery = {
  id: string;
  name: string;
  state: GalleryState;
  suspended: boolean;
  closedReason: string | null;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  fileCount: number;
};

export type ClientDetail = Client & { galleries: ClientGallery[]; orderCount: number };

export type OrderStatus = 'pending' | 'in_production' | 'ready' | 'delivered' | 'cancelled';

export type ClientOrder = {
  id: string;
  number: number;
  kind: 'store' | 'print';
  status: OrderStatus;
  itemCount: number;
  totalEgp: number;
  createdAt: string;
};

export type ClientOrdersPage = { items: ClientOrder[]; total: number; page: number; pageSize: number };
