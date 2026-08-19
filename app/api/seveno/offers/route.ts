import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  createJobOffer,
  listJobOffers,
  SevenoJobOfferError,
} from '@/lib/seveno-job-offers-server';
import type { JobOfferStatus } from '@/types/seveno-job-offers';
import { readOfferJsonBody, toJobOfferApiError } from './_shared';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: JobOfferStatus[] = ['draft', 'published', 'paused', 'closed', 'archived'];

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'viewer'] });
    const requestedScope = request.nextUrl.searchParams.get('scope') ?? 'mine';
    if (!['mine', 'company'].includes(requestedScope)) throw new SevenoJobOfferError('invalid_scope', 400, 'La vue demandée est invalide.');
    if (requestedScope === 'company' && !['owner', 'admin', 'viewer'].includes(membership.role)) throw new SevenoJobOfferError('forbidden_scope', 403, 'La vue entreprise n’est pas autorisée pour ce rôle.');
    const assigneeUid = request.nextUrl.searchParams.get('assignedToUid')?.trim() ?? '';
    if (assigneeUid && requestedScope !== 'company') throw new SevenoJobOfferError('invalid_assignee_filter', 400, 'Le filtre responsable exige la vue entreprise.');
    if (assigneeUid && !['owner', 'admin'].includes(membership.role)) throw new SevenoJobOfferError('forbidden_assignee_filter', 403, 'Ce filtre n’est pas autorisé pour ce rôle.');
    const statusValue = request.nextUrl.searchParams.get('status')?.trim() ?? '';
    const status = statusValue && STATUSES.includes(statusValue as JobOfferStatus)
      ? statusValue as JobOfferStatus
      : undefined;
    if (statusValue && !status) throw new SevenoJobOfferError('invalid_status', 400, 'Le statut demande est invalide.');
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 30);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new SevenoJobOfferError('invalid_limit', 400, 'La limite demandee est invalide.');
    }
    const payload = await listJobOffers(membership.companyId, {
      ...(status ? { status } : {}),
      ...(requestedScope === 'mine' ? { assignedToUid: token.uid } : assigneeUid ? { assignedToUid: assigneeUid } : {}),
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
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    const body = await readOfferJsonBody(request);
    if (!body) throw new SevenoJobOfferError('invalid_offer', 400, 'Le contenu de l offre est invalide.');
    const offer = await createJobOffer(membership.companyId, body, token.uid);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return toJobOfferApiError(error);
  }
}
