import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { User } from 'firebase/auth';
import { CANDIDATE_NAVIGATION } from '@/lib/seveno-navigation';
import { COMPANY_INVITE_ONLY_MESSAGE, canAssignPublicRole } from '@/lib/seveno-users';
import {
  resolveCandidateSessionGateState,
  shouldRenderCandidateChildren,
} from '@/lib/seveno-candidate-session-gate';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const OPEN_CANDIDATE_ROUTES = [
  '/candidat',
  '/candidat/onboarding',
  '/candidat/identite',
  '/candidat/recommandations',
];

const BLOCKED_CANDIDATE_ROUTES = [
  '/candidat/test',
  '/candidat/offres',
  '/candidat/candidatures',
  '/candidat/demandes',
];

assert.deepEqual(
  CANDIDATE_NAVIGATION.map((item) => item.href),
  OPEN_CANDIDATE_ROUTES,
  'La navigation candidat doit rester limitée au périmètre public ouvert.',
);

for (const route of BLOCKED_CANDIDATE_ROUTES) {
  assert.equal(
    CANDIDATE_NAVIGATION.some((item) => item.href === route),
    false,
    `La route ${route} ne doit plus apparaître dans la navigation candidat.`,
  );
}

assert.equal(canAssignPublicRole(null, 'candidate'), true);
assert.equal(canAssignPublicRole('candidate', 'candidate'), true);
assert.equal(canAssignPublicRole('company', 'company'), true);
assert.equal(canAssignPublicRole(null, 'company'), false);
assert.equal(canAssignPublicRole('candidate', 'company'), false);
assert.match(COMPANY_INVITE_ONLY_MESSAGE, /invitation/i);

const authenticatedCandidate = { uid: 'candidate-1' } as User;

assert.equal(
  resolveCandidateSessionGateState({ loading: true, authUser: null, error: null }),
  'loading',
);
assert.equal(
  resolveCandidateSessionGateState({ loading: false, authUser: null, error: null }),
  'redirecting',
);
assert.equal(
  resolveCandidateSessionGateState({ loading: false, authUser: authenticatedCandidate, error: null }),
  'ready',
);
assert.equal(
  resolveCandidateSessionGateState({ loading: false, authUser: authenticatedCandidate, error: 'boom' }),
  'error',
);
assert.equal(shouldRenderCandidateChildren('loading'), false);
assert.equal(shouldRenderCandidateChildren('redirecting'), false);
assert.equal(shouldRenderCandidateChildren('error'), false);
assert.equal(shouldRenderCandidateChildren('ready'), true);

const layoutSource = readSource('app/candidat/layout.tsx');
assert.match(layoutSource, /CandidateSessionGate/);
assert.doesNotMatch(layoutSource, /AuthenticatedAppShell/);

console.log('Candidate launch readiness smoke test: OK');
