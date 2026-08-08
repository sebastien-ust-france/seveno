import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  reviewCompanyJobApplication,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { readApplicationBody, toApplicationApiError } from '../../_shared';
import { releaseCampaignCandidateSlot } from '@/lib/seveno-recruitment-campaigns-server';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { assertRecruitmentApplicationAccess } from '@/lib/seveno-job-offers-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    const body = await readApplicationBody(request);
    if (!body) {
      throw new SevenoJobApplicationError('invalid_payload', 400, 'Le contenu envoye est invalide.');
    }

    const decision = body.decision === 'interested' || body.decision === 'declined' ? body.decision : '';
    if (!decision) {
      throw new SevenoJobApplicationError('invalid_decision', 400, 'La decision doit etre positive ou negative.');
    }

    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    await assertRecruitmentApplicationAccess(applicationId, membership, true);
    const application = await reviewCompanyJobApplication(membership.companyId, applicationId, decision, token.uid);
    await releaseCampaignCandidateSlot({ applicationId, actorUid: token.uid, reason: decision === 'interested' ? 'contact_requested' : 'company_declined' });
    return NextResponse.json({ application });
  } catch (error) {
    return toApplicationApiError(error);
  }
}
