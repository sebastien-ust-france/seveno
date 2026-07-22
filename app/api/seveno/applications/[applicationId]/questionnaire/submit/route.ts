import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  submitCandidateApplicationQuestionnaire,
  SevenoApplicationQuestionnaireError,
} from '@/lib/seveno-application-questionnaires-server';
import { readApplicationBody } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ applicationId: string }> };

function toQuestionnaireApiError(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoApplicationQuestionnaireError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }

  console.error('[POST /api/seveno/applications/[applicationId]/questionnaire/submit] Unexpected server error', error);
  return NextResponse.json(
    { error: 'unexpected_error', message: 'Le questionnaire entreprise est temporairement indisponible.' },
    { status: 500 },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { applicationId } = await context.params;
    const body = await readApplicationBody(request);
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      throw new SevenoApplicationQuestionnaireError('invalid_session_id', 400, 'La session du questionnaire est invalide.');
    }

    const answers = typeof body?.questionId === 'string'
      ? body
      : body?.answers ?? body;
    return NextResponse.json(
      await submitCandidateApplicationQuestionnaire(token.uid, applicationId, sessionId, answers),
    );
  } catch (error) {
    return toQuestionnaireApiError(error);
  }
}
