import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import { buildSevenoTermsAcceptancePatch } from '@/lib/seveno-terms-acceptance';
import { SEVENO_TERMS_VERSION } from '@/lib/seveno-terms-version';
import type { TermsAcceptance } from '@/types/seveno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACCEPTANCE_COLLECTION = 'users';

function buildAcceptanceRecord(context: TermsAcceptance['context']): TermsAcceptance {
  if (typeof SEVENO_TERMS_VERSION !== 'string' || SEVENO_TERMS_VERSION.trim().length === 0) {
    throw new SevenoApiAuthError(
      'invalid_terms_version',
      500,
      'La version des CGU n est pas configuree.',
    );
  }

  return {
    cguVersion: SEVENO_TERMS_VERSION,
    context,
    acceptedAt: Timestamp.now(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const user = await getSevenoUserByUid(decodedToken.uid);
    if (!user || (user.role !== 'candidate' && user.role !== 'company')) {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Ce compte ne peut pas enregistrer cette acceptation.');
    }

    const context = user.role === 'candidate'
      ? 'candidate_account'
      : 'company_first_access';
    const acceptance = buildAcceptanceRecord(context);

    if (!adminDb) {
      throw new SevenoApiAuthError(
        'firebase_admin_missing',
        500,
        'Firebase Admin n est pas configure pour enregistrer les acceptations CGU.',
      );
    }

    const ref = adminDb.collection(ACCEPTANCE_COLLECTION).doc(decodedToken.uid);
    await ref.set(buildSevenoTermsAcceptancePatch(context, acceptance), { merge: true });

    return NextResponse.json({ acceptance }, { status: 201 });
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof SevenoMatchRequestError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: 'unexpected_error',
        message: error instanceof Error ? error.message : 'L acceptation des CGU a echoue.',
      },
      { status: 500 },
    );
  }
}
