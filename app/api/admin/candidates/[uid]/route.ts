import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import {
  getAdminCandidateDetail,
  updateAdminCandidateStatus,
  writeAdminLog,
} from '@/lib/seveno-admin-service';
import type { CandidateProfileStatus } from '@/types/seveno';
import { readJsonBody, toAdminApiErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANDIDATE_PROFILE_STATUSES: CandidateProfileStatus[] = ['draft', 'active', 'paused'];

export async function GET(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const { uid } = await context.params;
    const payload = await getAdminCandidateDetail(uid);

    if (payload.candidate || payload.user || payload.privateIdentity) {
      await writeAdminLog('candidate_private_viewed', session.user, 'users', uid, {
        candidateUid: uid,
        publicCandidateId: payload.candidate?.publicCandidateId ?? null,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);

    if (!body) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'Le contenu envoye est invalide.',
        },
        { status: 400 },
      );
    }

    const { uid } = await context.params;
    const profileStatus = body.profileStatus;
    if (typeof profileStatus !== 'string' || !CANDIDATE_PROFILE_STATUSES.includes(profileStatus as CandidateProfileStatus)) {
      return NextResponse.json(
        {
          error: 'invalid_profile_status',
          message: 'Le statut candidat envoye est invalide.',
        },
        { status: 400 },
      );
    }

    const payload = await updateAdminCandidateStatus(uid, profileStatus as CandidateProfileStatus);
    await writeAdminLog('candidate_profile_status_changed', session.user, 'candidate_profiles', uid, {
      candidateUid: uid,
      profileStatus,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}
