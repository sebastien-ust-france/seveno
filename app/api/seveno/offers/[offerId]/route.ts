import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  deleteJobOffer,
  getJobOffer,
  SevenoJobOfferError,
  updateJobOffer,
} from '@/lib/seveno-job-offers-server';
import { readOfferJsonBody, toJobOfferApiError } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ offerId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    const offer = await getJobOffer(token.uid, offerId);
    return NextResponse.json({ offer });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    await deleteJobOffer(token.uid, offerId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    const body = await readOfferJsonBody(request);
    if (!body) throw new SevenoJobOfferError('invalid_offer', 400, 'Le contenu de l offre est invalide.');
    const offer = await updateJobOffer(token.uid, offerId, body);
    return NextResponse.json({ offer });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}
