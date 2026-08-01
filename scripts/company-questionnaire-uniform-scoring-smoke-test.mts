import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPANY_QUESTION_POINTS } from '@/lib/seveno-company-questionnaire-constants';
import { calculateCompanyQuestionnaireScorePercent } from '@/lib/seveno-company-questionnaire-scoring';

assert.equal(COMPANY_QUESTION_POINTS, 1);
for (const [correct, expected] of [[20, 100], [14, 70], [13, 65], [10, 50], [0, 0]] as const) {
  assert.equal(calculateCompanyQuestionnaireScorePercent(correct, 20), expected);
}
assert.equal(calculateCompanyQuestionnaireScorePercent(0, 0), null);

const editor = readFileSync('components/entreprise/CompanyQuestionnaireEditor.tsx', 'utf8');
assert.doesNotMatch(editor, /Pondération \(points\)|type="number"[^>]*value=\{question\.points\}/);
assert.match(editor, /Chaque question a le même poids dans le résultat\./);
assert.match(editor, /points: COMPANY_QUESTION_POINTS/);
assert.match(editor, /duplicateQuestion[\s\S]*?points: COMPANY_QUESTION_POINTS/);

const server = readFileSync('lib/seveno-company-questionnaires-server.ts', 'utf8');
assert.match(server, /raw\.points === undefined \|\| raw\.points === COMPANY_QUESTION_POINTS/);
assert.match(server, /custom_question_weight_not_allowed/);

const runtime = readFileSync('lib/seveno-application-questionnaires-server.ts', 'utf8');
assert.match(runtime, /points: COMPANY_QUESTION_POINTS/);
assert.match(runtime, /awardedPoints: correct \? COMPANY_QUESTION_POINTS : 0/);
assert.match(runtime, /autoScoredMaximum: COMPANY_QUESTION_POINTS/);
assert.doesNotMatch(runtime, /awardedPoints: correct \? question\.points|autoScoredMaximum: question\.points/);

console.log('Company questionnaire uniform scoring smoke tests: OK');
