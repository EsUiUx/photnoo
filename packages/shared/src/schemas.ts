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

/**
 * A gallery belongs to a managed client: pick an existing one (clientId), or give a name and
 * phone and the client is found or created by phone.
 */
export const createGallerySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    clientId: z.string().uuid().optional(),
    clientName: z.string().trim().min(1).max(100).optional(),
    clientPhone: phoneSchema.optional(),
    clientEmail: emailSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.clientId) return;
    if (!value.clientName) ctx.addIssue({ code: 'custom', path: ['clientName'], message: 'Enter the client name' });
    if (!value.clientPhone) ctx.addIssue({ code: 'custom', path: ['clientPhone'], message: 'Enter the client phone' });
  });
export type CreateGalleryInput = z.infer<typeof createGallerySchema>;

export const updateGallerySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    /** Switches the gallery to another managed client; the client fields follow it. */
    clientId: z.string().uuid(),
    clientName: z.string().trim().min(1).max(100),
    clientPhone: phoneSchema,
    clientEmail: emailSchema.nullable(),
    coverFileId: z.string().uuid().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type UpdateGalleryInput = z.infer<typeof updateGallerySchema>;

// ---------- Billing (PRD B-01 to B-07) ----------

export const checkoutSchema = z.object({ planId: z.string().uuid() });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Downgrade or cycle change, applied at the next renewal (B-07). Null cancels it. */
export const nextPlanSchema = z.object({ planId: z.string().uuid().nullable() });
export type NextPlanInput = z.infer<typeof nextPlanSchema>;

/** Sent as multipart form fields together with the proof file (B-03). */
export const paymentProofSchema = z.object({
  method: z.enum(['instapay', 'vodafone_cash', 'bank_transfer']),
  declaredAmountEgp: z.coerce.number().positive().max(1_000_000),
});
export type PaymentProofInput = z.infer<typeof paymentProofSchema>;

// ---------- Admin (PRD section 8) ----------

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/** Every admin action carries a reason for the audit log (A-05, A-08). */
export const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export type ReasonInput = z.infer<typeof reasonSchema>;

export const approveApplicationSchema = z.object({ grantTrial: z.boolean() });
export type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>;

export const changePlanSchema = reasonSchema.extend({ planId: z.string().uuid() });
export type ChangePlanInput = z.infer<typeof changePlanSchema>;

export const suspendGallerySchema = reasonSchema.extend({
  /** Empty = until an admin lifts it. */
  hours: z.number().int().min(1).max(24 * 90).optional(),
});
export type SuspendGalleryInput = z.infer<typeof suspendGallerySchema>;

export const decideAbuseSchema = z.object({
  status: z.enum(['actioned', 'dismissed']),
  note: z.string().trim().min(3).max(1000),
  suspendGallery: z.boolean().default(false),
});
export type DecideAbuseInput = z.infer<typeof decideAbuseSchema>;

export const createPlanSchema = z.object({
  tier: z.string().trim().regex(/^\d+(GB|TB)$/, 'Use a size such as 100GB or 1TB'),
  annualAllowanceGb: z.number().int().min(1).max(1_000_000),
  cycle: z.enum(['annual', 'monthly']),
  priceEgp: z.number().positive().max(10_000_000),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const planPriceSchema = z.object({ priceEgp: z.number().positive().max(10_000_000) });
export type PlanPriceInput = z.infer<typeof planPriceSchema>;

export const SwitchKeys = ['uploads_frozen', 'downloads_frozen', 'maintenance'] as const;
export type SwitchKey = (typeof SwitchKeys)[number];

export const setSwitchSchema = reasonSchema.extend({ on: z.boolean() });
export type SetSwitchInput = z.infer<typeof setSwitchSchema>;
