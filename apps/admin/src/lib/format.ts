export function formatBytes(value: string | number | null | undefined): string {
  let size = Number(value ?? 0);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toLocaleString('en-US', { maximumFractionDigits: unit >= 3 ? 1 : 0 })} ${units[unit]}`;
}

/** Staff read Cairo time everywhere, whatever their laptop says. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo',
  }).format(new Date(value));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Cairo' }).format(new Date(value));
}

export function egp(value: number | null | undefined): string {
  return `${(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP`;
}

export function percent(part: string | number, whole: string | number): number {
  const w = Number(whole);
  return w ? Math.min(100, Math.round((Number(part) / w) * 100)) : 0;
}
