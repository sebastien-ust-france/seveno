import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  changeJobOfferStatus,
  SevenoJobOfferError,
} from '@/lib/seveno-job-offers-server';
import type { JobOfferStatusAction } from '@/types/seveno-job-offers';
import { readOfferJsonBody, toJobOfferApiError } from '../../_shared';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS: JobOfferStatusAction[] = ['publish', 'pause', 'reactivate', 'close', 'archive', 'restore'];
type RouteContext = { params: Promise<{ offerId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    const { offerId } = await context.params;
    const body = await readOfferJsonBody(request);
    const action = body?.action;
    if (typeof action !== 'string' || !ACTIONS.includes(action as JobOfferStatusAction)) {
      throw new SevenoJobOfferError('invalid_status_action', 400, 'L action demandee est invalide.');
    }
    const offer = await changeJobOfferStatus(membership.companyId, offerId, action as JobOfferStatusAction, { uid: token.uid, membershipRole: membership.role });
    return NextResponse.json({ offer });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}
