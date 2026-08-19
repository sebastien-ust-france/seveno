import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  markJobApplicationConversationRead,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { toApplicationApiError } from '../../../_shared';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { assertRecruitmentApplicationAccess } from '@/lib/seveno-job-offers-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

async function resolveParticipant(request: NextRequest, tokenUid: string, applicationId: string) {
  const actor = await getSevenoUserByUid(tokenUid);
  if (!actor || !actor.role) {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Acces refuse.');
  }
  if (actor.role !== 'candidate' && actor.role !== 'company' && actor.role !== 'admin') {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Acces refuse.');
  }
  if (actor.role === 'company') {
    const membership = await requireActiveCompanyMembership({ userUid: tokenUid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'viewer'] });
    await assertRecruitmentApplicationAccess(applicationId, membership, true);
    return { uid: membership.companyId, role: actor.role };
  }
  return { uid: tokenUid, role: actor.role };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    const participant = await resolveParticipant(request, token.uid, applicationId);
    return NextResponse.json(await markJobApplicationConversationRead(applicationId, participant));
  } catch (error) {
    return toApplicationApiError(error);
  }
}
