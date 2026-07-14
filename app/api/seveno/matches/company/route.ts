import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getCompanyMatchRequests, getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { toMatchApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);

    if (!actor || actor.role !== 'company') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seules les entreprises peuvent consulter ces demandes.');
    }

    const publicCandidateId = request.nextUrl.searchParams.get('publicCandidateId')?.trim() ?? '';
    const requests = await getCompanyMatchRequests(decodedToken.uid, publicCandidateId || undefined);

    return NextResponse.json({ requests });
  } catch (error) {
    return toMatchApiErrorResponse(error);
  }
}

