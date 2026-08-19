import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  activateCompanyQuestionnaire,
  SevenoCompanyQuestionnaireError,
} from '@/lib/seveno-company-questionnaires-server';
import { assertRecruitmentOfferIdAccess, SevenoJobOfferError } from '@/lib/seveno-job-offers-server';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ offerId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    const { offerId } = await context.params;
    await assertRecruitmentOfferIdAccess(offerId, membership, true);
    return NextResponse.json({ questionnaire: await activateCompanyQuestionnaire(membership.companyId, offerId) });
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof SevenoJobOfferError || error instanceof SevenoCompanyQuestionnaireError || error instanceof CompanyMembershipError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error('[SevenO company questionnaire activation] Unexpected server error', error);
    return NextResponse.json({ error: 'unexpected_error', message: 'L activation du questionnaire a echoue.' }, { status: 500 });
  }
}
