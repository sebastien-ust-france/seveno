import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import {
  SevenoAvailabilityError,
  sendCandidateAvailabilityTestNotification,
} from '@/lib/seveno-candidate-availability-server';
import type { AvailabilityNotificationSource } from '@/types/seveno';

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
      message: error instanceof Error ? error.message : 'La notification de test est temporairement indisponible.',
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent tester leurs notifications.');
    }

    const body = (await request.json().catch(() => null)) as {
      source?: AvailabilityNotificationSource;
    } | null;

    console.info('[POST /api/seveno/candidates/availability/test-notification] request received', {
      source: body?.source ?? 'dashboard',
      role: actor.role,
    });

    const result = await sendCandidateAvailabilityTestNotification({
      uid: decodedToken.uid,
      source: body?.source ?? 'dashboard',
    });

    console.info('[POST /api/seveno/candidates/availability/test-notification] request completed', {
      sent: result.sent,
      failed: result.failed,
      invalidDeviceIdsCount: result.invalidDeviceIds.length,
      hasActiveAvailabilityPushSubscription: result.hasActiveAvailabilityPushSubscription,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/seveno/candidates/availability/test-notification] request failed', {
      code: error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code ?? 'unknown') : 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });
    return toAvailabilityErrorResponse(error);
  }
}
