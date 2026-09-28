/**
 * Lucide ships no brand icons, so these are simple line marks drawn to match its 24px grid and
 * 1.75 stroke. They are generic shapes (a camera outline and "Bē" letters), not the brands' logos.
 */
export function InstagramMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BehanceMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6.5h5a2.75 2.75 0 0 1 0 5.5h-5z" />
      <path d="M2.5 12h5.75a3 3 0 0 1 0 6H2.5z" />
      <path d="M14.5 14h7a3.5 3.5 0 1 0-1 2.6" />
      <path d="M15 7.5h5" />
    </svg>
  );
}
