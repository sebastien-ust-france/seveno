import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  getCompanyQuestionnaire,
  saveCompanyQuestionnaire,
  SevenoCompanyQuestionnaireError,
} from '@/lib/seveno-company-questionnaires-server';
import { SevenoJobOfferError } from '@/lib/seveno-job-offers-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ offerId: string }> };

function errorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoJobOfferError || error instanceof SevenoCompanyQuestionnaireError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error('[SevenO company questionnaire] Unexpected server error', error);
  return NextResponse.json({ error: 'unexpected_error', message: 'Le questionnaire est temporairement indisponible.' }, { status: 500 });
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    return NextResponse.json({ questionnaire: await getCompanyQuestionnaire(token.uid, offerId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    const body = await request.json().catch(() => null) as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new SevenoCompanyQuestionnaireError('invalid_questionnaire', 400, 'Le questionnaire est invalide.');
    }
    return NextResponse.json({ questionnaire: await saveCompanyQuestionnaire(token.uid, offerId, body) });
  } catch (error) {
    return errorResponse(error);
  }
}
