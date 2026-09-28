/**
 * Marketing-site content that the owner still has to confirm. Keep it here, not in components,
 * so a price or phone number changes in one place.
 */

export type Tier = {
  key: '100gb' | '250gb' | '500gb' | '1tb' | '2tb';
  label: string;
  /** Yearly delivery allowance in GB (PRD section 2). */
  allowanceGb: number;
  /**
   * PENDING OWNER: placeholder prices in EGP, identical to the placeholder catalogue seeded by
   * `pnpm --filter @photnoo/api cli:billing seed-plans`. Annual costs ten months.
   */
  monthlyEgp: number;
  annualEgp: number;
  featured?: boolean;
};

export const tiers: Tier[] = [
  { key: '100gb', label: '100 GB', allowanceGb: 100, monthlyEgp: 20, annualEgp: 200 },
  { key: '250gb', label: '250 GB', allowanceGb: 250, monthlyEgp: 80, annualEgp: 800 },
  { key: '500gb', label: '500 GB', allowanceGb: 500, monthlyEgp: 150, annualEgp: 1500, featured: true },
  { key: '1tb', label: '1 TB', allowanceGb: 1024, monthlyEgp: 250, annualEgp: 2500 },
  { key: '2tb', label: '2 TB', allowanceGb: 2048, monthlyEgp: 450, annualEgp: 4500 },
];

/** Tiers shown as full cards on the homepage; the rest are listed underneath. */
export const headlineTiers = ['100gb', '500gb', '2tb'] as const;

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
