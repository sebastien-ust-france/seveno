import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { duplicateJobOffer } from '@/lib/seveno-job-offers-server';
import { toJobOfferApiError } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ offerId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    const offer = await duplicateJobOffer(token.uid, offerId);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}
