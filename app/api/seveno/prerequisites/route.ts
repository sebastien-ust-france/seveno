import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
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
import type { CompanyPrerequisiteCreationInput } from '@/types/seveno-prerequisites';

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
    const membership = await requireActiveCompanyMembership({ userUid: decodedToken.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter', 'viewer'] });
    await assertCompanyCanAccessCandidateProfiles(membership.companyId);
    const jobRoleId = request.nextUrl.searchParams.get('jobRoleId')?.trim() ?? '';
    const offerId = request.nextUrl.searchParams.get('offerId')?.trim() ?? '';
    const query = request.nextUrl.searchParams.get('query')?.trim() ?? '';
    const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(limitParam) ? limitParam : 20;
    if (!jobRoleId) throw new SevenoPrerequisiteError('job_role_required', 400, 'Selectionnez un metier precis.');
    const prerequisites = await listApplicablePrerequisites(jobRoleId, {
      companyUid: membership.companyId,
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
      || error instanceof CompanyMembershipError
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
    const membership = await requireActiveCompanyMembership({ userUid: decodedToken.uid, companyId: request.headers.get('x-seveno-company-id'), allowedRoles: ['owner', 'admin', 'recruiter'] });
    await assertCompanyCanAccessCandidateProfiles(membership.companyId);

    const body = await request.json().catch(() => null);
    if (!isPlainObject(body)) {
      throw new SevenoPrerequisiteError('invalid_prerequisite', 400, 'Le prerequis est invalide.');
    }

    const offerId = typeof body.offerId === 'string' ? body.offerId.trim() : '';
    if (!offerId) {
      throw new SevenoPrerequisiteError('offer_required', 400, 'Enregistrez l offre avant de creer un prerequis personnalise.');
    }
    const companyLabel = typeof body.companyLabel === 'string' ? body.companyLabel.trim() : '';
    if (!companyLabel) {
      throw new SevenoPrerequisiteError('invalid_prerequisite_label', 400, 'Saisissez le nom du prerequis.');
    }
    const candidateQuestion = typeof body.candidateQuestion === 'string' ? body.candidateQuestion.trim() : '';
    if (!candidateQuestion) {
      throw new SevenoPrerequisiteError('invalid_candidate_question', 400, 'Saisissez la question présentée au candidat.');
    }
    const candidateHelp = typeof body.candidateHelp === 'string' ? body.candidateHelp.trim() : '';

    const saveToLibrary = body.saveToLibrary === true;
    const offer = await getJobOffer(membership.companyId, offerId);
    const definition = await createCompanyPrerequisite(membership.companyId, offer, {
      offerId,
      prerequisiteFamily: body.prerequisiteFamily as CompanyPrerequisiteCreationInput['prerequisiteFamily'],
      ...(body.offerRequirementCategory ? { offerRequirementCategory: body.offerRequirementCategory as CompanyPrerequisiteCreationInput['offerRequirementCategory'] } : {}),
      companyLabel,
      candidateQuestion,
      ...(candidateHelp ? { candidateHelp } : {}),
      answerType: body.answerType as CompanyPrerequisiteCreationInput['answerType'],
      options: Array.isArray(body.options) ? body.options as CompanyPrerequisiteCreationInput['options'] : [],
      expectedCriterion: body.expectedCriterion as CompanyPrerequisiteCreationInput['expectedCriterion'],
      comparisonOperator: body.comparisonOperator as CompanyPrerequisiteCreationInput['comparisonOperator'],
      saveToLibrary,
    });
    return NextResponse.json({ definition }, { status: 201 });
  } catch (error) {
    if (
      error instanceof SevenoApiAuthError
      || error instanceof SevenoMatchRequestError
      || error instanceof SevenoPrerequisiteError
      || error instanceof CompanyMembershipError
    ) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'unexpected_error', message: 'La creation du prerequis est temporairement indisponible.' },
      { status: 500 },
    );
  }
}
