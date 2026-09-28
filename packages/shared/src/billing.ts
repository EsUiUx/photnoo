/**
 * Billing rules from PRD v1 section B. Prices themselves live in the Plan table (admin config,
 * PRD A-04); these are the rules that turn a plan and a date into an amount or a state.
 */
export const BillingRules = {
  /** Renewal reminder emails, in days before the cycle ends (B-05). */
  reminderDays: [45, 15, 7, 0],
  /** Dashboard renewal banner starts this many days before the cycle ends (B-05). */
  bannerDays: 15,
  /** A renewal can be paid from this many days before the cycle ends. */
  renewalOpensDays: 45,
  /** Soft-locked accounts become Dormant after this many days unpaid (B-08). */
  dormantAfterDays: 30,
  /** Allowance warning emails at these fractions of the cycle allowance (B-02). */
  allowanceWarnings: [0.8, 0.95],
  /** Payment proof: image or PDF up to 10 MB (B-03). */
  proofMaxBytes: 10 * 1024 ** 2,
  /** VAT rate on invoices; 0 until Photnoo is VAT registered (B-04). */
  vatRate: 0,
} as const;

export const PaymentMethods = ['instapay', 'vodafone_cash', 'bank_transfer'] as const;
export type ManualPaymentMethod = (typeof PaymentMethods)[number];

export type Cycle = 'annual' | 'monthly';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Plans are sold per year of deliveries; a monthly cycle gets a twelfth each month. */
export function cycleAllowanceBytes(annualBytes: bigint, cycle: Cycle): bigint {
  return cycle === 'annual' ? annualBytes : annualBytes / 12n;
}

/** Calendar cycle end: same day next month or next year (Jan 31 + 1 month = Feb 28/29). */
export function addCycle(start: Date, cycle: Cycle): Date {
  const end = new Date(start);
  const day = end.getUTCDate();
  if (cycle === 'annual') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1, 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
}

/**
 * B-06: an upgrade mid-cycle costs (new price − old price) × days left ÷ days in cycle,
 * rounded up to a whole pound. The renewal date does not move.
 */
export function prorateUpgrade(input: {
  newPriceEgp: number;
  oldPriceEgp: number;
  cycleStart: Date;
  cycleEnd: Date;
  now: Date;
}): number {
  const total = daysBetween(input.cycleStart, input.cycleEnd);
  const left = Math.min(total, daysBetween(input.now, input.cycleEnd));
  if (total === 0 || left === 0) return 0;
  const amount = ((input.newPriceEgp - input.oldPriceEgp) * left) / total;
  return Math.max(0, Math.ceil(amount));
}

/** Monthly-equivalent saving of annual billing, as a whole percentage (B-01). */
export function annualSavingPercent(monthlyPriceEgp: number, annualPriceEgp: number): number {
  const yearOfMonthly = monthlyPriceEgp * 12;
  if (yearOfMonthly <= 0) return 0;
  return Math.max(0, Math.round((1 - annualPriceEgp / yearOfMonthly) * 100));
}

/** Short, unambiguous payment reference such as PHN-4F7K2Q (no 0/O or 1/I). */
export function paymentReference(random: Uint8Array): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[random[i]! % alphabet.length];
  return `PHN-${out}`;
}

export function invoiceNumber(number: number): string {
  return `INV-${String(number).padStart(6, '0')}`;
}
