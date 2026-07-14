import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import {
  SevenoAvailabilityError,
  confirmCandidateAvailabilityFromDashboard,
} from '@/lib/seveno-candidate-availability-server';
import type { AvailabilityNotificationSource, CandidateAvailabilityConfirmationAction } from '@/types/seveno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toAvailabilityErrorResponse(error: unknown) {
  if (
    error instanceof SevenoApiAuthError
    || error instanceof SevenoMatchRequestError
    || error instanceof SevenoAvailabilityError
  ) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'La disponibilite candidat est temporairement indisponible.',
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent confirmer leur disponibilite.');
    }

    const body = (await request.json().catch(() => null)) as {
      action?: CandidateAvailabilityConfirmationAction | 'immediate';
      source?: AvailabilityNotificationSource;
    } | null;

    const action = body?.action;
    if (action !== 'yes' && action !== 'no' && action !== 'immediate') {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'La decision doit etre yes, no ou immediate.',
        },
        { status: 400 },
      );
    }

    const result = await confirmCandidateAvailabilityFromDashboard(decodedToken.uid, {
      action,
      source: body?.source ?? 'dashboard',
    });

    return NextResponse.json(result);
  } catch (error) {
    return toAvailabilityErrorResponse(error);
  }
}

