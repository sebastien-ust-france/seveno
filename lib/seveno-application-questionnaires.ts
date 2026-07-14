'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type {
  CompanyApplicationQuestionnaireSubmissionPayload,
  CompanyApplicationQuestionnaireReviewView,
  CompanyApplicationQuestionnaireView,
} from '@/types/seveno-application-questionnaires';

export function getCandidateApplicationQuestionnaireClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<CompanyApplicationQuestionnaireView>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/questionnaire`,
  );
}

export function startCandidateApplicationQuestionnaireClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<CompanyApplicationQuestionnaireView>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/questionnaire`,
    { method: 'POST' },
  );
}

export function submitCandidateApplicationQuestionnaireClient(
  authUser: User,
  applicationId: string,
  payload: CompanyApplicationQuestionnaireSubmissionPayload,
) {
  return fetchSevenoMatchApi<CompanyApplicationQuestionnaireView>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/questionnaire/submit`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export function getCompanyApplicationQuestionnaireReviewClient(authUser: User, applicationId: string) {
  return fetchSevenoMatchApi<CompanyApplicationQuestionnaireReviewView>(
    authUser,
    `/api/seveno/applications/${encodeURIComponent(applicationId)}/questionnaire/review`,
  );
}
