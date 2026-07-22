import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { listAdminRecommendations, SevenoRecommendationError } from '@/lib/seveno-recommendations-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireSevenoAdminSessionFromRequest(request);
    const payload = await listAdminRecommendations();
    return NextResponse.json(payload);
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
      message: error instanceof Error ? error.message : 'La requete admin a echoue.',
    },
    { status: 500 },
  );
}
