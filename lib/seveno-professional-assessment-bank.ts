import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import {
  AssessmentModelError,
  SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES,
  SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_CONTEXT_VALUES,
  SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_QUESTION_TYPES,
  SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES,
  SEVENO_PROFESSIONAL_ASSESSMENT_SIGNAL_RELIABILITY_VALUES,
  validateAssessmentScoringStructure,
} from '@/lib/seveno-professional-assessment';
import type {
  AssessmentBehaviorAxisCode,
  AssessmentBehaviorContext,
  AssessmentBehaviorQuestionType,
  AssessmentBehaviorSignalValue,
  AssessmentDimensionCode,
  AssessmentDimensionDefinition,
  AssessmentInterpretationBlock,
  AssessmentQuestion,
  AssessmentQuestionDifficulty,
  AssessmentScoreValue,
  AssessmentSignalReliability,
  AssessmentValidationIssue,
  AssessmentValidationResult,
  AssessmentVersionDescriptor,
} from '@/types/seveno-assessment';
import type { SevenoAssessmentStoredVersion } from '@/types/seveno-assessment-admin';

export const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION = 'seveno_professional_assessment_bank_v1';
export const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE = 30;
export const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE = 30;
export const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE = 20;
export const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE = 20;
export const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_MAX_DOCUMENT_BYTES = 600 * 1024;
const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_V2_ROOT_KEYS = [
  'versionMetadata',
  'essentialQuestionPool',
  'extendedQuestionPool',
  'dimensionConfigurations',
  'interpretationBlocks',
  'interviewQuestions',
] as const;
const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_V2_INTERPRETATION_RANGES = [
  { minScore: 0, maxScore: 39 },
  { minScore: 40, maxScore: 59 },
  { minScore: 60, maxScore: 74 },
  { minScore: 75, maxScore: 89 },
  { minScore: 90, maxScore: 100 },
] as const;

export const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DRAW_PROFILE = {
  information_understanding: 3,
  organization_prioritization: 4,
  problem_solving: 4,
  autonomy_initiative: 3,
  adaptability: 2,
  collaboration: 2,
  rigor_reliability: 2,
} as const satisfies Record<AssessmentDimensionCode, number>;

export interface SevenoProfessionalAssessmentBankVersionMetadata {
  name: string;
  version: string;
  description: string;
  generatedPromptVersion: string;
  essentialPoolSize: number;
  extendedPoolSize: number;
  essentialDrawSize: number;
  extendedDrawSize: number;
  schemaVersion: 1 | 2;
}

export interface SevenoProfessionalAssessmentBankQuestionOption {
  id: string;
  label: string;
  order: number;
  dimensionScores: Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>>;
  adminExplanation: string;
  behaviorSignals?: Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>>;
}

export interface SevenoProfessionalAssessmentBankQuestion {
  questionId: string;
  path: 'essential' | 'extended';
  situation: string;
  instruction: string;
  primaryDimensionCodes: AssessmentDimensionCode[];
  secondaryDimensionCode?: AssessmentDimensionCode | null;
  questionType?: AssessmentBehaviorQuestionType;
  signalReliability?: AssessmentSignalReliability;
  behaviorModel?: {
    primaryAxisCode: AssessmentBehaviorAxisCode;
    secondaryAxisCodes: AssessmentBehaviorAxisCode[];
    signalReliability: AssessmentSignalReliability;
    context: AssessmentBehaviorContext;
  };
  options: SevenoProfessionalAssessmentBankQuestionOption[];
  adminRationale: string;
  difficulty: AssessmentQuestionDifficulty;
  internalTags?: string[];
}

export interface SevenoProfessionalAssessmentBankDimensionConfiguration {
  code: AssessmentDimensionCode;
  label: string;
  description: string;
  weight: number;
  displayOrder: number;
  minimumEssentialObservations: number;
  minimumExtendedObservations: number;
  isActive: boolean;
}

export interface SevenoProfessionalAssessmentBankInterpretationBlockGroup {
  dimensionCode: AssessmentDimensionCode;
  blocks: AssessmentInterpretationBlock[];
}

export interface SevenoProfessionalAssessmentBankInterviewQuestion {
  questionId: string;
  dimensionCode: AssessmentDimensionCode;
  prompt: string;
  rationale: string;
}

export interface SevenoProfessionalAssessmentBankDocument {
  versionMetadata: SevenoProfessionalAssessmentBankVersionMetadata;
  essentialQuestionPool: SevenoProfessionalAssessmentBankQuestion[];
  extendedQuestionPool: SevenoProfessionalAssessmentBankQuestion[];
  dimensionConfigurations: SevenoProfessionalAssessmentBankDimensionConfiguration[];
  interpretationBlocks: SevenoProfessionalAssessmentBankInterpretationBlockGroup[];
  interviewQuestions: SevenoProfessionalAssessmentBankInterviewQuestion[];
}

export interface SevenoProfessionalAssessmentBankDrawResult {
  essentialQuestionIds: string[];
  extendedQuestionIds: string[];
  essentialQuestions: SevenoProfessionalAssessmentBankQuestion[];
  extendedQuestions: SevenoProfessionalAssessmentBankQuestion[];
}

export interface SevenoProfessionalAssessmentBankSimulationSummary {
  runs: number;
  uniqueEssentialDraws: number;
  uniqueExtendedDraws: number;
  uniquePairDraws: number;
  crossPoolOverlapCount: number;
  seedStabilityMatches: number;
}

const SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_DESCRIPTION_FALLBACK = 'Description à compléter avant import.';

function createIssue(
  code: string,
  path: string,
  message: string,
  severity: AssessmentValidationIssue['severity'] = 'error',
): AssessmentValidationIssue {
  return { code, path, message, severity };
}

function resultFromIssues(issues: AssessmentValidationIssue[]): AssessmentValidationResult {
  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isScore(value: unknown): value is AssessmentScoreValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4;
}

function isKnownDimensionCode(value: unknown): value is AssessmentDimensionCode {
  return typeof value === 'string' && (SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES as readonly string[]).includes(value);
}

function isKnownBehaviorAxisCode(value: unknown): value is AssessmentBehaviorAxisCode {
  return typeof value === 'string' && (SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES as readonly string[]).includes(value);
}

function isKnownBehaviorQuestionType(value: unknown): value is AssessmentBehaviorQuestionType {
  return typeof value === 'string' && (SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_QUESTION_TYPES as readonly string[]).includes(value);
}

function isKnownSignalReliability(value: unknown): value is AssessmentSignalReliability {
  return typeof value === 'string' && (SEVENO_PROFESSIONAL_ASSESSMENT_SIGNAL_RELIABILITY_VALUES as readonly string[]).includes(value);
}

function isKnownBehaviorContextValue<K extends keyof AssessmentBehaviorContext>(
  key: K,
  value: unknown,
): value is AssessmentBehaviorContext[K] {
  return (SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_CONTEXT_VALUES[key] as readonly unknown[]).includes(value);
}

function normalizeBehaviorSignals(
  raw: unknown,
): Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>> | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  return cloneValue(raw) as Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>>;
}

function normalizeBehaviorContext(raw: unknown): AssessmentBehaviorContext | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const context: AssessmentBehaviorContext = {
    riskLevel: isKnownBehaviorContextValue('riskLevel', raw.riskLevel) ? raw.riskLevel : 'none',
    reversibility: isKnownBehaviorContextValue('reversibility', raw.reversibility) ? raw.reversibility : 'not_applicable',
    urgency: isKnownBehaviorContextValue('urgency', raw.urgency) ? raw.urgency : 'none',
    authorityContext: isKnownBehaviorContextValue('authorityContext', raw.authorityContext) ? raw.authorityContext : 'none',
    informationCompleteness: isKnownBehaviorContextValue('informationCompleteness', raw.informationCompleteness) ? raw.informationCompleteness : 'partial',
    collectiveImpact: isKnownBehaviorContextValue('collectiveImpact', raw.collectiveImpact) ? raw.collectiveImpact : 'individual',
    priorFailure: isKnownBehaviorContextValue('priorFailure', raw.priorFailure) ? raw.priorFailure : 'none',
    socialPressure: isKnownBehaviorContextValue('socialPressure', raw.socialPressure) ? raw.socialPressure : 'none',
    helpAvailability: isKnownBehaviorContextValue('helpAvailability', raw.helpAvailability) ? raw.helpAvailability : 'not_applicable',
    waitingCost: isKnownBehaviorContextValue('waitingCost', raw.waitingCost) ? raw.waitingCost : 'none',
    smallScaleTestPossible: typeof raw.smallScaleTestPossible === 'boolean' || raw.smallScaleTestPossible === null
      ? raw.smallScaleTestPossible
      : null,
  };

  return context;
}

function normalizeBehaviorModel(raw: unknown) {
  if (!isRecord(raw)) {
    return undefined;
  }

  const secondaryAxisCodes = Array.isArray(raw.secondaryAxisCodes)
    ? [...new Set(raw.secondaryAxisCodes.map((item) => cleanString(item)).filter(isKnownBehaviorAxisCode))]
    : [];

  if (!isKnownBehaviorAxisCode(raw.primaryAxisCode) || !isKnownSignalReliability(raw.signalReliability)) {
    return undefined;
  }

  const context = normalizeBehaviorContext(raw.context);
  if (!context) {
    return undefined;
  }

  return {
    primaryAxisCode: raw.primaryAxisCode,
    secondaryAxisCodes,
    signalReliability: raw.signalReliability,
    context,
  } satisfies NonNullable<SevenoProfessionalAssessmentBankQuestion['behaviorModel']>;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'fr-FR', { sensitivity: 'base' })) as T[];
}

function normalizeDimensionCodes(values: unknown): AssessmentDimensionCode[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return sortedUnique(values.map((value) => cleanString(value)).filter(isKnownDimensionCode)) as AssessmentDimensionCode[];
}

function normalizeOption(raw: unknown, questionId: string, index: number): SevenoProfessionalAssessmentBankQuestionOption {
  const source = isRecord(raw) ? raw : {};
  const id = cleanString(source.id) || `${questionId}-option-${index + 1}-${randomUUID().slice(0, 8)}`;
  const dimensionScores: Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>> = {};

  if (isRecord(source.dimensionScores)) {
    for (const [key, value] of Object.entries(source.dimensionScores)) {
      if (isKnownDimensionCode(key) && isScore(value)) {
        dimensionScores[key] = value;
      }
    }
  }

  return {
    id,
    label: cleanString(source.label),
    order: isPositiveInteger(source.order) ? source.order : index + 1,
    dimensionScores,
    adminExplanation: cleanString(source.adminExplanation),
    ...(normalizeBehaviorSignals(source.behaviorSignals) ? { behaviorSignals: normalizeBehaviorSignals(source.behaviorSignals) } : {}),
  };
}

function normalizeQuestion(raw: unknown, index: number): SevenoProfessionalAssessmentBankQuestion {
  const source = isRecord(raw) ? raw : {};
  const questionId = cleanString(source.questionId) || `bank-question-${index + 1}-${randomUUID().slice(0, 8)}`;
  const options = Array.isArray(source.options)
    ? source.options.map((option, optionIndex) => normalizeOption(option, questionId, optionIndex))
    : [];

  return {
    questionId,
    path: source.path === 'extended' ? 'extended' : 'essential',
    situation: cleanString(source.situation),
    instruction: cleanString(source.instruction),
    primaryDimensionCodes: normalizeDimensionCodes(source.primaryDimensionCodes),
    ...(isKnownDimensionCode(source.secondaryDimensionCode) ? { secondaryDimensionCode: source.secondaryDimensionCode } : {}),
    ...(isKnownBehaviorQuestionType(source.questionType) ? { questionType: source.questionType } : {}),
    ...(isKnownSignalReliability(source.signalReliability) ? { signalReliability: source.signalReliability } : {}),
    ...(normalizeBehaviorModel(source.behaviorModel) ? { behaviorModel: normalizeBehaviorModel(source.behaviorModel) } : {}),
    options,
    adminRationale: cleanString(source.adminRationale),
    difficulty: source.difficulty === 'standard' || source.difficulty === 'advanced' ? source.difficulty : 'introductory',
    ...(Array.isArray(source.internalTags) ? { internalTags: source.internalTags.map((tag) => cleanString(tag)).filter(Boolean) } : {}),
  };
}

function normalizeDimensionConfiguration(raw: unknown, index: number): SevenoProfessionalAssessmentBankDimensionConfiguration {
  const source = isRecord(raw) ? raw : {};
  const code = isKnownDimensionCode(source.code) ? source.code : SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES[index]!;

  return {
    code,
    label: cleanString(source.label),
    description: cleanString(source.description),
    weight: isPositiveInteger(source.weight) ? source.weight : 0,
    displayOrder: isPositiveInteger(source.displayOrder) ? source.displayOrder : index + 1,
    minimumEssentialObservations: isPositiveInteger(source.minimumEssentialObservations) ? source.minimumEssentialObservations : 1,
    minimumExtendedObservations: isPositiveInteger(source.minimumExtendedObservations) ? source.minimumExtendedObservations : 1,
    isActive: typeof source.isActive === 'boolean' ? source.isActive : true,
  };
}

function normalizeInterpretationBlock(raw: unknown): SevenoProfessionalAssessmentBankInterpretationBlockGroup {
  const source = isRecord(raw) ? raw : {};
  const dimensionCode = isKnownDimensionCode(source.dimensionCode) ? source.dimensionCode : SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES[0]!;
  const blocks = Array.isArray(source.blocks)
    ? source.blocks.map((block) => {
      const blockSource = isRecord(block) ? block : {};
      return {
        interpretationCode: cleanString(blockSource.interpretationCode),
        minScore: isPositiveInteger(blockSource.minScore) || blockSource.minScore === 0 ? Number(blockSource.minScore) : 0,
        maxScore: isPositiveInteger(blockSource.maxScore) || blockSource.maxScore === 0 ? Number(blockSource.maxScore) : 0,
        candidateSummary: cleanString(blockSource.candidateSummary),
        companySummary: cleanString(blockSource.companySummary),
        ...(isNonEmptyString(blockSource.strengthLabel) ? { strengthLabel: cleanString(blockSource.strengthLabel) } : {}),
        interviewFocus: cleanString(blockSource.interviewFocus),
        limitations: Array.isArray(blockSource.limitations) ? blockSource.limitations.map((item) => cleanString(item)).filter(Boolean) : [],
        interviewQuestionIds: Array.isArray(blockSource.interviewQuestionIds) ? blockSource.interviewQuestionIds.map((item) => cleanString(item)).filter(Boolean) : [],
      } satisfies AssessmentInterpretationBlock;
    })
    : [];

  return { dimensionCode, blocks };
}

function normalizeInterviewQuestion(raw: unknown): SevenoProfessionalAssessmentBankInterviewQuestion {
  const source = isRecord(raw) ? raw : {};
  return {
    questionId: cleanString(source.questionId),
    dimensionCode: isKnownDimensionCode(source.dimensionCode) ? source.dimensionCode : SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES[0]!,
    prompt: cleanString(source.prompt),
    rationale: cleanString(source.rationale),
  };
}

function buildBankPromptDescription(version: AssessmentVersionDescriptor) {
  return isNonEmptyString(version.description)
    ? version.description
    : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_DESCRIPTION_FALLBACK;
}

function scanForForbiddenKeys(value: unknown, path = ''): AssessmentValidationIssue[] {
  const issues: AssessmentValidationIssue[] = [];
  const forbidden = new Set(['status', 'publishedAt', 'archivedAt', 'activatedAt', 'globalScore', 'overallScore', 'score', 'rank', 'percentile', 'humanReviewStatus', 'decisionFinal']);

  function visit(node: unknown, currentPath: string) {
    if (!isRecord(node)) {
      if (typeof node === 'string' && node.includes('\uFFFD')) {
        issues.push(createIssue('bank_utf8_corruption', currentPath, 'Le JSON importé contient un caractère UTF-8 invalide.'));
      }
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (forbidden.has(key)) {
        issues.push(createIssue('bank_forbidden_publication_field', childPath, 'Le JSON importé ne doit pas définir de champ de publication ou de score global.'));
      }

      if (typeof child === 'string') {
        if (child.includes('\uFFFD')) {
          issues.push(createIssue('bank_utf8_corruption', childPath, 'Le JSON importé contient un caractère UTF-8 invalide.'));
        }

        if (/(https?:\/\/|www\.|@|\blinkedin\b|\bcv\b|\bcurriculum vitae\b|\b\d{2,}[\s.-]?\d{2,})/i.test(child)) {
          issues.push(createIssue('bank_sensitive_data_detected', childPath, 'Le JSON importé semble contenir des données sensibles.'));
        }
      } else if (Array.isArray(child) || isRecord(child)) {
        visit(child, childPath);
      }
    }
  }

  visit(value, path);
  return issues;
}

function normalizeBankDocument(raw: unknown): SevenoProfessionalAssessmentBankDocument {
  const source = isRecord(raw) ? raw : {};
  const versionMetadata = isRecord(source.versionMetadata) ? source.versionMetadata : {};
  const schemaVersion = versionMetadata.schemaVersion === 2 ? 2 : 1;
  return {
    versionMetadata: {
      name: cleanString(versionMetadata.name),
      version: cleanString(versionMetadata.version),
      description: cleanString(versionMetadata.description),
      generatedPromptVersion: cleanString(versionMetadata.generatedPromptVersion) || SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
      essentialPoolSize: isPositiveInteger(versionMetadata.essentialPoolSize)
        ? Number(versionMetadata.essentialPoolSize)
        : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
      extendedPoolSize: isPositiveInteger(versionMetadata.extendedPoolSize)
        ? Number(versionMetadata.extendedPoolSize)
        : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
      essentialDrawSize: isPositiveInteger(versionMetadata.essentialDrawSize)
        ? Number(versionMetadata.essentialDrawSize)
        : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
      extendedDrawSize: isPositiveInteger(versionMetadata.extendedDrawSize)
        ? Number(versionMetadata.extendedDrawSize)
        : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
      schemaVersion,
    },
    essentialQuestionPool: Array.isArray(source.essentialQuestionPool) ? source.essentialQuestionPool.map((question, index) => normalizeQuestion(question, index)) : [],
    extendedQuestionPool: Array.isArray(source.extendedQuestionPool) ? source.extendedQuestionPool.map((question, index) => normalizeQuestion(question, index)) : [],
    dimensionConfigurations: Array.isArray(source.dimensionConfigurations)
      ? source.dimensionConfigurations.map((dimension, index) => normalizeDimensionConfiguration(dimension, index))
      : [],
    interpretationBlocks: Array.isArray(source.interpretationBlocks)
      ? source.interpretationBlocks.map((block) => normalizeInterpretationBlock(block))
      : [],
    interviewQuestions: Array.isArray(source.interviewQuestions)
      ? source.interviewQuestions.map((item) => normalizeInterviewQuestion(item))
      : [],
  } satisfies SevenoProfessionalAssessmentBankDocument;
}

function uniqueKeySetsMatch(options: SevenoProfessionalAssessmentBankQuestionOption[]) {
  if (options.length !== 4) {
    return false;
  }

  const firstSet = JSON.stringify(sortedUnique(Object.keys(options[0]!.dimensionScores ?? {})));
  return options.every((option) => JSON.stringify(sortedUnique(Object.keys(option.dimensionScores ?? {}))) === firstSet);
}

function validateBehaviorSignals(
  behaviorSignals: unknown,
  context: string,
  allowedAxes: readonly AssessmentBehaviorAxisCode[],
  requireBehaviorSignals: boolean,
  requireExactAxisSet: boolean,
) {
  const issues: AssessmentValidationIssue[] = [];
  if (!isRecord(behaviorSignals)) {
    if (requireBehaviorSignals) {
      issues.push(createIssue('bank_option_missing_behavior_signals', `${context}.behaviorSignals`, 'Les signaux comportementaux sont obligatoires pour une question V2.'));
    }

    return issues;
  }

  const allowedAxisCodes = new Set<string>(allowedAxes);
  if (requireExactAxisSet) {
    for (const axisCode of allowedAxes) {
      if (!(axisCode in behaviorSignals)) {
        issues.push(createIssue('bank_option_missing_behavior_axis', `${context}.behaviorSignals.${axisCode}`, 'Chaque option V2 doit contenir exactement les axes comportementaux declares.'));
      }
    }
  }

  for (const [axisCode, value] of Object.entries(behaviorSignals)) {
    if (!isKnownBehaviorAxisCode(axisCode)) {
      issues.push(createIssue('bank_option_unknown_behavior_axis', `${context}.behaviorSignals.${axisCode}`, 'Un axe comportemental inconnu a ete trouve.'));
      continue;
    }

    if (!allowedAxisCodes.has(axisCode)) {
      issues.push(createIssue('bank_option_disallowed_behavior_axis', `${context}.behaviorSignals.${axisCode}`, 'Un signal comportemental ne peut utiliser qu un axe declare dans le modele comportemental de la question.'));
    }

    const numericValue = typeof value === 'number' ? value : Number.NaN;
    if (!Number.isInteger(numericValue) || numericValue < -2 || numericValue > 2) {
      issues.push(createIssue('bank_option_invalid_behavior_signal', `${context}.behaviorSignals.${axisCode}`, 'Un signal comportemental doit etre compris entre -2 et 2.'));
    }
  }

  return issues;
}

function validateBehaviorContext(context: unknown, path: string) {
  const issues: AssessmentValidationIssue[] = [];
  if (!isRecord(context)) {
    issues.push(createIssue('bank_question_missing_behavior_context', path, 'Le contexte comportemental est obligatoire.'));
    return issues;
  }

  const allowedKeys: Array<keyof AssessmentBehaviorContext> = [
    'riskLevel',
    'reversibility',
    'urgency',
    'authorityContext',
    'informationCompleteness',
    'collectiveImpact',
    'priorFailure',
    'socialPressure',
    'helpAvailability',
    'waitingCost',
    'smallScaleTestPossible',
  ];

  for (const key of Object.keys(context)) {
    if (!allowedKeys.includes(key as keyof AssessmentBehaviorContext)) {
      issues.push(createIssue('bank_question_unknown_behavior_context_field', `${path}.${key}`, 'Le contexte comportemental contient un champ inconnu.'));
    }
  }

  if (!isKnownBehaviorContextValue('riskLevel', context.riskLevel)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.riskLevel`, 'Le niveau de risque est invalide.'));
  }

  if (!isKnownBehaviorContextValue('reversibility', context.reversibility)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.reversibility`, 'La reversibilite est invalide.'));
  }

  if (!isKnownBehaviorContextValue('urgency', context.urgency)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.urgency`, "Le niveau d'urgence est invalide."));
  }

  if (!isKnownBehaviorContextValue('authorityContext', context.authorityContext)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.authorityContext`, "Le contexte d'autorite est invalide."));
  }

  if (!isKnownBehaviorContextValue('informationCompleteness', context.informationCompleteness)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.informationCompleteness`, 'Le niveau de completude de l information est invalide.'));
  }

  if (!isKnownBehaviorContextValue('collectiveImpact', context.collectiveImpact)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.collectiveImpact`, "L'impact collectif est invalide."));
  }

  if (!isKnownBehaviorContextValue('priorFailure', context.priorFailure)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.priorFailure`, 'Le niveau de precedent echec est invalide.'));
  }

  if (!isKnownBehaviorContextValue('socialPressure', context.socialPressure)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.socialPressure`, 'La pression sociale est invalide.'));
  }

  if (!isKnownBehaviorContextValue('helpAvailability', context.helpAvailability)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.helpAvailability`, "La disponibilite d aide est invalide."));
  }

  if (!isKnownBehaviorContextValue('waitingCost', context.waitingCost)) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.waitingCost`, "Le cout de l'attente est invalide."));
  }

  if (typeof context.smallScaleTestPossible !== 'boolean' && context.smallScaleTestPossible !== null) {
    issues.push(createIssue('bank_question_invalid_behavior_context', `${path}.smallScaleTestPossible`, 'La possibilite de test a petite echelle est invalide.'));
  }

  return issues;
}

function validateBehaviorModel(model: unknown, path: string) {
  const issues: AssessmentValidationIssue[] = [];
  if (!isRecord(model)) {
    issues.push(createIssue('bank_question_missing_behavior_model', path, 'Le modele comportemental de la question est obligatoire.'));
    return issues;
  }

  if (!isKnownBehaviorAxisCode(model.primaryAxisCode)) {
    issues.push(createIssue('bank_question_invalid_primary_behavior_axis', `${path}.primaryAxisCode`, 'L axe comportemental principal est invalide.'));
  }

  if (!Array.isArray(model.secondaryAxisCodes)) {
    issues.push(createIssue('bank_question_missing_secondary_behavior_axes', `${path}.secondaryAxisCodes`, 'Les axes secondaires comportementaux doivent etre un tableau.'));
  } else {
    const secondaryAxisCodes = model.secondaryAxisCodes.filter(isKnownBehaviorAxisCode);
    if (secondaryAxisCodes.length !== model.secondaryAxisCodes.length) {
      issues.push(createIssue('bank_question_invalid_secondary_behavior_axis', `${path}.secondaryAxisCodes`, 'Chaque axe secondaire comportemental doit appartenir au referentiel autorise.'));
    }

    if (secondaryAxisCodes.length > 2) {
      issues.push(createIssue('bank_question_too_many_secondary_behavior_axes', `${path}.secondaryAxisCodes`, 'Une question ne peut pas avoir plus de deux axes secondaires comportementaux.'));
    }

    if (secondaryAxisCodes.length !== sortedUnique(secondaryAxisCodes).length) {
      issues.push(createIssue('bank_question_duplicate_behavior_axes', `${path}.secondaryAxisCodes`, 'Les axes secondaires comportementaux doivent etre uniques.'));
    }

    if (isKnownBehaviorAxisCode(model.primaryAxisCode) && secondaryAxisCodes.includes(model.primaryAxisCode)) {
      issues.push(createIssue('bank_question_behavior_axis_overlap', `${path}.secondaryAxisCodes`, 'L axe comportemental principal ne peut pas aussi etre secondaire.'));
    }
  }

  const behaviorAxisCodes = [
    ...(isKnownBehaviorAxisCode(model.primaryAxisCode) ? [model.primaryAxisCode] : []),
    ...(Array.isArray(model.secondaryAxisCodes) ? model.secondaryAxisCodes.filter(isKnownBehaviorAxisCode) : []),
  ];
  const uniqueBehaviorAxisCodes = sortedUnique(behaviorAxisCodes);
  if (uniqueBehaviorAxisCodes.length > 3) {
    issues.push(createIssue('bank_question_too_many_behavior_axes', path, 'Une question ne peut pas observer plus de trois axes comportementaux au total.'));
  }

  if (!isKnownSignalReliability(model.signalReliability)) {
    issues.push(createIssue('bank_question_invalid_signal_reliability', `${path}.signalReliability`, 'La fiabilite du signal comportemental est invalide.'));
  }

  issues.push(...validateBehaviorContext(model.context, `${path}.context`));
  return issues;
}

function optionFingerprint(option: SevenoProfessionalAssessmentBankQuestionOption) {
  return JSON.stringify({
    label: option.label,
    order: option.order,
    dimensionScores: Object.fromEntries(Object.entries(option.dimensionScores).sort(([left], [right]) => left.localeCompare(right, 'fr-FR', { sensitivity: 'base' }))),
    adminExplanation: option.adminExplanation,
  });
}

function questionFingerprint(question: SevenoProfessionalAssessmentBankQuestion) {
  return JSON.stringify({
    path: question.path,
    situation: question.situation,
    instruction: question.instruction,
    primaryDimensionCodes: [...question.primaryDimensionCodes].sort(),
    secondaryDimensionCode: question.secondaryDimensionCode ?? null,
    options: question.options.map((option) => optionFingerprint(option)),
    adminRationale: question.adminRationale,
    difficulty: question.difficulty,
    internalTags: [...(question.internalTags ?? [])].sort(),
  });
}

function validateQuestion(question: SevenoProfessionalAssessmentBankQuestion, context: string, schemaVersion: 1 | 2) {
  const issues: AssessmentValidationIssue[] = [];

  if (!isNonEmptyString(question.questionId)) {
    issues.push(createIssue('bank_question_missing_id', `${context}.questionId`, 'Chaque question doit contenir un identifiant.'));
  }

  if (question.path !== 'essential' && question.path !== 'extended') {
    issues.push(createIssue('bank_question_invalid_path', `${context}.path`, 'Chaque question doit appartenir au parcours essentiel ou approfondi.'));
  }

  if (!isNonEmptyString(question.situation)) {
    issues.push(createIssue('bank_question_missing_situation', `${context}.situation`, 'La situation de la question est obligatoire.'));
  }

  if (!isNonEmptyString(question.instruction)) {
    issues.push(createIssue('bank_question_missing_instruction', `${context}.instruction`, 'La consigne de la question est obligatoire.'));
  }

  if (schemaVersion >= 2) {
    if (!isKnownBehaviorQuestionType(question.questionType)) {
      issues.push(createIssue('bank_question_missing_type', `${context}.questionType`, 'Chaque question V2 doit contenir un type de question comportementale.'));
    }

    if (!isKnownSignalReliability(question.signalReliability)) {
      issues.push(createIssue('bank_question_missing_signal_reliability', `${context}.signalReliability`, 'Chaque question V2 doit contenir une fiabilite de signal.'));
    }

    issues.push(...validateBehaviorModel(question.behaviorModel, `${context}.behaviorModel`));

    if (
      isKnownSignalReliability(question.signalReliability)
      && isRecord(question.behaviorModel)
      && isKnownSignalReliability(question.behaviorModel.signalReliability)
      && question.signalReliability !== question.behaviorModel.signalReliability
    ) {
      issues.push(createIssue('bank_question_signal_reliability_mismatch', `${context}.signalReliability`, 'La fiabilite du signal doit etre identique dans la question et dans le modele comportemental.'));
    }
  }

  if (!Array.isArray(question.options) || question.options.length !== 4) {
    issues.push(createIssue('bank_question_invalid_option_count', `${context}.options`, 'Chaque question doit proposer exactement quatre options.'));
    return issues;
  }

  const optionIds = question.options.map((option) => option.id);
  const duplicateOptionIds = optionIds.filter((id, index) => optionIds.indexOf(id) !== index);
  if (duplicateOptionIds.length > 0) {
    issues.push(createIssue('bank_question_duplicate_option_ids', `${context}.options`, 'Les identifiants des options doivent être uniques.'));
  }

  const normalizedDimensionKeys = question.options.map((option, index) => {
    if (!isNonEmptyString(option.id)) {
      issues.push(createIssue('bank_option_missing_id', `${context}.options[${index}].id`, 'Une option doit contenir un identifiant.'));
    }

    if (!isNonEmptyString(option.label)) {
      issues.push(createIssue('bank_option_missing_label', `${context}.options[${index}].label`, 'Une option doit contenir un libellé.'));
    }

    if (!isPositiveInteger(option.order)) {
      issues.push(createIssue('bank_option_invalid_order', `${context}.options[${index}].order`, 'L ordre de l option doit être un entier positif.'));
    }

    if (!isNonEmptyString(option.adminExplanation)) {
      issues.push(createIssue('bank_option_missing_admin_explanation', `${context}.options[${index}].adminExplanation`, 'Chaque option doit expliquer son intention administrateur.'));
    }

    for (const [dimensionCode, score] of Object.entries(option.dimensionScores ?? {})) {
      if (!isKnownDimensionCode(dimensionCode)) {
        issues.push(createIssue('bank_option_unknown_dimension', `${context}.options[${index}].dimensionScores.${dimensionCode}`, 'Une dimension inconnue a été trouvée.'));
      }

      if (!isScore(score)) {
        issues.push(createIssue('bank_option_invalid_score', `${context}.options[${index}].dimensionScores.${dimensionCode}`, 'Les scores doivent être compris entre 0 et 4.'));
      }
    }

    return JSON.stringify(sortedUnique(Object.keys(option.dimensionScores ?? {})));
  });

  if (normalizedDimensionKeys.some((key) => key !== normalizedDimensionKeys[0])) {
    issues.push(createIssue('bank_question_option_dimension_mismatch', `${context}.options`, 'Les quatre options doivent scorer les mêmes dimensions.'));
  }

  if (!uniqueKeySetsMatch(question.options)) {
    issues.push(createIssue('bank_question_dimension_key_mismatch', `${context}.options`, 'Les options doivent partager exactement les mêmes dimensions de score.'));
  }

  const allowedBehaviorAxisCodes = schemaVersion >= 2 && isRecord(question.behaviorModel)
    ? uniqueStrings([
        ...(isKnownBehaviorAxisCode(question.behaviorModel.primaryAxisCode) ? [question.behaviorModel.primaryAxisCode] : []),
        ...(Array.isArray(question.behaviorModel.secondaryAxisCodes) ? question.behaviorModel.secondaryAxisCodes.filter(isKnownBehaviorAxisCode) : []),
      ]) as AssessmentBehaviorAxisCode[]
    : SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES;

  if (!Array.isArray(question.primaryDimensionCodes) || question.primaryDimensionCodes.length < 1 || question.primaryDimensionCodes.length > 2) {
    issues.push(createIssue('bank_question_invalid_primary_dimensions', `${context}.primaryDimensionCodes`, 'Une question doit avoir une ou deux dimensions principales.'));
  }

  if (question.secondaryDimensionCode && question.primaryDimensionCodes.includes(question.secondaryDimensionCode)) {
    issues.push(createIssue('bank_question_dimension_overlap', `${context}.secondaryDimensionCode`, 'Une dimension secondaire ne peut pas être aussi principale.'));
  }

  if (!isNonEmptyString(question.adminRationale)) {
    issues.push(createIssue('bank_question_missing_rationale', `${context}.adminRationale`, 'La justification administrateur est obligatoire.'));
  }

  if (question.difficulty !== 'introductory' && question.difficulty !== 'standard' && question.difficulty !== 'advanced') {
    issues.push(createIssue('bank_question_invalid_difficulty', `${context}.difficulty`, 'La difficulté de la question est invalide.'));
  }

  for (const [index, option] of question.options.entries()) {
    if (schemaVersion >= 2) {
      if (!isRecord(option.behaviorSignals)) {
        issues.push(createIssue('bank_option_missing_behavior_signals', `${context}.options[${index}].behaviorSignals`, 'Chaque option V2 doit contenir des signaux comportementaux.'));
      } else {
        issues.push(...validateBehaviorSignals(option.behaviorSignals, `${context}.options[${index}]`, allowedBehaviorAxisCodes, true, true));
      }
    } else if (option.behaviorSignals !== undefined) {
      issues.push(...validateBehaviorSignals(option.behaviorSignals, `${context}.options[${index}]`, allowedBehaviorAxisCodes, false, false));
    }
  }

  if (Array.isArray(question.internalTags)) {
    for (const [index, tag] of question.internalTags.entries()) {
      if (!isNonEmptyString(tag)) {
        issues.push(createIssue('bank_question_invalid_internal_tag', `${context}.internalTags[${index}]`, 'Les balises internes doivent être des chaînes non vides.'));
      }
    }
  }

  return issues;
}

function bankQuestionToAssessmentQuestion(
  question: SevenoProfessionalAssessmentBankQuestion,
  versionId: string,
  position: number,
): AssessmentQuestion {
  return {
    id: question.questionId,
    code: question.questionId,
    assessmentVersionId: versionId,
    path: question.path,
    position,
    situation: question.situation,
    instruction: question.instruction,
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      position: option.order,
      dimensionScores: { ...option.dimensionScores },
      adminExplanation: option.adminExplanation,
      ...(option.behaviorSignals ? { behaviorSignals: { ...option.behaviorSignals } } : {}),
    })),
    primaryDimensionCodes: [...question.primaryDimensionCodes],
    ...(question.secondaryDimensionCode ? { secondaryDimensionCodes: [question.secondaryDimensionCode] } : {}),
    ...(question.questionType ? { questionType: question.questionType } : {}),
    ...(question.signalReliability ? { signalReliability: question.signalReliability } : {}),
    ...(question.behaviorModel ? { behaviorModel: { ...question.behaviorModel, secondaryAxisCodes: [...question.behaviorModel.secondaryAxisCodes], context: { ...question.behaviorModel.context } } } : {}),
    difficulty: question.difficulty,
    estimatedReadingSeconds: question.path === 'essential' ? 30 : 45,
    adminRationale: question.adminRationale,
    isActive: true,
  };
}

function collectV2RawQuestionContractIssues(rawDocument: unknown): AssessmentValidationIssue[] {
  const issues: AssessmentValidationIssue[] = [];

  if (!isRecord(rawDocument)) {
    return issues;
  }

  const metadata = isRecord(rawDocument.versionMetadata) ? rawDocument.versionMetadata : {};
  if (metadata.schemaVersion !== 2) {
    return issues;
  }

  const questionPools = [
    { poolKey: 'essentialQuestionPool', poolLabel: 'essentialQuestionPool' },
    { poolKey: 'extendedQuestionPool', poolLabel: 'extendedQuestionPool' },
  ] as const;

  for (const { poolKey, poolLabel } of questionPools) {
    const rawQuestions = Array.isArray(rawDocument[poolKey]) ? rawDocument[poolKey] : [];

    for (const [questionIndex, rawQuestion] of rawQuestions.entries()) {
      if (!isRecord(rawQuestion)) {
        continue;
      }

      const context = `${poolLabel}[${questionIndex}]`;

      const rawPrimaryDimensionCodes = Array.isArray(rawQuestion.primaryDimensionCodes)
        ? rawQuestion.primaryDimensionCodes
        : [];
      const knownPrimaryDimensionCodes = rawPrimaryDimensionCodes.filter(isKnownDimensionCode);

      for (const [dimensionIndex, dimensionCode] of rawPrimaryDimensionCodes.entries()) {
        if (!isKnownDimensionCode(dimensionCode)) {
          issues.push(createIssue(
            'bank_question_invalid_primary_dimension_code',
            `${context}.primaryDimensionCodes[${dimensionIndex}]`,
            'Une dimension principale doit appartenir au referentiel SevenO autorise.',
          ));
        }
      }

      if (rawPrimaryDimensionCodes.length !== sortedUnique(knownPrimaryDimensionCodes).length) {
        issues.push(createIssue(
          'bank_question_duplicate_primary_dimension_code',
          `${context}.primaryDimensionCodes`,
          'Les dimensions principales doivent etre uniques.',
        ));
      }

      if ('secondaryDimensionCode' in rawQuestion && rawQuestion.secondaryDimensionCode !== undefined && !isKnownDimensionCode(rawQuestion.secondaryDimensionCode)) {
        issues.push(createIssue(
          'bank_question_invalid_secondary_dimension_code',
          `${context}.secondaryDimensionCode`,
          'La dimension secondaire doit appartenir au referentiel SevenO autorise.',
        ));
      }

      const rawOptions = Array.isArray(rawQuestion.options) ? rawQuestion.options : [];
      for (const [optionIndex, rawOption] of rawOptions.entries()) {
        if (!isRecord(rawOption) || !isRecord(rawOption.dimensionScores)) {
          continue;
        }

        for (const [dimensionCode] of Object.entries(rawOption.dimensionScores)) {
          if (!isKnownDimensionCode(dimensionCode)) {
            issues.push(createIssue(
              'bank_option_unknown_dimension',
              `${context}.options[${optionIndex}].dimensionScores.${dimensionCode}`,
              'Une dimension inconnue a ete trouvee.',
            ));
          }
        }
      }
    }
  }

  return issues;
}

function buildVersionDimensions(
  dimensionConfigurations: SevenoProfessionalAssessmentBankDimensionConfiguration[],
  interpretationBlocks: SevenoProfessionalAssessmentBankInterpretationBlockGroup[],
  interviewQuestions: SevenoProfessionalAssessmentBankInterviewQuestion[],
): AssessmentDimensionDefinition[] {
  return dimensionConfigurations
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((dimension) => {
      const interpretationGroup = interpretationBlocks.find((group) => group.dimensionCode === dimension.code);
      const questionIds = interviewQuestions.filter((question) => question.dimensionCode === dimension.code).map((question) => question.questionId);

      return {
        code: dimension.code,
        label: dimension.label,
        description: dimension.description,
        weight: dimension.weight,
        displayOrder: dimension.displayOrder,
        minimumEssentialObservations: dimension.minimumEssentialObservations,
        minimumExtendedObservations: dimension.minimumExtendedObservations,
        interpretationThresholds: [...(interpretationGroup?.blocks ?? [])],
        interviewQuestionIds: questionIds,
        isActive: dimension.isActive,
      };
    });
}

function hashRank(seed: string, value: string) {
  return createHash('sha256').update(`${seed}:${value}`).digest('hex');
}

function drawStratifiedQuestions(
  pool: SevenoProfessionalAssessmentBankQuestion[],
  seed: string,
  totalQuestions: number,
  targetCounts = SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DRAW_PROFILE,
) {
  const grouped = new Map<AssessmentDimensionCode, SevenoProfessionalAssessmentBankQuestion[]>();
  for (const code of SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES) {
    grouped.set(code, []);
  }

  for (const question of pool) {
    const primary = question.primaryDimensionCodes[0] ?? question.secondaryDimensionCode ?? null;
    if (!primary) {
      continue;
    }

    grouped.get(primary)?.push(question);
  }

  const selected = new Map<string, SevenoProfessionalAssessmentBankQuestion>();
  for (const [dimensionCode, count] of Object.entries(targetCounts) as Array<[AssessmentDimensionCode, number]>) {
    const bucket = [...(grouped.get(dimensionCode) ?? [])].sort((left, right) => hashRank(seed, `${dimensionCode}:${left.questionId}`).localeCompare(hashRank(seed, `${dimensionCode}:${right.questionId}`)));
    for (const question of bucket) {
      if (selected.size >= totalQuestions) {
        break;
      }
      if (!selected.has(question.questionId) && selected.size < totalQuestions) {
        selected.set(question.questionId, question);
      }
      if ([...selected.values()].filter((item) => (item.primaryDimensionCodes[0] ?? item.secondaryDimensionCode ?? '') === dimensionCode).length >= count) {
        break;
      }
    }
  }

  if (selected.size < totalQuestions) {
    const remaining = [...pool].sort((left, right) => hashRank(seed, left.questionId).localeCompare(hashRank(seed, right.questionId)));
    for (const question of remaining) {
      if (selected.size >= totalQuestions) {
        break;
      }
      if (!selected.has(question.questionId)) {
        selected.set(question.questionId, question);
      }
    }
  }

  return [...selected.values()].slice(0, totalQuestions);
}

type BankPromptQuestionOptionSource = {
  id: string;
  label: string;
  order?: number;
  dimensionScores: Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>>;
  adminExplanation: string;
};

function buildBankPromptQuestionDimensionScoreKeys(
  question: { options: BankPromptQuestionOptionSource[] },
): AssessmentDimensionCode[] {
  return sortedUnique(
    question.options.flatMap((option) => Object.keys(option.dimensionScores ?? {})).filter(isKnownDimensionCode),
  );
}

function buildBankPromptQuestionDimensionScores(
  dimensionScoreKeys: AssessmentDimensionCode[],
  option: BankPromptQuestionOptionSource,
): Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>> {
  return Object.fromEntries(
    dimensionScoreKeys.map((dimensionCode) => [dimensionCode, option.dimensionScores[dimensionCode] ?? 0] as const),
  ) as Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>>;
}

function buildBankPromptQuestionDimensionScoresFromValues(
  dimensionScoreKeys: AssessmentDimensionCode[],
  values: AssessmentScoreValue[],
): Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>> {
  return Object.fromEntries(
    dimensionScoreKeys.map((dimensionCode, index) => [dimensionCode, values[index] ?? 0] as const),
  ) as Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>>;
}

function buildBankPromptQuestionOptions(
  options: BankPromptQuestionOptionSource[],
): SevenoProfessionalAssessmentBankQuestion['options'] {
  const dimensionScoreKeys = buildBankPromptQuestionDimensionScoreKeys({ options });

  return options.map((option, index) => ({
    id: option.id,
    label: option.label,
    order: option.order ?? index + 1,
    dimensionScores: buildBankPromptQuestionDimensionScores(dimensionScoreKeys, option),
    adminExplanation: cleanString(option.adminExplanation),
  }));
}

function buildBankPromptDimensionExample(dimension: AssessmentDimensionDefinition): SevenoProfessionalAssessmentBankDimensionConfiguration {
  return {
    code: dimension.code,
    label: dimension.label,
    description: dimension.description,
    weight: dimension.weight,
    displayOrder: dimension.displayOrder,
    minimumEssentialObservations: dimension.minimumEssentialObservations,
    minimumExtendedObservations: dimension.minimumExtendedObservations,
    isActive: dimension.isActive,
  };
}

function buildBankPromptInterpretationGroupExample(
  dimension: AssessmentDimensionDefinition,
  interviewQuestionIdsOverride?: string[],
): SevenoProfessionalAssessmentBankInterpretationBlockGroup {
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
      interviewQuestionIds: interviewQuestionIdsOverride ? [...interviewQuestionIdsOverride] : [...threshold.interviewQuestionIds],
    })),
  };
}

function buildBankPromptInterviewQuestionExample(
  dimension: AssessmentDimensionDefinition,
  questionId: string,
  version?: AssessmentVersionDescriptor,
): SevenoProfessionalAssessmentBankInterviewQuestion {
  return {
    questionId,
    dimensionCode: dimension.code,
    prompt: version?.interviewQuestionCatalog?.[questionId] ?? `Comment observer ${dimension.label.toLowerCase()} en entretien ?`,
    rationale: `Question d'entretien pour ${dimension.label}.`,
  };
}

function buildBankPromptExample(version: AssessmentVersionDescriptor) {
  const promptDescription = buildBankPromptDescription(version);
  const sortedDimensions = [...version.dimensions].sort((left, right) => left.displayOrder - right.displayOrder);
  const essentialQuestion = version.questions.find((question) => question.path === 'essential') ?? version.questions[0];
  const extendedQuestion = version.questions.find((question) => question.path === 'extended' && question.id !== essentialQuestion?.id)
    ?? version.questions.find((question) => question.path === 'extended')
    ?? version.questions[0];
  const interpretationDimension = sortedDimensions.find((dimension) => dimension.interpretationThresholds.length > 0) ?? sortedDimensions[0];
  const interviewQuestionId = interpretationDimension ? `interview-${interpretationDimension.code.replaceAll('_', '-')}-1` : null;
  const extendedDimensionScoreKeys = extendedQuestion ? buildBankPromptQuestionDimensionScoreKeys(extendedQuestion) : [];
  const essentialQuestionExample = essentialQuestion ? {
    questionId: essentialQuestion.id,
    path: essentialQuestion.path,
    situation: essentialQuestion.situation,
    instruction: essentialQuestion.instruction,
    primaryDimensionCodes: [...essentialQuestion.primaryDimensionCodes],
    ...(essentialQuestion.secondaryDimensionCodes?.[0] ? { secondaryDimensionCode: essentialQuestion.secondaryDimensionCodes[0] } : {}),
    options: buildBankPromptQuestionOptions(essentialQuestion.options),
    adminRationale: essentialQuestion.adminRationale,
    difficulty: essentialQuestion.difficulty,
  } : null;
  const extendedQuestionExample = extendedQuestion ? {
    questionId: `${extendedQuestion.id}-illustration`,
    path: extendedQuestion.path,
    situation: 'Une consigne importante manque de précision.',
    instruction: 'Que faites-vous d’abord ?',
    primaryDimensionCodes: [...extendedQuestion.primaryDimensionCodes],
    ...(extendedQuestion.secondaryDimensionCodes?.[0] ? { secondaryDimensionCode: extendedQuestion.secondaryDimensionCodes[0] } : {}),
    options: [
      {
        id: `${extendedQuestion.id}-illustration-option-1`,
        label: 'Je commence par ce qui est certain.',
        order: 1,
        dimensionScores: buildBankPromptQuestionDimensionScoresFromValues(extendedDimensionScoreKeys, [0, 1, 0]),
        adminExplanation: 'Réponse prudente mais incomplète.',
      },
      {
        id: `${extendedQuestion.id}-illustration-option-2`,
        label: 'Je demande une reformulation complète.',
        order: 2,
        dimensionScores: buildBankPromptQuestionDimensionScoresFromValues(extendedDimensionScoreKeys, [1, 2, 1]),
        adminExplanation: 'Réponse sécurisante mais un peu coûteuse en temps.',
      },
      {
        id: `${extendedQuestion.id}-illustration-option-3`,
        label: 'Je vérifie l’essentiel, puis je confirme le point ambigu.',
        order: 3,
        dimensionScores: buildBankPromptQuestionDimensionScoresFromValues(extendedDimensionScoreKeys, [4, 4, 3]),
        adminExplanation: 'Réponse structurée et la plus équilibrée.',
      },
      {
        id: `${extendedQuestion.id}-illustration-option-4`,
        label: 'Je retiens l’interprétation qui paraît la plus probable.',
        order: 4,
        dimensionScores: buildBankPromptQuestionDimensionScoresFromValues(extendedDimensionScoreKeys, [3, 3, 2]),
        adminExplanation: 'Réponse plausible mais un peu trop spéculative.',
      },
    ],
    adminRationale: `Exemple approfondi distinct pour ${extendedQuestion.primaryDimensionCodes.map((code) => code.replaceAll('_', ' ')).join(' et ')}.`,
    difficulty: extendedQuestion.difficulty,
  } : null;
  const interpretationGroup = interpretationDimension && interviewQuestionId
    ? buildBankPromptInterpretationGroupExample(interpretationDimension, [interviewQuestionId])
    : null;
  const interviewQuestions = interpretationDimension && interviewQuestionId
    ? [buildBankPromptInterviewQuestionExample(interpretationDimension, interviewQuestionId, version)]
    : [];

  return {
    versionMetadata: {
      name: version.name,
      version: version.version,
      description: promptDescription,
      generatedPromptVersion: version.generatedPromptVersion ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
      essentialPoolSize: version.essentialPoolSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
      extendedPoolSize: version.extendedPoolSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
      essentialDrawSize: version.essentialDrawSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
      extendedDrawSize: version.extendedDrawSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
    },
    essentialQuestionPool: essentialQuestionExample ? [essentialQuestionExample] : [],
    extendedQuestionPool: extendedQuestionExample ? [extendedQuestionExample] : [],
    dimensionConfigurations: sortedDimensions.map((dimension) => buildBankPromptDimensionExample(dimension)),
    interpretationBlocks: interpretationGroup ? [interpretationGroup] : [],
    interviewQuestions,
  };
}

function buildBankPromptRules(version: AssessmentVersionDescriptor) {
  const promptDescription = buildBankPromptDescription(version);
  const dimensionLines = version.dimensions
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((dimension) => `- ${dimension.code}: ${dimension.label}`);

  const allowedDimensionCodes = version.dimensions
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((dimension) => dimension.code)
    .join(', ');

  const drawProfile = Object.entries(SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DRAW_PROFILE)
    .map(([code, count]) => `${code}: ${count}`)
    .join(', ');

  return [
    `Version technique du brouillon: ${version.version}`,
    `Nom du brouillon: ${version.name}`,
    `Description du brouillon: ${promptDescription}`,
    `Version du générateur attendue: ${version.generatedPromptVersion ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION}`,
    'Tu dois répondre uniquement par un objet JSON valide, sans Markdown, sans bloc de code, sans commentaire et sans texte avant ni après.',
    'Le JSON doit contenir exactement les clés suivantes: versionMetadata, essentialQuestionPool, extendedQuestionPool, dimensionConfigurations, interpretationBlocks, interviewQuestions.',
    'Aucun champ supplémentaire inconnu ne doit être ajouté.',
    'Aucune valeur undefined ne doit être produite.',
    'Les guillemets doubles sont obligatoires et aucun trailing comma n est autorisé.',
    'Les champs de publication et de score global sont interdits: status, publishedAt, archivedAt, activatedAt, humanReviewStatus, decisionFinal, globalScore, overallScore, score, rank, percentile.',
    'Aucun champ de précision calculée n est attendu dans cette banque: les niveaux de précision sont calculés ensuite par le moteur SevenO.',
    'Le JSON ne doit contenir aucune donnée sensible, aucun email, aucun téléphone, aucune URL, aucun CV, aucun lien LinkedIn, aucun secret, aucun token ni aucune clé.',
    'La description de la version est obligatoire et ne peut pas être vide.',
    'Le questionnaire est général et indépendant de tout métier.',
    'Chaque question doit pouvoir être comprise et traitée équitablement par une personne travaillant dans la logistique, la vente, la restauration, l’entretien, l’industrie, le bâtiment, la santé, l’administration, l’informatique ou les services.',
    'Aucune question ne doit nécessiter de connaissance professionnelle ou sectorielle.',
    'Évite les contextes liés à un client, un logiciel, un chantier, une commande, un stock, une caisse, un patient, un contrat, un dossier, un projet ou un métier précis.',
    'Utilise uniquement des situations véritablement transversales: une consigne imprécise, une information contradictoire, une erreur, un changement, une priorité, un imprévu, plusieurs tâches, une difficulté, une décision, une coopération, une vérification.',
    'Ne rends pas une situation artificiellement générique en remplaçant simplement "client" par "personne". Reconstruis réellement la situation autour d’un comportement universel.',
    'Le candidat dispose de 30 secondes pour lire la question, lire les quatre réponses, réfléchir et choisir.',
    'La partie visible de la question est composée de `situation` et `instruction`.',
    'La somme des mots de `situation` et `instruction` ne doit pas dépasser 18 mots.',
    'Chaque label de réponse ne doit pas dépasser 12 mots.',
    'La somme des mots de `situation`, `instruction` et des quatre labels de réponse ne doit pas dépasser 60 mots.',
    'Les champs `adminExplanation` et `adminRationale` ne sont pas inclus dans ce budget de lecture, car ils ne sont pas affichés au candidat pendant le test.',
    'Une seule idée principale par réponse.',
    'Aucune justification longue dans les réponses.',
    'Aucun jargon.',
    'Aucune double négation.',
    'Aucune phrase inutilement complexe.',
    'Les explications administratives peuvent être plus longues, car elles ne sont pas affichées pendant le test candidat.',
    'Le timer reste fixé à 30 secondes.',
    'La banque doit contenir exactement 7 dimensionConfigurations, une par dimension autorisée.',
    `Les pools doivent contenir exactement ${version.essentialPoolSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE} questions essentielles et ${version.extendedPoolSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE} questions approfondies.`,
    `Le système tirera ensuite exactement ${version.essentialDrawSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE} questions essentielles et ${version.extendedDrawSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE} questions approfondies.`,
    `La répartition cible des pools doit permettre le tirage suivant: ${drawProfile}.`,
    'Chaque question doit proposer exactement 4 options.',
    'Chaque option doit contenir: id, order, label, dimensionScores, adminExplanation.',
    'Chaque option doit avoir un identifiant unique dans sa question.',
    'Chaque option doit contenir un label et une adminExplanation non vides.',
    'Les scores de dimension doivent être des entiers compris entre 0 et 4 inclus.',
    'Les clés de dimensionScores doivent appartenir uniquement aux dimensions autorisées.',
    'Les quatre options d une même question doivent scorer exactement les mêmes dimensions.',
    'Pour une même question, les quatre objets dimensionScores doivent avoir exactement les mêmes clés. Lorsque secondaryDimensionCode est présent et doit être scoré, cette dimension doit apparaître dans dimensionScores pour chacune des quatre options.',
    'Aucune paire de questions ne doit partager le même ensemble complet de quatre réponses.',
    'Les questions essential et extended ne doivent pas réutiliser les mêmes quatre options.',
    'Les exemples essential et extended doivent illustrer des situations distinctes, avec quatre réponses, explications et barèmes distincts.',
    'Les réponses doivent être directement liées à la situation tout en restant universelles, sans objet, outil, rôle, procédure ou connaissance propre à un métier.',
    'Chaque score doit être expliqué par adminExplanation.',
    'Éviter les réponses manifestement parfaites ou absurdes.',
    'Chaque question doit contenir: questionId, path, situation, instruction, primaryDimensionCodes, secondaryDimensionCode optionnel, difficulty, adminRationale, options, internalTags optionnel.',
    'Chaque question doit avoir un questionId unique sur l ensemble de la banque.',
    'Chaque question doit contenir une situation, une instruction et une justification administrateur non vides.',
    'Le champ isActive ne doit pas être fourni pour les questions de la banque: elles sont activées automatiquement à l import.',
    'path doit valoir essential ou extended.',
    'difficulty doit valoir introductory, standard ou advanced.',
    'primaryDimensionCodes doit contenir une ou deux dimensions.',
    'secondaryDimensionCode, si présent, doit être différent des dimensions principales.',
    'Chaque dimensionConfiguration doit contenir: code, label, description, weight, displayOrder, minimumEssentialObservations, minimumExtendedObservations, isActive.',
    'Chaque dimensionConfiguration doit avoir un libellé non vide, une description non vide, un poids entier positif, un displayOrder entier positif et des minima d observations positifs.',
    'La somme des poids des dimensions doit être égale à 100.',
    `Les codes de dimensions autorisés sont fermés: ${allowedDimensionCodes}.`,
    ...dimensionLines,
    'Chaque interpretationBlocks group doit contenir: dimensionCode et blocks.',
    'Chaque dimension doit disposer d un seul groupe interpretationBlocks.',
    'Chaque dimension doit avoir exactement 5 blocs d interprétation couvrant 0-39, 40-59, 60-74, 75-89 et 90-100.',
    'Chaque bloc d interprétation doit contenir: interpretationCode, minScore, maxScore, candidateSummary, companySummary, strengthLabel optionnel, interviewFocus, limitations, interviewQuestionIds.',
    'Chaque bloc d interprétation doit remplir candidateSummary, companySummary, interviewFocus et interviewQuestionIds.',
    'Chaque dimension doit référencer au moins une interviewQuestion.',
    'Chaque interviewQuestion doit contenir: questionId, dimensionCode, prompt, rationale.',
    'Chaque interviewQuestion doit avoir un questionId unique, un dimensionCode autorisé, un prompt non vide et une rationale non vide.',
    'Chaque valeur de interviewQuestionIds doit correspondre exactement au questionId d une interviewQuestion existante.',
    'La question d entretien référencée doit avoir le même dimensionCode que le groupe d interprétation.',
    'Aucun questionId de question essential ou extended ne doit être réutilisé comme questionId d interviewQuestion.',
    'Les identifiants d interviewQuestion doivent utiliser une convention distincte comme interview-information-understanding-1.',
    'Générique ne signifie pas évident ou infantile.',
    'Les quatre réponses doivent être crédibles et proches les unes des autres.',
    'La difficulté doit venir de la nuance entre plusieurs comportements plausibles : ordre des actions, degré de vérification, équilibre entre autonomie et demande d’aide, gestion de l’incertitude, capacité à prioriser, réaction face à une erreur ou un changement.',
    'Ne crée jamais une bonne réponse évidente accompagnée de trois comportements absurdes.',
    'Évite notamment les réponses caricaturales comme : je ne fais rien, j’ignore le problème, je mens, je fais toujours ce que je veux.',
    'Une réponse de niveau faible doit rester humainement plausible.',
    'La meilleure réponse ne doit pas être systématiquement la plus longue.',
    'Exemple illustratif:',
    'Situation :',
    '« Une consigne importante manque de précision. »',
    'Instruction :',
    '« Que faites-vous d’abord ? »',
    'Options possibles :',
    '1. « Je commence par ce qui est certain. »',
    '2. « Je demande une reformulation complète. »',
    '3. « Je vérifie l’essentiel, puis je confirme le point ambigu. »',
    '4. « Je retiens l’interprétation qui paraît la plus probable. »',
    'Cet exemple illustre uniquement la généricité, la concision et la nuance attendues. Il ne doit pas être recopié ou décliné mécaniquement dans plusieurs questions.',
    'L’extrait JSON contient volontairement des formulations de démonstration comme :',
    '- « Situation professionnelle 1 »',
    '- « Réponse A »',
    '- « Réponse B »',
    '- « Réponse C »',
    '- « Réponse D »',
    '- « Question de test »',
    '- « Exemple approfondi »',
    '- « Texte à compléter »',
    '- « Placeholder ».',
    'Ces formulations sont uniquement des exemples de remplissage et ne doivent pas être réutilisées dans la sortie finale.',
    'Chaque `situation`, `instruction`, `label`, `adminExplanation`, `adminRationale`, résumé, interprétation et question d’entretien doit être entièrement rédigé, cohérent et directement exploitable.',
    'Avant de retourner le JSON, contrôle chaque question selon les critères suivants :',
    '1. Pourrait-elle être proposée sans désavantage à un cariste, une vendeuse, un cuisinier, un agent administratif et un développeur ?',
    '2. Nécessite-t-elle une connaissance métier ou sectorielle ?',
    '3. La somme des mots de `situation` et `instruction` est-elle inférieure ou égale à 18 ?',
    '4. Chaque réponse contient-elle au maximum 12 mots ?',
    '5. L’ensemble visible contient-il au maximum 60 mots ?',
    '6. Les quatre réponses sont-elles toutes plausibles ?',
    '7. La meilleure réponse est-elle identifiable par sa qualité plutôt que par sa longueur ?',
    '8. La question reste-t-elle suffisamment nuancée pour être discriminante ?',
    'Corrige toute question non conforme avant de produire le résultat final.',
    'Retourne uniquement le JSON valide, sans introduction, sans commentaire et sans bloc Markdown.',
    'Extrait structurel volontairement incomplet, fourni uniquement pour illustrer la forme des objets. Ne pas reproduire les quantités de cet extrait. La sortie finale doit respecter toutes les quantités, couvertures et contraintes imposées ci-dessus.',
    JSON.stringify(buildBankPromptExample(version), null, 2),
  ];
}

export function buildSevenoProfessionalAssessmentBankPrompt(version: AssessmentVersionDescriptor) {
  const lines = [
    'Tu es un générateur de banque d analyse professionnelle SevenO.',
    'Produis un JSON strictement conforme au schéma demandé.',
    '',
    ...buildBankPromptRules(version),
    '',
    'Rappels:',
    '- Conserver le contenu centré sur des situations de travail universelles, compréhensibles dans tous les métiers et ne nécessitant aucune connaissance professionnelle ou sectorielle.',
    '- Ne pas publier la banque dans cet état.',
    '- Ne pas ajouter de score global ni de recommandation automatique.',
    '- Ne jamais ajouter de statut de publication défini par l IA.',
  ];

  return lines.join('\n');
}

function collectBankValidationIssues(rawDocument: unknown, document: SevenoProfessionalAssessmentBankDocument) {
  const issues: AssessmentValidationIssue[] = [];

  issues.push(...scanForForbiddenKeys(rawDocument));

  if (!isRecord(rawDocument)) {
    issues.push(createIssue('bank_document_invalid_root', 'root', 'Le JSON importé doit être un objet.'));
    return issues;
  }

  const metadata = isRecord(rawDocument.versionMetadata) ? rawDocument.versionMetadata : {};
  if (!isNonEmptyString(metadata.name)) {
    issues.push(createIssue('bank_missing_version_name', 'versionMetadata.name', 'Le nom de la version est obligatoire.'));
  }

  if (!isNonEmptyString(metadata.version) || !/^\d+\.\d+\.\d+$/.test(cleanString(metadata.version))) {
    issues.push(createIssue('bank_invalid_version_number', 'versionMetadata.version', 'La version doit suivre une numérotation sémantique stable.'));
  }

  if (!isNonEmptyString(metadata.description)) {
    issues.push(createIssue('bank_missing_version_description', 'versionMetadata.description', 'La description de la version est obligatoire.'));
  }

  if (metadata.schemaVersion !== undefined && metadata.schemaVersion !== 1 && metadata.schemaVersion !== 2) {
    issues.push(createIssue('bank_invalid_schema_version', 'versionMetadata.schemaVersion', 'La version de schema doit etre 1 ou 2.'));
  }

  const schemaVersion = metadata.schemaVersion === 2 ? 2 : 1;
  if (schemaVersion === 2) {
    const rootKeys = sortedUnique(Object.keys(rawDocument));
    const expectedRootKeys = sortedUnique([...SEVENO_PROFESSIONAL_ASSESSMENT_BANK_V2_ROOT_KEYS]);
    if (rootKeys.length !== expectedRootKeys.length || rootKeys.some((key, index) => key !== expectedRootKeys[index])) {
      issues.push(createIssue('bank_v2_root_keys_mismatch', 'root', 'Un JSON V2 doit contenir exactement les six cles racine attendues.'));
    }
  }

  if (!isPositiveInteger(document.versionMetadata.essentialPoolSize) || document.versionMetadata.essentialPoolSize !== SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE) {
    issues.push(createIssue('bank_invalid_essential_pool_size', 'versionMetadata.essentialPoolSize', `La banque doit contenir exactement ${SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE} questions essentielles.`));
  }

  if (!isPositiveInteger(document.versionMetadata.extendedPoolSize) || document.versionMetadata.extendedPoolSize !== SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE) {
    issues.push(createIssue('bank_invalid_extended_pool_size', 'versionMetadata.extendedPoolSize', `La banque doit contenir exactement ${SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE} questions approfondies.`));
  }

  if (!isPositiveInteger(document.versionMetadata.essentialDrawSize) || document.versionMetadata.essentialDrawSize !== SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE) {
    issues.push(createIssue('bank_invalid_essential_draw_size', 'versionMetadata.essentialDrawSize', `Le tirage essentiel doit contenir exactement ${SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE} questions.`));
  }

  if (!isPositiveInteger(document.versionMetadata.extendedDrawSize) || document.versionMetadata.extendedDrawSize !== SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE) {
    issues.push(createIssue('bank_invalid_extended_draw_size', 'versionMetadata.extendedDrawSize', `Le tirage approfondi doit contenir exactement ${SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE} questions.`));
  }

  if (document.dimensionConfigurations.length !== SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.length) {
    issues.push(createIssue('bank_dimension_configuration_count', 'dimensionConfigurations', 'La banque doit couvrir exactement sept dimensions.'));
  }

  const dimensionCodes = document.dimensionConfigurations.map((dimension) => dimension.code);
  const duplicateDimensionCodes = dimensionCodes.filter((code, index) => dimensionCodes.indexOf(code) !== index);
  if (duplicateDimensionCodes.length > 0) {
    issues.push(createIssue('bank_dimension_duplicate_code', 'dimensionConfigurations', 'Les codes de dimensions doivent être uniques.'));
  }

  const unknownDimensionCodes = dimensionCodes.filter((code) => !SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.includes(code));
  if (unknownDimensionCodes.length > 0) {
    issues.push(createIssue('bank_dimension_unknown_code', 'dimensionConfigurations', 'Une dimension inconnue a été détectée.'));
  }

  const weightedSum = document.dimensionConfigurations.reduce((sum, dimension) => sum + (Number.isFinite(dimension.weight) ? dimension.weight : 0), 0);
  if (weightedSum !== 100) {
    issues.push(createIssue('bank_dimension_weight_sum_invalid', 'dimensionConfigurations', 'La somme des poids des dimensions doit être égale à 100.'));
  }

  const interpretationCodes = document.interpretationBlocks.map((group) => group.dimensionCode);
  if (interpretationCodes.length !== SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.length) {
    issues.push(createIssue('bank_interpretation_group_count', 'interpretationBlocks', 'Chaque dimension doit disposer de ses blocs d interprétation.'));
  }

  if (
    schemaVersion === 2
    && (
      sortedUnique(interpretationCodes).length !== SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.length
      || SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.some((dimensionCode) => !interpretationCodes.includes(dimensionCode))
    )
  ) {
    issues.push(createIssue('bank_interpretation_group_exact_coverage', 'interpretationBlocks', 'En V2, chaque dimension doit apparaitre exactement une fois dans interpretationBlocks.'));
  }

  const questionPools = [
    ...document.essentialQuestionPool.map((question) => ({ question, pool: 'essential' as const })),
    ...document.extendedQuestionPool.map((question) => ({ question, pool: 'extended' as const })),
  ];

  if (document.essentialQuestionPool.length !== document.versionMetadata.essentialPoolSize) {
    issues.push(createIssue('bank_essential_pool_size_mismatch', 'essentialQuestionPool', 'Le nombre de questions essentielles ne correspond pas aux paramètres de la banque.'));
  }

  if (document.extendedQuestionPool.length !== document.versionMetadata.extendedPoolSize) {
    issues.push(createIssue('bank_extended_pool_size_mismatch', 'extendedQuestionPool', 'Le nombre de questions approfondies ne correspond pas aux paramètres de la banque.'));
  }

  const questionIds = questionPools.map((entry) => entry.question.questionId);
  const duplicateQuestionIds = questionIds.filter((id, index) => questionIds.indexOf(id) !== index);
  if (duplicateQuestionIds.length > 0) {
    issues.push(createIssue('bank_duplicate_question_ids', 'questions', 'Les identifiants des questions doivent être uniques.'));
  }

  const evaluationQuestionIdSet = new Set(questionIds);
  const interviewQuestionIds = document.interviewQuestions.map((question) => question.questionId);
  const duplicateInterviewQuestionIds = interviewQuestionIds.filter((id, index) => interviewQuestionIds.indexOf(id) !== index);
  if (duplicateInterviewQuestionIds.length > 0) {
    issues.push(createIssue('bank_duplicate_interview_question_ids', 'interviewQuestions', 'Les identifiants des interviewQuestions doivent être uniques.'));
  }

  const interviewQuestionById = new Map(document.interviewQuestions.map((question) => [question.questionId, question] as const));
  for (const [index, interviewQuestion] of document.interviewQuestions.entries()) {
    const context = `interviewQuestions[${index}]`;
    if (!isNonEmptyString(interviewQuestion.questionId)) {
      issues.push(createIssue('bank_interview_question_missing_id', `${context}.questionId`, 'Chaque interviewQuestion doit contenir un identifiant.'));
    }

    if (!isKnownDimensionCode(interviewQuestion.dimensionCode)) {
      issues.push(createIssue('bank_interview_question_invalid_dimension', `${context}.dimensionCode`, 'Chaque interviewQuestion doit cibler une dimension autorisée.'));
    }

    if (!isNonEmptyString(interviewQuestion.prompt)) {
      issues.push(createIssue('bank_interview_question_missing_prompt', `${context}.prompt`, 'Chaque interviewQuestion doit contenir un prompt non vide.'));
    }

    if (!isNonEmptyString(interviewQuestion.rationale)) {
      issues.push(createIssue('bank_interview_question_missing_rationale', `${context}.rationale`, 'Chaque interviewQuestion doit contenir une rationale non vide.'));
    }
  }

  for (const [groupIndex, group] of document.interpretationBlocks.entries()) {
    if (!isKnownDimensionCode(group.dimensionCode)) {
      issues.push(createIssue('bank_interpretation_invalid_dimension', `interpretationBlocks[${groupIndex}].dimensionCode`, 'Chaque groupe d interprétation doit cibler une dimension autorisée.'));
      continue;
    }

    if (schemaVersion === 2) {
      if (group.blocks.length !== SEVENO_PROFESSIONAL_ASSESSMENT_BANK_V2_INTERPRETATION_RANGES.length) {
        issues.push(createIssue('bank_interpretation_invalid_block_count', `interpretationBlocks[${groupIndex}].blocks`, 'Chaque dimension V2 doit contenir exactement cinq blocs d interpretation.'));
      }

      for (const [thresholdIndex, expectedRange] of SEVENO_PROFESSIONAL_ASSESSMENT_BANK_V2_INTERPRETATION_RANGES.entries()) {
        const block = group.blocks[thresholdIndex];
        if (!block) {
          continue;
        }

        if (block.minScore !== expectedRange.minScore || block.maxScore !== expectedRange.maxScore) {
          issues.push(createIssue('bank_interpretation_invalid_range', `interpretationBlocks[${groupIndex}].blocks[${thresholdIndex}]`, 'Les plages V2 doivent respecter exactement 0-39, 40-59, 60-74, 75-89 et 90-100.'));
        }
      }
    }

    for (const [blockIndex, block] of group.blocks.entries()) {
      if (!Array.isArray(block.interviewQuestionIds) || block.interviewQuestionIds.length === 0) {
        issues.push(createIssue('bank_interpretation_missing_interview_question_ids', `interpretationBlocks[${groupIndex}].blocks[${blockIndex}].interviewQuestionIds`, 'Chaque bloc d interprétation doit référencer au moins une interviewQuestion.'));
        continue;
      }

      for (const [idIndex, interviewQuestionId] of block.interviewQuestionIds.entries()) {
        const referencedInterviewQuestion = interviewQuestionById.get(interviewQuestionId);
        if (!referencedInterviewQuestion) {
          issues.push(createIssue('bank_interpretation_missing_interview_question_reference', `interpretationBlocks[${groupIndex}].blocks[${blockIndex}].interviewQuestionIds[${idIndex}]`, 'Chaque valeur de interviewQuestionIds doit correspondre exactement au questionId d une interviewQuestion existante.'));
          continue;
        }

        if (referencedInterviewQuestion.dimensionCode !== group.dimensionCode) {
          issues.push(createIssue('bank_interpretation_interview_question_dimension_mismatch', `interpretationBlocks[${groupIndex}].blocks[${blockIndex}].interviewQuestionIds[${idIndex}]`, 'La question d entretien référencée doit avoir le même dimensionCode que le groupe d interprétation.'));
        }

        if (evaluationQuestionIdSet.has(interviewQuestionId)) {
          issues.push(createIssue('bank_interview_question_id_collision', `interpretationBlocks[${groupIndex}].blocks[${blockIndex}].interviewQuestionIds[${idIndex}]`, 'Aucun questionId de question essential ou extended ne doit être réutilisé comme questionId d interviewQuestion.'));
        }
      }
    }
  }

  const seenFingerprints = new Map<string, string>();
  const seenOptionFingerprints = new Map<string, string>();
  const coveredDimensions = new Set<AssessmentDimensionCode>();

  for (const { question, pool } of questionPools) {
    const context = `${pool}QuestionPool.${question.questionId}`;
    issues.push(...validateQuestion(question, context, schemaVersion));

    for (const code of [...question.primaryDimensionCodes, ...(question.secondaryDimensionCode ? [question.secondaryDimensionCode] : [])]) {
      coveredDimensions.add(code);
    }

    const fingerprint = questionFingerprint(question);
    const previousFingerprint = seenFingerprints.get(fingerprint);
    if (previousFingerprint) {
      issues.push(createIssue('bank_duplicate_question_content', context, `La question ${question.questionId} duplique le contenu de ${previousFingerprint}.`));
    } else {
      seenFingerprints.set(fingerprint, question.questionId);
    }

    const optionSetFingerprint = JSON.stringify(question.options.map((option) => optionFingerprint(option)));
    const previousOptionFingerprint = seenOptionFingerprints.get(optionSetFingerprint);
    if (previousOptionFingerprint) {
      issues.push(createIssue('bank_duplicate_option_set', context, `La question ${question.questionId} duplique le paquet d options de ${previousOptionFingerprint}.`));
    } else {
      seenOptionFingerprints.set(optionSetFingerprint, question.questionId);
    }
  }

  for (const dimensionCode of SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES) {
    if (!coveredDimensions.has(dimensionCode)) {
      issues.push(createIssue('bank_missing_dimension_coverage', 'questions', `La dimension ${dimensionCode} doit être couverte au moins une fois dans la banque.`));
    }
  }

  const essentialSignatures = new Set(document.essentialQuestionPool.map((question) => questionFingerprint(question)));
  for (const question of document.extendedQuestionPool) {
    if (essentialSignatures.has(questionFingerprint(question))) {
      issues.push(createIssue('bank_cross_pool_duplicate', `extendedQuestionPool.${question.questionId}`, 'Une question approfondie duplique une question essentielle.'));
    }
  }

  const documentBytes = Buffer.byteLength(JSON.stringify(document), 'utf8');
  if (documentBytes >= SEVENO_PROFESSIONAL_ASSESSMENT_BANK_MAX_DOCUMENT_BYTES) {
    issues.push(createIssue('bank_document_too_large', 'root', 'Le document de banque dépasse la taille maximale interne.'));
  }

  return issues;
}

export function validateSevenoProfessionalAssessmentBankDocument(rawDocument: unknown): AssessmentValidationResult {
  const rawV2Issues = collectV2RawQuestionContractIssues(rawDocument);
  const normalized = normalizeBankDocument(rawDocument);
  const runtimeVersion = buildSevenoProfessionalAssessmentDraftFromBankDocument(normalized);
  return resultFromIssues([
    ...rawV2Issues,
    ...collectBankValidationIssues(rawDocument, normalized),
    ...(normalized.versionMetadata.schemaVersion === 2
      ? validateAssessmentScoringStructure(runtimeVersion).issues
      : []),
  ]);
}

export function parseSevenoProfessionalAssessmentBankDocument(jsonText: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AssessmentModelError('Le JSON importé est invalide.', [createIssue('bank_invalid_json', 'root', 'Le JSON importé est invalide.')]);
  }

  const normalized = normalizeBankDocument(parsed);
  const validation = validateSevenoProfessionalAssessmentBankDocument(parsed);
  if (!validation.valid) {
    throw new AssessmentModelError('Le JSON importé ne respecte pas le schéma de banque IA.', validation.issues);
  }

  return normalized;
}

export function buildSevenoProfessionalAssessmentDraftFromBankDocument(
  document: SevenoProfessionalAssessmentBankDocument,
  options: { createdBy?: string; now?: Date } = {},
): SevenoAssessmentStoredVersion {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const versionSeed = `${document.versionMetadata.version}:${document.versionMetadata.generatedPromptVersion}`;
  const versionId = `seveno-professional-assessment-bank-${createHash('sha256').update(versionSeed).digest('hex').slice(0, 12)}`;
  const versionCode = `seveno_professional_assessment_bank_${document.versionMetadata.version.replaceAll('.', '_')}_${createHash('sha1').update(versionSeed).digest('hex').slice(0, 8)}`;
  const essentialQuestions = document.essentialQuestionPool.map((question, index) => bankQuestionToAssessmentQuestion(question, versionId, index + 1));
  const extendedQuestions = document.extendedQuestionPool.map((question, index) => bankQuestionToAssessmentQuestion(question, versionId, essentialQuestions.length + index + 1));
  const questions = [
    ...essentialQuestions,
    ...extendedQuestions,
  ];
  const dimensions = buildVersionDimensions(document.dimensionConfigurations, document.interpretationBlocks, document.interviewQuestions);

  return {
    id: versionId,
    code: versionCode,
    version: document.versionMetadata.version,
    status: 'draft',
    name: document.versionMetadata.name,
    description: document.versionMetadata.description,
    createdAt: nowIso,
    updatedAt: nowIso,
    publishedAt: null,
    archivedAt: null,
    createdBy: options.createdBy ?? 'phase-4d-bank-import',
    generatedPromptVersion: document.versionMetadata.generatedPromptVersion,
    essentialPoolSize: document.versionMetadata.essentialPoolSize,
    extendedPoolSize: document.versionMetadata.extendedPoolSize,
    essentialDrawSize: document.versionMetadata.essentialDrawSize,
    extendedDrawSize: document.versionMetadata.extendedDrawSize,
    dimensions,
    questions,
    essentialQuestionCount: essentialQuestions.length,
    extendedQuestionCount: extendedQuestions.length,
    estimatedEssentialDurationMinutes: Math.max(1, Math.round(essentialQuestions.length * 0.8)),
    estimatedExtendedDurationMinutes: Math.max(1, Math.round(extendedQuestions.length * 0.8)),
    scoringEngineVersion: '1.0.0',
    interpretationEngineVersion: '1.0.0',
    legalNoticeVersion: 'seveno_professional_assessment_bank_v1',
    revisionNotes: ['DO_NOT_PUBLISH', 'HUMAN_REVIEW_REQUIRED'],
    interviewQuestionCatalog: Object.fromEntries(
      document.interviewQuestions.map((question) => [question.questionId, `${question.prompt} ${question.rationale}`.trim()] as const),
    ),
    revisionNumber: 1,
    schemaVersion: document.versionMetadata.schemaVersion,
    sourceVersionId: null,
    hasStartedSessions: false,
  } satisfies SevenoAssessmentStoredVersion;
}

export function buildSevenoProfessionalAssessmentBankDraw(
  document: SevenoProfessionalAssessmentBankDocument,
  seed: string,
): SevenoProfessionalAssessmentBankDrawResult {
  const essentialQuestions = drawStratifiedQuestions(document.essentialQuestionPool, `${seed}:essential`, document.versionMetadata.essentialDrawSize);
  const extendedQuestions = drawStratifiedQuestions(document.extendedQuestionPool, `${seed}:extended`, document.versionMetadata.extendedDrawSize);

  return {
    essentialQuestionIds: essentialQuestions.map((question) => question.questionId),
    extendedQuestionIds: extendedQuestions.map((question) => question.questionId),
    essentialQuestions,
    extendedQuestions,
  };
}

export function simulateSevenoProfessionalAssessmentDraws(
  document: SevenoProfessionalAssessmentBankDocument,
  runs = 1000,
) {
  const uniqueEssentialDraws = new Set<string>();
  const uniqueExtendedDraws = new Set<string>();
  const uniquePairDraws = new Set<string>();
  let crossPoolOverlapCount = 0;

  const reference = buildSevenoProfessionalAssessmentBankDraw(document, `${document.versionMetadata.version}:reference`);
  const referenceAgain = buildSevenoProfessionalAssessmentBankDraw(document, `${document.versionMetadata.version}:reference`);
  const seedStabilityMatches = JSON.stringify(reference.essentialQuestionIds) === JSON.stringify(referenceAgain.essentialQuestionIds)
    && JSON.stringify(reference.extendedQuestionIds) === JSON.stringify(referenceAgain.extendedQuestionIds)
    ? 1
    : 0;

  for (let index = 0; index < runs; index += 1) {
    const draw = buildSevenoProfessionalAssessmentBankDraw(document, `${document.versionMetadata.version}:simulation:${index}`);
    const essentialSignature = draw.essentialQuestionIds.join('|');
    const extendedSignature = draw.extendedQuestionIds.join('|');
    uniqueEssentialDraws.add(essentialSignature);
    uniqueExtendedDraws.add(extendedSignature);
    uniquePairDraws.add(`${essentialSignature}::${extendedSignature}`);

    const overlap = draw.essentialQuestionIds.some((questionId) => draw.extendedQuestionIds.includes(questionId));
    if (overlap) {
      crossPoolOverlapCount += 1;
    }
  }

  return {
    runs,
    uniqueEssentialDraws: uniqueEssentialDraws.size,
    uniqueExtendedDraws: uniqueExtendedDraws.size,
    uniquePairDraws: uniquePairDraws.size,
    crossPoolOverlapCount,
    seedStabilityMatches,
  } satisfies SevenoProfessionalAssessmentBankSimulationSummary;
}
