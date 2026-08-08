import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import { requireActiveCompanyMembership } from '@/lib/seveno-company-memberships-server';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import {
  assertCompanyCanAccessCandidateProfiles,
  getSevenoUserByUid,
  SevenoMatchRequestError,
} from '@/lib/seveno-match-requests';
import {
  searchVisibleCandidateProfiles,
} from '@/lib/seveno-company-candidates-server';
import { loadCompanyCandidateRecommendationBundleByPublicId, SevenoRecommendationError } from '@/lib/seveno-recommendations-server';
import { toMatchApiErrorResponse } from '../matches/_shared';
import type { CandidateAvailability, CandidateExperienceLevel, CandidateSearchFilters } from '@/types/seveno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEARCH_PARAMETERS = new Set([
  'sectorId',
  'jobFamilyId',
  'jobRoleId',
  'locationArea',
  'availability',
  'experienceLevel',
  'cursor',
]);
const AVAILABILITY_VALUES: CandidateAvailability[] = [
  'immediate',
  'less_than_1_month',
  'one_to_three_months',
  'listening',
  'not_available',
];
const EXPERIENCE_VALUES: CandidateExperienceLevel[] = [
  'beginner',
  'intermediate',
  'confirmed',
  'senior',
  'expert',
];

function assertOnlyAllowedParameters(request: NextRequest, allowedParameters: Set<string>) {
  for (const key of request.nextUrl.searchParams.keys()) {
    if (!allowedParameters.has(key)) {
      throw new SevenoMatchRequestError('invalid_search_parameter', 400, 'Un filtre de recherche est invalide.');
    }
  }
}

function readCandidateSearchFilters(request: NextRequest): CandidateSearchFilters {
  const sectorId = request.nextUrl.searchParams.get('sectorId')?.trim() ?? '';
  const jobFamilyId = request.nextUrl.searchParams.get('jobFamilyId')?.trim() ?? '';
  const jobRoleId = request.nextUrl.searchParams.get('jobRoleId')?.trim() ?? '';
  const locationArea = request.nextUrl.searchParams.get('locationArea')?.trim() ?? '';
  const availability = request.nextUrl.searchParams.get('availability')?.trim() ?? '';
  const experienceLevel = request.nextUrl.searchParams.get('experienceLevel')?.trim() ?? '';

  const sector = JOB_SECTORS.find((item) => item.code === sectorId);
  const family = sector?.families.find((item) => item.code === jobFamilyId);
  const role = family?.roles.find((item) => item.code === jobRoleId);
  if (!sector || !family || !role) {
    throw new SevenoMatchRequestError(
      'job_role_required',
      400,
      'Selectionnez un secteur, une famille et un metier precis pour lancer la recherche.',
    );
  }

  if (locationArea.length > 120) {
    throw new SevenoMatchRequestError('invalid_location_area', 400, 'La zone de recrutement est invalide.');
  }

  if (availability && !AVAILABILITY_VALUES.includes(availability as CandidateAvailability)) {
    throw new SevenoMatchRequestError('invalid_availability', 400, 'La disponibilite demandee est invalide.');
  }

  if (experienceLevel && !EXPERIENCE_VALUES.includes(experienceLevel as CandidateExperienceLevel)) {
    throw new SevenoMatchRequestError('invalid_experience_level', 400, 'Le niveau d experience demande est invalide.');
  }

  return {
    sectorId,
    jobFamilyId,
    jobRoleId,
    ...(locationArea ? { locationArea } : {}),
    ...(availability ? { availability: availability as CandidateAvailability } : {}),
    ...(experienceLevel ? { experienceLevel: experienceLevel as CandidateExperienceLevel } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);

    if (!actor || actor.role !== 'company') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seules les entreprises peuvent consulter ces profils.');
    }

    const membership = await requireActiveCompanyMembership({
      userUid: decodedToken.uid,
      companyId: request.headers.get('x-seveno-company-id'),
      allowedRoles: ['owner', 'admin', 'recruiter', 'viewer'],
    });
    await assertCompanyCanAccessCandidateProfiles(membership.companyId);

    const publicCandidateId = request.nextUrl.searchParams.get('publicCandidateId')?.trim() ?? '';
    if (publicCandidateId) {
      assertOnlyAllowedParameters(request, new Set(['publicCandidateId']));
      const bundle = await loadCompanyCandidateRecommendationBundleByPublicId(publicCandidateId);
      return NextResponse.json(bundle);
    }

    assertOnlyAllowedParameters(request, SEARCH_PARAMETERS);
    const filters = readCandidateSearchFilters(request);
    const cursor = request.nextUrl.searchParams.get('cursor');
    const page = await searchVisibleCandidateProfiles(filters, cursor);
    return NextResponse.json(page);
  } catch (error: unknown) {
    const firestoreError = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      stack?: unknown;
    };

    console.error('[GET /api/seveno/candidates] Échec de la recherche', {
      error,
      code: firestoreError.code,
      message: firestoreError.message,
      details: firestoreError.details,
      stack: firestoreError.stack,
    });

    return toCandidateSearchApiErrorResponse(error);
  }
}

function toCandidateSearchApiErrorResponse(error: unknown) {
  if (error instanceof SevenoMatchRequestError || error instanceof SevenoRecommendationError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return toMatchApiErrorResponse(error);
}
