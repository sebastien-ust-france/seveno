import { NextRequest, NextResponse } from 'next/server';
import {
  loadPublicRecommendationInvitation,
  submitRecommendationByToken,
  SevenoRecommendationError,
} from '@/lib/seveno-recommendations-server';
import { readJsonBody } from '../../../matches/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const bundle = await loadPublicRecommendationInvitation(token);
    if (!bundle) {
      return NextResponse.json(
        { error: 'invitation_not_found', message: 'Le lien de recommandation est invalide.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      invitation: bundle.invitation,
      candidate: bundle.candidate,
      recommendations: [],
    });
  } catch (error) {
    return toRecommendationApiErrorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await readJsonBody(request);
    if (!body) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Le contenu envoye est invalide.' },
        { status: 400 },
      );
    }

    const result = await submitRecommendationByToken(token, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toRecommendationApiErrorResponse(error);
  }
}

function toRecommendationApiErrorResponse(error: unknown) {
  if (error instanceof SevenoRecommendationError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'La requete a echoue.',
    },
    { status: 500 },
  );
}
