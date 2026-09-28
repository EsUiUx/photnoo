/**
 * Marketing-site content that the owner still has to confirm. Keep it here, not in components,
 * so a price or phone number changes in one place.
 */

export type PlanKey = 'starter' | 'growth' | 'studio';

export type Plan = {
  key: PlanKey;
  /** Monthly price in EGP as shown in Figma. PENDING OWNER: set from the cost model (PRD B-01). */
  priceEgp: number;
  /** Yearly delivery allowance in GB (PRD section 2). */
  allowanceGb: number;
  highlighted?: boolean;
};

export const plans: Plan[] = [
  { key: 'starter', priceEgp: 20, allowanceGb: 100 },
  { key: 'growth', priceEgp: 150, allowanceGb: 500, highlighted: true },
  { key: 'studio', priceEgp: 450, allowanceGb: 2000 },
];

export const contact = {
  // PENDING OWNER: number and city copied from the Figma footer.
  phone: '+201090359579',
  city: 'Cairo, Egypt',
  email: 'hello@photnoo.com',
};

/** Social profiles. An entry without an href is not rendered. PENDING OWNER: add real URLs. */
export const social: Array<{ key: 'whatsapp' | 'instagram' | 'tiktok' | 'x' | 'snapchat'; href?: string }> = [
  { key: 'whatsapp', href: `https://wa.me/${contact.phone.replace(/\D/g, '')}` },
  { key: 'instagram' },
  { key: 'tiktok' },
  { key: 'x' },
  { key: 'snapchat' },
];
