import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import {
  SevenoRecommendationError,
  verifyCandidateRecommendationByAdmin,
} from '@/lib/seveno-recommendations-server';
import { readJsonBody } from '../../../seveno/matches/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ recommendationId: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const { recommendationId } = await params;
    const body = await readJsonBody(request);
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!['verify', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'invalid_action', message: 'L action demandee est invalide.' },
        { status: 400 },
      );
    }

    const result = await verifyCandidateRecommendationByAdmin(
      session.user.uid,
      recommendationId,
      {
        action: action as 'verify' | 'reject',
        reason: typeof body?.reason === 'string' ? body.reason : undefined,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return toRecommendationApiErrorResponse(error);
  }
}

function toRecommendationApiErrorResponse(error: unknown) {
  if (error instanceof SevenoRecommendationError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'La requete admin a echoue.',
    },
    { status: 500 },
  );
}
