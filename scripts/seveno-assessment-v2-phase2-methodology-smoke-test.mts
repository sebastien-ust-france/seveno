import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSevenoProfessionalAssessmentBankDraw,
  buildSevenoProfessionalAssessmentDraftFromBankDocument,
  parseSevenoProfessionalAssessmentBankDocument,
  simulateSevenoProfessionalAssessmentDraws,
  validateSevenoProfessionalAssessmentBankDocument,
} from '@/lib/seveno-professional-assessment-bank';
import {
  calculateProfessionalAssessmentOutcome,
  projectAssessmentReportForCandidate,
  SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES,
  validateAssessmentVersion,
} from '@/lib/seveno-professional-assessment';
import type {
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentVersionDescriptor,
} from '@/types/seveno-assessment';
import {
  buildPhase2Audit,
  buildPhase2Bank,
  DIMENSION_RUBRICS,
  PHASE2_OUTPUT_PATH,
  PHASE2_SOURCE_PATH,
} from './seveno-assessment-v2-phase2-content.mts';

type ProfileName = 'low' | 'middle' | 'high' | 'heterogeneous';

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function correlation(left: number[], right: number[]) {
  assert.equal(left.length, right.length);
  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce((sum, value, index) => sum + ((value - leftMean) * (right[index] - rightMean)), 0);
  const leftVariance = left.reduce((sum, value) => sum + ((value - leftMean) ** 2), 0);
  const rightVariance = right.reduce((sum, value) => sum + ((value - rightMean) ** 2), 0);
  return numerator / Math.sqrt(leftVariance * rightVariance);
}

function selectOption(question: AssessmentQuestion, profile: ProfileName, questionIndex: number) {
  const dimension = question.primaryDimensionCodes[0];
  assert.ok(dimension);
  const ranked = question.options.map((option) => ({
    option,
    score: option.dimensionScores[dimension] ?? 0,
  }));

  if (profile === 'low') return [...ranked].sort((left, right) => left.score - right.score)[0].option;
  if (profile === 'high') return [...ranked].sort((left, right) => right.score - left.score)[0].option;
  if (profile === 'middle') return [...ranked].sort((left, right) => Math.abs(left.score - 2) - Math.abs(right.score - 2))[0].option;
  return ranked[(questionIndex * 3 + 1) % ranked.length].option;
}

function calculateProfile(version: AssessmentVersionDescriptor, questions: AssessmentQuestion[], profile: ProfileName) {
  const responses: AssessmentResponse[] = questions.map((question, index) => ({
    questionId: question.id,
    optionId: selectOption(question, profile, index).id,
    answeredAt: new Date('2026-08-13T10:00:00.000Z'),
    responseOrder: index + 1,
    sessionId: `phase2-${profile}`,
    responseDurationSeconds: 5,
  }));
  const outcome = calculateProfessionalAssessmentOutcome({
    version,
    completedPath: 'extended',
    questions,
    responses,
    completedAt: new Date('2026-08-13T10:10:00.000Z'),
  });
  const scores = Object.fromEntries(outcome.report.dimensionResults.map((result) => [result.dimensionCode, result.score]));
  const numericScores = Object.values(scores).filter((score): score is number => typeof score === 'number');
  const candidate = projectAssessmentReportForCandidate(outcome.report);
  return {
    outcome,
    scores,
    overallScore: Math.round(mean(numericScores)),
    candidate,
  };
}

function main() {
  const persistedJson = readFileSync(resolve(process.cwd(), PHASE2_OUTPUT_PATH), 'utf8');
  const source = JSON.parse(readFileSync(resolve(process.cwd(), PHASE2_SOURCE_PATH), 'utf8')) as ReturnType<typeof buildPhase2Bank>;
  const generated = buildPhase2Bank();
  const audit = buildPhase2Audit();
  assert.deepEqual(JSON.parse(persistedJson), generated, 'Le JSON versionné doit être la sortie exacte du builder.');

  const bankValidation = validateSevenoProfessionalAssessmentBankDocument(generated);
  assert.equal(bankValidation.valid, true, JSON.stringify(bankValidation.issues, null, 2));
  assert.equal(bankValidation.issues.filter((issue) => issue.severity === 'error').length, 0);
  const parsed = parseSevenoProfessionalAssessmentBankDocument(persistedJson);
  const storedVersion = buildSevenoProfessionalAssessmentDraftFromBankDocument(parsed, {
    createdBy: 'phase2-methodology-smoke',
    now: new Date('2026-08-13T10:00:00.000Z'),
  });
  const version = {
    ...storedVersion,
    createdAt: new Date(storedVersion.createdAt),
    updatedAt: new Date(storedVersion.updatedAt),
  } as AssessmentVersionDescriptor;
  const strictValidation = validateAssessmentVersion(version, { mode: 'definition' });
  assert.equal(strictValidation.valid, true, JSON.stringify(strictValidation.issues, null, 2));
  assert.equal(strictValidation.issues.filter((issue) => issue.severity === 'error').length, 0);

  assert.equal(storedVersion.version, '1.2.0');
  assert.equal(storedVersion.questions.length, 60);
  assert.equal(storedVersion.essentialQuestionCount, 30);
  assert.equal(storedVersion.extendedQuestionCount, 30);
  assert.deepEqual(audit.classificationCounts, { A: 19, B: 22, C: 19 });
  assert.equal(audit.rewrittenQuestionCount, 19);
  assert.equal(audit.rewrittenOptionCount, 76);
  assert.equal(Object.keys(DIMENSION_RUBRICS).length, 7);
  assert.equal(Object.values(DIMENSION_RUBRICS).every((rubric) => rubric.length === 5), true);

  const sourceQuestions = [...source.essentialQuestionPool, ...source.extendedQuestionPool];
  const generatedQuestions = [...generated.essentialQuestionPool, ...generated.extendedQuestionPool];
  for (const question of generatedQuestions) {
    const sourceQuestion = sourceQuestions.find((candidate) => candidate.questionId === question.questionId);
    assert.ok(sourceQuestion);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map((option) => Object.values(option.dimensionScores)[0])).size > 1, true, `${question.questionId}: scores identiques.`);
    assert.deepEqual(
      Object.fromEntries(question.options.map((option) => [option.id, option.behaviorSignals])),
      Object.fromEntries(sourceQuestion.options.map((option) => [option.id, option.behaviorSignals])),
      `${question.questionId}: les behaviorSignals ne doivent pas changer.`,
    );
  }

  const globalScoresByDimension = new Map<string, number[]>();
  const mainDimensionByPool = new Map<string, number>();
  const highestScorePositions = [0, 0, 0, 0];
  const signalValues: number[] = [];
  const dimensionValues: number[] = [];
  let signalPlusTwoMatches = 0;
  let signalComparableCount = 0;

  for (const question of generatedQuestions) {
    const dimension = question.primaryDimensionCodes[0];
    const key = `${question.path}:${dimension}`;
    mainDimensionByPool.set(key, (mainDimensionByPool.get(key) ?? 0) + 1);
    const scores = question.options.map((option) => option.dimensionScores[dimension] ?? 0);
    const highest = Math.max(...scores);
    for (const [index, score] of scores.entries()) if (score === highest) highestScorePositions[index] += 1;
    globalScoresByDimension.set(dimension, [...(globalScoresByDimension.get(dimension) ?? []), ...scores]);

    const axis = question.behaviorModel?.primaryAxisCode;
    for (const option of question.options) {
      const signal = axis ? option.behaviorSignals?.[axis] : undefined;
      const score = option.dimensionScores[dimension];
      if (typeof signal === 'number' && typeof score === 'number') {
        signalValues.push(signal);
        dimensionValues.push(score);
        signalComparableCount += 1;
        if (score === signal + 2) signalPlusTwoMatches += 1;
      }
    }
  }

  for (const dimension of SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES) {
    const scores = globalScoresByDimension.get(dimension) ?? [];
    assert.ok(scores.length > 0, `${dimension}: aucune contribution.`);
    assert.ok(Math.max(...scores) > Math.min(...scores), `${dimension}: span nul.`);
    assert.ok(new Set(scores).size >= 3, `${dimension}: distribution trop pauvre.`);
    assert.ok(mean(scores) >= 1.5 && mean(scores) <= 3.5, `${dimension}: moyenne aberrante.`);
  }

  const targetCounts = {
    information_understanding: 3,
    organization_prioritization: 4,
    problem_solving: 4,
    autonomy_initiative: 3,
    adaptability: 2,
    collaboration: 2,
    rigor_reliability: 2,
  } as const;
  for (const path of ['essential', 'extended'] as const) {
    for (const [dimension, expected] of Object.entries(targetCounts)) {
      assert.ok((mainDimensionByPool.get(`${path}:${dimension}`) ?? 0) >= expected, `${path}:${dimension}: représentation insuffisante.`);
    }
  }

  assert.ok(Math.max(...highestScorePositions) / generatedQuestions.length < 0.7, 'Une position concentre artificiellement tous les meilleurs scores.');
  assert.ok(signalPlusTwoMatches / signalComparableCount < 0.35, 'Les scores semblent dérivés de behaviorSignal + 2.');
  assert.ok(Math.abs(correlation(signalValues, dimensionValues)) < 0.75, 'Corrélation systématique artificielle entre signaux et scores.');

  const drawSimulation = simulateSevenoProfessionalAssessmentDraws(parsed, 100);
  assert.equal(drawSimulation.crossPoolOverlapCount, 0);
  assert.equal(drawSimulation.seedStabilityMatches, 1);
  assert.ok(drawSimulation.uniquePairDraws > 90);

  const profileResults: Array<ReturnType<typeof calculateProfile> & { seed: string; profile: ProfileName }> = [];
  for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
    const draw = buildSevenoProfessionalAssessmentBankDraw(parsed, `phase2:${seed}`);
    assert.equal(draw.essentialQuestionIds.length, 20);
    assert.equal(draw.extendedQuestionIds.length, 20);
    assert.equal(new Set([...draw.essentialQuestionIds, ...draw.extendedQuestionIds]).size, 40);
    const drawnIds = new Set([...draw.essentialQuestionIds, ...draw.extendedQuestionIds]);
    const questions = version.questions.filter((question) => drawnIds.has(question.id));
    assert.equal(questions.length, 40);

    for (const profile of ['low', 'middle', 'high', 'heterogeneous'] as const) {
      const result = calculateProfile(version, questions, profile);
      profileResults.push({ ...result, seed, profile });
      assert.equal(Object.keys(result.scores).length, 7);
      assert.equal(result.outcome.report.dimensionResults.every((dimension) => dimension.status === 'measured'), true);
      assert.ok(result.outcome.report.behavioralProfile);
      assert.ok(result.candidate.behavioralProfile);
      assert.ok(result.candidate.candidateSummary.length > 0);
      assert.ok(result.candidate.dimensionResults.every((dimension) => dimension.interpretationCode.length > 0));
    }

    const seedResults = profileResults.filter((result) => result.seed === seed);
    const low = seedResults.find((result) => result.profile === 'low')!;
    const middle = seedResults.find((result) => result.profile === 'middle')!;
    const high = seedResults.find((result) => result.profile === 'high')!;
    const heterogeneous = seedResults.find((result) => result.profile === 'heterogeneous')!;
    assert.ok(high.overallScore > middle.overallScore);
    assert.ok(middle.overallScore > low.overallScore);
    assert.ok(high.overallScore > 0);
    assert.ok(middle.overallScore > 0);
    assert.notDeepEqual(heterogeneous.scores, middle.scores);
    assert.notDeepEqual(high.scores, low.scores);
  }

  console.log(JSON.stringify({
    versionId: storedVersion.id,
    classifications: audit.classificationCounts,
    rewrittenQuestions: audit.rewrittenQuestionCount,
    rewrittenOptions: audit.rewrittenOptionCount,
    blockingErrors: 0,
    dimensionSpans: 'PASS',
    highestScorePositions,
    signalPlusTwoRatio: signalPlusTwoMatches / signalComparableCount,
    signalScoreCorrelation: correlation(signalValues, dimensionValues),
    profileRuns: profileResults.length,
    overallScoreRange: [Math.min(...profileResults.map((result) => result.overallScore)), Math.max(...profileResults.map((result) => result.overallScore))],
  }, null, 2));
}

main();
