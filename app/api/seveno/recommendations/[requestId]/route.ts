import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import {
  resendCandidateRecommendationInvitation,
  revokeCandidateRecommendationInvitation,
  SevenoRecommendationError,
} from '@/lib/seveno-recommendations-server';
import { readJsonBody } from '../../matches/_shared';
import { SevenoRateLimitConfigurationError } from '@/lib/seveno-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent modifier une invitation.');
    }

    const { requestId } = await params;
    const body = await readJsonBody(request);
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!['resend', 'revoke'].includes(action)) {
      return NextResponse.json(
        { error: 'invalid_action', message: 'L action demandee est invalide.' },
        { status: 400 },
      );
    }

    const result = action === 'resend'
      ? await resendCandidateRecommendationInvitation(decodedToken.uid, requestId)
      : await revokeCandidateRecommendationInvitation(decodedToken.uid, requestId);

    return NextResponse.json(result);
  } catch (error) {
    return toRecommendationApiErrorResponse(error);
  }
}

function toRecommendationApiErrorResponse(error: unknown) {
  if (error instanceof SevenoRateLimitConfigurationError) return NextResponse.json({ error: 'rate_limit_unavailable' }, { status: 503 });
  if (error instanceof SevenoRecommendationError && error.code === 'rate_limit_exceeded' && error.retryAfterSeconds) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded', retryAfterSeconds: error.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof SevenoMatchRequestError || error instanceof SevenoRecommendationError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'La requete a echoue.',
    },
    { status: 500 },
  );
}
