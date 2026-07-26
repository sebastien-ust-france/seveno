import type { User } from 'firebase/auth';

export type CandidateSessionGateState = 'loading' | 'redirecting' | 'ready' | 'error';

export function resolveCandidateSessionGateState(input: {
  loading: boolean;
  authUser: User | null;
  error: string | null;
}): CandidateSessionGateState {
  if (input.loading) {
    return 'loading';
  }

  if (input.error) {
    return 'error';
  }

  if (!input.authUser) {
    return 'redirecting';
  }

  return 'ready';
}

export function shouldRenderCandidateChildren(state: CandidateSessionGateState) {
  return state === 'ready';
}

export function shouldAllowCandidateOnboardingWithoutProfile(
  pathname: string | null,
  hasCandidateProfile: boolean,
) {
  return pathname === '/candidat/onboarding' && !hasCandidateProfile;
}
