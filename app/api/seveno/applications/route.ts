import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  beginJobApplication,
  listCandidateApplications,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { readApplicationBody, toApplicationApiError } from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
      throw new SevenoJobApplicationError('invalid_limit', 400, 'La limite demandee est invalide.');
    }
    return NextResponse.json(await listCandidateApplications(token.uid, {
      limit,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
    }));
  } catch (error) {
    return toApplicationApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const body = await readApplicationBody(request);
    const offerId = typeof body?.offerId === 'string' ? body.offerId.trim() : '';
    if (!offerId) throw new SevenoJobApplicationError('offer_id_required', 400, 'L offre est obligatoire.');
    const application = await beginJobApplication(token.uid, offerId);
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    return toApplicationApiError(error);
  }
}
