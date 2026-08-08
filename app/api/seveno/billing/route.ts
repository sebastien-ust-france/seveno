import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import { getCompanyBillingView, SevenoBillingError } from '@/lib/seveno-billing-server';
import { canPurchaseCompanyCredits } from '@/lib/seveno-company-roles';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'billing_manager', 'viewer'] });
    const billing = await getCompanyBillingView(membership.companyId);
    let campaigns = billing.campaigns;
    if (membership.role === 'recruiter') {
      if (!adminDb) throw new Error('Firebase Admin indisponible.');
      const offers = await adminDb.collection('job_offers').where('companyUid', '==', membership.companyId).where('assignedToUid', '==', membership.userUid).get();
      const offerIds = new Set(offers.docs.map((offer) => offer.id));
      campaigns = campaigns.filter((campaign) => offerIds.has(String((campaign as { offerId?: unknown }).offerId ?? '')));
    } else if (membership.role === 'billing_manager' || membership.role === 'viewer') {
      campaigns = [];
    }
    return NextResponse.json({
      ...billing,
      campaigns,
      membershipRole: membership.role,
      canPurchaseCredits: canPurchaseCompanyCredits(membership),
    });
  } catch (error) {
    if (error instanceof CompanyMembershipError || error instanceof SevenoBillingError || error instanceof SevenoApiAuthError) return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ error: 'billing_unavailable', message: 'Facturation indisponible.' }, { status: 500 });
  }
}
