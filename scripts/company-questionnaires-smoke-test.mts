import assert from 'node:assert/strict';
import { buildCompanyQuestionnaireAiPrompt, parseCompanyQuestionnaireAiImport } from '@/lib/seveno-company-questionnaire-ai';
import {
  COMPANY_QUESTION_TIME_LIMIT_SECONDS,
  COMPANY_QUESTION_POINTS,
  COMPANY_QUESTIONNAIRE_AI_SCHEMA,
  COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION,
  COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
} from '@/lib/seveno-company-questionnaire-constants';

import {
  SevenoCompanyQuestionnaireError,
  toCompanyQuestionEditorProjection,
  validateCompanyQuestionnaireInput,
} from '@/lib/seveno-company-questionnaires-server';
import { buildPublicQuestion, shuffleQuestionIds } from '@/lib/seveno-application-questionnaires-server';
import type { CompanyQuestion } from '@/types/seveno-company-questionnaires';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';

assert.equal(COMPANY_QUESTION_TIME_LIMIT_SECONDS, 30);

function hasCode(code: string) {
  return (error: unknown) => error instanceof SevenoCompanyQuestionnaireError && error.code === code;
}

function buildChoiceOption(index: number) {
  return {
    id: `option-${index + 1}`,
    label: `Reponse ${index + 1}`,
    order: index + 1,
  };
}

function buildAiQuestion(index: number, type: 'single_choice' | 'multiple_choice' = 'single_choice') {
  const options = type === 'single_choice'
    ? [buildChoiceOption(0), buildChoiceOption(1)]
    : [buildChoiceOption(0), buildChoiceOption(1), buildChoiceOption(2)];
  return {
    id: `question-ia-${index + 1}`,
    prompt: `Question ${index + 1}`,
    type,
    required: true,
    options,
    correctionMode: 'automatic' as const,
    expectedAnswer: type === 'single_choice'
      ? 'option-2'
      : ['option-1', 'option-3'],
    difficulty: index < COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy
      ? 'easy' as const
      : index < COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy + COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.medium
        ? 'medium' as const
        : 'hard' as const,
    explanation: `Explication ${index + 1}.`,
    order: index,
  };
}

function buildAiImportQuestions(count: number) {
  return Array.from({ length: count }, (_, index) => buildAiQuestion(index, index % 2 === 0 ? 'single_choice' : 'multiple_choice'));
}

const baseQuestion = {
  id: 'question-1',
  prompt: 'Quel environnement utilisez-vous ?',
  explanation: 'La bonne reponse depend du contexte fourni par l offre.',
  type: 'single_choice',
  required: true,
  options: [
    { id: 'option-1', label: 'Reponse A', order: 1 },
    { id: 'option-2', label: 'Reponse B', order: 2 },
  ],
  correctionMode: 'automatic',
  expectedAnswer: 'option-2',
  difficulty: 'medium',
  points: COMPANY_QUESTION_POINTS,
  order: 0,
};

const input = {
  title: 'Evaluation technique',
  instructions: 'Repondez sans aide exterieure.',
  creationMode: 'manual',
  durationMinutes: null,
  questions: [
    baseQuestion,
    {
      id: 'question-2',
      prompt: 'Expliquez votre approche.',
      type: 'long_text',
      required: false,
      options: [],
      correctionMode: 'manual',
      points: COMPANY_QUESTION_POINTS,
      order: 1,
    },
  ],
};

const validated = validateCompanyQuestionnaireInput(input);
assert.equal(validated.questions.length, 2);
assert.equal(validated.questions[0]?.expectedAnswer, 'option-2');
assert.equal(validated.creationMode, 'manual');
assert.equal(validated.questions.every((question) => question.points === COMPANY_QUESTION_POINTS), true);

const withoutPoints = validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, points: undefined }],
});
assert.equal(withoutPoints.questions[0]?.points, COMPANY_QUESTION_POINTS);
for (const invalidPoints of [2, 0, -1, '1']) {
  assert.throws(() => validateCompanyQuestionnaireInput({
    ...input,
    questions: [{ ...baseQuestion, points: invalidPoints }],
  }), hasCode('custom_question_weight_not_allowed'));
}

const privateQuestion = validated.questions[0] as CompanyQuestion;
const projection = toCompanyQuestionEditorProjection(privateQuestion);
assert.equal('expectedAnswer' in projection, false);
assert.equal('numberOperator' in projection, false);
assert.equal(projection.explanation, 'La bonne reponse depend du contexte fourni par l offre.');
assert.equal(projection.difficulty, 'medium');
assert.deepEqual(projection.correctOptionIds, ['option-2']);
const candidateProjection = buildPublicQuestion(privateQuestion);
assert.equal('expectedAnswer' in candidateProjection, false);
assert.equal('explanation' in candidateProjection, false);
assert.equal('numberOperator' in candidateProjection, false);
assert.deepEqual(candidateProjection.options, privateQuestion.options);

const preserved = validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, expectedAnswer: undefined }],
}, [privateQuestion]);
assert.equal(preserved.questions[0]?.expectedAnswer, 'option-2');

for (const optionCount of [2, 3, 4]) {
  const options = Array.from({ length: optionCount }, (_, index) => ({
    id: `option-${index + 1}`,
    label: `Reponse ${index + 1}`,
    order: index + 1,
  }));
  const result = validateCompanyQuestionnaireInput({
    ...input,
    questions: [{ ...baseQuestion, options, expectedAnswer: options[0]?.id }],
  });
  assert.equal(result.questions[0]?.options.length, optionCount);
}

const multipleChoice = validateCompanyQuestionnaireInput({
  ...input,
  questions: [{
    ...baseQuestion,
    type: 'multiple_choice',
    options: [
      ...baseQuestion.options,
      { id: 'option-3', label: 'Reponse C', order: 3 },
      { id: 'option-4', label: 'Reponse D', order: 4 },
    ],
    expectedAnswer: ['option-1', 'option-3'],
  }],
});
assert.deepEqual(multipleChoice.questions[0]?.expectedAnswer, ['option-1', 'option-3']);

const legacyQuestion = validateCompanyQuestionnaireInput({
  ...input,
  questions: [{
    ...baseQuestion,
    options: [
      { value: 'option-1', label: 'Ancienne reponse A' },
      { value: 'option-2', label: 'Ancienne reponse B' },
    ],
  }],
});
assert.deepEqual(legacyQuestion.questions[0]?.options, [
  { id: 'option-1', label: 'Ancienne reponse A', order: 1 },
  { id: 'option-2', label: 'Ancienne reponse B', order: 2 },
]);
const legacyProjection = toCompanyQuestionEditorProjection({
  ...privateQuestion,
  points: 4,
  options: [
    { value: 'option-1', label: 'Ancienne reponse A' },
    { value: 'option-2', label: 'Ancienne reponse B' },
  ],
} as unknown as CompanyQuestion);
assert.deepEqual(legacyProjection.options, [
  { id: 'option-1', label: 'Ancienne reponse A', order: 1 },
  { id: 'option-2', label: 'Ancienne reponse B', order: 2 },
]);
assert.equal(legacyProjection.points, COMPANY_QUESTION_POINTS);
assert.equal(buildPublicQuestion({ ...privateQuestion, points: 4 }).points, COMPANY_QUESTION_POINTS);

assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...input.questions[1], correctionMode: 'automatic', expectedAnswer: 'texte' }],
}), hasCode('invalid_correction_mode'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, options: [baseQuestion.options[0]] }],
}), hasCode('invalid_options'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{
    ...baseQuestion,
    options: [...baseQuestion.options,
      { id: 'option-3', label: 'Reponse C', order: 3 },
      { id: 'option-4', label: 'Reponse D', order: 4 },
      { id: 'option-5', label: 'Reponse E', order: 5 }],
  }],
}), hasCode('invalid_options'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, options: [{ ...baseQuestion.options[0], label: '' }, baseQuestion.options[1]] }],
}), hasCode('invalid_questionnaire'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, options: [baseQuestion.options[0], { ...baseQuestion.options[1], id: 'option-1' }] }],
}), hasCode('invalid_options'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, options: [baseQuestion.options[0], { ...baseQuestion.options[1], label: '  REPONSE   A ' }] }],
}), hasCode('invalid_options'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, expectedAnswer: undefined }],
}), hasCode('invalid_expected_answer'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, expectedAnswer: ['option-1', 'option-2'] }],
}), hasCode('invalid_expected_answer'));
assert.throws(() => validateCompanyQuestionnaireInput({
  ...input,
  questions: [{ ...baseQuestion, expectedAnswer: 'option-supprimee' }],
}), hasCode('invalid_expected_answer'));

assert.deepEqual(shuffleQuestionIds(['question-1', 'question-2', 'question-3', 'question-4'], () => 0), [
  'question-2',
  'question-3',
  'question-4',
  'question-1',
]);

assert.throws(() => parseCompanyQuestionnaireAiImport({
  schema: 'seveno_company_questionnaire_v1',
  creationMode: 'ai_import',
  questionCount: COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
  title: 'Questionnaire IA',
  instructions: 'Validez puis enregistrez.',
  questions: Array.from({ length: COMPANY_QUESTIONNAIRE_QUESTION_COUNT }, (_, index) => ({
    id: `question-ia-${index + 1}`,
    prompt: `Decrivez votre methode de travail ${index + 1}.`,
    type: 'long_text',
    required: true,
    options: [],
    correctionMode: 'manual',
    expectedAnswer: null,
    points: 5,
    order: index,
  })),
}), /single_choice|multiple_choice|correctionMode = automatic|texte/i);

const imported = parseCompanyQuestionnaireAiImport({
  schema: 'seveno_company_questionnaire_v1',
  creationMode: 'ai_import',
  questionCount: COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
  title: 'Questionnaire IA',
  instructions: 'Validez puis enregistrez.',
  questions: buildAiImportQuestions(COMPANY_QUESTIONNAIRE_QUESTION_COUNT),
});
assert.equal(imported.questionnaire.creationMode, 'ai_import');
assert.equal(imported.questionnaire.questions.length, COMPANY_QUESTIONNAIRE_QUESTION_COUNT);
assert.equal(imported.questionnaire.questions[0]?.difficulty, 'easy');
assert.equal(imported.questionnaire.questions[0]?.explanation, 'Explication 1.');
assert.deepEqual(imported.questionnaire.questions[0]?.expectedAnswer, 'option-2');
assert.deepEqual(imported.questionnaire.questions[1]?.expectedAnswer, ['option-1', 'option-3']);
assert.equal(imported.questionnaire.questions[0]?.points, 1);
assert.equal(imported.questionnaire.questions[1]?.points, 1);
assert.equal(imported.warnings.length, 0);
assert.equal(validateCompanyQuestionnaireInput(imported.questionnaire).questions.length, COMPANY_QUESTIONNAIRE_QUESTION_COUNT);
assert.throws(() => validateCompanyQuestionnaireInput({
  ...imported.questionnaire,
  questions: imported.questionnaire.questions.map((question) => ({ ...question, difficulty: 'medium' })),
}), hasCode('invalid_ai_questionnaire_contract'));

assert.throws(() => parseCompanyQuestionnaireAiImport({
  schema: COMPANY_QUESTIONNAIRE_AI_SCHEMA,
  creationMode: 'ai_import',
  questionCount: COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
  title: 'Questionnaire IA',
  instructions: 'Validez puis enregistrez.',
  questions: buildAiImportQuestions(COMPANY_QUESTIONNAIRE_QUESTION_COUNT).map((question) => ({ ...question, difficulty: 'medium' })),
}), /répartition reçue 0\/20\/0.*6\/10\/4/i);

assert.throws(() => parseCompanyQuestionnaireAiImport({
  schema: COMPANY_QUESTIONNAIRE_AI_SCHEMA,
  creationMode: 'ai_import',
  questionCount: COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
  title: 'Questionnaire IA',
  instructions: 'Validez puis enregistrez.',
  questions: buildAiImportQuestions(COMPANY_QUESTIONNAIRE_QUESTION_COUNT).map((question, index) => ({
    ...question,
    difficulty: index < 7 ? 'easy' : index < 16 ? 'medium' : 'hard',
  })),
}), /répartition reçue 7\/9\/4.*6\/10\/4/i);

assert.throws(() => parseCompanyQuestionnaireAiImport({
  schema: COMPANY_QUESTIONNAIRE_AI_SCHEMA,
  creationMode: 'ai_import',
  questionCount: COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
  title: 'Questionnaire IA',
  instructions: 'Validez puis enregistrez.',
  questions: buildAiImportQuestions(COMPANY_QUESTIONNAIRE_QUESTION_COUNT).map((question, index) => index === 0 ? { ...question, points: 1 } : question),
}), /questions\[0\]\.points.*interdit/i);

assert.throws(() => parseCompanyQuestionnaireAiImport({
  schema: 'seveno_company_questionnaire_v1',
  creationMode: 'ai_import',
  questionCount: COMPANY_QUESTIONNAIRE_QUESTION_COUNT - 1,
  title: 'Questionnaire IA',
  instructions: 'Validez puis enregistrez.',
  questions: buildAiImportQuestions(COMPANY_QUESTIONNAIRE_QUESTION_COUNT - 1),
}), /annoncer exactement 20 questions/i);

assert.throws(() => parseCompanyQuestionnaireAiImport({
  schema: 'seveno_company_questionnaire_v1',
  creationMode: 'ai_import',
  questionCount: COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
  title: 'Questionnaire IA',
  instructions: 'Validez puis enregistrez.',
  questions: buildAiImportQuestions(COMPANY_QUESTIONNAIRE_QUESTION_COUNT - 1),
}), /annonce 20 questions mais en contient 19/i);

const sampleOffer = {
  id: 'offer-1',
  companyUid: 'company-1',
  companyPublicId: 'sev-co-1',
  companyNameSnapshot: 'SevenO',
  title: 'Macon coffreur',
  sectorId: 'construction-btp',
  jobFamilyId: 'gros-oeuvre',
  jobRoleId: 'macon-coffreur',
  jobRoleLabel: 'Macon coffreur',
  location: 'Gironde',
  workMode: 'onsite',
  contractType: 'permanent',
  workingTime: 'full_time',
  description: 'Description',
  missions: 'Missions',
  profileSummary: 'Resume',
  questionnaireRequired: true,
  questionnaireId: 'questionnaire-1',
  questionnaireVersion: 1,
  questionnaireTitleSnapshot: 'Questionnaire',
  questionnaireQuestionCountSnapshot: 1,
  requiredPrerequisites: [
    {
      prerequisiteId: 'prerequisite-1',
      prerequisiteCode: 'outil-metier',
      prerequisiteVersion: 1,
      source: 'seveno',
      category: 'software',
      companyLabel: 'Outil métier',
      candidateQuestion: 'Quel niveau utilisez-vous au quotidien ?',
      answerType: 'single_choice',
      options: [
        { value: 'notions', candidateLabel: 'Notions' },
        { value: 'autonome', candidateLabel: 'Autonome' },
      ],
      comparisonOperator: 'equals',
      expectedCriterion: 'autonome',
      responseScope: 'profile_reusable',
      evidencePolicy: 'none',
      importance: 'required',
    },
  ],
  preferredPrerequisites: [],
  status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publishedAt: null,
  closedAt: null,
  version: 1,
} as SerializedJobOffer;
const prompt = buildCompanyQuestionnaireAiPrompt(sampleOffer);
assert.equal(prompt.includes(`${COMPANY_QUESTION_TIME_LIMIT_SECONDS} secondes`), true);
assert.equal(prompt.includes('français naturel, grammaticalement correct et intégralement accentué'), true);
assert.equal(prompt.includes('conservés en UTF-8'), true);
assert.equal(prompt.includes('convertir les titres, instructions, questions, options ou explications en ASCII'), true);
assert.equal(prompt.includes('Crée exactement 20 questions.'), true);
assert.equal(prompt.includes('questionCount": 20'), true);
assert.equal(prompt.includes('ordre aléatoire'), true);
assert.equal(prompt.includes('indépendante'), true);
assert.equal(prompt.includes('6 easy, 10 medium et 4 hard'), true);
assert.equal(prompt.includes('NIVEAU PROFESSIONNEL MINIMAL'), true);
assert.equal(prompt.includes('connaissance élémentaire propre au métier analysé'), true);
assert.equal(prompt.includes('connaissances scolaires, à la culture générale, au bon sens ou à l’élimination d’options absurdes'), true);
assert.equal(prompt.includes('formule de l’aire d’un rectangle'), true);
assert.equal(prompt.includes('question scolaire artificiellement habillée avec un contexte métier'), true);
assert.equal(prompt.includes('calcul professionnel contextualisé'), true);
assert.equal(prompt.includes('raisonnement à plusieurs étapes'), true);
assert.equal(prompt.includes('même univers professionnel'), true);
assert.equal(prompt.includes('confusions métier crédibles'), true);
assert.equal(prompt.includes('Outil métier'), true);
assert.equal(prompt.includes('Question candidat : Quel niveau utilisez-vous au quotidien ?'), false);
assert.equal(prompt.includes('Type de réponse : single_choice'), false);
assert.equal(prompt.includes('Opérateur : equals'), false);
assert.equal(prompt.includes('Valeur(s) acceptée(s)'), false);
assert.equal(prompt.includes('exactement 15 questions'), true);
assert.equal(prompt.includes('exactement 5 questions'), true);
assert.equal(prompt.includes('75 % / 25 %'), true);
assert.equal(prompt.includes('description, les missions et le profil recherché'), true);
assert.equal(prompt.includes('compétences indispensables restent prioritaires'), true);
assert.equal(prompt.includes('compétence complémentaire avec au moins une question'), true);
assert.equal(prompt.includes('plus de 5 questions'), true);
assert.equal(prompt.includes('mauvaises réponses doivent être plausibles'), true);
assert.equal(prompt.includes('question-01 à question-20'), true);
for (const hardcodedExample of ['Développeur', 'responsable de magasin', 'client mécontent', 'inventaire', 'rupture de stock', 'Permis B', 'disponible le samedi']) {
  assert.equal(prompt.includes(hardcodedExample), false);
}
assert.equal(prompt.includes('Si la question est libre'), false);
assert.equal(prompt.includes('correctionMode = manual'), false);
assert.equal(prompt.includes('type text'), false);
assert.equal(prompt.includes('"points"'), false);
assert.equal(prompt.includes('Aucune compétence métier renseignée.'), true);
assert.equal(prompt.includes('10 minutes maximum'), true);

console.log('Company questionnaire validation smoke tests: OK');
