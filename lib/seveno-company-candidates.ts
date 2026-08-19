'use client';

import { Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type {
  CandidateRecommendationPublicBundle,
  CandidateSearchFilters,
  CandidateSearchPage,
  VisibleCandidateProfile,
} from '@/types/seveno';

type SerializedVisibleCandidateProfile = Omit<VisibleCandidateProfile, 'availabilityAvailableFromAt' | 'availabilityConfirmedAt' | 'availabilityValidUntil'> & {
  availabilityAvailableFromAt?: string | null;
  availabilityConfirmedAt?: string | null;
  availabilityValidUntil?: string | null;
};

type SerializedCandidateSearchPage = {
  candidates: SerializedVisibleCandidateProfile[];
  nextCursor: string | null;
};

type SerializedCompanyCandidateRecommendationBundle = {
  candidate: SerializedVisibleCandidateProfile | null;
  recommendations: CandidateRecommendationPublicBundle['recommendations'];
};

function hydrateVisibleCandidateProfile(profile: SerializedVisibleCandidateProfile): VisibleCandidateProfile {
  const availabilityAvailableFromAt = profile.availabilityAvailableFromAt ? new Date(profile.availabilityAvailableFromAt) : null;
  const availabilityConfirmedAt = profile.availabilityConfirmedAt ? new Date(profile.availabilityConfirmedAt) : null;
  const availabilityValidUntil = profile.availabilityValidUntil ? new Date(profile.availabilityValidUntil) : null;
  if (availabilityAvailableFromAt && Number.isNaN(availabilityAvailableFromAt.getTime())) {
    throw new Error("La date de disponibilite future est invalide.");
  }
  if (availabilityConfirmedAt && Number.isNaN(availabilityConfirmedAt.getTime())) {
    throw new Error("La date de confirmation de disponibilite est invalide.");
  }
  if (availabilityValidUntil && Number.isNaN(availabilityValidUntil.getTime())) {
    throw new Error("La date d'expiration de disponibilite est invalide.");
  }

  const hydratedProfile = { ...profile } as VisibleCandidateProfile;

  if (availabilityAvailableFromAt) {
    hydratedProfile.availabilityAvailableFromAt = Timestamp.fromDate(availabilityAvailableFromAt);
  } else {
    delete hydratedProfile.availabilityAvailableFromAt;
  }

  if (availabilityConfirmedAt) {
    hydratedProfile.availabilityConfirmedAt = Timestamp.fromDate(availabilityConfirmedAt);
  } else {
    delete hydratedProfile.availabilityConfirmedAt;
  }

  if (availabilityValidUntil) {
    hydratedProfile.availabilityValidUntil = Timestamp.fromDate(availabilityValidUntil);
  } else {
    delete hydratedProfile.availabilityValidUntil;
  }

  return hydratedProfile;
}

export function buildCandidateSearchParams(filters: CandidateSearchFilters) {
  const params = new URLSearchParams({
    sectorId: filters.sectorId,
    jobFamilyId: filters.jobFamilyId,
    jobRoleId: filters.jobRoleId,
  });

  if (filters.locationArea) params.set('locationArea', filters.locationArea);
  if (filters.countryCode) params.set('countryCode', filters.countryCode);
  if (filters.administrativeAreaCode) params.set('administrativeAreaCode', filters.administrativeAreaCode);
  if (filters.city) params.set('city', filters.city);
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel);

  return params;
}

export async function searchVisibleCandidateProfiles(
  authUser: User,
  filters: CandidateSearchFilters,
  cursor?: string | null,
): Promise<CandidateSearchPage> {
  const params = buildCandidateSearchParams(filters);
  if (cursor) params.set('cursor', cursor);

  const payload = await fetchSevenoMatchApi<SerializedCandidateSearchPage>(
    authUser,
    `/api/seveno/candidates?${params.toString()}`,
  );

  return {
    candidates: payload.candidates.map(hydrateVisibleCandidateProfile),
    nextCursor: payload.nextCursor,
  };
}

export async function getVisibleCandidateProfileByPublicId(
  authUser: User,
  publicCandidateId: string,
): Promise<CandidateRecommendationPublicBundle> {
  const payload = await fetchSevenoMatchApi<SerializedCompanyCandidateRecommendationBundle>(
    authUser,
    `/api/seveno/candidates?publicCandidateId=${encodeURIComponent(publicCandidateId)}`,
  );

  return {
    candidate: payload.candidate ? hydrateVisibleCandidateProfile(payload.candidate) : null,
    recommendations: payload.recommendations,
  };
}
