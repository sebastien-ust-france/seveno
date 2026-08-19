import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  SevenoApplicationQuestionnaireError,
  getCompanyApplicationQuestionnaireReview,
} from '@/lib/seveno-application-questionnaires-server';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { assertRecruitmentApplicationAccess, SevenoJobOfferError } from '@/lib/seveno-job-offers-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

function toQuestionnaireReviewApiError(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoApplicationQuestionnaireError || error instanceof CompanyMembershipError || error instanceof SevenoJobOfferError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }

  console.error('[GET /api/seveno/applications/[applicationId]/questionnaire/review] Unexpected server error', error);
  return NextResponse.json(
    { error: 'unexpected_error', message: 'Le questionnaire du candidat est temporairement indisponible.' },
    { status: 500 },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const companyUser = await getSevenoUserByUid(token.uid);
    if (!companyUser || companyUser.role !== 'company') {
      return NextResponse.json({ error: 'forbidden_role', message: 'Seules les entreprises peuvent consulter ce questionnaire.' }, { status: 403 });
    }

    const { applicationId } = await context.params;
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'viewer'] });
    await assertRecruitmentApplicationAccess(applicationId, membership);
    return NextResponse.json(await getCompanyApplicationQuestionnaireReview(membership.companyId, applicationId));
  } catch (error) {
    return toQuestionnaireReviewApiError(error);
  }
}
