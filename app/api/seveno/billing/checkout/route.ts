import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { CompanyMembershipError, requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { createStripeCheckout, SevenoStripeError, toStripeErrorResponse, validateCheckoutRequest } from '@/lib/seveno-stripe-server';
import { canPurchaseCompanyCredits } from '@/lib/seveno-company-roles';
import { requireCurrentCompanySalesTermsAcceptance } from '@/lib/seveno-company-sales-terms-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'billing_manager'] });
    if (!canPurchaseCompanyCredits(membership)) {
      throw new CompanyMembershipError('credit_purchase_forbidden', 403, 'Le propriétaire de l’entreprise ne vous autorise pas à acheter des crédits.');
    }
    await requireCurrentCompanySalesTermsAcceptance(membership.companyId);
    const body = validateCheckoutRequest(await request.json().catch(() => null));
    const result = await createStripeCheckout({ companyId: membership.companyId, actorUid: token.uid, ...(token.email_verified && token.email ? { actorEmail: token.email } : {}), actorRole: membership.role, companyProfile: membership.profile, ...body });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof CompanyMembershipError || error instanceof SevenoStripeError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    const response = toStripeErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
