import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** PRD P-02: at least 10 characters. Common-password check happens server-side. */
export const passwordSchema = z.string().min(10).max(128);

/** E.164 phone number, e.g. +201001234567. */
export const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +201001234567');

export const localeSchema = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof localeSchema>;

export const applicationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  studioName: z.string().trim().max(100).optional(),
  city: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: emailSchema,
  portfolioUrl: z.string().trim().url().max(300),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
  acceptTerms: z.literal(true),
  acceptContentDeclaration: z.literal(true),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({ email: emailSchema });
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  newPassword: passwordSchema,
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;

export const createFolderSchema = z.object({ name: z.string().trim().min(1).max(60) });
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

/** Start of a multipart upload (PRD P-06, P-07). Size and name are checked before any URL is issued. */
export const createUploadSchema = z.object({
  name: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(100).optional(),
  folderId: z.string().uuid().optional(),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const signPartsSchema = z.object({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(100),
});
export type SignPartsInput = z.infer<typeof signPartsSchema>;

export const completeUploadSchema = z.object({
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) }))
    .min(1)
    .max(10_000),
});
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

export const unlockGallerySchema = z.object({ password: z.string().min(1).max(64) });
export type UnlockGalleryInput = z.infer<typeof unlockGallerySchema>;

export const reportGallerySchema = z.object({
  reason: z.string().trim().min(5).max(1000),
  email: emailSchema.optional(),
});
export type ReportGalleryInput = z.infer<typeof reportGallerySchema>;

export const createGallerySchema = z.object({
  name: z.string().trim().min(1).max(80),
  clientName: z.string().trim().min(1).max(100),
  clientPhone: phoneSchema,
  clientEmail: emailSchema.optional(),
});
export type CreateGalleryInput = z.infer<typeof createGallerySchema>;

export const updateGallerySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    clientName: z.string().trim().min(1).max(100),
    clientPhone: phoneSchema,
    clientEmail: emailSchema.nullable(),
    coverFileId: z.string().uuid().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateGalleryInput = z.infer<typeof updateGallerySchema>;
