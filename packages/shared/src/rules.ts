/**
 * Delivery rules from PRD v1. Values marked (default) await owner confirmation;
 * keep them here so every app reads the same number.
 */
export const DeliveryRules = {
  /** Days a link stays active after "Activate and share" (default). */
  linkActiveDays: 7,
  /** A link may serve this many times the gallery's total bytes (default). */
  downloadCapMultiplier: 2,
  /** Re-requesting the same file within this window is not counted again. */
  repeatDownloadWindowMinutes: 10,
  /** Signed download URL lifetime. */
  signedUrlTtlSeconds: 300,
  /** Drafts never activated are purged after this many days. */
  draftMaxIdleDays: 14,
  /** Closed galleries have their files purged within this many hours. */
  purgeWithinHours: 24,
  /** Client and IP fields are anonymised this many months after close. */
  anonymiseAfterMonths: 12,
  /** Largest single file accepted (default: 2 GB). */
  maxFileBytes: 2 * 1024 ** 3,
  /** Per-gallery bandwidth breaker (default: 50 GB in one hour). */
  breakerBytesPerHour: 50 * 1024 ** 3,
} as const;

export const AllowanceWarnings = [0.8, 0.95, 1] as const;

export const TrialDefaults = { allowanceBytes: 25 * 1024 ** 3, days: 30 } as const;

/** File extensions accepted for upload (PRD P-06). Previews only for JPG/PNG. */
export const AcceptedExtensions = [
  'jpg', 'jpeg', 'png', 'tif', 'tiff', 'psd', 'zip',
  'cr2', 'cr3', 'nef', 'arw', 'raf', 'dng', 'orf', 'rw2',
] as const;

export const PreviewableExtensions = ['jpg', 'jpeg', 'png'] as const;

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isAcceptedFile(name: string): boolean {
  return (AcceptedExtensions as readonly string[]).includes(fileExtension(name));
}

export function isPreviewable(name: string): boolean {
  return (PreviewableExtensions as readonly string[]).includes(fileExtension(name));
}

/** Bytes a link may serve before it closes. */
export function downloadCapBytes(galleryTotalBytes: bigint): bigint {
  return galleryTotalBytes * BigInt(DeliveryRules.downloadCapMultiplier);
}
