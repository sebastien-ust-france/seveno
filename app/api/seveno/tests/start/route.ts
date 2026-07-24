import { NextRequest, NextResponse } from 'next/server';
import { SevenoApiAuthError, requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { SevenoTestError, getSevenoAssessmentStartState, startSevenoTestSession } from '@/lib/seveno-tests';
import { SevenoMatchRequestError, getSevenoUserByUid } from '@/lib/seveno-match-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toErrorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoTestError || error instanceof SevenoMatchRequestError) {
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
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent lancer ce questionnaire.');
    }

    const result = await startSevenoTestSession(decodedToken.uid);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent consulter cet historique.');
    }

    const state = await getSevenoAssessmentStartState(decodedToken.uid);
    return NextResponse.json(state);
  } catch (error) {
    return toErrorResponse(error);
  }
}
