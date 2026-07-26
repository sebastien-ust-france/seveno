import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildProfessionalAssessmentCandidateBehavioralProfile,
  buildProfessionalAssessmentReport,
  calculateProfessionalAssessmentOutcome,
  AssessmentModelError,
  projectAssessmentReportForCandidate,
  projectAssessmentReportForCompany,
  validateAssessmentSourceNotLegacy,
  validateAssessmentOption,
  validateAssessmentVersion,
} from '@/lib/seveno-professional-assessment';
import {
  SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_TAG,
  SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_ESSENTIAL_REQUEST,
  SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_INCOMPLETE_REQUEST,
  SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST,
  SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION,
} from '@/lib/seveno-professional-assessment-fixtures';
import type {
  AssessmentBehaviorAxisCode,
  AssessmentQuestion,
  AssessmentQuestionOption,
  AssessmentVersionDescriptor,
  ProfessionalAssessmentAxisDirection,
  ProfessionalAssessmentAxisKind,
  ProfessionalAssessmentAxisResult,
} from '@/types/seveno-assessment';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function cloneQuestion(question: AssessmentQuestion): AssessmentQuestion {
  return {
    ...question,
    options: question.options.map((option) => ({
      ...option,
      dimensionScores: { ...option.dimensionScores },
    })),
    primaryDimensionCodes: [...question.primaryDimensionCodes],
    ...(question.secondaryDimensionCodes ? { secondaryDimensionCodes: [...question.secondaryDimensionCodes] } : {}),
  };
}

function cloneVersion(version: AssessmentVersionDescriptor): AssessmentVersionDescriptor {
  return {
    ...version,
    dimensions: version.dimensions.map((dimension) => ({
      ...dimension,
      interpretationThresholds: dimension.interpretationThresholds.map((threshold) => ({
        ...threshold,
        limitations: [...threshold.limitations],
        interviewQuestionIds: [...threshold.interviewQuestionIds],
      })),
      interviewQuestionIds: [...dimension.interviewQuestionIds],
    })),
    questions: version.questions.map(cloneQuestion),
    revisionNotes: [...version.revisionNotes],
    ...(version.interviewQuestionCatalog ? { interviewQuestionCatalog: { ...version.interviewQuestionCatalog } } : {}),
  };
}

function buildOption(dimensionScores: AssessmentQuestionOption['dimensionScores']): AssessmentQuestionOption {
  return {
    id: 'option-test',
    label: 'Option de test',
    position: 1,
    dimensionScores,
    adminExplanation: 'Explication de test.',
  };
}

const INDEPENDENT_BEHAVIOR_AXIS_CODES = new Set<AssessmentBehaviorAxisCode>([
  'leadership_activation',
  'influence',
  'followership',
  'collective_support',
  'value_creation',
  'alerting_behavior',
]);

function buildAxisResult(
  axisCode: AssessmentBehaviorAxisCode,
  direction: ProfessionalAssessmentAxisDirection,
  overrides: Partial<ProfessionalAssessmentAxisResult> = {},
): ProfessionalAssessmentAxisResult {
  const axisKind: ProfessionalAssessmentAxisKind = INDEPENDENT_BEHAVIOR_AXIS_CODES.has(axisCode)
    ? 'independent'
    : 'bipolar';

  return {
    axisCode,
    axisKind,
    observationCount: 2,
    weightedEvidence: 2,
    weightedMean: axisKind === 'independent'
      ? ({ low: 0.4, moderate: 1, high: 1.6 } as const)[direction as 'low' | 'moderate' | 'high'] ?? 1
      : ({ negative: -0.7, mixed: 0, positive: 0.7 } as const)[direction as 'negative' | 'mixed' | 'positive'] ?? 0,
    direction,
    strength: axisKind === 'independent' ? 0.65 : 0.5,
    stability: 'stable',
    evidenceLevel: 'supported',
    contextSensitive: false,
    contextFactors: [],
    ...overrides,
  };
}

function assertNarrativeFormatting(paragraphs: string[]) {
  assert.equal(paragraphs.every((paragraph) => paragraph.length > 0), true);
  assert.equal(paragraphs.every((paragraph) => !paragraph.includes('undefined')), true);
  assert.equal(paragraphs.every((paragraph) => !paragraph.includes('  ')), true);
  assert.equal(paragraphs.every((paragraph) => !/[.?!]{2,}|,,/.test(paragraph)), true);
}

function mutateForNotMeasured(version: AssessmentVersionDescriptor) {
  const mutated = cloneVersion(version);
  const adaptabilityQuestions = mutated.questions.filter(
    (question) => question.primaryDimensionCodes.includes('adaptability')
      || question.secondaryDimensionCodes?.includes('adaptability'),
  );

  for (const question of adaptabilityQuestions) {
    const primaryDimensionCode = question.primaryDimensionCodes[0];
    question.options.forEach((option, index) => {
      if (question.primaryDimensionCodes.includes('adaptability')) {
        option.dimensionScores = {
          collaboration: [1, 1, 2, 3][index] ?? 1,
        };
        return;
      }

      option.dimensionScores = {
        [primaryDimensionCode]: [1, 2, 3, 3][index] ?? 1,
      };
    });
  }
  return mutated;
}

function mutateForInvalidWeights(version: AssessmentVersionDescriptor) {
  const mutated = cloneVersion(version);
  mutated.dimensions[0] = {
    ...mutated.dimensions[0],
    weight: mutated.dimensions[0].weight - 1,
  };
  return mutated;
}

function mutateForUnknownDimension(version: AssessmentVersionDescriptor) {
  const mutated = cloneVersion(version);
  mutated.dimensions[0] = {
    ...mutated.dimensions[0],
    code: 'unknown_dimension' as never,
  };
  return mutated;
}

function mutateForInvalidOptionScore(version: AssessmentVersionDescriptor, score: number) {
  const mutated = cloneVersion(version);
  mutated.questions[0] = {
    ...mutated.questions[0],
    options: mutated.questions[0].options.map((option, index) => (
      index === 0
        ? {
            ...option,
            dimensionScores: {
              ...option.dimensionScores,
              information_understanding: score,
            },
          }
        : option
    )),
  };
  return mutated;
}

function mutateForDuplicateQuestionId(version: AssessmentVersionDescriptor) {
  const mutated = cloneVersion(version);
  mutated.questions[1] = {
    ...mutated.questions[1],
    id: mutated.questions[0].id,
  };
  return mutated;
}

function mutateForActiveVersion(version: AssessmentVersionDescriptor) {
  const mutated = cloneVersion(version);
  mutated.status = 'active';
  return mutated;
}

function mutateForArchivedVersion(version: AssessmentVersionDescriptor) {
  const mutated = cloneVersion(version);
  mutated.status = 'archived';
  mutated.archivedAt = mutated.updatedAt;
  return mutated;
}

function assertProjectionIsSanitized(value: Record<string, unknown>) {
  assert.equal('overallScore' in value, false);
  assert.equal('globalScore' in value, false);
  assert.equal('employabilityScore' in value, false);
  assert.equal('candidateRankingScore' in value, false);
  assert.equal('compatibilityScore' in value, false);
  assert.equal('evidenceCodes' in value, false);
  assert.equal('answers' in value, false);
  assert.equal('questionIds' in value, false);
  assert.equal('interpretationThresholds' in value, false);
  assert.equal('createdBy' in value, false);
}

function main() {
  assert.equal(SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_TAG, 'TEST_ONLY_FIXTURE_DO_NOT_PUBLISH');

  const validVersionResult = validateAssessmentVersion(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  assert.equal(validVersionResult.valid, true);

  const singleMaxScoreOption = validateAssessmentOption(buildOption({
    information_understanding: 4,
  }));
  assert.equal(singleMaxScoreOption.valid, true);

  const dualMaxScoreOption = validateAssessmentOption(buildOption({
    information_understanding: 4,
    rigor_reliability: 4,
  }));
  assert.equal(dualMaxScoreOption.valid, false);
  assert.equal(
    dualMaxScoreOption.issues.some((issue) => issue.code === 'assessment_option_all_maximum_scores'),
    true,
  );

  const dualDifferentiatedOption = validateAssessmentOption(buildOption({
    information_understanding: 4,
    rigor_reliability: 3,
  }));
  assert.equal(dualDifferentiatedOption.valid, true);

  const singleThreeScoreOption = validateAssessmentOption(buildOption({
    information_understanding: 3,
  }));
  assert.equal(singleThreeScoreOption.valid, true);

  const emptyContributionOption = validateAssessmentOption(buildOption({}));
  assert.equal(emptyContributionOption.valid, false);
  assert.equal(
    emptyContributionOption.issues.some((issue) => issue.code === 'assessment_option_without_contribution'),
    true,
  );
  assert.equal(
    emptyContributionOption.issues.some((issue) => issue.code === 'assessment_option_all_maximum_scores'),
    false,
  );

  const invalidWeightVersion = mutateForInvalidWeights(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  assert.equal(validateAssessmentVersion(invalidWeightVersion).valid, false);

  const unknownDimensionVersion = mutateForUnknownDimension(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  assert.equal(validateAssessmentVersion(unknownDimensionVersion).valid, false);

  const invalidNegativeScoreVersion = mutateForInvalidOptionScore(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION, -1);
  assert.equal(validateAssessmentVersion(invalidNegativeScoreVersion).valid, false);

  const invalidHighScoreVersion = mutateForInvalidOptionScore(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION, 5);
  assert.equal(validateAssessmentVersion(invalidHighScoreVersion).valid, false);

  const duplicateQuestionVersion = mutateForDuplicateQuestionId(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  assert.equal(validateAssessmentVersion(duplicateQuestionVersion).valid, false);

  const activeVersion = mutateForActiveVersion(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  assert.equal(validateAssessmentVersion(activeVersion, { mode: 'edit' }).valid, false);

  const archivedVersion = mutateForArchivedVersion(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  assert.equal(validateAssessmentVersion(archivedVersion, { mode: 'edit' }).valid, false);

  const legacyPayloadResult = validateAssessmentSourceNotLegacy({
    overallScore: 72,
    scoresByDimension: { collaboration: 70 },
    questionnaireVersion: 'legacy-1',
    resultId: 'legacy-result-1',
  });
  assert.equal(legacyPayloadResult.valid, false);

  const deterministicOutcomeA = calculateProfessionalAssessmentOutcome(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST);
  const deterministicOutcomeB = calculateProfessionalAssessmentOutcome(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST);
  assert.deepStrictEqual(deterministicOutcomeA.report, deterministicOutcomeB.report);

  assert.equal(deterministicOutcomeA.report.precisionLevel, 'reinforced');
  assert.equal(deterministicOutcomeA.report.dimensionResults.every((result) => result.status === 'measured'), true);
  assert.equal(deterministicOutcomeA.report.dimensionResults.every((result) => typeof result.score === 'number' && result.score >= 0 && result.score <= 100), true);
  assert.equal(deterministicOutcomeA.report.strengths.length >= 2 && deterministicOutcomeA.report.strengths.length <= 4, true);
  assert.equal(deterministicOutcomeA.report.interviewFocusAreas.length >= 2 && deterministicOutcomeA.report.interviewFocusAreas.length <= 4, true);
  assert.equal(deterministicOutcomeA.report.suggestedInterviewQuestions.length >= 3 && deterministicOutcomeA.report.suggestedInterviewQuestions.length <= 6, true);
  assert.equal('overallScore' in deterministicOutcomeA.report, false);
  assert.equal('globalScore' in deterministicOutcomeA.report, false);

  const essentialOutcome = calculateProfessionalAssessmentOutcome(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_ESSENTIAL_REQUEST);
  assert.equal(essentialOutcome.report.precisionLevel, 'standard');
  assert.equal(essentialOutcome.report.dimensionResults.every((result) => result.status === 'measured'), true);

  const incompleteOutcome = calculateProfessionalAssessmentOutcome(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_INCOMPLETE_REQUEST);
  assert.equal(incompleteOutcome.report.precisionLevel, 'caution');
  assert.equal(incompleteOutcome.report.dimensionResults.some((result) => result.status !== 'measured'), true);

  const notMeasuredVersion = mutateForNotMeasured(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  const notMeasuredOutcome = calculateProfessionalAssessmentOutcome({
    ...SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST,
    version: notMeasuredVersion,
    questions: notMeasuredVersion.questions,
    responses: SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST.responses.map((response) => ({ ...response })),
  });
  const adaptabilityResult = notMeasuredOutcome.report.dimensionResults.find((result) => result.dimensionCode === 'adaptability');
  assert.equal(adaptabilityResult?.status, 'not_measured');
  assert.equal(adaptabilityResult?.score, undefined);

  const invalidResponseRequest = {
    ...SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST,
    responses: [
      {
        ...SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST.responses[0],
        optionId: 'invalid-option-id',
      },
      ...SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST.responses.slice(1),
    ],
  };

  assert.throws(
    () => calculateProfessionalAssessmentOutcome(invalidResponseRequest),
    (error: unknown) => error instanceof AssessmentModelError
      && error.issues.some((issue) => issue.code === 'assessment_response_unknown_option'),
  );

  const candidateProjection = projectAssessmentReportForCandidate(deterministicOutcomeA.report);
  const companyProjection = projectAssessmentReportForCompany(deterministicOutcomeA.report);
  assert.equal(candidateProjection.precisionLevel, deterministicOutcomeA.report.precisionLevel);
  assert.equal(companyProjection.precisionLevel, deterministicOutcomeA.report.precisionLevel);
  assertProjectionIsSanitized(candidateProjection as Record<string, unknown>);
  assertProjectionIsSanitized(companyProjection as Record<string, unknown>);
  assert.equal('evidenceCodes' in (candidateProjection.dimensionResults[0] ?? {}), false);
  assert.equal('evidenceCodes' in (companyProjection.dimensionResults[0] ?? {}), false);
  assert.equal('candidateSummary' in companyProjection, false);
  assert.equal('companySummary' in candidateProjection, false);

  const referenceBehavioralProfile = buildProfessionalAssessmentCandidateBehavioralProfile([
    buildAxisResult('decision_pace', 'positive'),
    buildAxisResult('method_exploration', 'positive'),
    buildAxisResult('execution_improvement', 'negative'),
    buildAxisResult('leadership_activation', 'high', {
      contextSensitive: true,
      contextFactors: ['riskLevel'],
    }),
    buildAxisResult('influence', 'moderate'),
    buildAxisResult('value_creation', 'moderate'),
  ]);

  assert.equal(referenceBehavioralProfile.candidateNarrativeParagraphs?.length ?? 0, 3);
  assert.deepStrictEqual(referenceBehavioralProfile.candidateNarrativeParagraphs, [
    'Dans votre manière de travailler, vous avez tendance à prendre vos décisions assez rapidement avec les éléments disponibles. Vous explorez volontiers de nouvelles méthodes, tout en préférant généralement aller au bout du cadre prévu avant d’introduire des améliorations.',
    'Dans le travail collectif, vous prenez assez naturellement un rôle de coordination lorsque la situation le demande, même si cette tendance paraît varier selon le contexte. Vous avez également tendance à expliquer et argumenter pour faciliter la décision collective.',
    'Vous semblez attentif aux possibilités d’amélioration utiles au-delà de la tâche immédiate.',
  ]);
  assert.deepStrictEqual(referenceBehavioralProfile.candidateThemeGroups?.map((group) => group.title), [
    'Décision et façon de travailler',
    'Fonctionnement collectif',
    'Contribution et vigilance',
  ]);
  assert.deepStrictEqual(referenceBehavioralProfile.candidateThemeGroups?.map((group) => group.items.length), [3, 2, 1]);
  assertNarrativeFormatting(referenceBehavioralProfile.candidateNarrativeParagraphs ?? []);

  const noCollectiveBehavioralProfile = buildProfessionalAssessmentCandidateBehavioralProfile([
    buildAxisResult('decision_pace', 'positive'),
    buildAxisResult('method_exploration', 'positive'),
    buildAxisResult('execution_improvement', 'negative'),
    buildAxisResult('value_creation', 'moderate'),
  ]);
  assert.equal(noCollectiveBehavioralProfile.candidateThemeGroups?.some((group) => group.code === 'COLLECTIVE'), false);
  assert.equal(noCollectiveBehavioralProfile.candidateNarrativeParagraphs?.some((paragraph) => paragraph.includes('travail collectif')), false);
  assertNarrativeFormatting(noCollectiveBehavioralProfile.candidateNarrativeParagraphs ?? []);

  const noContributionBehavioralProfile = buildProfessionalAssessmentCandidateBehavioralProfile([
    buildAxisResult('decision_pace', 'positive'),
    buildAxisResult('method_exploration', 'positive'),
    buildAxisResult('execution_improvement', 'negative'),
    buildAxisResult('leadership_activation', 'high', {
      contextSensitive: true,
      contextFactors: ['riskLevel'],
    }),
    buildAxisResult('influence', 'moderate'),
  ]);
  assert.equal(noContributionBehavioralProfile.candidateThemeGroups?.some((group) => group.code === 'CONTRIBUTION'), false);
  assert.equal(noContributionBehavioralProfile.candidateNarrativeParagraphs?.length ?? 0, 2);
  assertNarrativeFormatting(noContributionBehavioralProfile.candidateNarrativeParagraphs ?? []);

  const minimalBehavioralProfile = buildProfessionalAssessmentCandidateBehavioralProfile([
    buildAxisResult('decision_pace', 'positive'),
    buildAxisResult('leadership_activation', 'high'),
    buildAxisResult('value_creation', 'moderate'),
  ]);
  assert.equal(minimalBehavioralProfile.candidateSummaryItems.length, 3);
  assert.equal(minimalBehavioralProfile.candidateNarrativeParagraphs?.length ?? 0, 3);
  assert.equal(minimalBehavioralProfile.candidateThemeGroups?.length ?? 0, 3);
  assertNarrativeFormatting(minimalBehavioralProfile.candidateNarrativeParagraphs ?? []);

  const engineSource = readSource('lib/seveno-professional-assessment.ts');
  assert.doesNotMatch(engineSource, /candidate_profiles/);
  assert.doesNotMatch(engineSource, /apphosting\.yaml/);
  assert.doesNotMatch(engineSource, /profileStatus/);
  assert.doesNotMatch(engineSource, /testPassed/);

  const legacySource = readSource('lib/seveno-legacy-assessment.ts');
  assert.match(legacySource, /LegacySevenoAssessmentSummary/);

  const report = buildProfessionalAssessmentReport(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_REQUEST);
  assert.deepStrictEqual(report, deterministicOutcomeA.report);

  console.log('SevenO professional assessment profile smoke test: OK');
}

main();
