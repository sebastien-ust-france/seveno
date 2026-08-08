import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { reassignJobOffer, SevenoJobOfferError } from '@/lib/seveno-job-offers-server';
import { toJobOfferApiError } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ offerId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin'] });
    const body = await request.json().catch(() => null) as { targetUid?: unknown } | null;
    if (typeof body?.targetUid !== 'string' || !body.targetUid.trim()) throw new SevenoJobOfferError('invalid_assignee', 400, 'Sélectionnez un responsable.');
    const { offerId } = await context.params;
    return NextResponse.json({ offer: await reassignJobOffer(membership.companyId, offerId, { uid: token.uid, role: membership.role }, body.targetUid.trim()) });
  } catch (error) { return toJobOfferApiError(error); }
}
