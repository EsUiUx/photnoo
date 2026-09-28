/**
 * Detects a file's real format from its first bytes (PRD P-08), so a renamed file is caught.
 * Covers every extension in AcceptedExtensions. RAW formats are mostly TIFF containers.
 */
export type SniffedType = 'jpeg' | 'png' | 'tiff' | 'psd' | 'zip' | 'cr2' | 'cr3' | 'raf' | 'orf' | 'rw2' | 'unknown';

const ascii = (bytes: Buffer, start: number, text: string) =>
  bytes.length >= start + text.length && bytes.subarray(start, start + text.length).toString('latin1') === text;

export function sniff(head: Buffer): SniffedType {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (ascii(head, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  if (ascii(head, 0, '8BPS')) return 'psd';
  if (ascii(head, 0, 'PK\x03\x04') || ascii(head, 0, 'PK\x05\x06')) return 'zip';
  if (ascii(head, 0, 'FUJIFILMCCD-RAW')) return 'raf';
  if (ascii(head, 4, 'ftypcrx ')) return 'cr3';
  if (ascii(head, 0, 'IIRO') || ascii(head, 0, 'IIRS') || ascii(head, 0, 'MMOR')) return 'orf';
  if (ascii(head, 0, 'IIU\x00')) return 'rw2';
  const tiff = ascii(head, 0, 'II*\x00') || ascii(head, 0, 'MM\x00*');
  if (tiff && ascii(head, 8, 'CR')) return 'cr2';
  if (tiff) return 'tiff';
  return 'unknown';
}

/** Which sniffed formats a declared extension may contain. NEF, ARW and DNG are plain TIFF. */
const EXPECTED: Record<string, SniffedType[]> = {
  jpg: ['jpeg'],
  jpeg: ['jpeg'],
  png: ['png'],
  tif: ['tiff'],
  tiff: ['tiff'],
  psd: ['psd'],
  zip: ['zip'],
  cr2: ['cr2', 'tiff'],
  cr3: ['cr3'],
  nef: ['tiff'],
  arw: ['tiff'],
  dng: ['tiff'],
  raf: ['raf'],
  orf: ['orf', 'tiff'],
  rw2: ['rw2', 'tiff'],
};

export function matchesExtension(extension: string, sniffed: SniffedType): boolean {
  return EXPECTED[extension]?.includes(sniffed) ?? false;
}

export const MIME: Partial<Record<SniffedType, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  tiff: 'image/tiff',
  psd: 'image/vnd.adobe.photoshop',
  zip: 'application/zip',
};
