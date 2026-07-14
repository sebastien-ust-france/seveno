import { NextRequest, NextResponse } from 'next/server';
import { SevenoApiAuthError, requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { prepareSevenoAssessment, SevenoTestError, startSevenoTestSession } from '@/lib/seveno-tests';

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

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const result = await startSevenoTestSession(decodedToken.uid);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const result = await prepareSevenoAssessment(decodedToken.uid);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
