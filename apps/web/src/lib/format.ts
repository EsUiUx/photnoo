/** Binary units, one decimal: 1.5 GB, 820 MB. Accepts BigInt strings from the API. */
export function formatBytes(value: string | number, locale: string): string {
  const bytes = typeof value === 'string' ? Number(value) : value;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: unit >= 3 ? 1 : 0 }).format(size);
  return isolate(`${number} ${units[unit]}`);
}

/**
 * Wraps Latin text such as "500 GB" in a left-to-right isolate so Arabic sentences do not
 * reorder it into "GB 500".
 */
export function isolate(text: string): string {
  return `⁦${text}⁩`;
}

/**
 * Figma shows dates as 01/07/2026 (day first); Cairo time. Arabic keeps Western digits, like
 * every other number in the app (ar-EG would switch to Arabic-Indic digits).
 */
export function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Africa/Cairo',
  }).format(new Date(iso));
}

/** Time left for uploads: "45s", "12m", "1h 20m" in the page language. */
export function formatDuration(seconds: number, locale: string): string {
  const unit = (value: number, name: 'second' | 'minute' | 'hour') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(value);
  if (seconds < 60) return unit(Math.ceil(seconds), 'second');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return unit(minutes, 'minute');
  const rest = minutes % 60;
  return rest ? `${unit(Math.floor(minutes / 60), 'hour')} ${unit(rest, 'minute')}` : unit(minutes / 60, 'hour');
}

export function percent(part: string | number, whole: string | number): number {
  const w = Number(whole);
  if (!w) return 0;
  return Math.min(100, Math.round((Number(part) / w) * 100));
}
