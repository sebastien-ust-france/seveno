import type {
  AssessmentDimensionCode,
  AssessmentDimensionDefinition,
  AssessmentInterpretationBlock,
  AssessmentQuestion,
  AssessmentQuestionOption,
  AssessmentVersionDescriptor,
} from '@/types/seveno-assessment';
import {
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
  type SevenoProfessionalAssessmentBankDocument,
  type SevenoProfessionalAssessmentBankDimensionConfiguration,
  type SevenoProfessionalAssessmentBankInterpretationBlockGroup,
  type SevenoProfessionalAssessmentBankInterviewQuestion,
  type SevenoProfessionalAssessmentBankQuestion,
} from '@/lib/seveno-professional-assessment-bank';

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function buildInterviewQuestionId(dimensionCode: AssessmentDimensionCode, index: number) {
  return `interview-${dimensionCode.replaceAll('_', '-')}-${index}`;
}

function buildBankQuestionOption(
  questionId: string,
  option: AssessmentQuestionOption,
  order: number,
  scoringCodes: AssessmentDimensionCode[],
  poolSuffix: string,
) {
  const dimensionScores: Partial<Record<AssessmentDimensionCode, number>> = {};
  for (const code of scoringCodes) {
    dimensionScores[code] = typeof option.dimensionScores[code] === 'number' ? option.dimensionScores[code] : 0;
  }

  return {
    id: `${questionId}-option-${order}`,
    label: `${option.label} ${poolSuffix}`,
    order,
    dimensionScores,
    adminExplanation: `${option.adminExplanation} ${poolSuffix}`,
  } satisfies SevenoProfessionalAssessmentBankQuestion['options'][number];
}

function buildBankQuestion(
  question: AssessmentQuestion,
  pool: 'essential' | 'extended',
  index: number,
) {
  const poolSuffix = `${pool}-${String(index + 1).padStart(2, '0')}`;
  const questionId = `${question.id}-${poolSuffix}`;
  const primaryDimensionCode = question.primaryDimensionCodes[0] ?? question.secondaryDimensionCodes?.[0] ?? 'information_understanding';
  const secondaryDimensionCode = question.secondaryDimensionCodes?.[0] ?? null;
  const scoringCodes = uniqueStrings([
    primaryDimensionCode,
    ...(secondaryDimensionCode ? [secondaryDimensionCode] : []),
  ]).filter((code): code is AssessmentDimensionCode => Boolean(code));

  return {
    questionId,
    path: pool,
    situation: `${question.situation} [${poolSuffix}]`,
    instruction: `${question.instruction} [${poolSuffix}]`,
    primaryDimensionCodes: question.primaryDimensionCodes.length > 0
      ? [...question.primaryDimensionCodes]
      : [primaryDimensionCode],
    ...(secondaryDimensionCode ? { secondaryDimensionCode } : {}),
    options: question.options.map((option, optionIndex) => buildBankQuestionOption(questionId, option, optionIndex + 1, scoringCodes, poolSuffix)),
    adminRationale: `${question.adminRationale} [${poolSuffix}]`,
    difficulty: question.difficulty,
    ...(Array.isArray(question.internalTags) && question.internalTags.length > 0 ? { internalTags: [...question.internalTags] } : {}),
  } satisfies SevenoProfessionalAssessmentBankQuestion;
}

function buildDimensionConfiguration(dimension: AssessmentDimensionDefinition) {
  return {
    code: dimension.code,
    label: dimension.label,
    description: dimension.description,
    weight: dimension.weight,
    displayOrder: dimension.displayOrder,
    minimumEssentialObservations: dimension.minimumEssentialObservations,
    minimumExtendedObservations: dimension.minimumExtendedObservations,
    isActive: dimension.isActive,
  } satisfies SevenoProfessionalAssessmentBankDimensionConfiguration;
}

function buildInterpretationGroup(dimension: AssessmentDimensionDefinition) {
  const interviewQuestionId = buildInterviewQuestionId(dimension.code, 1);
  return {
    dimensionCode: dimension.code,
    blocks: dimension.interpretationThresholds.map((threshold) => ({
      interpretationCode: threshold.interpretationCode,
      minScore: threshold.minScore,
      maxScore: threshold.maxScore,
      candidateSummary: threshold.candidateSummary,
      companySummary: threshold.companySummary,
      ...(threshold.strengthLabel ? { strengthLabel: threshold.strengthLabel } : {}),
      interviewFocus: threshold.interviewFocus,
      limitations: [...threshold.limitations],
      interviewQuestionIds: [interviewQuestionId],
    })) satisfies AssessmentInterpretationBlock[],
  } satisfies SevenoProfessionalAssessmentBankInterpretationBlockGroup;
}

function buildInterviewQuestions(version: AssessmentVersionDescriptor) {
  const questions: SevenoProfessionalAssessmentBankInterviewQuestion[] = [];

  for (const dimension of version.dimensions) {
    const questionId = buildInterviewQuestionId(dimension.code, 1);
    questions.push({
      questionId,
      dimensionCode: dimension.code,
      prompt: version.interviewQuestionCatalog?.[questionId] ?? `Comment observer ${dimension.label.toLowerCase()} en entretien ?`,
      rationale: `Question d'entretien pour ${dimension.label}.`,
    });
  }

  return questions;
}

function buildBankPool(version: AssessmentVersionDescriptor, pool: 'essential' | 'extended', poolSize: number) {
  const poolQuestions: SevenoProfessionalAssessmentBankQuestion[] = [];
  const sourceQuestions = version.questions.length > 0 ? version.questions : [];

  for (let index = 0; index < poolSize; index += 1) {
    const sourceQuestion = sourceQuestions[index % sourceQuestions.length];
    if (!sourceQuestion) {
      break;
    }

    poolQuestions.push(buildBankQuestion(sourceQuestion, pool, index));
  }

  return poolQuestions;
}

export function buildSevenoAssessmentBankTestDocument(version: AssessmentVersionDescriptor): SevenoProfessionalAssessmentBankDocument {
  return {
    versionMetadata: {
      name: version.name,
      version: version.version,
      description: version.description,
      generatedPromptVersion: SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
      essentialPoolSize: SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
      extendedPoolSize: SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
      essentialDrawSize: SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
      extendedDrawSize: SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
    },
    essentialQuestionPool: buildBankPool(version, 'essential', SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE),
    extendedQuestionPool: buildBankPool(version, 'extended', SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE),
    dimensionConfigurations: version.dimensions.map((dimension) => buildDimensionConfiguration(dimension)),
    interpretationBlocks: version.dimensions.map((dimension) => buildInterpretationGroup(dimension)),
    interviewQuestions: buildInterviewQuestions(version),
  };
}

export function buildSevenoAssessmentBankTestJson(version: AssessmentVersionDescriptor) {
  return JSON.stringify(buildSevenoAssessmentBankTestDocument(version));
}
