import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { CompanyMembershipError, requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { getCompanyOrderStatus, SevenoStripeError } from '@/lib/seveno-stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'billing_manager', 'viewer'] });
    const { orderId } = await context.params;
    if (!/^[a-f0-9]{40}$/.test(orderId)) return NextResponse.json({ error: 'invalid_order_id', message: 'Commande invalide.' }, { status: 422 });
    return NextResponse.json(await getCompanyOrderStatus(membership.companyId, orderId));
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof CompanyMembershipError || error instanceof SevenoStripeError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'billing_unavailable', message: 'Facturation indisponible.' }, { status: 500 });
  }
}
