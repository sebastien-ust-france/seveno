import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requireAdminDatabase() {
  if (!adminDb) {
    throw new SevenoApiAuthError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour finaliser l onboarding candidat.',
    );
  }

  return adminDb;
}

function toErrorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoMatchRequestError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'La validation de l onboarding candidat a echoue.',
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const user = await getSevenoUserByUid(decodedToken.uid);
    if (!user || user.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent valider leur onboarding.');
    }

    const firestore = requireAdminDatabase();
    await firestore.collection('users').doc(decodedToken.uid).set(
      {
        onboardingCompleted: true,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    return NextResponse.json({ onboardingCompleted: true }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
