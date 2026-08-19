import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import {
  getJobApplicationContactSharing,
  shareJobApplicationContact,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { readApplicationBody, toApplicationApiError } from '../../_shared';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { assertRecruitmentApplicationAccess } from '@/lib/seveno-job-offers-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

async function resolveParticipant(request: NextRequest, uid: string, applicationId: string, mutation: boolean) {
  const user = await getSevenoUserByUid(uid);
  if (!user || (user.role !== 'candidate' && user.role !== 'company')) {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Accès refusé.');
  }
  if (user.role === 'company') {
    const membership = await requireActiveCompanyMembership({ userUid: uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'viewer'] });
    await assertRecruitmentApplicationAccess(applicationId, membership, mutation);
    return { uid: membership.companyId, role: user.role };
  }
  return { uid, role: user.role };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    return NextResponse.json(await getJobApplicationContactSharing(applicationId, await resolveParticipant(request, token.uid, applicationId, false)));
  } catch (error) {
    return toApplicationApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const body = await readApplicationBody(request);
    if (!body || body.action !== 'share') {
      throw new SevenoJobApplicationError('invalid_payload', 400, 'L’action de partage est invalide.');
    }
    const { applicationId } = await context.params;
    return NextResponse.json(await shareJobApplicationContact(applicationId, await resolveParticipant(request, token.uid, applicationId, true)));
  } catch (error) {
    return toApplicationApiError(error);
  }
}
