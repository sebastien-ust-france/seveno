'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type {
  CompanyQuestionnaireEditorProjection,
  CompanyQuestionnaireListItem,
  CompanyQuestionnaireInput,
} from '@/types/seveno-company-questionnaires';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';
import { companyHeaders } from '@/lib/seveno-billing-client';

export function getCompanyQuestionnaireClient(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{
    offer: SerializedJobOffer;
    questionnaire: CompanyQuestionnaireEditorProjection | null;
    aiPrompt: string;
  }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/questionnaire`,
    { cache: 'no-store', headers: companyHeaders() },
  );
}

export function saveCompanyQuestionnaireClient(authUser: User, offerId: string, input: CompanyQuestionnaireInput) {
  return fetchSevenoMatchApi<{ questionnaire: CompanyQuestionnaireEditorProjection }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/questionnaire`,
    { method: 'PUT', body: JSON.stringify(input), headers: companyHeaders() },
  );
}

export function activateCompanyQuestionnaireClient(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ questionnaire: CompanyQuestionnaireEditorProjection }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/questionnaire/activate`,
    { method: 'POST', headers: companyHeaders() },
  );
}

export function listCompanyQuestionnairesClient(authUser: User) {
  return fetchSevenoMatchApi<{ questionnaires: CompanyQuestionnaireListItem[] }>(
    authUser,
    '/api/seveno/company-questionnaires',
    { headers: companyHeaders() },
  );
}
