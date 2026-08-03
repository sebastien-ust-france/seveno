import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { User } from 'firebase/auth';
import { CANDIDATE_NAVIGATION } from '@/lib/seveno-navigation';
import { validateCandidateIdentity } from '@/lib/seveno-candidate-identity';
import { COMPANY_INVITE_ONLY_MESSAGE, canAssignPublicRole } from '@/lib/seveno-users';
import {
  resolveCandidateSessionGateState,
  shouldAllowCandidateOnboardingWithoutProfile,
  shouldRenderCandidateChildren,
} from '@/lib/seveno-candidate-session-gate';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const OPEN_CANDIDATE_ROUTES = [
  '/candidat',
  '/candidat/onboarding',
  '/candidat/offres',
  '/candidat/identite',
  '/candidat/recommandations',
];

const BLOCKED_CANDIDATE_ROUTES = [
  '/candidat/test',
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
assert.equal(
  shouldAllowCandidateOnboardingWithoutProfile('/candidat/onboarding', false),
  true,
);
assert.equal(
  shouldAllowCandidateOnboardingWithoutProfile('/candidat', false),
  false,
);
assert.equal(
  shouldAllowCandidateOnboardingWithoutProfile('/candidat/onboarding', true),
  false,
);

const layoutSource = readSource('app/candidat/layout.tsx');
assert.match(layoutSource, /CandidateSessionGate/);
assert.doesNotMatch(layoutSource, /AuthenticatedAppShell/);

const mojibakePattern = new RegExp(
  '\\u00c3|\\u00c2|\\u00e2\\u20ac\\u2122|\\u00e2\\u20ac\\u0153|\\u00e2\\u20ac\\u2014|\\u00ef\\u00bf\\u00bd',
);

const candidateDashboardSource = readSource('app/candidat/page.tsx');
assert.match(candidateDashboardSource, /Questionnaire général Seven’O/);
assert.match(candidateDashboardSource, /Disponibilité quotidienne/);
assert.match(candidateDashboardSource, /Contrats recherchés/);
assert.match(candidateDashboardSource, /formatDesiredContractTypeLabels/);
assert.doesNotMatch(candidateDashboardSource, mojibakePattern);

const candidateOffersPageSource = readSource('app/candidat/offres/page.tsx');
assert.match(candidateOffersPageSource, /CandidateOffersList/);
assert.doesNotMatch(candidateOffersPageSource, /CandidateFeatureComingSoon/);

const candidateOfferDetailPageSource = readSource('app/candidat/offres/[offerId]/page.tsx');
assert.match(candidateOfferDetailPageSource, /CandidateOfferDetail/);
assert.doesNotMatch(candidateOfferDetailPageSource, /CandidateFeatureComingSoon/);

const candidateOffersListSource = readSource('components/candidate/CandidateOffersList.tsx');
assert.match(candidateOffersListSource, /listCandidateOffersClient/);
assert.match(candidateOffersListSource, /\/candidat\/offres\/\$\{encodeURIComponent\(offer\.offerId\)\}/);
assert.match(candidateOffersListSource, /Modifier mes métiers/);
assert.match(candidateOffersListSource, /tone=\{offer\.applicationId \? 'cyan' : 'neutral'\}/);
assert.doesNotMatch(candidateOffersListSource, /companyUid|candidateUid|Firebase UID/);
assert.match(candidateDashboardSource, /\/candidat\/test/);
assert.doesNotMatch(
  candidateDashboardSource,
  /Les confirmations quotidiennes et le bouton de test seront réactivées lors de l'ouverture complète/,
);
assert.doesNotMatch(candidateDashboardSource, mojibakePattern);

const testRunnerSource = readSource('components/candidate/CandidateSevenoTestRunner.tsx');
assert.match(testRunnerSource, /useSevenoCandidateSession/);
assert.match(testRunnerSource, /currentQuestionIndex/);
assert.match(testRunnerSource, /questionExpiresAt/);
assert.match(testRunnerSource, /questionTimeSeconds/);
assert.match(testRunnerSource, /Questionnaire général Seven’O/);
assert.match(testRunnerSource, /Chargement de votre session Seven’O…/);
assert.match(testRunnerSource, /Session chronométrée en cours/);
assert.match(testRunnerSource, /Question suivante/);
assert.doesNotMatch(testRunnerSource, mojibakePattern);

const candidateSessionHookSource = readSource('lib/use-seveno-candidate-session.ts');
assert.match(candidateSessionHookSource, /hasSevenoTermsAcceptance\(sevenoUser, 'candidate_account'\)/);
assert.match(candidateSessionHookSource, /router\.replace\('\/cgu'\)/);
assert.match(candidateSessionHookSource, /pathname !== '\/candidat\/onboarding'/);

const franceIdentity = validateCandidateIdentity({
  firstName: 'Alice',
  lastName: 'Durand',
  phone: '06 12 34 56 78',
  addressLine1: '',
  addressLine2: '',
  postalCode: '75001',
  city: 'Paris',
  country: 'France',
});

assert.equal(franceIdentity.errors.phone, undefined);
assert.equal(franceIdentity.data?.phone, '+33612345678');
assert.equal(franceIdentity.data?.country, 'France');

const belgiumIdentity = validateCandidateIdentity({
  firstName: 'Alice',
  lastName: 'Durand',
  phone: '0470 12 34 56',
  addressLine1: '',
  addressLine2: '',
  postalCode: '1000',
  city: 'Bruxelles',
  country: 'Belgique',
});

assert.equal(belgiumIdentity.errors.phone, undefined);
assert.equal(belgiumIdentity.data?.phone, '+32470123456');
assert.equal(belgiumIdentity.data?.country, 'Belgique');

const belgiumInternationalIdentity = validateCandidateIdentity({
  firstName: 'Alice',
  lastName: 'Durand',
  phone: '+32 470 12 34 56',
  addressLine1: '',
  addressLine2: '',
  postalCode: '1000',
  city: 'Bruxelles',
  country: 'BE',
});

assert.equal(belgiumInternationalIdentity.errors.phone, undefined);
assert.equal(belgiumInternationalIdentity.data?.phone, '+32470123456');
assert.equal(belgiumInternationalIdentity.data?.country, 'Belgique');

const belgiumInvalidIdentity = validateCandidateIdentity({
  firstName: 'Alice',
  lastName: 'Durand',
  phone: '12345',
  addressLine1: '',
  addressLine2: '',
  postalCode: '1000',
  city: 'Bruxelles',
  country: 'Belgique',
});

assert.equal(belgiumInvalidIdentity.data, null);
assert.equal(
  belgiumInvalidIdentity.errors.phone,
  'Le numéro de téléphone n’est pas valide pour le pays sélectionné.',
);

const candidateOnboardingSource = readSource('app/candidat/onboarding/page.tsx');
assert.match(candidateOnboardingSource, /completeCandidateOnboarding/);
assert.match(candidateOnboardingSource, /Quels types de contrat recherchez-vous \?/);
assert.match(candidateOnboardingSource, /desiredContractTypeCodes/);
assert.match(candidateOnboardingSource, /DESIRED_CONTRACT_TYPE_OPTIONS/);
assert.doesNotMatch(candidateOnboardingSource, /markUserOnboardingCompleted/);

const adminOverviewSource = readSource('app/admin/page.tsx');
assert.match(adminOverviewSource, /Contrats recherchés/);
assert.match(adminOverviewSource, /formatDesiredContractTypeLabels/);

const adminCandidatesSource = readSource('app/admin/candidats/page.tsx');
assert.match(adminCandidatesSource, /Contrats recherchés/);
assert.match(adminCandidatesSource, /formatDesiredContractTypeLabels/);

const adminCandidateDetailSource = readSource('app/admin/candidats/[uid]/page.tsx');
assert.match(adminCandidateDetailSource, /Contrats recherchés/);
assert.match(adminCandidateDetailSource, /formatDesiredContractTypeLabels/);

const companyCandidateSource = readSource('app/entreprise/candidats/[publicCandidateId]/page.tsx');
assert.match(companyCandidateSource, /Contrats recherchés/);
assert.match(companyCandidateSource, /formatDesiredContractTypeLabels/);

const anonymousCandidateCardSource = readSource('components/entreprise/AnonymousCandidateCard.tsx');
assert.match(anonymousCandidateCardSource, /Contrats recherchés/);
assert.match(anonymousCandidateCardSource, /formatDesiredContractTypeLabels/);

const candidateOnboardingCompleteRouteSource = readSource('app/api/seveno/candidates/onboarding/complete/route.ts');
assert.match(candidateOnboardingCompleteRouteSource, /onboardingCompleted: true/);
assert.match(candidateOnboardingCompleteRouteSource, /role !== 'candidate'/);

console.log('Candidate launch readiness smoke test: OK');
