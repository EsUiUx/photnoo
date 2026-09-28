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

export const createGallerySchema = z.object({
  name: z.string().trim().min(1).max(80),
  clientName: z.string().trim().min(1).max(100),
  clientPhone: phoneSchema,
  clientEmail: emailSchema.optional(),
});
export type CreateGalleryInput = z.infer<typeof createGallerySchema>;
