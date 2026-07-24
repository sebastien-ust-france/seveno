'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import type {
  SevenoTestStartState,
  TestSessionStartResult,
  TestSessionSubmitResult,
} from '@/types/seveno';

export function getCandidateSevenoTestStateClient(authUser: User) {
  return fetchSevenoMatchApi<SevenoTestStartState>(
    authUser,
    '/api/seveno/tests/start',
  );
}

export function startCandidateSevenoTestSessionClient(authUser: User) {
  return fetchSevenoMatchApi<TestSessionStartResult>(
    authUser,
    '/api/seveno/tests/start',
    { method: 'POST' },
    'candidate_seveno_test_start',
  );
}

export function submitCandidateSevenoTestSessionClient(
  authUser: User,
  input: {
    sessionId: string;
    answers: Record<string, string>;
  },
) {
  return fetchSevenoMatchApi<TestSessionSubmitResult>(
    authUser,
    '/api/seveno/tests/submit',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    'candidate_seveno_test_submit',
  );
}

export function abandonCandidateSevenoTestSessionClient(
  authUser: User,
  input: {
    sessionId: string;
  },
) {
  return fetchSevenoMatchApi<{ status: string }>(
    authUser,
    '/api/seveno/tests/abandon',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    'candidate_seveno_test_abandon',
  );
}
