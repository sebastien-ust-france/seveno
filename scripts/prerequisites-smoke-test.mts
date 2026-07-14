import assert from 'node:assert/strict';
import {
  assertUniqueOfferPrerequisiteSelections,
  buildAdminApplicabilityKeys,
  buildCompanyPrerequisitePickerResults,
  buildJobApplicabilityKeys,
  buildPrerequisiteApplicabilityKeys,
  buildPrerequisiteExclusionKeys,
  createOfferPrerequisiteSnapshot,
  SevenoPrerequisiteError,
  validatePrerequisiteInput,
} from '@/lib/seveno-prerequisites-server';
import {
  buildPrerequisiteSuggestionGroupingKey,
  buildPrerequisiteSuggestionId,
  buildPrerequisiteSuggestionUsageDescriptors,
  buildPrerequisiteSuggestionUsageId,
  summarizePrerequisiteSuggestionUsageDiff,
} from '@/lib/seveno-prerequisite-suggestions-server';
import type { SerializedPrerequisiteDefinition } from '@/types/seveno-prerequisites';

const roleId = 'informatique-et-numerique-developpement-logiciel-developpeur-full-stack';
const familyId = 'informatique-et-numerique-developpement-logiciel';
const sectorId = 'informatique-et-numerique';
const baseInput = {
  code: 'permis-b',
  category: 'license',
  companyLabel: 'Permis B obligatoire',
  candidateQuestion: 'Possedez-vous un permis B en cours de validite ?',
  answerType: 'boolean',
  options: [],
  criterionMode: 'fixed',
  defaultCriterion: true,
  allowedCriterionValues: [],
  comparisonOperator: 'equals',
  responseScope: 'profile_reusable',
  evidencePolicy: 'required_after_match',
  freshnessDays: 365,
  applicability: {
    global: true,
    sectorIds: [],
    jobFamilyIds: [],
    jobRoleIds: [],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
  status: 'draft',
} as const;

function hasCode(code: string) {
  return (error: unknown) => error instanceof SevenoPrerequisiteError && error.code === code;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function makeDefinition(input: {
  code: string;
  companyLabel: string;
  applicability: Parameters<typeof buildPrerequisiteApplicabilityKeys>[0];
  source?: 'seveno' | 'company';
  ownerCompanyId?: string;
  originOfferId?: string;
}) {
  return {
    id: input.code,
    ...validated,
    code: input.code,
    status: 'active',
    source: input.source ?? 'seveno',
    ...(input.ownerCompanyId ? { ownerCompanyId: input.ownerCompanyId } : {}),
    ...(input.originOfferId ? { originOfferId: input.originOfferId } : {}),
    companyLabel: input.companyLabel,
    applicability: input.applicability,
    applicabilityKeys: buildPrerequisiteApplicabilityKeys(input.applicability),
    exclusionKeys: [],
    searchKeys: [normalizeSearchText(input.code), normalizeSearchText(input.companyLabel)],
    version: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    createdBy: 'admin-test',
    updatedBy: 'admin-test',
  } as SerializedPrerequisiteDefinition;
}

const validated = validatePrerequisiteInput(baseInput);
assert.equal(validated.code, 'permis-b');
assert.deepEqual(buildJobApplicabilityKeys(roleId), [
  'global',
  `sector:${sectorId}`,
  `family:${familyId}`,
  `role:${roleId}`,
]);
assert.deepEqual(buildAdminApplicabilityKeys({ sectorId }), ['global', `sector:${sectorId}`]);
assert.deepEqual(buildAdminApplicabilityKeys({ sectorId, jobFamilyId: familyId }), [
  'global',
  `sector:${sectorId}`,
  `family:${familyId}`,
]);
assert.deepEqual(buildPrerequisiteExclusionKeys({
  global: false,
  sectorIds: [],
  jobFamilyIds: [],
  jobRoleIds: [],
  excludedSectorIds: [sectorId],
  excludedJobFamilyIds: [],
  excludedJobRoleIds: [roleId],
}), [`sector:${sectorId}`, `role:${roleId}`]);

assert.throws(
  () => validatePrerequisiteInput({ ...baseInput, comparisonOperator: 'minimum' }),
  hasCode('invalid_operator'),
);
assert.throws(() => buildJobApplicabilityKeys('metier-inconnu'), hasCode('unknown_job_role'));
assert.throws(
  () => buildAdminApplicabilityKeys({ sectorId: 'commerce-vente-relation-client', jobFamilyId: familyId }),
  hasCode('unknown_taxonomy_id'),
);
assert.throws(
  () => validatePrerequisiteInput({ ...baseInput, companyLabel: 'Religion du candidat' }),
  hasCode('prohibited_prerequisite_content'),
);

const globalDefinition = makeDefinition({
  code: 'permis-b',
  companyLabel: 'Permis B obligatoire',
  applicability: {
    global: true,
    sectorIds: [],
    jobFamilyIds: [],
    jobRoleIds: [],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});
const sectorDefinition = makeDefinition({
  code: 'zone-gironde',
  companyLabel: 'Zone Gironde',
  applicability: {
    global: false,
    sectorIds: [sectorId],
    jobFamilyIds: [],
    jobRoleIds: [],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});
const familyDefinition = makeDefinition({
  code: 'caces-logistique',
  companyLabel: 'CACES logistique',
  applicability: {
    global: false,
    sectorIds: [],
    jobFamilyIds: [familyId],
    jobRoleIds: [],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});
const roleDefinition = makeDefinition({
  code: 'lecture-plan',
  companyLabel: 'Lecture de plan',
  applicability: {
    global: false,
    sectorIds: [],
    jobFamilyIds: [],
    jobRoleIds: [roleId],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});
const otherRoleDefinition = makeDefinition({
  code: 'habilitation-hauteur',
  companyLabel: 'Habilitation travail en hauteur',
  applicability: {
    global: false,
    sectorIds: [],
    jobFamilyIds: [],
    jobRoleIds: ['autre-metier'],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});
const privateDefinition = makeDefinition({
  code: 'controle-interne',
  companyLabel: 'Controle interne',
  source: 'company',
  ownerCompanyId: 'company-a',
  applicability: {
    global: false,
    sectorIds: [],
    jobFamilyIds: [],
    jobRoleIds: ['autre-metier'],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});
const duplicatePublicDefinition = makeDefinition({
  code: 'lecture-plan-public',
  companyLabel: 'Lecture de plan',
  applicability: {
    global: false,
    sectorIds: [],
    jobFamilyIds: [],
    jobRoleIds: [roleId],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});
const companyOfferA = {
  companyUid: 'company-a',
  id: 'offer-a',
  sectorId,
  jobFamilyId: familyId,
  jobRoleId: roleId,
};
const companyOfferB = {
  companyUid: 'company-a',
  id: 'offer-b',
  sectorId,
  jobFamilyId: familyId,
  jobRoleId: roleId,
};
const companyDefinition = makeDefinition({
  code: 'controle-interne',
  companyLabel: 'Controle interne',
  source: 'company',
  ownerCompanyId: 'company-a',
  originOfferId: 'offer-a',
  applicability: {
    global: false,
    sectorIds: [],
    jobFamilyIds: [],
    jobRoleIds: ['autre-metier'],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  },
});

const defaultPicker = buildCompanyPrerequisitePickerResults(
  [globalDefinition, sectorDefinition, familyDefinition, roleDefinition, otherRoleDefinition, privateDefinition],
  { jobRoleId: roleId, companyUid: 'company-a' },
);
assert.deepEqual(defaultPicker.map((item) => [item.companyLabel, item.applicabilityLevel]), [
  ['Lecture de plan', 'role'],
  ['CACES logistique', 'family'],
  ['Zone Gironde', 'sector'],
  ['Permis B obligatoire', 'global'],
]);

const searchPicker = buildCompanyPrerequisitePickerResults(
  [globalDefinition, sectorDefinition, familyDefinition, roleDefinition, otherRoleDefinition, privateDefinition],
  { jobRoleId: roleId, companyUid: 'company-a', query: 'habilitation travail en hauteur' },
);
assert.equal(searchPicker.length, 1);
assert.equal(searchPicker[0]?.companyLabel, 'Habilitation travail en hauteur');
assert.equal(searchPicker[0]?.applicableToCurrentRole, false);

const privateSearchPicker = buildCompanyPrerequisitePickerResults(
  [globalDefinition, sectorDefinition, familyDefinition, roleDefinition, otherRoleDefinition, privateDefinition],
  { jobRoleId: roleId, companyUid: 'company-a', query: 'controle interne' },
);
assert.equal(privateSearchPicker.length, 1);
assert.equal(privateSearchPicker[0]?.companyLabel, 'Controle interne');

const foreignSearchPicker = buildCompanyPrerequisitePickerResults(
  [globalDefinition, sectorDefinition, familyDefinition, roleDefinition, otherRoleDefinition, privateDefinition],
  { jobRoleId: roleId, companyUid: 'company-b', query: 'controle interne' },
);
assert.equal(foreignSearchPicker.length, 0);

const dedupedPicker = buildCompanyPrerequisitePickerResults(
  [globalDefinition, sectorDefinition, familyDefinition, roleDefinition, duplicatePublicDefinition],
  { jobRoleId: roleId, companyUid: 'company-a', selectedIds: ['lecture-plan-public'] },
);
assert.equal(dedupedPicker.filter((item) => item.companyLabel === 'Lecture de plan').length, 1);
assert.equal(dedupedPicker.find((item) => item.companyLabel === 'Lecture de plan')?.alreadySelected, true);

assert.equal(buildPrerequisiteSuggestionGroupingKey('  Controle interne  '), 'controle interne');
assert.equal(buildPrerequisiteSuggestionId(buildPrerequisiteSuggestionGroupingKey('Controle interne')),
  buildPrerequisiteSuggestionId(buildPrerequisiteSuggestionGroupingKey('  controle    interne ')));

const companyRequiredSnapshot = createOfferPrerequisiteSnapshot(companyDefinition, {
  prerequisiteId: companyDefinition.id,
  expectedCriterion: true,
  importance: 'required',
});
const companyPreferredSnapshot = createOfferPrerequisiteSnapshot(companyDefinition, {
  prerequisiteId: companyDefinition.id,
  expectedCriterion: true,
  importance: 'preferred',
});
const companyDescriptorsA = buildPrerequisiteSuggestionUsageDescriptors(companyOfferA, [companyRequiredSnapshot]);
assert.equal(companyDescriptorsA.length, 1);
assert.equal(companyDescriptorsA[0]?.suggestionId, buildPrerequisiteSuggestionId('controle interne'));
assert.equal(companyDescriptorsA[0]?.usageId, buildPrerequisiteSuggestionUsageId('company-a', 'offer-a', companyDefinition.id));

const companyDescriptorsB = buildPrerequisiteSuggestionUsageDescriptors(companyOfferB, [companyRequiredSnapshot]);
assert.equal(companyDescriptorsB.length, 1);
assert.equal(companyDescriptorsA[0]?.suggestionId, companyDescriptorsB[0]?.suggestionId);
assert.notEqual(companyDescriptorsA[0]?.usageId, companyDescriptorsB[0]?.usageId);

const unchangedTransitions = summarizePrerequisiteSuggestionUsageDiff(
  companyDescriptorsA,
  buildPrerequisiteSuggestionUsageDescriptors(companyOfferA, [companyRequiredSnapshot]),
);
assert.deepEqual(unchangedTransitions.map((transition) => transition.kind), ['unchanged']);

const importanceTransitions = summarizePrerequisiteSuggestionUsageDiff(
  companyDescriptorsA,
  buildPrerequisiteSuggestionUsageDescriptors(companyOfferA, [companyPreferredSnapshot]),
);
assert.deepEqual(importanceTransitions.map((transition) => transition.kind), ['importance_changed']);

const definition: SerializedPrerequisiteDefinition = {
  id: validated.code,
  ...validated,
  applicabilityKeys: ['global'],
  exclusionKeys: [],
  searchKeys: ['pe', 'per'],
  version: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  createdBy: 'admin-test',
  updatedBy: 'admin-test',
};
const snapshot = createOfferPrerequisiteSnapshot(definition, {
  prerequisiteId: definition.id,
  expectedCriterion: true,
  importance: 'required',
});
assert.equal(snapshot.prerequisiteVersion, 3);
assert.equal(snapshot.candidateQuestion, definition.candidateQuestion);
assert.throws(
  () => assertUniqueOfferPrerequisiteSelections([
    { prerequisiteId: 'permis-b', expectedCriterion: true, importance: 'required' },
    { prerequisiteId: 'permis-b', expectedCriterion: true, importance: 'preferred' },
  ]),
  hasCode('duplicate_offer_prerequisite'),
);

console.log('Prerequisite validation smoke tests: OK');
