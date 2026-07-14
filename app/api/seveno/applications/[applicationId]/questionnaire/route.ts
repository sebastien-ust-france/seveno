import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  getCandidateApplicationQuestionnaireView,
  startCandidateApplicationQuestionnaire,
  SevenoApplicationQuestionnaireError,
} from '@/lib/seveno-application-questionnaires-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

function toQuestionnaireApiError(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoApplicationQuestionnaireError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }

  console.error('[GET/POST /api/seveno/applications/[applicationId]/questionnaire] Unexpected server error', error);
  return NextResponse.json(
    { error: 'unexpected_error', message: 'Le questionnaire entreprise est temporairement indisponible.' },
    { status: 500 },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    return NextResponse.json(await getCandidateApplicationQuestionnaireView(token.uid, applicationId));
  } catch (error) {
    return toQuestionnaireApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    return NextResponse.json(await startCandidateApplicationQuestionnaire(token.uid, applicationId));
  } catch (error) {
    return toQuestionnaireApiError(error);
  }
}
