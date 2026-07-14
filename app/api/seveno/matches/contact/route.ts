import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getMatchRequestContact, getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { toMatchApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);

    if (!actor || (actor.role !== 'candidate' && actor.role !== 'company' && actor.role !== 'admin')) {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Acces refuse.');
    }

    const matchRequestId = request.nextUrl.searchParams.get('matchRequestId')?.trim() ?? '';
    if (!matchRequestId) {
      return NextResponse.json(
        {
          error: 'missing_match_request_id',
          message: 'L identifiant de la demande est manquant.',
        },
        { status: 400 },
      );
    }

    const contact = await getMatchRequestContact(
      {
        uid: decodedToken.uid,
        role: actor.role,
      },
      matchRequestId,
    );

    return NextResponse.json({ contact });
  } catch (error) {
    return toMatchApiErrorResponse(error);
  }
}

