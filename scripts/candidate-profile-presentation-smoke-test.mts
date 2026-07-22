import assert from 'node:assert/strict';
import {
  normalizeCandidateProfileUpsertInput,
  SevenoCandidateProfileError,
} from '@/lib/seveno-candidate-profile-server';

const BASE_INPUT = {
  targetJobRoleIds: ['btp-construction-travaux-publics-gros-oeuvre-coffreur-bancheur'],
  availability: 'immediate',
  locationArea: 'Gironde',
  experienceLevel: 'intermediate',
  profileStatus: 'draft',
  anonymousVisibilityConsent: false,
};

function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    ...BASE_INPUT,
    ...overrides,
  };
}

function assertTooLongRejected(error: unknown) {
  return error instanceof SevenoCandidateProfileError
    && error.code === 'invalid_candidate_profile'
    && error.status === 400;
}

const emptyResult = normalizeCandidateProfileUpsertInput(buildInput());
assert.equal(emptyResult.professionalSelfDescription, null);
assert.equal(emptyResult.professionalReputationDescription, null);
assert.equal(Object.prototype.hasOwnProperty.call(emptyResult, 'professionalSelfDescription'), true);
assert.equal(Object.prototype.hasOwnProperty.call(emptyResult, 'professionalReputationDescription'), true);

const selfOnlyResult = normalizeCandidateProfileUpsertInput(buildInput({
  professionalSelfDescription: "J'ai encadre des equipes\nen situation de chantier.",
}));
assert.equal(selfOnlyResult.professionalSelfDescription, "J'ai encadre des equipes en situation de chantier.");
assert.equal(selfOnlyResult.professionalReputationDescription, null);

const reputationOnlyResult = normalizeCandidateProfileUpsertInput(buildInput({
  professionalReputationDescription: 'Mes anciens collegues disent que je suis fiable et rigoureux.',
}));
assert.equal(reputationOnlyResult.professionalSelfDescription, null);
assert.equal(reputationOnlyResult.professionalReputationDescription, 'Mes anciens collegues disent que je suis fiable et rigoureux.');

const bothFilledResult = normalizeCandidateProfileUpsertInput(buildInput({
  professionalSelfDescription: "Je suis polyvalent, ponctuel et j'aime livrer un chantier propre.",
  professionalReputationDescription: 'On dit que je suis autonome, calme et efficace.',
}));
assert.equal(bothFilledResult.professionalSelfDescription, "Je suis polyvalent, ponctuel et j'aime livrer un chantier propre.");
assert.equal(bothFilledResult.professionalReputationDescription, 'On dit que je suis autonome, calme et efficace.');

const dateRangeResult = normalizeCandidateProfileUpsertInput(buildInput({
  professionalSelfDescription: "J'ai travaillé de 2018 à 2024 sur des chantiers.",
  professionalReputationDescription: 'Mes anciens collègues disent que je suis fiable depuis 2019.',
}));
assert.equal(dateRangeResult.professionalSelfDescription, "J'ai travaillé de 2018 à 2024 sur des chantiers.");
assert.equal(dateRangeResult.professionalReputationDescription, 'Mes anciens collègues disent que je suis fiable depuis 2019.');

const legacyAliasResult = normalizeCandidateProfileUpsertInput(buildInput({
  professionalPresentation: 'Je viens du terrain et je sais m adapter vite.',
  whatOthersSayAboutMe: 'Les autres disent que je suis fiable.',
}));
assert.equal(legacyAliasResult.professionalSelfDescription, 'Je viens du terrain et je sais m adapter vite.');
assert.equal(legacyAliasResult.professionalReputationDescription, 'Les autres disent que je suis fiable.');

const canonicalStillWinsResult = normalizeCandidateProfileUpsertInput(buildInput({
  professionalSelfDescription: 'Champ canonique prioritaire.',
  professionalPresentation: 'Champ historique ignore car le champ canonique existe.',
  professionalReputationDescription: 'Champ canonique reput.',
  othersDescription: 'Champ historique ignore lui aussi.',
}));
assert.equal(canonicalStillWinsResult.professionalSelfDescription, 'Champ canonique prioritaire.');
assert.equal(canonicalStillWinsResult.professionalReputationDescription, 'Champ canonique reput.');

assert.throws(
  () => normalizeCandidateProfileUpsertInput(buildInput({
    professionalSelfDescription: 'a'.repeat(601),
  })),
  assertTooLongRejected,
);

assert.throws(
  () => normalizeCandidateProfileUpsertInput(buildInput({
    professionalReputationDescription: 'https://example.com',
  })),
  (error: unknown) => error instanceof SevenoCandidateProfileError && error.code === 'invalid_candidate_profile',
);

assert.throws(
  () => normalizeCandidateProfileUpsertInput(buildInput({
    professionalSelfDescription: 'Vous pouvez me joindre au 06 12 34 56 78.',
  })),
  (error: unknown) => error instanceof SevenoCandidateProfileError && error.code === 'invalid_candidate_profile',
);

const keys = Object.keys(bothFilledResult);
assert.equal(keys.includes('professionalPresentation'), false);
assert.equal(keys.includes('whatOthersSayAboutMe'), false);
assert.equal(keys.includes('selfDescription'), false);
assert.equal(keys.includes('othersDescription'), false);

console.log('Candidate profile presentation smoke test: OK');
