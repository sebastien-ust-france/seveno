import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getCandidateMatchRequests, getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { toMatchApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);

    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent consulter ces demandes.');
    }

    const requests = await getCandidateMatchRequests(decodedToken.uid);
    return NextResponse.json({ requests });
  } catch (error) {
    return toMatchApiErrorResponse(error);
  }
}

