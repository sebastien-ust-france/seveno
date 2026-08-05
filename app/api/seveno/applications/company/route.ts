import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  createCompanyApplicationInvitation,
  listCompanyApplications,
  SevenoJobApplicationError,
} from '@/lib/seveno-job-applications-server';
import { readApplicationBody, toApplicationApiError } from '../_shared';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(token.uid);
    if (!actor || actor.role !== 'company') {
      throw new SevenoJobApplicationError('forbidden_role', 403, 'Seules les entreprises peuvent consulter ces relations.');
    }
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
      throw new SevenoJobApplicationError('invalid_limit', 400, 'La limite demandee est invalide.');
    }

    const publicCandidateId = request.nextUrl.searchParams.get('publicCandidateId')?.trim() ?? '';
    const offerId = request.nextUrl.searchParams.get('offerId')?.trim() ?? '';
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id') });
    const payload = await listCompanyApplications(membership.companyId, {
      limit,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
      ...(publicCandidateId ? { publicCandidateId } : {}),
      ...(offerId ? { offerId } : {}),
    }, token.uid);

    return NextResponse.json(payload);
  } catch (error) {
    return toApplicationApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(token.uid);
    if (!actor || actor.role !== 'company') {
      throw new SevenoJobApplicationError('forbidden_role', 403, 'Seules les entreprises peuvent creer une invitation.');
    }
    const membership = await requireActiveCompanyMembership({ userUid: token.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });

    const body = await readApplicationBody(request);
    if (!body) {
      throw new SevenoJobApplicationError('invalid_payload', 400, 'Le contenu envoye est invalide.');
    }

    const offerId = typeof body.offerId === 'string' ? body.offerId.trim() : '';
    const publicCandidateId = typeof body.publicCandidateId === 'string' ? body.publicCandidateId.trim() : '';
    const message = typeof body.message === 'string' ? body.message : undefined;

    if (!offerId) {
      throw new SevenoJobApplicationError('offer_id_required', 400, 'L offre est obligatoire.');
    }
    if (!publicCandidateId) {
      throw new SevenoJobApplicationError('public_candidate_id_required', 400, 'L identifiant public du candidat est obligatoire.');
    }

    const application = await createCompanyApplicationInvitation({
      companyUid: membership.companyId,
      actorUid: token.uid,
      offerId,
      publicCandidateId,
      ...(message ? { message } : {}),
    });

    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    return toApplicationApiError(error);
  }
}
