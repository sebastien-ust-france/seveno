import assert from 'node:assert/strict';
import { buildCompanyQuestionnaireAiPrompt } from '@/lib/seveno-company-questionnaire-ai';
import { classifyOfferPrerequisites, resolvePrerequisiteFamily, validatePrerequisiteFamily } from '@/lib/seveno-prerequisite-families';
import { assertOfferPrerequisiteLimits } from '@/lib/seveno-prerequisites-server';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';
import type { OfferPrerequisiteSnapshot } from '@/types/seveno-prerequisites';

function prerequisite(id: string, label: string, importance: 'required' | 'preferred'): OfferPrerequisiteSnapshot {
  return {
    prerequisiteId: id, prerequisiteCode: id, prerequisiteVersion: 1, source: 'company', category: 'other_professional',
    companyLabel: label, candidateQuestion: `Le candidat satisfait-il ${label} ?`, answerType: 'boolean', options: [],
    comparisonOperator: 'equals', expectedCriterion: true, responseScope: 'application_specific', evidencePolicy: 'none', importance,
  };
}

const required = [prerequisite('lecture-plans', 'Lire un plan', 'required'), { ...prerequisite('company-library-permis-b-b56329-ab3611ca41bf', 'Permis B', 'required'), comparisonOperator: 'maximum' as const, expectedCriterion: 987654 }, prerequisite('implantation', 'implantation', 'required'), prerequisite('metre', 'métré', 'required')];
const preferred = [{ ...prerequisite('company-library-vehicule-b56329-ee233281c288', 'Véhiculé', 'preferred'), comparisonOperator: 'one_of' as const, expectedCriterion: ['excluded-vehicle'] }, prerequisite('coffrage', 'coffrage', 'preferred')];
const groups = classifyOfferPrerequisites([...required, ...preferred]);
assert.deepEqual(groups.requiredJobSkills.map((item) => item.companyLabel), ['Lire un plan', 'implantation', 'métré']);
assert.deepEqual(groups.preferredJobSkills.map((item) => item.companyLabel), ['coffrage']);
assert.deepEqual(groups.requiredOfferRequirements.map((item) => item.companyLabel), ['Permis B']);
assert.deepEqual(groups.preferredOfferRequirements.map((item) => item.companyLabel), ['Véhiculé']);

const offer = {
  id: 'b9c99b0a-0aba-4ea8-b920-32f81f3bd13a', companyUid: 'company', companyPublicId: 'company', companyNameSnapshot: 'Entreprise',
  title: 'Maçon coffreur', sectorId: 'construction', jobFamilyId: 'gros-oeuvre', jobRoleId: 'coffreur-bancheur', jobRoleLabel: 'Coffreur bancheur',
  location: 'Gironde', workMode: 'onsite', contractType: 'permanent', workingTime: 'full_time', description: 'Construction', missions: 'Préparation et sécurisation de la zone ; fondations, dalles et chapes ; montage de murs ; mortiers et enduits ; rénovation et réparation ; contrôle de la qualité ; entretien du matériel.', profileSummary: 'Profil',
  questionnaireRequired: true, questionnaireId: null, questionnaireVersion: null, questionnaireTitleSnapshot: null, questionnaireQuestionCountSnapshot: null,
  requiredPrerequisites: required, preferredPrerequisites: preferred, status: 'draft', createdAt: '', updatedAt: '', publishedAt: null, closedAt: null, version: 1,
} satisfies SerializedJobOffer;
const prompt = buildCompanyQuestionnaireAiPrompt(offer);
for (const value of ['Maçon coffreur', 'Coffreur bancheur', 'Lire un plan', 'implantation', 'métré', 'coffrage']) assert.match(prompt, new RegExp(value, 'i'));
for (const value of ['Préparation et sécurisation de la zone', 'fondations, dalles et chapes', 'montage de murs', 'mortiers et enduits', 'rénovation et réparation', 'contrôle de la qualité', 'entretien du matériel', 'exactement 15 questions', 'exactement 5 questions']) assert.match(prompt, new RegExp(value, 'i'));
for (const value of ['Permis B', 'permis-b', 'company-library-permis-b-b56329-ab3611ca41bf', 'Véhiculé', 'vehicule', 'company-library-vehicule-b56329-ee233281c288', 'satisfait-il Permis', 'satisfait-il Véhiculé', 'Opérateur : maximum', '987654', 'Opérateur : one_of', 'excluded-vehicle']) assert.doesNotMatch(prompt, new RegExp(value, 'i'));

for (const [label, category] of [['deux ans d’expérience', 'experience'], ['CAP Maçon', 'diploma'], ['Permis B', 'permit'], ['Permis C', 'permit'], ['Véhicule personnel', 'vehicle'], ['CACES R482', 'caces'], ['habilitation électrique', 'habilitation'], ['certification réglementaire', 'certification'], ['autorisation de conduite', 'authorization'], ['carte professionnelle', 'professional_card'], ['disponibilité le samedi', 'availability'], ['mobilité Gironde', 'mobility']] as const) {
  assert.deepEqual(resolvePrerequisiteFamily({ companyLabel: label }), { prerequisiteFamily: 'offer_requirement', offerRequirementCategory: category });
}
for (const label of ['lecture de plans', 'implantation', 'métré', 'coffrage', 'préparation du mortier', 'contrôle de l’aplomb', 'règles de sécurité dans l’exécution du métier']) assert.deepEqual(resolvePrerequisiteFamily({ companyLabel: label }), { prerequisiteFamily: 'job_skill' });
assert.throws(() => validatePrerequisiteFamily({ prerequisiteFamily: 'job_skill', offerRequirementCategory: 'permit' }));
assert.throws(() => validatePrerequisiteFamily({ prerequisiteFamily: 'job_skill', offerRequirementCategory: 'caces' }));
assert.throws(() => validatePrerequisiteFamily({ prerequisiteFamily: 'offer_requirement' }));
assert.throws(() => validatePrerequisiteFamily({ prerequisiteFamily: 'offer_requirement', offerRequirementCategory: 'unknown' }));

const explicit = (family: 'job_skill' | 'offer_requirement', importance: 'required' | 'preferred', index: number) => ({ ...prerequisite(`${family}-${importance}-${index}`, `Item ${index}`, importance), prerequisiteFamily: family, ...(family === 'offer_requirement' ? { offerRequirementCategory: 'other' as const } : {}) });
assert.throws(() => assertOfferPrerequisiteLimits(Array.from({ length: 6 }, (_, i) => explicit('job_skill', 'required', i))));
assert.throws(() => assertOfferPrerequisiteLimits(Array.from({ length: 4 }, (_, i) => explicit('job_skill', 'preferred', i))));
assert.throws(() => assertOfferPrerequisiteLimits(Array.from({ length: 6 }, (_, i) => explicit('offer_requirement', 'required', i))));
assert.throws(() => assertOfferPrerequisiteLimits(Array.from({ length: 4 }, (_, i) => explicit('offer_requirement', 'preferred', i))));
assert.doesNotThrow(() => assertOfferPrerequisiteLimits([...Array.from({ length: 5 }, (_, i) => explicit('job_skill', 'required', i)), ...Array.from({ length: 5 }, (_, i) => explicit('offer_requirement', 'required', i))]));

console.log('Questionnaire prerequisite filter smoke tests: OK');
