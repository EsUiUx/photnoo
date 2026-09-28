/**
 * Browser client for the Photnoo API, served same-origin under /v1 (see next.config.ts rewrites).
 * Sends the double-submit CSRF header and retries once through /v1/auth/refresh when the
 * 15-minute access token has expired.
 */

export type FieldError = { path: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: FieldError[] = [],
  ) {
    super(message);
  }

  /** The message for one form field, if the API rejected it. */
  field(path: string): string | undefined {
    return this.fields.find((f) => f.path === path)?.message;
  }
}

type Options = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; retry?: boolean };

const CSRF_COOKIE = 'pn_csrf';

function csrfToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`))
    ?.slice(CSRF_COOKIE.length + 1);
}

export function hasSessionHint(): boolean {
  return typeof document !== 'undefined' && Boolean(csrfToken());
}

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const csrf = csrfToken();
  if (csrf && method !== 'GET') headers['x-csrf-token'] = csrf;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'network_error');
  }

  if (response.status === 401 && options.retry !== false && !path.startsWith('/v1/auth/')) {
    const refreshed = await fetch('/v1/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      headers: csrf ? { 'x-csrf-token': csrf } : {},
    });
    if (refreshed.ok) return api<T>(path, { ...options, retry: false });
  }

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string; fields?: FieldError[] } }
    | null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'error',
      error?.message ?? response.statusText,
      error?.fields ?? [],
    );
  }
  return payload as T;
}

/** Accepts 01012345678, 1012345678 or +201012345678 and returns E.164 (Egypt by default). */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('1')) return `+20${digits}`;
  return digits ? `+${digits}` : '';
}
