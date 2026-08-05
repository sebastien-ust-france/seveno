import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  deleteJobOffer,
  getJobOffer,
  SevenoJobOfferError,
  updateJobOffer,
} from '@/lib/seveno-job-offers-server';
import { readOfferJsonBody, toJobOfferApiError } from '../_shared';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ offerId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id') });
    const { offerId } = await context.params;
    const offer = await getJobOffer(membership.companyId, offerId);
    return NextResponse.json({ offer });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    const { offerId } = await context.params;
    await deleteJobOffer(membership.companyId, offerId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    const { offerId } = await context.params;
    const body = await readOfferJsonBody(request);
    if (!body) throw new SevenoJobOfferError('invalid_offer', 400, 'Le contenu de l offre est invalide.');
    const offer = await updateJobOffer(membership.companyId, offerId, body);
    return NextResponse.json({ offer });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}
