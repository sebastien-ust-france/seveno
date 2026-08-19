import type { User } from 'firebase/auth';

export interface SevenoMatchApiErrorPayload {
  error?: string;
  message?: string;
}

function extractErrorMessage(payload: unknown, fallbackMessage: string) {
  if (payload && typeof payload === 'object') {
    const { message, error } = payload as SevenoMatchApiErrorPayload;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
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

export async function fetchSevenoMatchApi<T>(
  authUser: User,
  path: string,
  init: RequestInit = {},
  traceLabel?: string,
): Promise<T> {
  if (traceLabel) {
    console.info('[SevenO availability test]', {
      step: `${traceLabel}:auth_token_request`,
      path,
    });
  }

  const token = await authUser.getIdToken();
  const hasBody = init.body !== undefined && init.body !== null;
  if (traceLabel) {
    console.info('[SevenO availability test]', {
      step: `${traceLabel}:auth_token_ready`,
      path,
      hasBody,
    });
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...Object.fromEntries(buildHeaders(init.headers, hasBody).entries()),
    },
  });

  if (traceLabel) {
    console.info('[SevenO availability test]', {
      step: `${traceLabel}:response`,
      path,
      ok: response.ok,
      status: response.status,
    });
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, 'La requete a echoue.'));
  }

  return payload as T;
}
