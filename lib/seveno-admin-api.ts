export interface SevenoAdminApiErrorPayload {
  error?: string;
  message?: string;
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
    throw new Error(extractErrorMessage(payload, 'La requete admin a echoue.'));
  }

  return payload as T;
}

