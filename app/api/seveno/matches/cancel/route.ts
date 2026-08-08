import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { cancelSevenoMatchRequest, getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { readJsonBody, toMatchApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);

    if (!actor || actor.role !== 'company') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seules les entreprises peuvent annuler une demande.');
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
    if (!matchRequestId) {
      return NextResponse.json(
        {
          error: 'missing_match_request_id',
          message: 'L identifiant de la demande est manquant.',
        },
        { status: 400 },
      );
    }

    const membership = await requireActiveCompanyMembership({ userUid: decodedToken.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin'] });
    const payload = await cancelSevenoMatchRequest(membership.companyId, matchRequestId);
    return NextResponse.json(payload);
  } catch (error) {
    return toMatchApiErrorResponse(error);
  }
}
