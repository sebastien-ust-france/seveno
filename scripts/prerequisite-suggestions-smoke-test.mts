import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPublicQuestion } from '@/lib/seveno-application-questionnaires-server';
import { buildCompanyQuestionnaireAiPrompt, parseCompanyQuestionnaireAiImport } from '@/lib/seveno-company-questionnaire-ai';
import { COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION } from '@/lib/seveno-company-questionnaire-constants';
import { evaluatePrerequisiteAnswer } from '@/lib/seveno-job-applications-server';
import {
  createOfferPrerequisiteSnapshot,
  validatePrerequisiteInput,
} from '@/lib/seveno-prerequisites-server';
import {
  buildPendingPrerequisiteSuggestionPayload,
  buildPrerequisiteSuggestionUsageDescriptors,
} from '@/lib/seveno-prerequisite-suggestions-server';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';
import type { SerializedPrerequisiteDefinition } from '@/types/seveno-prerequisites';

function definition(overrides: Partial<SerializedPrerequisiteDefinition>): SerializedPrerequisiteDefinition {
  return {
    id: 'existing-suggestion',
    code: 'existing-suggestion',
    source: 'seveno',
    category: 'software',
    companyLabel: 'Outil métier',
    candidateQuestion: 'Quel est votre niveau sur cet outil ?',
    answerType: 'single_choice',
    options: [
      { value: 'notions', candidateLabel: 'Notions' },
      { value: 'autonomous', candidateLabel: 'Autonome' },
    ],
    criterionMode: 'fixed',
    defaultCriterion: 'autonomous',
    allowedCriterionValues: [],
    comparisonOperator: 'equals',
    responseScope: 'profile_reusable',
    evidencePolicy: 'none',
    applicability: { global: true, sectorIds: [], jobFamilyIds: [], jobRoleIds: [], excludedSectorIds: [], excludedJobFamilyIds: [], excludedJobRoleIds: [] },
    status: 'active',
    applicabilityKeys: ['global'],
    exclusionKeys: [],
    searchKeys: ['outil'],
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    updatedBy: 'admin',
    ...overrides,
  };
}

function aiQuestions() {
  return Array.from({ length: 20 }, (_, index) => {
    const multiple = index % 2 === 1;
    return {
      id: `question-${index + 1}`,
      prompt: `Quelle méthode convient à la situation numéro ${index + 1} ?`,
      type: multiple ? 'multiple_choice' : 'single_choice',
      required: true,
      options: [
        { id: 'option-1', label: 'Première réponse', order: 1 },
        { id: 'option-2', label: 'Deuxième réponse', order: 2 },
        ...(multiple ? [{ id: 'option-3', label: 'Troisième réponse', order: 3 }] : []),
      ],
      correctionMode: 'automatic',
      expectedAnswer: multiple ? ['option-1', 'option-3'] : 'option-2',
      difficulty: index < COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy
        ? 'easy'
        : index < COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy + COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.medium
          ? 'medium'
          : 'hard',
      explanation: `Explication correctement accentuée ${index + 1}.`,
      order: index + 1,
    };
  });
}

const sourceSuggestion = definition({});
const sourceBefore = JSON.stringify(sourceSuggestion);
const requiredSnapshot = createOfferPrerequisiteSnapshot(sourceSuggestion, {
  prerequisiteId: sourceSuggestion.id,
  expectedCriterion: 'autonomous',
  importance: 'required',
});
const adaptedDefinition = definition({
  id: 'adapted-suggestion',
  code: 'adapted-suggestion',
  companyLabel: 'Outil métier adapté',
  candidateQuestion: 'Quel niveau maîtrisez-vous réellement ?',
});
const adaptedSnapshot = createOfferPrerequisiteSnapshot(adaptedDefinition, {
  prerequisiteId: adaptedDefinition.id,
  expectedCriterion: 'autonomous',
  importance: 'preferred',
});
assert.equal(JSON.stringify(sourceSuggestion), sourceBefore);

const customInput = validatePrerequisiteInput({
  code: 'company-offer-test-typescript',
  source: 'company',
  ownerCompanyId: 'company-test',
  originOfferId: 'offer-test',
  libraryScope: 'offer',
  suggestedToSeveno: true,
  category: 'technical_skill',
  companyLabel: 'Niveau TypeScript',
  candidateQuestion: 'Quel est votre niveau actuel en TypeScript ?',
  answerType: 'single_choice',
  options: [
    { value: 'notions', candidateLabel: 'Notions' },
    { value: 'operational', candidateLabel: 'Opérationnel' },
    { value: 'autonomous', candidateLabel: 'Autonome' },
    { value: 'expert', candidateLabel: 'Expert' },
  ],
  criterionMode: 'fixed',
  defaultCriterion: ['autonomous', 'expert'],
  allowedCriterionValues: [],
  comparisonOperator: 'one_of',
  responseScope: 'profile_reusable',
  evidencePolicy: 'none',
  applicability: { global: false, sectorIds: ['informatique-et-numerique'], jobFamilyIds: [], jobRoleIds: [], excludedSectorIds: [], excludedJobFamilyIds: [], excludedJobRoleIds: [] },
  status: 'active',
});
const customDefinition = definition({
  ...customInput,
  id: customInput.code,
  code: customInput.code,
  applicabilityKeys: ['sector:informatique-et-numerique'],
  searchKeys: ['niveau'],
  createdBy: 'company-test',
  updatedBy: 'company-test',
});
const customSnapshot = createOfferPrerequisiteSnapshot(customDefinition, {
  prerequisiteId: customDefinition.id,
  expectedCriterion: ['autonomous', 'expert'],
  importance: 'required',
});
const movedSnapshot = { ...customSnapshot, importance: 'preferred' as const };
const persistedSnapshots = JSON.parse(JSON.stringify([requiredSnapshot, adaptedSnapshot, movedSnapshot]));
assert.deepEqual(persistedSnapshots, [requiredSnapshot, adaptedSnapshot, movedSnapshot]);
assert.equal(new Set(persistedSnapshots.map((item: { prerequisiteId: string }) => item.prerequisiteId)).size, 3);

const offer = {
  id: 'offer-test', companyUid: 'company-test', companyPublicId: 'SEV-CO-TEST', companyNameSnapshot: 'Entreprise test',
  title: 'Développeur applicatif', sectorId: 'informatique-et-numerique', jobFamilyId: 'developpement', jobRoleId: 'developpeur-applicatif', jobRoleLabel: 'Développeur applicatif',
  location: 'France', workMode: 'hybrid', contractType: 'permanent', workingTime: 'full_time', description: 'Concevoir une application fiable.', missions: 'Développer, tester et maintenir.', profileSummary: 'Maîtrise technique attendue.',
  questionnaireRequired: true, questionnaireId: null, questionnaireVersion: null, questionnaireTitleSnapshot: null, questionnaireQuestionCountSnapshot: null,
  requiredPrerequisites: [requiredSnapshot], preferredPrerequisites: [adaptedSnapshot, movedSnapshot], status: 'draft', createdAt: '', updatedAt: '', publishedAt: null, closedAt: null, version: 1,
} as SerializedJobOffer;
const prompt = buildCompanyQuestionnaireAiPrompt(offer);
assert.match(prompt, /Niveau TypeScript/);
assert.doesNotMatch(prompt, /\["autonomous","expert"\]/);
assert.doesNotMatch(prompt, /Opérateur : one_of/);
assert.doesNotMatch(prompt, /prérequis absent/i);
assert.doesNotMatch(prompt, /responsable de magasin|client mécontent|rupture de stock/i);
assert.match(prompt, /6 easy, 10 medium et 4 hard/);
assert.match(prompt, /Ne demande jamais au candidat de confirmer un prérequis/);

const imported = parseCompanyQuestionnaireAiImport({
  schema: 'seveno_company_questionnaire_v1', creationMode: 'ai_import', questionCount: 20,
  title: 'Évaluation métier', instructions: 'Répondez aux questions proposées.', questions: aiQuestions(),
});
assert.equal(imported.questionnaire.questions.length, 20);
for (const question of imported.questionnaire.questions) {
  const projection = buildPublicQuestion(question);
  assert.equal('expectedAnswer' in projection, false);
  assert.equal('explanation' in projection, false);
  assert.equal('numberOperator' in projection, false);
}
assert.equal(evaluatePrerequisiteAnswer(movedSnapshot, 'autonomous', true), 'satisfied');
assert.equal(evaluatePrerequisiteAnswer(movedSnapshot, 'expert', true), 'satisfied');
assert.equal(evaluatePrerequisiteAnswer(movedSnapshot, 'operational', true), 'unsatisfied');

const descriptors = buildPrerequisiteSuggestionUsageDescriptors(offer, [movedSnapshot]);
assert.equal(descriptors.length, 1);
const pending = buildPendingPrerequisiteSuggestionPayload(descriptors[0]!);
assert.equal(pending.status, 'pending');
assert.equal(pending.source, 'company_custom_prerequisite');
assert.deepEqual(pending.expectedCriterion, ['autonomous', 'expert']);
assert.equal(buildPrerequisiteSuggestionUsageDescriptors(offer, [{ ...movedSnapshot, suggestedToSeveno: undefined }]).length, 0);
assert.equal(customDefinition.libraryScope, 'offer');
assert.equal(customDefinition.originOfferId, offer.id);
const firestoreRules = readFileSync('firestore.rules', 'utf8');
assert.match(firestoreRules, /match \/prerequisite_definitions\/\{prerequisiteId\}[\s\S]*?allow create, update, delete: if false;/);
assert.match(firestoreRules, /match \/versions\/\{versionId\}[\s\S]*?allow create, update, delete: if false;/);
assert.match(firestoreRules, /match \/prerequisite_suggestions\/\{suggestionId\}[\s\S]*?allow read, write: if false;/);

console.log('Prerequisite suggestion functional smoke test: OK');
