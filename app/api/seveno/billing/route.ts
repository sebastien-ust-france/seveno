import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { getCompanyBillingView, SevenoBillingError } from '@/lib/seveno-billing-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'billing_manager', 'viewer'] });
    return NextResponse.json(await getCompanyBillingView(membership.companyId));
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoBillingError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'billing_unavailable', message: 'Facturation indisponible.' }, { status: 500 });
  }
}
