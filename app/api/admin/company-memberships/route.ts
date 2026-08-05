import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { upsertCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import type { CompanyMembershipRole, CompanyMembershipStatus } from '@/types/seveno-billing';
import { readJsonBody, toAdminApiErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    if (!body || typeof body.companyId !== 'string' || typeof body.userUid !== 'string' || typeof body.role !== 'string' || typeof body.status !== 'string' || typeof body.reason !== 'string') throw new CompanyMembershipError('invalid_membership', 400, 'Adhésion invalide.');
    const membershipId = await upsertCompanyMembership({ companyId: body.companyId, userUid: body.userUid, role: body.role as CompanyMembershipRole, status: body.status as CompanyMembershipStatus, actorUid: session.user.uid, reason: body.reason });
    return NextResponse.json({ membershipId });
  } catch (error) {
    if (error instanceof CompanyMembershipError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return toAdminApiErrorResponse(error);
  }
}
