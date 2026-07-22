import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { getJobOffer } from '@/lib/seveno-job-offers-server';
import {
  assertCompanyCanAccessCandidateProfiles,
  getSevenoUserByUid,
  SevenoMatchRequestError,
} from '@/lib/seveno-match-requests';
import {
  createCompanyPrerequisite,
  listApplicablePrerequisites,
  SevenoPrerequisiteError,
} from '@/lib/seveno-prerequisites-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'company') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seules les entreprises peuvent consulter cette bibliotheque.');
    }
    await assertCompanyCanAccessCandidateProfiles(decodedToken.uid);
    const jobRoleId = request.nextUrl.searchParams.get('jobRoleId')?.trim() ?? '';
    const offerId = request.nextUrl.searchParams.get('offerId')?.trim() ?? '';
    const query = request.nextUrl.searchParams.get('query')?.trim() ?? '';
    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(limitParam) ? limitParam : 20;
    if (!jobRoleId) throw new SevenoPrerequisiteError('job_role_required', 400, 'Selectionnez un metier precis.');
    const prerequisites = await listApplicablePrerequisites(jobRoleId, {
      companyUid: decodedToken.uid,
      ...(offerId ? { offerId } : {}),
      ...(query ? { query } : {}),
      limit,
    });
    return NextResponse.json({ prerequisites });
  } catch (error) {
    if (
      error instanceof SevenoApiAuthError
      || error instanceof SevenoMatchRequestError
      || error instanceof SevenoPrerequisiteError
    ) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'unexpected_error', message: 'La bibliotheque de prerequis est temporairement indisponible.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'company') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seules les entreprises peuvent creer un prerequis personnalise.');
    }
    await assertCompanyCanAccessCandidateProfiles(decodedToken.uid);

    const body = await request.json().catch(() => null);
    if (!isPlainObject(body)) {
      throw new SevenoPrerequisiteError('invalid_prerequisite', 400, 'Le prerequis est invalide.');
    }

    const offerId = typeof body.offerId === 'string' ? body.offerId.trim() : '';
    if (!offerId) {
      throw new SevenoPrerequisiteError('offer_required', 400, 'Enregistrez l offre avant de creer un prerequis personnalise.');
    }
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) {
      throw new SevenoPrerequisiteError('invalid_prerequisite_label', 400, 'Saisissez le nom du prerequis.');
    }
    const candidateHelp = typeof body.candidateHelp === 'string' ? body.candidateHelp.trim() : '';

    const saveToLibrary = body.saveToLibrary === true;
    const offer = await getJobOffer(decodedToken.uid, offerId);
    const definition = await createCompanyPrerequisite(decodedToken.uid, offer, {
      offerId,
      label,
      ...(candidateHelp ? { candidateHelp } : {}),
      saveToLibrary,
    });
    return NextResponse.json({ definition }, { status: 201 });
  } catch (error) {
    if (
      error instanceof SevenoApiAuthError
      || error instanceof SevenoMatchRequestError
      || error instanceof SevenoPrerequisiteError
    ) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'unexpected_error', message: 'La creation du prerequis est temporairement indisponible.' },
      { status: 500 },
    );
  }
}
