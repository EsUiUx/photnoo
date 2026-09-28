import { z } from 'zod';

// ---------- Portfolio ----------

/**
 * Portfolio images are showcase copies, separate from client galleries. They do not count
 * toward the storage allowance; instead a photographer can keep up to this many.
 */
export const PortfolioRules = {
  maxItems: 200,
  captionMax: 200,
  categoryMax: 40,
} as const;

/** Suggested categories. Free text is allowed too. */
export const PORTFOLIO_CATEGORIES = ['wedding', 'engagement', 'portrait', 'family', 'event', 'commercial'] as const;

const caption = z.string().trim().max(PortfolioRules.captionMax);
const category = z.string().trim().max(PortfolioRules.categoryMax);

/** Multipart text fields sent with a portfolio upload (all optional). */
export const portfolioUploadSchema = z.object({
  caption: caption.optional(),
  category: category.optional(),
});
export type PortfolioUploadInput = z.infer<typeof portfolioUploadSchema>;

/** Empty strings clear the value. */
export const updatePortfolioItemSchema = z
  .object({
    caption: caption.nullable().optional(),
    category: category.nullable().optional(),
  })
  .refine((v) => v.caption !== undefined || v.category !== undefined, { message: 'Nothing to update.' });
export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;

export const reorderPortfolioSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(PortfolioRules.maxItems),
});
export type ReorderPortfolioInput = z.infer<typeof reorderPortfolioSchema>;

export const portfolioSettingsSchema = z.object({ published: z.boolean() });
export type PortfolioSettingsInput = z.infer<typeof portfolioSettingsSchema>;

// ---------- Analytics ----------

export const ANALYTICS_RANGES = ['7d', '30d', '6m', '12m'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const analyticsQuerySchema = z.object({
  range: z.enum(ANALYTICS_RANGES).default('30d'),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
