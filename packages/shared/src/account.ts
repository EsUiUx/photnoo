import { z } from 'zod';
import { localeSchema, passwordSchema, phoneSchema } from './schemas';

// ---------- public handle (photnoo.com/p/<slug>) ----------

export const SlugRules = { min: 3, max: 30 } as const;

/** Handles that would collide with app routes, brand names or look official. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'api', 'app', 'apply', 'auth', 'billing', 'blog', 'clients', 'dashboard',
  'dev', 'docs', 'download', 'downloads', 'faq', 'g', 'galleries', 'gallery', 'help', 'home', 'invite',
  'login', 'logout', 'mail', 'me', 'new', 'notifications', 'official', 'orders', 'p', 'photnoo',
  'portfolio', 'pricing', 'prints', 'privacy', 'register', 'reset', 'root', 'security', 'settings',
  'signin', 'signup', 'staff', 'static', 'status', 'store', 'support', 'system', 'team', 'terms',
  'test', 'www',
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*$/;

export type SlugProblem = 'length' | 'characters' | 'reserved';

/** Why a handle cannot be used, or null. Lowercase a-z, 0-9 and single inner hyphens, 3-30 long. */
export function slugProblem(slug: string): SlugProblem | null {
  if (slug.length < SlugRules.min || slug.length > SlugRules.max) return 'length';
  if (!SLUG_PATTERN.test(slug)) return 'characters';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const problem = slugProblem(value);
    if (problem === 'length') ctx.addIssue({ code: 'custom', message: 'Use 3 to 30 characters.' });
    if (problem === 'characters') ctx.addIssue({ code: 'custom', message: 'Use lowercase letters, numbers and single hyphens.' });
    if (problem === 'reserved') ctx.addIssue({ code: 'custom', message: 'This handle is reserved. Choose another.' });
  });

// ---------- links ----------

/** Adds https:// when the scheme is missing, so "instagram.com/mona" is accepted. */
export function normaliseUrl(input: string): string {
  const value = input.trim();
  if (!value) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
}

function hostOf(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Why a link is not acceptable, or null. `site` limits it to one service's domain. */
export function linkProblem(value: string, site?: 'instagram.com' | 'behance.net'): 'invalid' | 'wrong_site' | null {
  const host = hostOf(normaliseUrl(value));
  if (!host) return 'invalid';
  if (site && host !== site && !host.endsWith(`.${site}`)) return 'wrong_site';
  return null;
}

/** Optional link: empty clears it (null); otherwise a http(s) URL, on `site` when given. */
function linkSchema(site?: 'instagram.com' | 'behance.net') {
  return z
    .string()
    .max(300)
    .nullable()
    .transform((value, ctx) => {
      const normalised = value ? normaliseUrl(value) : '';
      if (!normalised) return null;
      const problem = linkProblem(normalised, site);
      if (problem === 'invalid') ctx.addIssue({ code: 'custom', message: 'Enter a full web address, e.g. https://example.com' });
      if (problem === 'wrong_site') ctx.addIssue({ code: 'custom', message: `Enter a link on ${site}.` });
      return normalised;
    });
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

// ---------- profile ----------

export const galleryThemeSchema = z.enum(['light', 'dark']);
export type GalleryThemeInput = z.infer<typeof galleryThemeSchema>;

/** PATCH /v1/me/profile. Every field is optional; send only what changed. */
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    studioName: optionalText(100),
    phone: phoneSchema,
    city: optionalText(80),
    bio: optionalText(600),
    instagramUrl: linkSchema('instagram.com'),
    behanceUrl: linkSchema('behance.net'),
    websiteUrl: linkSchema(),
    otherUrl: linkSchema(),
    slug: slugSchema.nullable(),
    locale: localeSchema,
    galleryTheme: galleryThemeSchema,
  })
  .partial()
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const notificationPreferencesSchema = z
  .object({
    notifyFirstOpen: z.boolean(),
    notifyFullDownload: z.boolean(),
    notifyExpiring: z.boolean(),
    notifyOrders: z.boolean(),
    notifyByEmail: z.boolean(),
  })
  .partial()
  .strict();
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

/** POST /v1/me/password. Same strength rules as accepting the invite (PRD P-02). */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
  logoutOtherDevices: z.boolean().default(false),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
