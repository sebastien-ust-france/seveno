'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type {
  CompanyApplicationPrioritySelection,
  CandidateOfferListPage,
  CandidateOfferProjection,
  PrerequisiteAnswerInput,
  JobApplicationContactSharingView,
  SerializedCandidateJobApplication,
  SerializedJobApplicationConversationMessage,
} from '@/types/seveno-job-applications';

export function listCandidateOffersClient(authUser: User, cursor?: string | null) {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return fetchSevenoMatchApi<CandidateOfferListPage>(authUser, `/api/seveno/candidate-offers?${params.toString()}`);
}

export function getCandidateOfferClient(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ offer: CandidateOfferProjection; applicationId: string | null }>(
    authUser,
    `/api/seveno/candidate-offers/${encodeURIComponent(offerId)}`,
  );
}

export function beginApplicationClient(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(authUser, '/api/seveno/applications', {
    method: 'POST',
    body: JSON.stringify({ offerId }),
  });
}

export function getApplicationClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}`,
  );
}

export function listApplicationsClient(authUser: User, cursor?: string | null) {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return fetchSevenoMatchApi<{ applications: SerializedCandidateJobApplication[]; nextCursor: string | null }>(
    authUser,
    `/api/seveno/applications?${params.toString()}`,
  );
}

export function saveApplicationAnswersClient(authUser: User, applicationId: string, answers: PrerequisiteAnswerInput[]) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/answers`,
    { method: 'PUT', body: JSON.stringify({ answers }) },
  );
}

export function submitApplicationClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/submit`,
    { method: 'POST' },
  );
}

export function withdrawApplicationClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/withdraw`,
    { method: 'POST' },
  );
}

export function listCompanyApplicationsClient(
  authUser: User,
  cursor?: string | null,
  publicCandidateId?: string,
  offerId?: string,
) {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  if (publicCandidateId) params.set('publicCandidateId', publicCandidateId);
  if (offerId) params.set('offerId', offerId);
  return fetchSevenoMatchApi<{
    applications: SerializedCandidateJobApplication[];
    nextCursor: string | null;
    prioritySelection: CompanyApplicationPrioritySelection | null;
  }>(
    authUser,
    `/api/seveno/applications/company?${params.toString()}`,
  );
}

export function createCompanyInvitationClient(
  authUser: User,
  input: { offerId: string; publicCandidateId: string; message?: string },
) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(
    authUser,
    '/api/seveno/applications/company',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function respondToJobApplicationInvitationClient(
  authUser: User,
  applicationId: string,
  decision: 'accepted' | 'declined',
) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/candidate-decision`,
    { method: 'POST', body: JSON.stringify({ decision }) },
  );
}

export function reviewCompanyJobApplicationClient(
  authUser: User,
  applicationId: string,
  decision: 'interested' | 'declined',
) {
  return fetchSevenoMatchApi<{ application: SerializedCandidateJobApplication }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/company-decision`,
    { method: 'POST', body: JSON.stringify({ decision }) },
  );
}

export function getJobApplicationConversationClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<{
    application: SerializedCandidateJobApplication;
    messages: SerializedJobApplicationConversationMessage[];
  }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/conversation`,
  );
}

export function sendJobApplicationConversationMessageClient(
  authUser: User,
  applicationId: string,
  body: string,
) {
  return fetchSevenoMatchApi<{
    application: SerializedCandidateJobApplication;
    messages: SerializedJobApplicationConversationMessage[];
  }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/conversation`,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
}

export function markJobApplicationConversationReadClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<{
    application: SerializedCandidateJobApplication;
    messages: SerializedJobApplicationConversationMessage[];
  }>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/conversation/read`,
    { method: 'POST' },
  );
}

export function getJobApplicationContactSharingClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<JobApplicationContactSharingView>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/contact-sharing`,
  );
}

export function shareJobApplicationContactClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<JobApplicationContactSharingView>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/contact-sharing`,
    { method: 'POST', body: JSON.stringify({ action: 'share' }) },
  );
}
