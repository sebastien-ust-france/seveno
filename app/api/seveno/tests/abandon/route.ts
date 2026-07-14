import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { abandonSevenoTestSession, SevenoTestError } from '@/lib/seveno-tests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const body = (await request.json().catch(() => null)) as unknown;
    const sessionId = isPlainObject(body) && typeof body.sessionId === 'string'
      ? body.sessionId.trim()
      : '';
    if (!sessionId) {
      return NextResponse.json(
        { error: 'missing_session_id', message: 'La session de questionnaire est manquante.' },
        { status: 400 },
      );
    }

    const result = await abandonSevenoTestSession(decodedToken.uid, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof SevenoTestError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: 'unexpected_error', message: 'La tentative n a pas pu etre fermee.' },
      { status: 500 },
    );
  }
}
