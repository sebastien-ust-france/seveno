'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';

export async function completeCandidateOnboarding(authUser: User) {
  return fetchSevenoMatchApi<{ onboardingCompleted: true }>(
    authUser,
    '/api/seveno/candidates/onboarding/complete',
    {
      method: 'POST',
    },
    'candidate_onboarding_complete',
  );
}
