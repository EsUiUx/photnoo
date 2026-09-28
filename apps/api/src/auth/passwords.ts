import argon2 from 'argon2';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

/** Hash of a random string, used to spend the same time when the account does not exist. */
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export async function verifyPassword(hash: string | null, password: string): Promise<boolean> {
  if (!hash) {
    dummyHash ??= argon2.hash('photnoo-timing-equaliser', HASH_OPTIONS);
    await argon2.verify(await dummyHash, password).catch(() => false);
    return false;
  }
  return argon2.verify(hash, password).catch(() => false);
}

// Most common leaked passwords that still pass a 10-character minimum.
const COMMON = new Set([
  '1234567890', '0123456789', '0987654321', '1111111111', '0000000000', '1234512345',
  '123456789a', 'a123456789', '1q2w3e4r5t', 'qwertyuiop', 'asdfghjkl1', 'password12',
  'password123', 'password1234', 'passw0rd123', 'iloveyou12', 'qwerty1234', 'qwerty12345',
  '1qaz2wsx3edc', 'abcdefghij', 'abcd123456', 'abc1234567', 'photographer', 'photography',
  'photnoo123', 'welcome123', 'letmein123', 'football12', 'princess12', 'sunshine12',
  'monkey1234', 'dragon1234', 'baseball12', 'superman12', 'michael123', 'mohamed123',
  'ahmed12345', 'egypt12345', 'cairo12345', 'zxcvbnm123', 'aaaaaaaaaa', 'qazwsxedcr',
]);

/** Returns a reason the password is unacceptable, or null if it is fine. */
export function passwordProblem(password: string, email: string): string | null {
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'This password is too common. Choose another.';
  if (/^(.)\1+$/.test(password)) return 'Do not repeat one character.';
  const localPart = email.split('@')[0]?.toLowerCase() ?? '';
  if (localPart.length >= 4 && lower.includes(localPart)) {
    return 'Do not use your email address in your password.';
  }
  return null;
}
