import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  createJobOffer,
  listJobOffers,
  SevenoJobOfferError,
} from '@/lib/seveno-job-offers-server';
import type { JobOfferStatus } from '@/types/seveno-job-offers';
import { readOfferJsonBody, toJobOfferApiError } from './_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: JobOfferStatus[] = ['draft', 'published', 'paused', 'closed', 'archived'];

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const statusValue = request.nextUrl.searchParams.get('status')?.trim() ?? '';
    const status = statusValue && STATUSES.includes(statusValue as JobOfferStatus)
      ? statusValue as JobOfferStatus
      : undefined;
    if (statusValue && !status) throw new SevenoJobOfferError('invalid_status', 400, 'Le statut demande est invalide.');
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 30);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new SevenoJobOfferError('invalid_limit', 400, 'La limite demandee est invalide.');
    }
    const payload = await listJobOffers(token.uid, {
      ...(status ? { status } : {}),
      limit,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return toJobOfferApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const body = await readOfferJsonBody(request);
    if (!body) throw new SevenoJobOfferError('invalid_offer', 400, 'Le contenu de l offre est invalide.');
    const offer = await createJobOffer(token.uid, body);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}
