import type {
  AssessmentBehaviorAxisCode,
  AssessmentBehaviorContext,
  AssessmentBehaviorModel,
  AssessmentBehaviorQuestionType,
  AssessmentBehaviorSignalValue,
  AssessmentSignalReliability,
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

const BEHAVIOR_AXIS_CODES: AssessmentBehaviorAxisCode[] = [
  'decision_pace',
  'risk_orientation',
  'initiative_validation',
  'framework_adaptation',
  'persistence_switching',
  'analysis_experimentation',
  'speed_precision',
  'ambiguity_tolerance',
  'authority_challenge',
  'disagreement_style',
  'method_exploration',
  'execution_improvement',
  'leadership_activation',
  'influence',
  'followership',
  'collective_support',
  'value_creation',
  'alerting_behavior',
];

const BEHAVIOR_QUESTION_TYPES: AssessmentBehaviorQuestionType[] = [
  'behavioral_situation',
  'tradeoff',
  'direct_self_report',
  'work_preference',
];

const BEHAVIOR_SIGNAL_RELIABILITIES: AssessmentSignalReliability[] = ['high', 'medium', 'low', 'descriptive'];

function buildBehaviorContext(pool: 'essential' | 'extended', index: number): AssessmentBehaviorContext {
  const variants: AssessmentBehaviorContext[] = [
    {
      riskLevel: 'none',
      reversibility: 'not_applicable',
      urgency: 'low',
      authorityContext: 'present',
      informationCompleteness: 'complete',
      collectiveImpact: 'individual',
      priorFailure: 'none',
      socialPressure: 'low',
      helpAvailability: 'available',
      waitingCost: 'low',
      smallScaleTestPossible: true,
    },
    {
      riskLevel: 'medium',
      reversibility: 'high',
      urgency: 'medium',
      authorityContext: 'directive',
      informationCompleteness: 'partial',
      collectiveImpact: 'team',
      priorFailure: 'suspected',
      socialPressure: 'medium',
      helpAvailability: 'limited',
      waitingCost: 'medium',
      smallScaleTestPossible: false,
    },
    {
      riskLevel: 'high',
      reversibility: 'low',
      urgency: 'high',
      authorityContext: 'disagreement',
      informationCompleteness: 'uncertain',
      collectiveImpact: 'organization',
      priorFailure: 'confirmed',
      socialPressure: 'high',
      helpAvailability: 'unavailable',
      waitingCost: 'high',
      smallScaleTestPossible: null,
    },
  ];

  return variants[(index + (pool === 'extended' ? 1 : 0)) % variants.length]!;
}

function buildBehaviorModel(pool: 'essential' | 'extended', index: number): AssessmentBehaviorModel {
  const primaryAxisCode = BEHAVIOR_AXIS_CODES[(index + (pool === 'extended' ? 3 : 0)) % BEHAVIOR_AXIS_CODES.length]!;
  const secondaryAxisCodes = [
    BEHAVIOR_AXIS_CODES[(index + 5) % BEHAVIOR_AXIS_CODES.length]!,
    BEHAVIOR_AXIS_CODES[(index + 11) % BEHAVIOR_AXIS_CODES.length]!,
  ].filter((code, currentIndex, all) => all.indexOf(code) === currentIndex && code !== primaryAxisCode).slice(0, 2);

  return {
    primaryAxisCode,
    secondaryAxisCodes,
    signalReliability: BEHAVIOR_SIGNAL_RELIABILITIES[index % BEHAVIOR_SIGNAL_RELIABILITIES.length]!,
    context: buildBehaviorContext(pool, index),
  };
}

function buildBehaviorSignals(
  behaviorModel: AssessmentBehaviorModel,
  optionIndex: number,
): Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>> {
  const axisCodes = [behaviorModel.primaryAxisCode, ...behaviorModel.secondaryAxisCodes];
  const values: Array<AssessmentBehaviorSignalValue> = [-2, -1, 0, 1, 2];
  return Object.fromEntries(
    axisCodes.map((axisCode, index) => [axisCode, values[(optionIndex + index) % values.length]!] as const),
  ) as Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>>;
}

function buildBankQuestionOption(
  questionId: string,
  option: AssessmentQuestionOption,
  order: number,
  scoringCodes: AssessmentDimensionCode[],
  poolSuffix: string,
  behaviorModel?: AssessmentBehaviorModel,
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
    ...(behaviorModel ? { behaviorSignals: buildBehaviorSignals(behaviorModel, order) } : {}),
  } satisfies SevenoProfessionalAssessmentBankQuestion['options'][number];
}

function buildBankQuestion(
  question: AssessmentQuestion,
  pool: 'essential' | 'extended',
  index: number,
  schemaVersion: 1 | 2 = 1,
) {
  const poolSuffix = `${pool}-${String(index + 1).padStart(2, '0')}`;
  const questionId = `${question.id}-${poolSuffix}`;
  const primaryDimensionCode = question.primaryDimensionCodes[0] ?? question.secondaryDimensionCodes?.[0] ?? 'information_understanding';
  const secondaryDimensionCode = question.secondaryDimensionCodes?.[0] ?? null;
  const scoringCodes = uniqueStrings([
    primaryDimensionCode,
    ...(secondaryDimensionCode ? [secondaryDimensionCode] : []),
  ]).filter((code): code is AssessmentDimensionCode => Boolean(code));
  const behaviorModel = schemaVersion === 2 ? buildBehaviorModel(pool, index) : undefined;

  return {
    questionId,
    path: pool,
    situation: `${question.situation} [${poolSuffix}]`,
    instruction: `${question.instruction} [${poolSuffix}]`,
    primaryDimensionCodes: question.primaryDimensionCodes.length > 0
      ? [...question.primaryDimensionCodes]
      : [primaryDimensionCode],
    ...(secondaryDimensionCode ? { secondaryDimensionCode } : {}),
    ...(schemaVersion === 2 ? {
      questionType: BEHAVIOR_QUESTION_TYPES[index % BEHAVIOR_QUESTION_TYPES.length]!,
      signalReliability: BEHAVIOR_SIGNAL_RELIABILITIES[index % BEHAVIOR_SIGNAL_RELIABILITIES.length]!,
      behaviorModel,
    } : {}),
    options: question.options.map((option, optionIndex) => buildBankQuestionOption(questionId, option, optionIndex + 1, scoringCodes, poolSuffix, behaviorModel)),
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

export function buildSevenoAssessmentBankTestDocument(version: AssessmentVersionDescriptor, schemaVersion: 1 | 2 = 1): SevenoProfessionalAssessmentBankDocument {
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
      schemaVersion,
    },
    essentialQuestionPool: buildBankPool(version, 'essential', SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE).map((question, index) => ({
      ...question,
      ...(schemaVersion === 2 ? {
        questionType: BEHAVIOR_QUESTION_TYPES[index % BEHAVIOR_QUESTION_TYPES.length]!,
        signalReliability: BEHAVIOR_SIGNAL_RELIABILITIES[index % BEHAVIOR_SIGNAL_RELIABILITIES.length]!,
        behaviorModel: buildBehaviorModel('essential', index),
        options: question.options.map((option, optionIndex) => ({
          ...option,
          behaviorSignals: buildBehaviorSignals(buildBehaviorModel('essential', index), optionIndex + 1),
        })),
      } : {}),
    })),
    extendedQuestionPool: buildBankPool(version, 'extended', SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE).map((question, index) => ({
      ...question,
      ...(schemaVersion === 2 ? {
        questionType: BEHAVIOR_QUESTION_TYPES[index % BEHAVIOR_QUESTION_TYPES.length]!,
        signalReliability: BEHAVIOR_SIGNAL_RELIABILITIES[index % BEHAVIOR_SIGNAL_RELIABILITIES.length]!,
        behaviorModel: buildBehaviorModel('extended', index),
        options: question.options.map((option, optionIndex) => ({
          ...option,
          behaviorSignals: buildBehaviorSignals(buildBehaviorModel('extended', index), optionIndex + 1),
        })),
      } : {}),
    })),
    dimensionConfigurations: version.dimensions.map((dimension) => buildDimensionConfiguration(dimension)),
    interpretationBlocks: version.dimensions.map((dimension) => buildInterpretationGroup(dimension)),
    interviewQuestions: buildInterviewQuestions(version),
  };
}

export function buildSevenoAssessmentBankTestJson(version: AssessmentVersionDescriptor, schemaVersion: 1 | 2 = 1) {
  return JSON.stringify(buildSevenoAssessmentBankTestDocument(version, schemaVersion));
}
