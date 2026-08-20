import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getCandidateOffer } from '@/lib/seveno-job-applications-server';
import { resolvePublicOfferIdBySlugServer } from '@/lib/seveno-public-offers-server';
import { toApplicationApiError } from '../../../applications/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { slug } = await context.params;
    const offerId = await resolvePublicOfferIdBySlugServer(slug);
    if (!offerId) {
      return NextResponse.json(
        { error: 'public_offer_unavailable', message: 'Cette offre n’est plus disponible.' },
        { status: 404 },
      );
    }
    await getCandidateOffer(token.uid, offerId);
    return NextResponse.json({ offerId });
  } catch (error) {
    return toApplicationApiError(error);
  }
}
