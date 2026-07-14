import assert from 'node:assert/strict';
import {
  resolveJobOfferStatus,
  SevenoJobOfferError,
  toPublicJobOffer,
  validateJobOfferInput,
} from '@/lib/seveno-job-offers-server';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';

const sectorId = 'informatique-et-numerique';
const jobFamilyId = 'informatique-et-numerique-developpement-logiciel';
const jobRoleId = 'informatique-et-numerique-developpement-logiciel-developpeur-full-stack';
const draft = {
  title: 'Developpeur full stack',
  sectorId,
  jobFamilyId,
  jobRoleId,
  location: 'Paris',
  workMode: 'hybrid',
  contractType: 'permanent',
  workingTime: 'full_time',
  description: 'Developpement et maintenance de produits numeriques.',
  missions: 'Concevoir, tester et documenter les fonctionnalites.',
  profileSummary: 'Experience professionnelle en developpement web.',
  questionnaireRequired: false,
  requiredPrerequisites: [],
  preferredPrerequisites: [],
  questionnaireId: null,
  questionnaireVersion: null,
};

function hasCode(code: string) {
  return (error: unknown) => error instanceof SevenoJobOfferError && error.code === code;
}

const validated = validateJobOfferInput(draft);
assert.equal(validated.jobRoleId, jobRoleId);

const incompleteDraft = validateJobOfferInput({
  ...draft,
  description: '',
  missions: '',
  profileSummary: '',
  requiredPrerequisites: [],
  preferredPrerequisites: [],
  questionnaireRequired: false,
});
assert.equal(incompleteDraft.description, '');
assert.deepEqual(incompleteDraft.requiredPrerequisites, []);
assert.equal(incompleteDraft.questionnaireRequired, false);

assert.equal(validated.jobRoleLabel, 'Développeur full stack');
assert.equal(resolveJobOfferStatus('draft', 'publish'), 'published');
assert.equal(resolveJobOfferStatus('published', 'pause'), 'paused');
assert.equal(resolveJobOfferStatus('paused', 'close'), 'closed');
assert.equal(resolveJobOfferStatus('closed', 'archive'), 'archived');
assert.throws(() => resolveJobOfferStatus('draft', 'close'), hasCode('invalid_status_transition'));
assert.throws(
  () => validateJobOfferInput({ ...draft, sectorId: 'commerce-vente-relation-client' }),
  hasCode('invalid_job'),
);
assert.throws(
  () => validateJobOfferInput({
    ...draft,
    requiredPrerequisites: [{ prerequisiteId: 'permis-b', expectedCriterion: true }],
    preferredPrerequisites: [{ prerequisiteId: 'permis-b', expectedCriterion: true }],
  }),
  hasCode('duplicate_prerequisite'),
);
assert.throws(
  () => validateJobOfferInput({ ...draft, description: 'Selection selon la religion du candidat.' }),
  hasCode('prohibited_offer_content'),
);

const serialized: SerializedJobOffer = {
  id: 'offer-test',
  companyUid: 'private-company-uid',
  companyPublicId: 'SEV-ENT-1234567890',
  companyNameSnapshot: 'Entreprise test',
  ...validated,
  requiredPrerequisites: [],
  preferredPrerequisites: [],
  questionnaireId: null,
  questionnaireVersion: null,
  questionnaireTitleSnapshot: null,
  questionnaireQuestionCountSnapshot: null,
  status: 'draft',
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
  publishedAt: null,
  closedAt: null,
  version: 1,
};
const publicOffer = toPublicJobOffer(serialized);
assert.equal('companyUid' in publicOffer, false);
assert.equal(publicOffer.companyPublicId, serialized.companyPublicId);

console.log('Job offer validation smoke tests: OK');
