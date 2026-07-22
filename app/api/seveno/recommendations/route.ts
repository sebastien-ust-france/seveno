import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import {
  createCandidateRecommendationInvitation,
  listCandidateRecommendationDashboard,
  SevenoRecommendationError,
} from '@/lib/seveno-recommendations-server';
import { readJsonBody } from '../matches/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent consulter ces recommandations.');
    }

    const dashboard = await listCandidateRecommendationDashboard(decodedToken.uid);
    return NextResponse.json(dashboard);
  } catch (error) {
    return toRecommendationApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent creer une invitation.');
    }

    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Le contenu envoye est invalide.' },
        { status: 400 },
      );
    }

    const result = await createCandidateRecommendationInvitation(decodedToken.uid, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toRecommendationApiErrorResponse(error);
  }
}

function toRecommendationApiErrorResponse(error: unknown) {
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
