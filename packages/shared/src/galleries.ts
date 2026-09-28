import { z } from 'zod';
import { emailSchema, phoneSchema } from './schemas';

// ---------- Galleries: list filters, link duration, folders, files, cover ----------

/** How long a shared link works, chosen when the gallery is shared (PRD default 7). */
export const LinkDays = { min: 1, max: 10, default: 7 } as const;
/** An active link may be extended once by up to this many days (PRD P-14). */
export const ExtendDays = { min: 1, max: 3 } as const;

export const GallerySorts = ['newest', 'oldest', 'expiring', 'views'] as const;
export type GallerySort = (typeof GallerySorts)[number];
export const GalleryStatusFilters = ['all', 'active', 'drafts', 'closed'] as const;
export type GalleryStatusFilter = (typeof GalleryStatusFilters)[number];

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** Query string of GET /v1/galleries. Bad values fall back to defaults rather than failing. */
export const galleryListQuerySchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  cursor: z.string().uuid().optional().catch(undefined),
  status: z.enum(GalleryStatusFilters).default('all').catch('all'),
  sort: z.enum(GallerySorts).default('newest').catch('newest'),
  /** Created on or after this Cairo day. */
  from: isoDay.optional().catch(undefined),
  /** Created on or before this Cairo day. */
  to: isoDay.optional().catch(undefined),
  take: z.coerce.number().int().min(1).max(50).default(20).catch(20),
});
export type GalleryListQuery = z.infer<typeof galleryListQuerySchema>;

export const activateGallerySchema = z
  .object({ days: z.number().int().min(LinkDays.min).max(LinkDays.max).default(LinkDays.default) })
  .default({ days: LinkDays.default });
export type ActivateGalleryInput = z.infer<typeof activateGallerySchema>;

export const extendGallerySchema = z.object({ days: z.number().int().min(ExtendDays.min).max(ExtendDays.max) });
export type ExtendGalleryInput = z.infer<typeof extendGallerySchema>;

export const updateFolderSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    /** Zero-based place among the gallery's folders; the others shift to make room. */
    position: z.number().int().min(0).max(1000),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

export const reorderFoldersSchema = z.object({ folderIds: z.array(z.string().uuid()).min(1).max(200) });
export type ReorderFoldersInput = z.infer<typeof reorderFoldersSchema>;

/** Null moves the file to the top level of the gallery. */
export const moveFileSchema = z.object({ folderId: z.string().uuid().nullable() });
export type MoveFileInput = z.infer<typeof moveFileSchema>;

export const moveFilesSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(1000),
  folderId: z.string().uuid().nullable(),
});
export type MoveFilesInput = z.infer<typeof moveFilesSchema>;

export const setCoverSchema = z.object({ fileId: z.string().uuid() });
export type SetCoverInput = z.infer<typeof setCoverSchema>;

// ---------- Clients ----------

export const clientSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  email: emailSchema.nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export type ClientInput = z.infer<typeof clientSchema>;

export const updateClientSchema = clientSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
