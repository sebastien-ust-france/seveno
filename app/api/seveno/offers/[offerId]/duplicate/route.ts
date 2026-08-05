import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { duplicateJobOffer } from '@/lib/seveno-job-offers-server';
import { toJobOfferApiError } from '../../_shared';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ offerId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    const { offerId } = await context.params;
    const offer = await duplicateJobOffer(membership.companyId, offerId);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}
