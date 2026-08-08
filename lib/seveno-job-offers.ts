'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type {
  JobOfferInput,
  JobOfferListPage,
  JobOfferStatus,
  JobOfferStatusAction,
  SerializedJobOffer,
} from '@/types/seveno-job-offers';
import type { CompanyPrerequisiteCreationInput, CompanyPrerequisiteDefinition } from '@/types/seveno-prerequisites';
import { companyHeaders } from '@/lib/seveno-billing-client';

export async function listCompanyJobOffers(
  authUser: User,
  options: { status?: JobOfferStatus; cursor?: string | null; scope?: 'mine' | 'company'; assignedToUid?: string } = {},
) {
  const params = new URLSearchParams({ limit: '30' });
  if (options.status) params.set('status', options.status);
  if (options.cursor) params.set('cursor', options.cursor);
  params.set('scope', options.scope ?? 'mine');
  if (options.assignedToUid) params.set('assignedToUid', options.assignedToUid);
  return fetchSevenoMatchApi<JobOfferListPage>(authUser, `/api/seveno/offers?${params.toString()}`, { headers: companyHeaders() });
}

export async function reassignCompanyJobOffer(authUser: User, offerId: string, targetUid: string) {
  return fetchSevenoMatchApi<{ offer: SerializedJobOffer }>(authUser, `/api/seveno/offers/${encodeURIComponent(offerId)}/assignee`, {
    method: 'PATCH', headers: companyHeaders(), body: JSON.stringify({ targetUid }),
  });
}

export async function getCompanyJobOffer(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ offer: SerializedJobOffer }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}`, { headers: companyHeaders() },
  );
}

export async function saveCompanyJobOffer(authUser: User, input: JobOfferInput, offerId?: string) {
  return fetchSevenoMatchApi<{ offer: SerializedJobOffer }>(
    authUser,
    offerId ? `/api/seveno/offers/${encodeURIComponent(offerId)}` : '/api/seveno/offers',
    { method: offerId ? 'PATCH' : 'POST', body: JSON.stringify(input), headers: companyHeaders() },
  );
}

export async function changeCompanyJobOfferStatus(
  authUser: User,
  offerId: string,
  action: JobOfferStatusAction,
) {
  return fetchSevenoMatchApi<{ offer: SerializedJobOffer }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/status`,
    { method: 'POST', body: JSON.stringify({ action }), headers: companyHeaders() },
  );
}

export async function duplicateCompanyJobOffer(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ offer: SerializedJobOffer }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/duplicate`,
    { method: 'POST', headers: companyHeaders() },
  );
}

export async function deleteCompanyJobOffer(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ deleted: true }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}`,
    { method: 'DELETE', headers: companyHeaders() },
  );
}

export async function listApplicableOfferPrerequisites(
  authUser: User,
  jobRoleId: string,
  options: { offerId?: string; query?: string; limit?: number } = {},
) {
  const params = new URLSearchParams({ jobRoleId });
  if (options.offerId) params.set('offerId', options.offerId);
  if (options.query) params.set('query', options.query);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  return fetchSevenoMatchApi<{ prerequisites: CompanyPrerequisiteDefinition[] }>(
    authUser,
    `/api/seveno/prerequisites?${params.toString()}`,
  );
}

export async function createCompanyPrerequisiteClient(
  authUser: User,
  body: CompanyPrerequisiteCreationInput,
) {
  return fetchSevenoMatchApi<{ definition: CompanyPrerequisiteDefinition }>(
    authUser,
    '/api/seveno/prerequisites',
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function serializedJobOfferToInput(offer: SerializedJobOffer): JobOfferInput {
  const toSelections = (items: SerializedJobOffer['requiredPrerequisites']) => items.map((item) => ({
    prerequisiteId: item.prerequisiteId,
    expectedCriterion: item.expectedCriterion,
  }));
  return {
    title: offer.title,
    sectorId: offer.sectorId,
    jobFamilyId: offer.jobFamilyId,
    jobRoleId: offer.jobRoleId,
    questionnaireId: offer.questionnaireId ?? '',
    location: offer.location,
    workMode: offer.workMode,
    contractType: offer.contractType,
    workingTime: offer.workingTime,
    description: offer.description,
    missions: offer.missions,
    profileSummary: offer.profileSummary,
    questionnaireRequired: offer.questionnaireRequired,
    requiredPrerequisites: toSelections(offer.requiredPrerequisites),
    preferredPrerequisites: toSelections(offer.preferredPrerequisites),
  };
}
