import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { listCandidateOffers, SevenoJobApplicationError } from '@/lib/seveno-job-applications-server';
import { toApplicationApiError } from '../applications/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
      throw new SevenoJobApplicationError('invalid_limit', 400, 'La limite demandee est invalide.');
    }
    const payload = await listCandidateOffers(token.uid, {
      limit,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return toApplicationApiError(error);
  }
}
