'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type {
  CandidateRecommendationDashboardPayload,
  CandidateRecommendationInvitationInput,
  CandidateRecommendationPublicBundle,
  CandidateRecommendationSubmissionInput,
  CandidateRecommendationRequest,
  CandidateRecommendation,
} from '@/types/seveno';

type CandidateRecommendationInvitationResponse = {
  request: CandidateRecommendationRequest;
  publicLink: string | null;
};

type CandidateRecommendationSubmissionResponse = {
  recommendation: CandidateRecommendation;
};

type PublicCandidateRecommendationBundleResponse = CandidateRecommendationPublicBundle;

type AdminRecommendationsPayload = {
  requests: CandidateRecommendationRequest[];
  recommendations: CandidateRecommendation[];
};

type AdminRecommendationActionResponse = {
  recommendation: CandidateRecommendation | null;
};

export async function loadCandidateRecommendationDashboard(authUser: User) {
  return fetchSevenoMatchApi<CandidateRecommendationDashboardPayload>(authUser, '/api/seveno/recommendations');
}

export async function createCandidateRecommendationInvitationClient(
  authUser: User,
  body: CandidateRecommendationInvitationInput,
) {
  return fetchSevenoMatchApi<CandidateRecommendationInvitationResponse>(authUser, '/api/seveno/recommendations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function resendCandidateRecommendationInvitationClient(authUser: User, requestId: string) {
  return fetchSevenoMatchApi<CandidateRecommendationInvitationResponse>(
    authUser,
    `/api/seveno/recommendations/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ action: 'resend' }),
    },
  );
}

export async function revokeCandidateRecommendationInvitationClient(authUser: User, requestId: string) {
  return fetchSevenoMatchApi<CandidateRecommendationInvitationResponse>(
    authUser,
    `/api/seveno/recommendations/${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ action: 'revoke' }),
    },
  );
}

export async function loadPublicCandidateRecommendationBundle(token: string) {
  return fetch(`/api/seveno/recommendations/public/${encodeURIComponent(token)}`)
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string')
          ? (payload as { message: string }).message
          : 'Le lien de recommandation est invalide.');
      }

      return payload as PublicCandidateRecommendationBundleResponse;
    });
}

export async function submitPublicCandidateRecommendation(
  token: string,
  body: CandidateRecommendationSubmissionInput,
) {
  return fetch(`/api/seveno/recommendations/public/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error((payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string')
        ? (payload as { message: string }).message
        : 'La recommandation n a pas pu etre envoyee.');
    }

    return payload as CandidateRecommendationSubmissionResponse;
  });
}

export async function loadAdminRecommendations() {
  return fetchSevenoAdminApi<AdminRecommendationsPayload>('/api/admin/recommendations');
}

export async function verifyAdminRecommendation(
  recommendationId: string,
  action: 'verify' | 'reject',
  reason?: string,
) {
  return fetchSevenoAdminApi<AdminRecommendationActionResponse>(
    `/api/admin/recommendations/${encodeURIComponent(recommendationId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ action, reason }),
    },
  );
}

export type {
  AdminRecommendationActionResponse,
  AdminRecommendationsPayload,
  CandidateRecommendationInvitationResponse,
  CandidateRecommendationSubmissionResponse,
  PublicCandidateRecommendationBundleResponse,
};
