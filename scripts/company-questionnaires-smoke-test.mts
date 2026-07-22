import assert from 'node:assert/strict';
import { buildCompanyQuestionnaireAiPrompt, parseCompanyQuestionnaireAiImport } from '@/lib/seveno-company-questionnaire-ai';
import {
  COMPANY_QUESTION_TIME_LIMIT_SECONDS,
  COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
} from '@/lib/seveno-company-questionnaire-constants';
import {
  SevenoCompanyQuestionnaireError,
  toCompanyQuestionEditorProjection,
  validateCompanyQuestionnaireInput,
} from '@/lib/seveno-company-questionnaires-server';
import { shuffleQuestionIds } from '@/lib/seveno-application-questionnaires-server';
import type { CompanyQuestion } from '@/types/seveno-company-questionnaires';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';

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
    difficulty: index % 3 === 0 ? 'hard' as const : 'medium' as const,
    explanation: `Explication ${index + 1}.`,
    points: 99,
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
  points: 2,
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
      points: 3,
      order: 1,
    },
  ],
};

const validated = validateCompanyQuestionnaireInput(input);
assert.equal(validated.questions.length, 2);
assert.equal(validated.questions[0]?.expectedAnswer, 'option-2');
assert.equal(validated.creationMode, 'manual');

const privateQuestion = validated.questions[0] as CompanyQuestion;
const projection = toCompanyQuestionEditorProjection(privateQuestion);
assert.equal('expectedAnswer' in projection, false);
assert.equal('numberOperator' in projection, false);
assert.equal(projection.explanation, 'La bonne reponse depend du contexte fourni par l offre.');
assert.equal(projection.difficulty, 'medium');
assert.deepEqual(projection.correctOptionIds, ['option-2']);

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
  options: [
    { value: 'option-1', label: 'Ancienne reponse A' },
    { value: 'option-2', label: 'Ancienne reponse B' },
  ],
} as unknown as CompanyQuestion);
assert.deepEqual(legacyProjection.options, [
  { id: 'option-1', label: 'Ancienne reponse A', order: 1 },
  { id: 'option-2', label: 'Ancienne reponse B', order: 2 },
]);

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
assert.equal(imported.questionnaire.questions[0]?.difficulty, 'hard');
assert.equal(imported.questionnaire.questions[0]?.explanation, 'Explication 1.');
assert.deepEqual(imported.questionnaire.questions[0]?.expectedAnswer, 'option-2');
assert.deepEqual(imported.questionnaire.questions[1]?.expectedAnswer, ['option-1', 'option-3']);
assert.equal(imported.questionnaire.questions[0]?.points, 1);
assert.equal(imported.questionnaire.questions[1]?.points, 1);
assert.equal(imported.warnings.length, 0);

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
      prerequisiteCode: 'permit-b',
      prerequisiteVersion: 1,
      source: 'seveno',
      category: 'license',
      companyLabel: 'Permis B obligatoire',
      candidateQuestion: 'Possedez-vous le permis B ?',
      answerType: 'boolean',
      options: [],
      comparisonOperator: 'equals',
      expectedCriterion: true,
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
assert.equal(prompt.includes('Cree exactement 20 questions.'), true);
assert.equal(prompt.includes('questionCount": 20'), true);
assert.equal(prompt.includes('ordre aleatoire'), true);
assert.equal(prompt.includes('independante'), true);
assert.equal(prompt.includes('Si la question est libre'), false);
assert.equal(prompt.includes('correctionMode = manual'), false);
assert.equal(prompt.includes('type text'), false);
assert.equal(prompt.includes('"points"'), false);
assert.equal(prompt.includes('Aucun prerequis enregistre.'), true);
assert.equal(prompt.includes('Permis B obligatoire'), true);
assert.equal(prompt.includes('5 minutes maximum'), true);

console.log('Company questionnaire validation smoke tests: OK');
