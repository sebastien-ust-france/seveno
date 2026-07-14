import assert from 'node:assert/strict';
import {
  SevenoCompanyQuestionnaireError,
  toCompanyQuestionEditorProjection,
  validateCompanyQuestionnaireInput,
} from '@/lib/seveno-company-questionnaires-server';
import type { CompanyQuestion } from '@/types/seveno-company-questionnaires';

function hasCode(code: string) {
  return (error: unknown) => error instanceof SevenoCompanyQuestionnaireError && error.code === code;
}

const baseQuestion = {
  id: 'question-1',
  prompt: 'Quel environnement utilisez-vous ?',
  type: 'single_choice',
  required: true,
  options: [
    { id: 'option-1', label: 'Reponse A', order: 1 },
    { id: 'option-2', label: 'Reponse B', order: 2 },
  ],
  correctionMode: 'automatic',
  expectedAnswer: 'option-2',
  points: 2,
  order: 0,
};

const input = {
  title: 'Evaluation technique',
  instructions: 'Repondez sans aide exterieure.',
  durationMinutes: 20,
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

const privateQuestion = validated.questions[0] as CompanyQuestion;
const projection = toCompanyQuestionEditorProjection(privateQuestion);
assert.equal('expectedAnswer' in projection, false);
assert.equal('numberOperator' in projection, false);
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

console.log('Company questionnaire validation smoke tests: OK');
