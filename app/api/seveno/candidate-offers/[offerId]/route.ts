import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { getCandidateOffer } from '@/lib/seveno-job-applications-server';
import { toApplicationApiError } from '../../applications/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ offerId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const token = await requireSevenoApiToken(request);
    const { offerId } = await context.params;
    return NextResponse.json(await getCandidateOffer(token.uid, offerId));
  } catch (error) {
    return toApplicationApiError(error);
  }
}
