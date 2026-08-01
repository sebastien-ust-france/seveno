import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isOfferAvailableForNewApplication } from '@/lib/seveno-job-applications-server';
import {
  assertJobOfferDeletionAllowed,
  assertOfferOwner,
  buildDuplicatedJobOfferData,
  resolveJobOfferStatus,
  SevenoJobOfferError,
} from '@/lib/seveno-job-offers-server';
import type { JobOfferDependencyCounts, SerializedJobOffer } from '@/types/seveno-job-offers';

function hasCode(code: string) {
  return (error: unknown) => error instanceof SevenoJobOfferError && error.code === code;
}

const source: SerializedJobOffer = {
  id: 'offer-source', companyUid: 'company-a', companyPublicId: 'SEV-CO-A', companyNameSnapshot: 'Entreprise A',
  title: 'Développeur full stack', sectorId: 'informatique-et-numerique', jobFamilyId: 'developpement', jobRoleId: 'developpeur', jobRoleLabel: 'Développeur',
  location: 'Paris', workMode: 'hybrid', contractType: 'permanent', workingTime: 'full_time',
  description: 'Description originale', missions: 'Missions originales', profileSummary: 'Profil original',
  questionnaireRequired: true, questionnaireId: 'offer-source', questionnaireVersion: 4, questionnaireTitleSnapshot: 'Questionnaire original', questionnaireQuestionCountSnapshot: 20,
  requiredPrerequisites: [{
    prerequisiteId: 'prerequisite-1', prerequisiteCode: 'prerequisite-1', prerequisiteVersion: 1, source: 'seveno', category: 'software',
    companyLabel: 'Outil métier', candidateQuestion: 'Quel niveau maîtrisez-vous ?', answerType: 'single_choice',
    options: [{ value: 'autonomous', candidateLabel: 'Autonome' }, { value: 'expert', candidateLabel: 'Expert' }],
    comparisonOperator: 'one_of', expectedCriterion: ['autonomous', 'expert'], responseScope: 'profile_reusable', evidencePolicy: 'none', importance: 'required',
  }],
  preferredPrerequisites: [], status: 'closed', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z', publishedAt: '2026-01-05T00:00:00.000Z', closedAt: '2026-02-01T00:00:00.000Z', version: 8,
};

assert.equal(resolveJobOfferStatus('draft', 'publish'), 'published');
assert.equal(resolveJobOfferStatus('published', 'pause'), 'paused');
assert.equal(resolveJobOfferStatus('paused', 'reactivate'), 'published');
assert.equal(resolveJobOfferStatus('published', 'close'), 'closed');
assert.equal(resolveJobOfferStatus('paused', 'close'), 'closed');
assert.equal(resolveJobOfferStatus('paused', 'archive'), 'archived');
assert.equal(resolveJobOfferStatus('closed', 'archive'), 'archived');
assert.equal(resolveJobOfferStatus('closed', 'restore'), 'draft');
assert.equal(resolveJobOfferStatus('archived', 'restore'), 'draft');
for (const [status, action] of [['draft', 'pause'], ['archived', 'publish'], ['closed', 'publish'], ['published', 'restore']] as const) {
  assert.throws(() => resolveJobOfferStatus(status, action), hasCode('invalid_status_transition'));
}

assert.doesNotThrow(() => assertOfferOwner(source, 'company-a'));
assert.throws(() => assertOfferOwner(source, 'company-b'), hasCode('forbidden_offer'));

const duplicate = buildDuplicatedJobOfferData(source, { uid: 'company-a', companyName: 'Entreprise A', companyPublicId: 'SEV-CO-A' });
assert.equal(duplicate.status, 'draft');
assert.equal(duplicate.title, 'Copie de Développeur full stack');
assert.equal(duplicate.companyUid, 'company-a');
assert.deepEqual(duplicate.requiredPrerequisites, source.requiredPrerequisites);
assert.notEqual(duplicate.requiredPrerequisites, source.requiredPrerequisites);
assert.equal(duplicate.questionnaireId, null);
assert.equal(duplicate.questionnaireVersion, null);
assert.equal(duplicate.publishedAt, null);
assert.equal(duplicate.closedAt, null);
assert.equal(duplicate.version, 1);
for (const forbidden of ['applications', 'answers', 'results', 'scores', 'messages', 'statistics', 'conversationId', 'publishedAtOriginal']) {
  assert.equal(forbidden in duplicate, false);
}

const noDependencies: JobOfferDependencyCounts = {
  applications: 0, questionnaire: 0, sessions: 0, results: 0, applicationGuards: 0,
  capacityLocks: 0, matchRequests: 0, suggestionUsages: 0, versions: 0,
};
assert.doesNotThrow(() => assertJobOfferDeletionAllowed('draft', noDependencies));
assert.doesNotThrow(() => assertJobOfferDeletionAllowed('archived', noDependencies));
for (const key of Object.keys(noDependencies) as Array<keyof JobOfferDependencyCounts>) {
  assert.throws(() => assertJobOfferDeletionAllowed('draft', { ...noDependencies, [key]: 1 }), hasCode('offer_has_dependencies'));
}
assert.throws(() => assertJobOfferDeletionAllowed('published', noDependencies), hasCode('offer_deletion_status_forbidden'));

assert.equal(isOfferAvailableForNewApplication('published'), true);
for (const status of ['draft', 'paused', 'closed', 'archived']) assert.equal(isOfferAvailableForNewApplication(status), false);

const page = readFileSync('app/entreprise/offres/page.tsx', 'utf8');
assert.match(page, /Clôturer l’offre/);
assert.doesNotMatch(page, />Fermer<\/button>/);
for (const label of ['Mettre en pause', 'Réactiver', 'Autres actions', 'Dupliquer l’offre', 'Archiver', 'Restaurer en brouillon', 'Supprimer définitivement']) assert.match(page, new RegExp(label));
for (const filter of ['Actives', 'Brouillons', 'En pause', 'Clôturées', 'Archivées', 'Toutes']) assert.match(page, new RegExp(filter));
assert.match(page, /deleteConfirmation !== 'SUPPRIMER'/);
assert.match(page, /disabled=\{Boolean\(actionId\) \|\| deleteConfirmation !== 'SUPPRIMER'\}/);

const server = readFileSync('lib/seveno-job-offers-server.ts', 'utf8');
for (const collection of ['job_applications', 'company_questionnaires', 'test_sessions', 'test_results', 'job_application_guards', 'job_application_offer_locks', 'match_requests']) assert.match(server, new RegExp(collection));
assert.match(server, /collectionGroup\('usages'\)/);
assert.doesNotMatch(server, /force\s*===\s*true/);

console.log('Job offer lifecycle smoke tests: OK');
