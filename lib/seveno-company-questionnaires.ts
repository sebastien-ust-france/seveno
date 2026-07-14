'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type {
  CompanyQuestionnaireEditorProjection,
  CompanyQuestionnaireListItem,
  CompanyQuestionnaireInput,
} from '@/types/seveno-company-questionnaires';

export function getCompanyQuestionnaireClient(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ questionnaire: CompanyQuestionnaireEditorProjection | null }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/questionnaire`,
  );
}

export function saveCompanyQuestionnaireClient(authUser: User, offerId: string, input: CompanyQuestionnaireInput) {
  return fetchSevenoMatchApi<{ questionnaire: CompanyQuestionnaireEditorProjection }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/questionnaire`,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}

export function activateCompanyQuestionnaireClient(authUser: User, offerId: string) {
  return fetchSevenoMatchApi<{ questionnaire: CompanyQuestionnaireEditorProjection }>(
    authUser,
    `/api/seveno/offers/${encodeURIComponent(offerId)}/questionnaire/activate`,
    { method: 'POST' },
  );
}

export function listCompanyQuestionnairesClient(authUser: User) {
  return fetchSevenoMatchApi<{ questionnaires: CompanyQuestionnaireListItem[] }>(
    authUser,
    '/api/seveno/company-questionnaires',
  );
}
