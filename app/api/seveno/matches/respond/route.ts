import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, respondToSevenoMatchRequest, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { readJsonBody, toMatchApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);

    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent repondre a une demande.');
    }

    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'Le contenu envoye est invalide.',
        },
        { status: 400 },
      );
    }

    const matchRequestId = typeof body.matchRequestId === 'string' ? body.matchRequestId.trim() : '';
    const decision = body.decision === 'accepted' || body.decision === 'refused' ? body.decision : '';

    if (!matchRequestId) {
      return NextResponse.json(
        {
          error: 'missing_match_request_id',
          message: 'L identifiant de la demande est manquant.',
        },
        { status: 400 },
      );
    }

    if (!decision) {
      return NextResponse.json(
        {
          error: 'invalid_decision',
          message: 'La decision doit etre acceptee ou refusee.',
        },
        { status: 400 },
      );
    }

    const payload = await respondToSevenoMatchRequest(decodedToken.uid, matchRequestId, decision);
    return NextResponse.json(payload);
  } catch (error) {
    return toMatchApiErrorResponse(error);
  }
}

