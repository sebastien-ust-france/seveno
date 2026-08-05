import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { listCompanyQuestionnaires, SevenoCompanyQuestionnaireError } from '@/lib/seveno-company-questionnaires-server';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id') });
    return NextResponse.json(await listCompanyQuestionnaires(membership.companyId, token.uid));
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof SevenoCompanyQuestionnaireError || error instanceof CompanyMembershipError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error('[SevenO company questionnaires] Unexpected server error', error);
    return NextResponse.json(
      { error: 'unexpected_error', message: 'Les questionnaires sont temporairement indisponibles.' },
      { status: 500 },
    );
  }
}
