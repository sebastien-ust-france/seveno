import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompanyQuestionnaireAiPrompt } from '@/lib/seveno-company-questionnaire-ai';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';

function offer(id: string, title: string, jobRoleLabel: string, prerequisites: string[]): SerializedJobOffer {
  return {
    id, companyUid: 'company-a', companyPublicId: 'SEV-CO-A', companyNameSnapshot: 'Entreprise A',
    title, sectorId: 'sector', jobFamilyId: 'family', jobRoleId: id, jobRoleLabel,
    location: 'Paris', workMode: 'onsite', contractType: 'permanent', workingTime: 'full_time',
    description: `Description ${title}`, missions: `Missions ${title}`, profileSummary: `Profil ${title}`,
    questionnaireRequired: true, questionnaireId: null, questionnaireVersion: null,
    questionnaireTitleSnapshot: null, questionnaireQuestionCountSnapshot: null,
    requiredPrerequisites: prerequisites.map((label, index) => ({
      prerequisiteId: `${id}-${index}`, prerequisiteCode: `${id}-${index}`, prerequisiteVersion: 1,
      source: 'company', category: 'technical', companyLabel: label, candidateQuestion: `Question ${label}`,
      answerType: 'boolean', options: [], comparisonOperator: 'equals', expectedCriterion: true,
      responseScope: 'application_specific', evidencePolicy: 'none', importance: 'required',
    })),
    preferredPrerequisites: [], status: 'draft', createdAt: '', updatedAt: '', publishedAt: null, closedAt: null, version: 1,
  };
}

const developer = offer('offer-developer', 'Développeur Full Stack', 'Développement logiciel', ['JavaScript', 'TypeScript', 'React', 'API Node.js']);
developer.description = 'Conception d’applications web fiables.';
developer.missions = 'Développer des interfaces, concevoir des API et maintenir la qualité logicielle.';
const mason = offer('offer-macon', 'Maçon coffreur', 'Construction > Gros œuvre > Maçon', ['lecture de plans', 'implantation', 'métré', 'coffrage', 'cales d’enrobage', 'armatures longitudinales', 'tiges de serrage', 'contrôle avant bétonnage', 'produit de démoulage']);
mason.description = 'Réalisation d’ouvrages de gros œuvre.';
mason.missions = 'Préparer le chantier, réaliser les fondations et contrôler la qualité des ouvrages.';
const accountant = offer('offer-accountant', 'Comptable', 'Comptabilité générale', ['saisie comptable', 'rapprochement bancaire', 'contrôle des pièces', 'préparation des déclarations']);
accountant.description = 'Tenue et contrôle de la comptabilité.';
accountant.missions = 'Enregistrer les opérations, rapprocher les comptes et préparer les déclarations.';

const developerPrompt = buildCompanyQuestionnaireAiPrompt(developer);
const masonPrompt = buildCompanyQuestionnaireAiPrompt(mason);
const accountantPrompt = buildCompanyQuestionnaireAiPrompt(accountant);
for (const value of ['offer-macon', 'Maçon coffreur', 'Gros œuvre', 'lecture de plans', 'implantation', 'métré', 'coffrage', 'cales d’enrobage', 'armatures longitudinales', 'tiges de serrage', 'contrôle avant bétonnage', 'produit de démoulage', 'réaliser les fondations']) assert.match(masonPrompt, new RegExp(value, 'i'));
for (const value of ['Développeur Full Stack', 'JavaScript', 'TypeScript', 'React', 'API Node.js', 'Comptable', 'rapprochement bancaire']) assert.doesNotMatch(masonPrompt, new RegExp(value, 'i'));
for (const value of ['offer-developer', 'Développeur Full Stack', 'Développement logiciel', 'JavaScript', 'TypeScript', 'React', 'API Node.js', 'qualité logicielle']) assert.match(developerPrompt, new RegExp(value, 'i'));
for (const value of ['Maçon', 'implantation', 'coffrage', 'Comptable', 'rapprochement bancaire']) assert.doesNotMatch(developerPrompt, new RegExp(value, 'i'));
assert.doesNotMatch(developerPrompt, /\n\d+\. métré\b/i);
for (const value of ['offer-accountant', 'Comptable', 'Comptabilité générale', 'saisie comptable', 'rapprochement bancaire', 'contrôle des pièces', 'préparation des déclarations']) assert.match(accountantPrompt, new RegExp(value, 'i'));
for (const value of ['Maçon', 'implantation', 'coffrage', 'Développeur Full Stack', 'JavaScript', 'React', 'API Node.js']) assert.doesNotMatch(accountantPrompt, new RegExp(value, 'i'));
for (const prompt of [masonPrompt, developerPrompt, accountantPrompt]) {
  for (const rule of ['exactement 15 questions', 'exactement 5 questions', '6 easy, 10 medium et 4 hard', 'mauvaises réponses doivent être plausibles', 'question-01 à question-20', 'Ne crée aucune question portant sur la possession', 'NIVEAU PROFESSIONNEL MINIMAL', 'connaissance élémentaire propre au métier analysé', 'connaissances scolaires', 'simple bon sens', 'élimination d’options absurdes', 'calcul professionnel contextualisé', 'raisonnement à plusieurs étapes', 'options doivent appartenir au même univers professionnel']) {
    assert.match(prompt, new RegExp(rule, 'i'));
  }
}
for (const forbiddenSchoolQuestion of ['formule de l’aire d’un rectangle', 'multiplication', 'conversion sans véritable contexte professionnel', 'question scolaire artificiellement habillée']) {
  assert.match(masonPrompt, new RegExp(forbiddenSchoolQuestion, 'i'));
}
assert.doesNotMatch(accountantPrompt, /cale d’enrobage|armatures longitudinales|tige de serrage|produit de démoulage/i);
assert.match(buildCompanyQuestionnaireAiPrompt(offer('empty', 'Sans prérequis', 'Métier', [])), /Aucune compétence métier renseignée/);
assert.match(masonPrompt, /Suggestion de titre existante : aucune/);
assert.match(masonPrompt, /remplacera intégralement le contenu actuel/);
assert.throws(() => buildCompanyQuestionnaireAiPrompt(mason, { offerId: 'offer-developer' } as never), /n’est pas associé/);

const editor = readFileSync('components/entreprise/CompanyQuestionnaireEditor.tsx', 'utf8');
for (const invariant of ['setOffer(null)', "setAiPrompt('')", 'setLoading(true)', 'loadRequestId.current', 'payload.offer.id !== offerId', 'questionnaire.offerId !== offerId']) assert.match(editor, new RegExp(invariant.replace(/[()]/g, '\\$&')));
assert.match(editor, /disabled=\{!aiPrompt \|\| loading \|\| !offer \|\| offer\.id !== offerId/);
assert.match(editor, /Les conditions et justificatifs de l’offre ne sont jamais transmis au générateur du questionnaire/);

const route = readFileSync('app/api/seveno/offers/[offerId]/questionnaire/route.ts', 'utf8');
assert.match(route, /getCompanyQuestionnairePromptContext\(membership\.companyId, offerId\)/);

console.log('Questionnaire offer context smoke tests: OK');
