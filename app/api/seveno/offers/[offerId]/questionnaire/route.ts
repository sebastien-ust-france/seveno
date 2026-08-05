import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  getCompanyQuestionnairePromptContext,
  saveCompanyQuestionnaire,
  SevenoCompanyQuestionnaireError,
} from '@/lib/seveno-company-questionnaires-server';
import { SevenoJobOfferError } from '@/lib/seveno-job-offers-server';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ offerId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoJobOfferError || error instanceof SevenoCompanyQuestionnaireError || error instanceof CompanyMembershipError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error('[SevenO company questionnaire] Unexpected server error', error);
  return NextResponse.json({ error: 'unexpected_error', message: 'Le questionnaire est temporairement indisponible.' }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id') });
    const { offerId } = await context.params;
    return NextResponse.json(await getCompanyQuestionnairePromptContext(membership.companyId, offerId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    const { offerId } = await context.params;
    const body = await request.json().catch(() => null) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new SevenoCompanyQuestionnaireError('invalid_questionnaire', 400, 'Le questionnaire est invalide.');
    }
    return NextResponse.json({ questionnaire: await saveCompanyQuestionnaire(membership.companyId, offerId, body) });
  } catch (error) {
    return errorResponse(error);
  }
}
