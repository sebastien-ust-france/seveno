import assert from 'node:assert/strict';
import {
  buildJobApplicationGuardId,
  calculatePrerequisiteResults,
  evaluatePrerequisiteAnswer,
  isReusablePrerequisiteAnswerFresh,
} from '@/lib/seveno-job-applications-server';
import type { OfferPrerequisiteSnapshot } from '@/types/seveno-prerequisites';

function snapshot(
  code: string,
  answerType: OfferPrerequisiteSnapshot['answerType'],
  comparisonOperator: OfferPrerequisiteSnapshot['comparisonOperator'],
  expectedCriterion: OfferPrerequisiteSnapshot['expectedCriterion'],
  importance: OfferPrerequisiteSnapshot['importance'] = 'required',
  options: OfferPrerequisiteSnapshot['options'] = [],
): OfferPrerequisiteSnapshot {
  return {
    prerequisiteId: code,
    prerequisiteCode: code,
    prerequisiteVersion: 1,
    source: 'seveno',
    category: 'technical_skill',
    companyLabel: code,
    candidateQuestion: `${code} ?`,
    answerType,
    options,
    comparisonOperator,
    expectedCriterion,
    responseScope: 'application_specific',
    evidencePolicy: 'none',
    importance,
  };
}

assert.equal(evaluatePrerequisiteAnswer(snapshot('equals', 'boolean', 'equals', true), true, true), 'satisfied');
assert.equal(evaluatePrerequisiteAnswer(snapshot('minimum', 'number', 'minimum', 2), 3, true), 'satisfied');
assert.equal(evaluatePrerequisiteAnswer(snapshot('maximum', 'number', 'maximum', 4), 5, true), 'unsatisfied');
assert.equal(evaluatePrerequisiteAnswer(snapshot('any', 'multiple_choice', 'contains_any', ['a', 'b'], 'required', [
  { value: 'a', candidateLabel: 'A' }, { value: 'b', candidateLabel: 'B' }, { value: 'c', candidateLabel: 'C' },
]), ['c', 'b'], true), 'satisfied');
assert.equal(evaluatePrerequisiteAnswer(snapshot('all', 'multiple_choice', 'contains_all', ['a', 'b'], 'required', [
  { value: 'a', candidateLabel: 'A' }, { value: 'b', candidateLabel: 'B' },
]), ['a'], true), 'unsatisfied');
assert.equal(evaluatePrerequisiteAnswer(snapshot('before', 'date', 'before', '2026-09-01'), '2026-08-01', true), 'satisfied');
assert.equal(evaluatePrerequisiteAnswer(snapshot('after', 'date', 'after', '2026-09-01'), '2026-10-01', true), 'satisfied');

const level = snapshot('level', 'level', 'minimum', 'B2', 'required', [
  { value: 'B1', candidateLabel: 'B1', rank: 1 },
  { value: 'B2', candidateLabel: 'B2', rank: 2 },
  { value: 'C1', candidateLabel: 'C1', rank: 3 },
]);
assert.equal(evaluatePrerequisiteAnswer(level, 'C1', true), 'satisfied');
assert.equal(evaluatePrerequisiteAnswer(level, 'C1', false), 'unanswered');

const requiredSatisfied = snapshot('required-ok', 'boolean', 'equals', true);
const requiredFailed = snapshot('required-ko', 'boolean', 'equals', true);
const preferred = snapshot('preferred', 'boolean', 'equals', true, 'preferred');
const results = calculatePrerequisiteResults(
  [requiredSatisfied, requiredFailed, preferred],
  new Map([
    ['required-ok', { answerValue: true, confirmed: true }],
    ['required-ko', { answerValue: false, confirmed: true }],
    ['preferred', { answerValue: true, confirmed: true }],
  ]),
);
assert.deepEqual(results.requiredResult, { total: 2, satisfied: 1, unsatisfied: 1, unanswered: 0, allSatisfied: false });
assert.deepEqual(results.preferredResult, { total: 1, satisfied: 1, unsatisfied: 0, unanswered: 0, compatibilityRate: 100 });

const now = Date.now();
assert.equal(isReusablePrerequisiteAnswerFresh({ prerequisiteVersion: 2, freshnessExpiresAt: { toMillis: () => now + 1000 } as never }, 2, now), true);
assert.equal(isReusablePrerequisiteAnswerFresh({ prerequisiteVersion: 2, freshnessExpiresAt: { toMillis: () => now - 1 } as never }, 2, now), false);
assert.equal(isReusablePrerequisiteAnswerFresh({ prerequisiteVersion: 1, freshnessExpiresAt: null }, 2, now), false);

assert.equal(buildJobApplicationGuardId('offer-a', 'candidate-a'), buildJobApplicationGuardId('offer-a', 'candidate-a'));
assert.notEqual(buildJobApplicationGuardId('offer-a', 'candidate-a'), buildJobApplicationGuardId('offer-a', 'candidate-b'));

console.log('Job application compatibility smoke tests: OK');
