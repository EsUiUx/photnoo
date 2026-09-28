import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/** URL-safe random token, 256 bits by default. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored only as SHA-256 hashes, so a database leak does not leak live tokens. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed hash for short secrets (6-digit codes) that would be brute-forceable as a plain hash. */
export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// Letters and digits that cannot be confused when read aloud or typed from WhatsApp (no I/l/O/0/1).
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';

/**
 * Gallery password (PRD section 4): 9 characters, 6 letters + 3 digits in random positions,
 * case-sensitive, from a CSPRNG. About 2^48 combinations; brute force is stopped by the
 * per-IP and per-link limits, not by length alone.
 */
export function galleryPassword(): string {
  const chars = [
    ...Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]!),
    ...Array.from({ length: 3 }, () => DIGITS[randomInt(DIGITS.length)]!),
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

/** AES-256-GCM with a key derived from a server secret. Output: iv.tag.ciphertext (base64url). */
export function encrypt(secret: string, plaintext: string): string {
  const key = createHash('sha256').update(`photnoo-data-key:${secret}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

export function decrypt(secret: string, sealed: string): string {
  const [iv, tag, body] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !body) throw new Error('Malformed ciphertext');
  const key = createHash('sha256').update(`photnoo-data-key:${secret}`).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

/** Coarse device class for receipts and analytics; no fingerprinting (PRD section 10). */
export function deviceType(userAgent: string | undefined | null): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!userAgent) return 'unknown';
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}
