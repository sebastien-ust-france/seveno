export interface SevenoAdminApiErrorPayload {
  error?: string;
  message?: string;
  issues?: unknown;
}

export class SevenoAdminApiError extends Error {
  readonly status: number;

  readonly code?: string;

  readonly issues?: unknown;

  readonly payload: SevenoAdminApiErrorPayload | null;

  constructor(status: number, payload: SevenoAdminApiErrorPayload | null, fallbackMessage: string) {
    super(payload?.message?.trim() || fallbackMessage);
    this.name = 'SevenoAdminApiError';
    this.status = status;
    this.code = payload?.error;
    this.issues = payload?.issues;
    this.payload = payload;
  }
}

function extractErrorPayload(payload: unknown): SevenoAdminApiErrorPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as SevenoAdminApiErrorPayload;
  const result: SevenoAdminApiErrorPayload = {};

  if (typeof candidate.error === 'string' && candidate.error.trim().length > 0) {
    result.error = candidate.error;
  }

  if (typeof candidate.message === 'string' && candidate.message.trim().length > 0) {
    result.message = candidate.message;
  }

  if ('issues' in candidate) {
    result.issues = candidate.issues;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function extractErrorMessage(payload: unknown, fallbackMessage: string) {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function buildHeaders(initHeaders?: HeadersInit, includeJsonContentType = false) {
  const headers = new Headers(initHeaders);
  if (includeJsonContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

export async function fetchSevenoAdminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined && init.body !== null;
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: Object.fromEntries(buildHeaders(init.headers, hasBody).entries()),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new SevenoAdminApiError(response.status, extractErrorPayload(payload), extractErrorMessage(payload, 'La requete admin a echoue.'));
  }

  return payload as T;
}
