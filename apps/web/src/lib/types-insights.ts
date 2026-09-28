import type { AnalyticsRange } from '@photnoo/shared';

// ---------- Portfolio ----------

export type PortfolioItem = {
  id: string;
  /** Signed, 1 hour. */
  url: string;
  previewUrl: string;
  blurDataUrl: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  category: string | null;
  position: number;
  createdAt: string;
};

export type Portfolio = {
  published: boolean;
  slug: string | null;
  maxItems: number;
  items: PortfolioItem[];
};

// ---------- Public profile ----------

export type PublicPortfolioItem = Pick<PortfolioItem, 'id' | 'url' | 'previewUrl' | 'blurDataUrl' | 'width' | 'height' | 'caption' | 'category'>;

export type PublicProfile = {
  slug: string;
  name: string;
  studioName: string | null;
  city: string | null;
  bio: string | null;
  avatarUrl: string | null;
  logoUrl: string | null;
  links: { instagram: string | null; behance: string | null; website: string | null; other: string | null };
  whatsapp: string | null;
  storeEnabled: boolean;
  categories: string[];
  items: PublicPortfolioItem[];
  expiresInSeconds: number;
};

// ---------- Analytics ----------

export type { AnalyticsRange };

export type Metric = { value: number; previous: number; change: number | null };

export type AnalyticsOverview = {
  range: AnalyticsRange;
  from: string;
  to: string;
  previousFrom: string;
  views: Metric;
  downloads: Metric;
  orders: Metric;
  revenueEgp: Metric;
  devices: Array<{ deviceType: string; downloads: number }>;
  countries: Array<{ country: string; views: number }>;
};

export type TimeseriesPoint = { date: string; views: number; downloads: number };

export type AnalyticsTimeseries = {
  range: AnalyticsRange;
  unit: 'day' | 'week' | 'month';
  from: string;
  to: string;
  points: TimeseriesPoint[];
};

export type TopClient = {
  rank: number;
  clientId: string | null;
  name: string;
  phone: string | null;
  galleries: number;
  views: number;
  downloads: number;
};

export type TopGallery = {
  id: string;
  name: string;
  state: string;
  clientName: string | null;
  clientPhone: string | null;
  shareable: boolean;
  views: number;
  downloads: number;
  coverUrl: string | null;
};
