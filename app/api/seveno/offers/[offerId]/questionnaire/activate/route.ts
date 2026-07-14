import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  activateCompanyQuestionnaire,
  SevenoCompanyQuestionnaireError,
} from '@/lib/seveno-company-questionnaires-server';
import { SevenoJobOfferError } from '@/lib/seveno-job-offers-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ offerId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    return NextResponse.json({ questionnaire: await activateCompanyQuestionnaire(token.uid, offerId) });
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof SevenoJobOfferError || error instanceof SevenoCompanyQuestionnaireError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    console.error('[SevenO company questionnaire activation] Unexpected server error', error);
    return NextResponse.json({ error: 'unexpected_error', message: 'L activation du questionnaire a echoue.' }, { status: 500 });
  }
}
