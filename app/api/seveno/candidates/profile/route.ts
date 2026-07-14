import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  createOrUpdateCandidateProfileServer,
  SevenoCandidateProfileError,
} from '@/lib/seveno-candidate-profile-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const body = (await request.json().catch(() => null)) as unknown;
    const result = await createOrUpdateCandidateProfileServer(
      decodedToken.uid,
      body,
      decodedToken.email_verified === true,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof SevenoCandidateProfileError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: 'unexpected_error',
        message: error instanceof Error ? error.message : 'Le profil candidat n a pas pu etre enregistre.',
      },
      { status: 500 },
    );
  }
}
