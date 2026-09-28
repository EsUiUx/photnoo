// Response shapes of the account API (Settings and notifications).

export type NotificationPreferences = {
  notifyFirstOpen: boolean;
  notifyFullDownload: boolean;
  notifyExpiring: boolean;
  notifyOrders: boolean;
  notifyByEmail: boolean;
};

export type ProfileLinks = {
  instagramUrl: string | null;
  behanceUrl: string | null;
  websiteUrl: string | null;
  otherUrl: string | null;
};

export type Profile = {
  id: string;
  name: string;
  studioName: string | null;
  email: string;
  phone: string;
  city: string | null;
  bio: string | null;
  slug: string | null;
  locale: 'ar' | 'en';
  galleryTheme: 'light' | 'dark';
  avatarUrl: string | null;
  logoUrl: string | null;
  links: ProfileLinks;
  notifications: NotificationPreferences;
};

export type ProfilePatch = Partial<
  Pick<Profile, 'name' | 'studioName' | 'phone' | 'city' | 'bio' | 'slug' | 'locale' | 'galleryTheme'> & ProfileLinks
>;

export type SlugAvailability = { slug: string; available: boolean; reason?: 'length' | 'characters' | 'reserved' | 'taken' };

export type NotificationType =
  | 'gallery_opened'
  | 'gallery_downloaded'
  | 'gallery_expiring'
  | 'gallery_closed'
  | 'gallery_ready'
  | 'order_placed'
  | 'payment_approved'
  | 'payment_rejected'
  | 'allowance_warning'
  | 'renewal_due';

export type AppNotification = {
  id: string;
  type: NotificationType;
  data: Record<string, string | number | null | undefined>;
  galleryId: string | null;
  orderId: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationPage = { items: AppNotification[]; nextCursor: string | null; unreadCount: number };
