import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { CompanyMembershipError, requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { canPurchaseCompanyCredits } from '@/lib/seveno-company-roles';
import { SevenoBillingError } from '@/lib/seveno-billing-server';
import {
  acceptCurrentCompanySalesTerms,
  CURRENT_COMPANY_SALES_TERMS_VERSION,
} from '@/lib/seveno-company-sales-terms-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({
      userUid: token.uid,
      companyId: request.headers.get('x-seveno-company-id'),
      allowedRoles: ['owner', 'admin', 'billing_manager'],
    });
    if (!canPurchaseCompanyCredits(membership)) {
      throw new CompanyMembershipError('credit_purchase_forbidden', 403, 'Vous n’êtes pas autorisé à accepter les CGV commerciales pour cette entreprise.');
    }
    const acceptance = await acceptCurrentCompanySalesTerms({ companyId: membership.companyId, acceptedByUid: token.uid });
    return NextResponse.json({
      termsType: acceptance.termsType,
      version: CURRENT_COMPANY_SALES_TERMS_VERSION,
      acceptedAt: acceptance.acceptedAt.toDate().toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof CompanyMembershipError || error instanceof SevenoBillingError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'company_sales_terms_unavailable', message: 'L’acceptation des CGV n’a pas pu être enregistrée.' }, { status: 500 });
  }
}
