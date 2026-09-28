/**
 * Browser client for the admin API, served same-origin under /v1 (next.config.ts rewrite).
 * Writes echo the pn_adm_csrf cookie in x-csrf-token (double-submit).
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
}

function csrf(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith('pn_adm_csrf='))
    ?.slice('pn_adm_csrf='.length);
}

export async function api<T = unknown>(path: string, options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const token = csrf();
  if (token && method !== 'GET') headers['x-csrf-token'] = token;

  let response: Response;
  try {
    response = await fetch(`/v1/admin${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'The API cannot be reached.');
  }
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: FieldError[] } } | null;
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error?.code ?? 'error', payload?.error?.message ?? response.statusText, payload?.error?.fields ?? []);
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fields.length) return error.fields.map((f) => `${f.path}: ${f.message}`).join(' · ');
    return error.message;
  }
  return 'Something went wrong.';
}
