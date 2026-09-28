import type { Prisma } from '@photnoo/db';

/** Decimal(12,2) EGP as a JSON number. */
export const egp = (value: Prisma.Decimal | null | undefined): number => (value ? Number(value.toString()) : 0);

/** A JS number as the two-decimal string Prisma writes into a Decimal column. */
export const decimal = (value: number): string => value.toFixed(2);

/** Percent change against the previous period; null when there is nothing to compare with. */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
