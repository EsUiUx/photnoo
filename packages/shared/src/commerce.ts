import { z } from 'zod';

/**
 * Store, prints and orders (Figma parity). Prices are EGP with two decimals; the server always
 * recomputes totals from its own catalog and never trusts a price sent by a browser.
 */

export const CommerceRules = {
  maxPriceEgp: 1_000_000,
  maxQuantity: 20,
  maxOrderLines: 20,
  /** Public orders per IP per shop (or per gallery for print orders) per hour. */
  ordersPerHour: 10,
} as const;

const money = z
  .number()
  .finite()
  .positive()
  .max(CommerceRules.maxPriceEgp)
  .transform((value) => Math.round(value * 100) / 100);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

/** Accepts 01012345678, 1012345678, 00201012345678 or +201012345678; stores E.164 (Egypt by default). */
export const customerPhoneSchema = z.preprocess(
  (input) => {
    if (typeof input !== 'string') return input;
    const digits = input.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('1')) return `+20${digits}`;
    return digits ? `+${digits}` : '';
  },
  z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a phone number, e.g. 01001234567'),
);

// ---------- store ----------

const productFields = {
  name: z.string().trim().min(1).max(120),
  description: optionalText(2000),
  priceEgp: money,
  salePriceEgp: money.nullable().optional(),
  inStock: z.boolean().optional(),
};

const saleBelowPrice = (value: { priceEgp?: number; salePriceEgp?: number | null }) =>
  value.salePriceEgp == null || value.priceEgp === undefined || value.salePriceEgp < value.priceEgp;
const saleIssue = { message: 'The sale price must be lower than the price.', path: ['salePriceEgp'] };

export const createProductSchema = z.object(productFields).refine(saleBelowPrice, saleIssue);
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z
  .object({
    name: productFields.name.optional(),
    description: productFields.description,
    priceEgp: money.optional(),
    salePriceEgp: productFields.salePriceEgp,
    inStock: z.boolean().optional(),
  })
  .refine(saleBelowPrice, saleIssue);
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const commerceSettingsSchema = z
  .object({ storeEnabled: z.boolean().optional(), printsEnabled: z.boolean().optional() })
  .refine((value) => value.storeEnabled !== undefined || value.printsEnabled !== undefined, 'Nothing to change.');
export type CommerceSettingsInput = z.infer<typeof commerceSettingsSchema>;

// ---------- prints ----------

export const printTypes = ['album', 'frame', 'canvas', 'magazine', 'wooden', 'other'] as const;
export const printTypeSchema = z.enum(printTypes);
export type PrintTypeName = z.infer<typeof printTypeSchema>;

export const createPrintItemSchema = z.object({
  type: printTypeSchema,
  name: z.string().trim().min(1).max(120),
  size: z.string().trim().min(1).max(60),
  priceEgp: money,
  available: z.boolean().optional(),
});
export type CreatePrintItemInput = z.infer<typeof createPrintItemSchema>;

export const updatePrintItemSchema = createPrintItemSchema.partial();
export type UpdatePrintItemInput = z.infer<typeof updatePrintItemSchema>;

export const galleryPrintsSchema = z.object({ printsEnabled: z.boolean() });
export type GalleryPrintsInput = z.infer<typeof galleryPrintsSchema>;

// ---------- orders ----------

export const orderStatuses = ['pending', 'in_production', 'ready', 'delivered', 'cancelled'] as const;
export const orderStatusSchema = z.enum(orderStatuses);
export type OrderStatusName = z.infer<typeof orderStatusSchema>;

export const orderKindSchema = z.enum(['store', 'print']);
export type OrderKindName = z.infer<typeof orderKindSchema>;

export const updateOrderSchema = z
  .object({ status: orderStatusSchema.optional(), paid: z.boolean().optional() })
  .refine((value) => value.status !== undefined || value.paid !== undefined, 'Nothing to change.');
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const listOrdersQuerySchema = z.object({
  kind: orderKindSchema,
  q: z.string().trim().max(100).optional(),
  status: orderStatusSchema.optional(),
  /** Inclusive calendar days, YYYY-MM-DD, Cairo time. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

const customerFields = {
  name: z.string().trim().min(2).max(100),
  phone: customerPhoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .pipe(z.string().email().nullable()),
  note: optionalText(1000),
};

const quantity = z.number().int().min(1).max(CommerceRules.maxQuantity);

/** Public shop checkout. Only ids and quantities: prices come from the catalog. */
export const publicStoreOrderSchema = z.object({
  ...customerFields,
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity }))
    .min(1)
    .max(CommerceRules.maxOrderLines),
});
export type PublicStoreOrderInput = z.infer<typeof publicStoreOrderSchema>;

/** A client ordering a print of one gallery photo. */
export const clientPrintOrderSchema = z.object({
  name: customerFields.name,
  phone: customerFields.phone,
  note: customerFields.note,
  printItemId: z.string().uuid(),
  fileId: z.string().uuid(),
  quantity,
});
export type ClientPrintOrderInput = z.infer<typeof clientPrintOrderSchema>;
