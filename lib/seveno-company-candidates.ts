'use client';

import { Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type { CandidateSearchFilters, CandidateSearchPage, VisibleCandidateProfile } from '@/types/seveno';

type SerializedVisibleCandidateProfile = Omit<VisibleCandidateProfile, 'sevenoAssessmentCompletedAt'> & {
  sevenoAssessmentCompletedAt: string | null;
  availabilityAvailableFromAt?: string | null;
  availabilityConfirmedAt?: string | null;
  availabilityValidUntil?: string | null;
};

type SerializedCandidateSearchPage = {
  candidates: SerializedVisibleCandidateProfile[];
  nextCursor: string | null;
};

function hydrateVisibleCandidateProfile(profile: SerializedVisibleCandidateProfile): VisibleCandidateProfile {
  const completedAt = profile.sevenoAssessmentCompletedAt ? new Date(profile.sevenoAssessmentCompletedAt) : null;
  const availabilityAvailableFromAt = profile.availabilityAvailableFromAt ? new Date(profile.availabilityAvailableFromAt) : null;
  const availabilityConfirmedAt = profile.availabilityConfirmedAt ? new Date(profile.availabilityConfirmedAt) : null;
  const availabilityValidUntil = profile.availabilityValidUntil ? new Date(profile.availabilityValidUntil) : null;
  if (completedAt && Number.isNaN(completedAt.getTime())) throw new Error("La date de l'evaluation Seven'O est invalide.");
  if (availabilityAvailableFromAt && Number.isNaN(availabilityAvailableFromAt.getTime())) {
    throw new Error("La date de disponibilite future est invalide.");
  }
  if (availabilityConfirmedAt && Number.isNaN(availabilityConfirmedAt.getTime())) {
    throw new Error("La date de confirmation de disponibilite est invalide.");
  }
  if (availabilityValidUntil && Number.isNaN(availabilityValidUntil.getTime())) {
    throw new Error("La date d'expiration de disponibilite est invalide.");
  }

  return {
    ...profile,
    sevenoAssessmentCompletedAt: completedAt ? Timestamp.fromDate(completedAt) : null,
    ...(availabilityAvailableFromAt ? { availabilityAvailableFromAt: Timestamp.fromDate(availabilityAvailableFromAt) } : {}),
    ...(availabilityConfirmedAt ? { availabilityConfirmedAt: Timestamp.fromDate(availabilityConfirmedAt) } : {}),
    ...(availabilityValidUntil ? { availabilityValidUntil: Timestamp.fromDate(availabilityValidUntil) } : {}),
  };
}

export function buildCandidateSearchParams(filters: CandidateSearchFilters) {
  const params = new URLSearchParams({
    sectorId: filters.sectorId,
    jobFamilyId: filters.jobFamilyId,
    jobRoleId: filters.jobRoleId,
  });

  if (filters.locationArea) params.set('locationArea', filters.locationArea);
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel);
  if (filters.minSevenoAssessmentScore !== undefined) {
    params.set('minScore', String(filters.minSevenoAssessmentScore));
  }
  params.set('assessment', filters.assessment ?? 'all');

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
): Promise<VisibleCandidateProfile | null> {
  const payload = await fetchSevenoMatchApi<{ candidate: SerializedVisibleCandidateProfile | null }>(
    authUser,
    `/api/seveno/candidates?publicCandidateId=${encodeURIComponent(publicCandidateId)}`,
  );

  return payload.candidate ? hydrateVisibleCandidateProfile(payload.candidate) : null;
}
