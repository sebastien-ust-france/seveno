import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { updateAdminCompanyStatus, writeAdminLog } from '@/lib/seveno-admin-service';
import type { CompanyProfileStatus, CompanyVerificationStatus } from '@/types/seveno';
import { readJsonBody, toAdminApiErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPANY_PROFILE_STATUSES: CompanyProfileStatus[] = ['draft', 'active', 'suspended'];
const COMPANY_VERIFICATION_STATUSES: CompanyVerificationStatus[] = ['unverified', 'pending', 'verified', 'rejected'];

export async function PATCH(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const { uid } = await context.params;

    if (!body) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'Le contenu envoye est invalide.',
        },
        { status: 400 },
      );
    }

    const patch: {
      profileStatus?: CompanyProfileStatus;
      verificationStatus?: CompanyVerificationStatus;
    } = {};

    if (typeof body.profileStatus === 'string') {
      if (!COMPANY_PROFILE_STATUSES.includes(body.profileStatus as CompanyProfileStatus)) {
        return NextResponse.json(
          {
            error: 'invalid_profile_status',
            message: 'Le statut entreprise envoye est invalide.',
          },
          { status: 400 },
        );
      }

      patch.profileStatus = body.profileStatus as CompanyProfileStatus;
    }

    if (typeof body.verificationStatus === 'string') {
      if (!COMPANY_VERIFICATION_STATUSES.includes(body.verificationStatus as CompanyVerificationStatus)) {
        return NextResponse.json(
          {
            error: 'invalid_verification_status',
            message: 'Le statut de verification envoye est invalide.',
          },
          { status: 400 },
        );
      }

      patch.verificationStatus = body.verificationStatus as CompanyVerificationStatus;
    }

    if (!patch.profileStatus && !patch.verificationStatus) {
      return NextResponse.json(
        {
          error: 'missing_patch',
          message: 'Aucun statut a mettre a jour.',
        },
        { status: 400 },
      );
    }

    const payload = await updateAdminCompanyStatus(uid, patch);
    await writeAdminLog('company_status_changed', session.user, 'company_profiles', uid, {
      companyUid: uid,
      ...patch,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}
