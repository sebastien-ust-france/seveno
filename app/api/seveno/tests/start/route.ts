import { NextRequest, NextResponse } from 'next/server';
import { SevenoApiAuthError, requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { loadLegacyAssessmentSummary } from '@/lib/seveno-legacy-assessment';
import { SevenoTestError } from '@/lib/seveno-tests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toErrorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoTestError || error instanceof SevenoMatchRequestError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.',
    },
    {
      status: 500,
    },
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireSevenoApiToken(request);
    return NextResponse.json(
      {
        error: 'legacy_assessment_read_only',
        message: "L'ancien questionnaire Seven'O est disponible en lecture seule.",
      },
      { status: 409 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent consulter cet historique.');
    }

    const assessment = await loadLegacyAssessmentSummary(decodedToken.uid);
    return NextResponse.json({
      assessment: assessment
        ? {
            status: assessment.status,
            overallScore: assessment.overallScore,
            questionnaireVersion: assessment.questionnaireVersion,
            completedAt: assessment.completedAt.toDate().toISOString(),
          }
        : null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
