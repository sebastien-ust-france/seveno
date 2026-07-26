import { NextRequest, NextResponse } from 'next/server';
import { SevenoApiAuthError, requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { SevenoTestError, submitSevenoTestSession } from '@/lib/seveno-tests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toErrorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoTestError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.',
    },
    {
      status: 500,
    },
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);

    let body: Record<string, unknown> | null = null;
    try {
      const payload = (await request.json()) as unknown;
      body = isPlainObject(payload) ? payload : null;
    } catch {
      body = null;
    }

    if (!body) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'Le contenu envoye est invalide.',
        },
        {
          status: 400,
        },
      );
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      return NextResponse.json(
        {
          error: 'missing_session_id',
          message: 'La session de test est manquante.',
        },
        {
          status: 400,
        },
      );
    }

    const result = await submitSevenoTestSession(decodedToken.uid, sessionId, body);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
