import type {
  AssessmentCandidateProjection,
  AssessmentCalculationAlert,
  AssessmentCalculationOutcome,
  AssessmentCoverageSnapshot,
  AssessmentDimensionCode,
  AssessmentDimensionDefinition,
  AssessmentBehaviorAxisCode,
  AssessmentBehaviorContext,
  AssessmentBehaviorQuestionType,
  AssessmentSignalReliability,
  AssessmentDimensionResult,
  AssessmentEngineRequest,
  AssessmentInterpretationBlock,
  AssessmentPath,
  AssessmentPrecisionLevel,
  AssessmentProjectionDimensionResult,
  AssessmentProjectionFocusArea,
  AssessmentProjectionStrength,
  AssessmentQuestion,
  AssessmentQuestionOption,
  AssessmentReportFocusArea,
  AssessmentReportStrength,
  AssessmentResponse,
  AssessmentSessionStatus,
  AssessmentSuggestedInterviewQuestion,
  AssessmentValidationIssue,
  AssessmentValidationResult,
  AssessmentVersionDescriptor,
  AssessmentVersionSnapshot,
  AssessmentVersionValidationOptions,
  AssessmentCompanyProjection,
  SevenoProfessionalAssessmentReport,
} from '@/types/seveno-assessment';

const DIMENSION_CODES: AssessmentDimensionCode[] = [
  'information_understanding',
  'organization_prioritization',
  'problem_solving',
  'autonomy_initiative',
  'adaptability',
  'collaboration',
  'rigor_reliability',
];

const PATHS: AssessmentPath[] = ['essential', 'extended'];
const BEHAVIOR_AXIS_DEFINITIONS = [
  { code: 'decision_pace', kind: 'bipolar', negativeLabel: 'deliberation', positiveLabel: 'action' },
  { code: 'risk_orientation', kind: 'bipolar', negativeLabel: 'security', positiveLabel: 'risk_taking' },
  { code: 'initiative_validation', kind: 'bipolar', negativeLabel: 'validation', positiveLabel: 'initiative' },
  { code: 'framework_adaptation', kind: 'bipolar', negativeLabel: 'framework', positiveLabel: 'adaptation' },
  { code: 'persistence_switching', kind: 'bipolar', negativeLabel: 'persistence', positiveLabel: 'strategy_switching' },
  { code: 'analysis_experimentation', kind: 'bipolar', negativeLabel: 'analysis', positiveLabel: 'experimentation' },
  { code: 'speed_precision', kind: 'bipolar', negativeLabel: 'precision', positiveLabel: 'speed' },
  { code: 'ambiguity_tolerance', kind: 'bipolar', negativeLabel: 'clarification', positiveLabel: 'ambiguity_tolerance' },
  { code: 'authority_challenge', kind: 'bipolar', negativeLabel: 'execution', positiveLabel: 'challenge' },
  { code: 'disagreement_style', kind: 'bipolar', negativeLabel: 'consensus', positiveLabel: 'constructive_confrontation' },
  { code: 'method_exploration', kind: 'bipolar', negativeLabel: 'proven_method', positiveLabel: 'exploration' },
  { code: 'execution_improvement', kind: 'bipolar', negativeLabel: 'expected_execution', positiveLabel: 'spontaneous_improvement' },
  { code: 'leadership_activation', kind: 'independent' },
  { code: 'influence', kind: 'independent' },
  { code: 'followership', kind: 'independent' },
  { code: 'collective_support', kind: 'independent' },
  { code: 'value_creation', kind: 'independent' },
  { code: 'alerting_behavior', kind: 'independent' },
] as const satisfies readonly {
  code: AssessmentBehaviorAxisCode;
  kind: 'bipolar' | 'independent';
  negativeLabel?: string;
  positiveLabel?: string;
}[];
const BEHAVIOR_AXIS_CODES = BEHAVIOR_AXIS_DEFINITIONS.map((definition) => definition.code) as AssessmentBehaviorAxisCode[];
const BEHAVIOR_QUESTION_TYPES: AssessmentBehaviorQuestionType[] = [
  'behavioral_situation',
  'tradeoff',
  'direct_self_report',
  'work_preference',
];
const BEHAVIOR_SIGNAL_RELIABILITIES: AssessmentSignalReliability[] = ['high', 'medium', 'low', 'descriptive'];
const BEHAVIOR_CONTEXT_VALUES: Record<keyof AssessmentBehaviorContext, readonly (string | boolean | null)[]> = {
  riskLevel: ['none', 'low', 'medium', 'high'],
  reversibility: ['not_applicable', 'high', 'medium', 'low'],
  urgency: ['none', 'low', 'medium', 'high'],
  authorityContext: ['none', 'present', 'absent', 'directive', 'disagreement'],
  informationCompleteness: ['complete', 'partial', 'uncertain'],
  collectiveImpact: ['individual', 'team', 'third_party', 'organization'],
  priorFailure: ['none', 'suspected', 'confirmed'],
  socialPressure: ['none', 'low', 'medium', 'high'],
  helpAvailability: ['available', 'limited', 'unavailable', 'not_applicable'],
  waitingCost: ['none', 'low', 'medium', 'high'],
  smallScaleTestPossible: [true, false, null],
};
const SESSION_STATUSES: AssessmentSessionStatus[] = [
  'not_started',
  'in_progress',
  'submitted',
  'expired',
  'abandoned',
  'cancelled',
];
const PRECISION_LEVELS: AssessmentPrecisionLevel[] = ['caution', 'standard', 'reinforced'];
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const OPTION_SCORE_MIN = 0;
const OPTION_SCORE_MAX = 4;
const DEFAULT_SCORING_ENGINE_VERSION = '1.0.0';
const DEFAULT_INTERPRETATION_ENGINE_VERSION = '1.0.0';
const DEFAULT_LEGAL_NOTICE_CODE = 'seveno_professional_assessment_preview';
const MIN_SUGGESTED_QUESTIONS = 3;
const MAX_SUGGESTED_QUESTIONS = 6;

export const SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES = DIMENSION_CODES as readonly AssessmentDimensionCode[];
export const SEVENO_PROFESSIONAL_ASSESSMENT_PATHS = PATHS as readonly AssessmentPath[];
export const SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_DEFINITIONS = BEHAVIOR_AXIS_DEFINITIONS;
export const SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES = BEHAVIOR_AXIS_CODES as readonly AssessmentBehaviorAxisCode[];
export const SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_QUESTION_TYPES = BEHAVIOR_QUESTION_TYPES as readonly AssessmentBehaviorQuestionType[];
export const SEVENO_PROFESSIONAL_ASSESSMENT_SIGNAL_RELIABILITY_VALUES = BEHAVIOR_SIGNAL_RELIABILITIES as readonly AssessmentSignalReliability[];
export const SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_CONTEXT_VALUES = BEHAVIOR_CONTEXT_VALUES;
export const SEVENO_PROFESSIONAL_ASSESSMENT_SESSION_STATUSES = SESSION_STATUSES as readonly AssessmentSessionStatus[];
export const SEVENO_PROFESSIONAL_ASSESSMENT_PRECISION_LEVELS = PRECISION_LEVELS as readonly AssessmentPrecisionLevel[];
export const SEVENO_PROFESSIONAL_ASSESSMENT_DEFAULT_SCORING_ENGINE_VERSION = DEFAULT_SCORING_ENGINE_VERSION;
export const SEVENO_PROFESSIONAL_ASSESSMENT_DEFAULT_INTERPRETATION_ENGINE_VERSION = DEFAULT_INTERPRETATION_ENGINE_VERSION;
export const SEVENO_PROFESSIONAL_ASSESSMENT_DEFAULT_LEGAL_NOTICE_CODE = DEFAULT_LEGAL_NOTICE_CODE;

export class AssessmentModelError extends Error {
  issues: AssessmentValidationIssue[];

  constructor(message: string, issues: AssessmentValidationIssue[]) {
    super(message);
    this.name = 'AssessmentModelError';
    this.issues = issues;
  }
}

function createIssue(
  code: string,
  path: string,
  message: string,
  severity: AssessmentValidationIssue['severity'] = 'error',
): AssessmentValidationIssue {
  return { code, path, message, severity };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTimestampLike(value: unknown): boolean {
  if (!value) {
    return false;
  }

  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value === 'object') {
    const candidate = value as { toMillis?: unknown; toDate?: unknown };
    if (typeof candidate.toMillis === 'function') {
      return Number.isFinite(candidate.toMillis());
    }

    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime());
    }
  }

  return false;
}

function resultFromIssues(issues: AssessmentValidationIssue[]): AssessmentValidationResult {
  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function dimensionCodeSet(values: readonly AssessmentDimensionCode[]) {
  return new Set<AssessmentDimensionCode>(values);
}

const KNOWN_DIMENSION_CODES = dimensionCodeSet(DIMENSION_CODES);

function isKnownDimensionCode(value: unknown): value is AssessmentDimensionCode {
  return typeof value === 'string' && KNOWN_DIMENSION_CODES.has(value as AssessmentDimensionCode);
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
  return (BEHAVIOR_CONTEXT_VALUES[key] as readonly unknown[]).includes(value);
}

function isKnownPath(value: unknown): value is AssessmentPath {
  return typeof value === 'string' && PATHS.includes(value as AssessmentPath);
}

function isKnownDifficulty(value: unknown): value is AssessmentQuestion['difficulty'] {
  return value === 'introductory' || value === 'standard' || value === 'advanced';
}

function hasLegacyAssessmentShape(value: unknown) {
  return isRecord(value) && (
    'overallScore' in value
    || 'scoresByDimension' in value
    || 'questionnaireVersion' in value
    || 'resultId' in value
    || 'sevenoAssessmentOverallScore' in value
    || 'sevenoAssessmentDimensions' in value
  ) && !('assessmentVersion' in value) && !('dimensionResults' in value);
}

function getInterpretationBlock(
  dimension: AssessmentDimensionDefinition,
  score: number,
): AssessmentInterpretationBlock | null {
  return [...dimension.interpretationThresholds]
    .sort((left, right) => left.minScore - right.minScore)
    .find((block) => score >= block.minScore && score <= block.maxScore) ?? null;
}

function buildVersionSnapshot(version: AssessmentVersionDescriptor): AssessmentVersionSnapshot {
  return {
    id: version.id,
    code: version.code,
    version: version.version,
    status: version.status,
    name: version.name,
    ...(version.description ? { description: version.description } : {}),
  };
}

function buildPrecisionLevelFromResults(
  completedPath: AssessmentPath,
  dimensionResults: AssessmentDimensionResult[],
): AssessmentPrecisionLevel {
  if (dimensionResults.some((result) => result.status !== 'measured')) {
    return 'caution';
  }

  return completedPath === 'extended' ? 'reinforced' : 'standard';
}

function buildCoverageSnapshot(
  path: AssessmentPath,
  totalQuestions: number,
  answeredQuestions: number,
  expectedMinimumObservations: number,
): AssessmentCoverageSnapshot {
  const coverageRatio = expectedMinimumObservations > 0
    ? Math.min(1, answeredQuestions / expectedMinimumObservations)
    : 1;

  return {
    path,
    totalQuestions,
    answeredQuestions,
    expectedMinimumObservations,
    coverageRatio,
  };
}

function buildProjectionDimensionResult(result: AssessmentDimensionResult): AssessmentProjectionDimensionResult {
  return {
    dimensionCode: result.dimensionCode,
    ...(typeof result.score === 'number' ? { score: result.score } : {}),
    status: result.status,
    precisionLevel: result.precisionLevel,
    interpretationCode: result.interpretationCode,
    limitations: [...result.limitations],
  };
}

function buildProjectionStrength(result: AssessmentReportStrength): AssessmentProjectionStrength {
  return {
    code: result.code,
    dimensionCode: result.dimensionCode,
    label: result.label,
    summary: result.candidateSummary,
    interviewQuestionIds: [...result.interviewQuestionIds],
    limitations: [...result.limitations],
  };
}

function buildProjectionFocusArea(result: AssessmentReportFocusArea): AssessmentProjectionFocusArea {
  return {
    code: result.code,
    dimensionCode: result.dimensionCode,
    label: result.label,
    summary: result.candidateSummary,
    interviewQuestionIds: [...result.interviewQuestionIds],
    limitations: [...result.limitations],
  };
}

function buildReportText(parts: string[], fallback: string) {
  const cleaned = uniqueStrings(parts.map((part) => part.trim()).filter(Boolean));
  return cleaned.length > 0 ? cleaned.join(' ') : fallback;
}

type AssessmentOptionValidationContext = {
  allowedBehaviorAxisCodes?: readonly AssessmentBehaviorAxisCode[];
  requireBehaviorSignals?: boolean;
};

function collectVersionIssues(version: AssessmentVersionDescriptor, options: AssessmentVersionValidationOptions = {}) {
  const issues: AssessmentValidationIssue[] = [];
  const mode = options.mode ?? 'definition';

  if (!isNonEmptyString(version.id)) {
    issues.push(createIssue('assessment_version_missing_id', 'version.id', 'La version doit contenir un identifiant.'));
  }

  if (!isNonEmptyString(version.code)) {
    issues.push(createIssue('assessment_version_missing_code', 'version.code', 'La version doit contenir un code.'));
  }

  if (!isNonEmptyString(version.version) || !/^\d+\.\d+\.\d+$/.test(version.version)) {
    issues.push(createIssue('assessment_version_invalid_number', 'version.version', 'La version doit suivre un numéro semantique stable du type 1.0.0.'));
  }

  if (!isNonEmptyString(version.name)) {
    issues.push(createIssue('assessment_version_missing_name', 'version.name', 'La version doit contenir un nom lisible.'));
  }

  if (!isNonEmptyString(version.description)) {
    issues.push(createIssue('assessment_version_missing_description', 'version.description', 'La version doit contenir une description.'));
  }

  if (!isTimestampLike(version.createdAt)) {
    issues.push(createIssue('assessment_version_missing_created_at', 'version.createdAt', 'La date de création de la version est invalide.'));
  }

  if (!isTimestampLike(version.updatedAt)) {
    issues.push(createIssue('assessment_version_missing_updated_at', 'version.updatedAt', 'La date de mise à jour de la version est invalide.'));
  }

  if (!isNonEmptyString(version.createdBy)) {
    issues.push(createIssue('assessment_version_missing_created_by', 'version.createdBy', 'La version doit indiquer son auteur.'));
  }

  if (!isNonEmptyString(version.scoringEngineVersion)) {
    issues.push(createIssue('assessment_version_missing_scoring_engine', 'version.scoringEngineVersion', 'La version du moteur de calcul est requise.'));
  }

  if (!isNonEmptyString(version.interpretationEngineVersion)) {
    issues.push(createIssue('assessment_version_missing_interpretation_engine', 'version.interpretationEngineVersion', 'La version du moteur d interpretation est requise.'));
  }

  if (!isNonEmptyString(version.legalNoticeVersion)) {
    issues.push(createIssue('assessment_version_missing_legal_notice', 'version.legalNoticeVersion', 'La version de la mention legale est requise.'));
  }

  if (version.status === 'active' && !isTimestampLike(version.publishedAt)) {
    issues.push(createIssue('assessment_version_missing_published_at', 'version.publishedAt', 'Une version active doit etre publiee.'));
  }

  if (version.status === 'archived' && !isTimestampLike(version.archivedAt)) {
    issues.push(createIssue('assessment_version_missing_archived_at', 'version.archivedAt', 'Une version archivee doit contenir sa date d archivage.'));
  }

  if (mode === 'edit') {
    if (version.status === 'active' || version.status === 'archived') {
      issues.push(createIssue('assessment_version_immutable', 'version.status', 'Une version active ou archivee ne peut pas etre modifiee.'));
    }

    if (version.status === 'pilot' && options.hasStartedSessions) {
      issues.push(createIssue('assessment_pilot_version_locked', 'version.status', 'Une version pilote deja utilisee ne peut plus etre modifiee.'));
    }
  }

  return issues;
}

function validateAssessmentBehaviorSignals(
  behaviorSignals: unknown,
  context: string,
  allowedBehaviorAxisCodes: readonly AssessmentBehaviorAxisCode[],
  requireBehaviorSignals: boolean,
) {
  const issues: AssessmentValidationIssue[] = [];
  if (!isRecord(behaviorSignals)) {
    if (requireBehaviorSignals) {
      issues.push(createIssue('assessment_option_missing_behavior_signals', `${context}.behaviorSignals`, 'Les signaux comportementaux sont obligatoires pour une question V2.'));
    }

    return resultFromIssues(issues);
  }

  const allowedAxisCodes = new Set<string>(allowedBehaviorAxisCodes);
  for (const [axisCode, value] of Object.entries(behaviorSignals)) {
    if (!isKnownBehaviorAxisCode(axisCode)) {
      issues.push(createIssue('assessment_option_unknown_behavior_axis', `${context}.behaviorSignals.${axisCode}`, 'Un axe comportemental inconnu a ete trouve.'));
      continue;
    }

    if (!allowedAxisCodes.has(axisCode)) {
      issues.push(createIssue('assessment_option_disallowed_behavior_axis', `${context}.behaviorSignals.${axisCode}`, 'Un signal comportemental ne peut utiliser qu un axe declare dans le modele comportemental de la question.'));
    }

    const numericValue = typeof value === 'number' ? value : Number.NaN;
    if (!Number.isInteger(numericValue) || numericValue < -2 || numericValue > 2) {
      issues.push(createIssue('assessment_option_invalid_behavior_signal', `${context}.behaviorSignals.${axisCode}`, 'Un signal comportemental doit etre compris entre -2 et 2.'));
    }
  }

  return resultFromIssues(issues);
}

function validateAssessmentBehaviorContext(context: unknown, path: string) {
  const issues: AssessmentValidationIssue[] = [];
  if (!isRecord(context)) {
    issues.push(createIssue('assessment_question_missing_behavior_context', path, 'Le contexte comportemental est obligatoire.'));
    return resultFromIssues(issues);
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
      issues.push(createIssue('assessment_question_unknown_behavior_context_field', `${path}.${key}`, 'Le contexte comportemental contient un champ inconnu.'));
    }
  }

  if (!isKnownBehaviorContextValue('riskLevel', context.riskLevel)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.riskLevel`, 'Le niveau de risque est invalide.'));
  }

  if (!isKnownBehaviorContextValue('reversibility', context.reversibility)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.reversibility`, 'La reversibilite est invalide.'));
  }

  if (!isKnownBehaviorContextValue('urgency', context.urgency)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.urgency`, "Le niveau d'urgence est invalide."));
  }

  if (!isKnownBehaviorContextValue('authorityContext', context.authorityContext)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.authorityContext`, "Le contexte d'autorite est invalide."));
  }

  if (!isKnownBehaviorContextValue('informationCompleteness', context.informationCompleteness)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.informationCompleteness`, 'Le niveau de completude de l information est invalide.'));
  }

  if (!isKnownBehaviorContextValue('collectiveImpact', context.collectiveImpact)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.collectiveImpact`, "L'impact collectif est invalide."));
  }

  if (!isKnownBehaviorContextValue('priorFailure', context.priorFailure)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.priorFailure`, 'Le niveau de precedent echec est invalide.'));
  }

  if (!isKnownBehaviorContextValue('socialPressure', context.socialPressure)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.socialPressure`, 'La pression sociale est invalide.'));
  }

  if (!isKnownBehaviorContextValue('helpAvailability', context.helpAvailability)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.helpAvailability`, "La disponibilite d aide est invalide."));
  }

  if (!isKnownBehaviorContextValue('waitingCost', context.waitingCost)) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.waitingCost`, "Le cout de l'attente est invalide."));
  }

  if (typeof context.smallScaleTestPossible !== 'boolean' && context.smallScaleTestPossible !== null) {
    issues.push(createIssue('assessment_question_invalid_behavior_context', `${path}.smallScaleTestPossible`, 'La possibilite de test a petite echelle est invalide.'));
  }

  return resultFromIssues(issues);
}

function validateAssessmentBehaviorModel(model: unknown, path: string) {
  const issues: AssessmentValidationIssue[] = [];
  if (!isRecord(model)) {
    issues.push(createIssue('assessment_question_missing_behavior_model', path, 'Le modele comportemental de la question est obligatoire.'));
    return resultFromIssues(issues);
  }

  const rawSecondaryAxisCodes = Array.isArray(model.secondaryAxisCodes) ? model.secondaryAxisCodes : null;
  const secondaryAxisCodes = rawSecondaryAxisCodes ? rawSecondaryAxisCodes.filter(isKnownBehaviorAxisCode) : [];

  if (!isKnownBehaviorAxisCode(model.primaryAxisCode)) {
    issues.push(createIssue('assessment_question_invalid_primary_behavior_axis', `${path}.primaryAxisCode`, 'L axe comportemental principal est invalide.'));
  }

  if (!Array.isArray(model.secondaryAxisCodes)) {
    issues.push(createIssue('assessment_question_missing_secondary_behavior_axes', `${path}.secondaryAxisCodes`, 'Les axes secondaires comportementaux doivent etre un tableau.'));
  } else {
    if (secondaryAxisCodes.length !== model.secondaryAxisCodes.length) {
      issues.push(createIssue('assessment_question_invalid_secondary_behavior_axis', `${path}.secondaryAxisCodes`, 'Chaque axe secondaire comportemental doit appartenir au referentiel autorise.'));
    }

    if (secondaryAxisCodes.length > 2) {
      issues.push(createIssue('assessment_question_too_many_secondary_behavior_axes', `${path}.secondaryAxisCodes`, 'Une question ne peut pas avoir plus de deux axes secondaires comportementaux.'));
    }

    if (secondaryAxisCodes.length !== uniqueStrings(secondaryAxisCodes).length) {
      issues.push(createIssue('assessment_question_duplicate_behavior_axes', `${path}.secondaryAxisCodes`, 'Les axes secondaires comportementaux doivent etre uniques.'));
    }

    if (isKnownBehaviorAxisCode(model.primaryAxisCode) && secondaryAxisCodes.includes(model.primaryAxisCode)) {
      issues.push(createIssue('assessment_question_behavior_axis_overlap', `${path}.secondaryAxisCodes`, 'L axe comportemental principal ne peut pas aussi etre secondaire.'));
    }
  }

  const allAxisCodes = uniqueStrings([
    ...(isKnownBehaviorAxisCode(model.primaryAxisCode) ? [model.primaryAxisCode] : []),
    ...secondaryAxisCodes,
  ]);

  if (allAxisCodes.length > 3) {
    issues.push(createIssue('assessment_question_too_many_behavior_axes', path, 'Une question ne peut pas observer plus de trois axes comportementaux au total.'));
  }

  if (!isKnownSignalReliability(model.signalReliability)) {
    issues.push(createIssue('assessment_question_invalid_signal_reliability', `${path}.signalReliability`, 'La fiabilite du signal comportemental est invalide.'));
  }

  issues.push(...validateAssessmentBehaviorContext(model.context, `${path}.context`).issues);

  return resultFromIssues(issues);
}

export function validateAssessmentOption(
  option: AssessmentQuestionOption,
  context: AssessmentOptionValidationContext = {},
): AssessmentValidationResult {
  const issues: AssessmentValidationIssue[] = [];

  if (!isNonEmptyString(option.id)) {
    issues.push(createIssue('assessment_option_missing_id', 'option.id', "L'option doit contenir un identifiant."));
  }

  if (!isNonEmptyString(option.label)) {
    issues.push(createIssue('assessment_option_missing_label', 'option.label', 'Le libelle de l option ne peut pas etre vide.'));
  }

  if (!isPositiveInteger(option.position)) {
    issues.push(createIssue('assessment_option_invalid_position', 'option.position', "La position de l'option doit etre un entier positif."));
  }

  if (!isRecord(option.dimensionScores)) {
    issues.push(createIssue('assessment_option_missing_scores', 'option.dimensionScores', "L'option doit contenir des scores par dimension."));
    return resultFromIssues(issues);
  }

  const entries = Object.entries(option.dimensionScores);
  const contributingEntries = entries.filter(([, score]) => isFiniteNumber(score) && score > 0);
  const contributingScores = contributingEntries.map(([, score]) => score as number);

  if (contributingEntries.length === 0) {
    issues.push(createIssue('assessment_option_without_contribution', 'option.dimensionScores', "Une option doit contribuer a au moins une dimension."));
  }

  if (contributingEntries.length > 3) {
    issues.push(createIssue('assessment_option_too_many_dimensions', 'option.dimensionScores', 'Une option ne peut scorer plus de trois dimensions.'));
  }

  if (contributingEntries.length >= 2 && contributingScores.every((score) => score === 4)) {
    issues.push(createIssue('assessment_option_all_maximum_scores', 'option.dimensionScores', 'Une option ne doit pas attribuer 4 a toutes ses contributions.'));
  }

  for (const [dimensionCode, score] of entries) {
    if (!isKnownDimensionCode(dimensionCode)) {
      issues.push(createIssue('assessment_option_unknown_dimension', `option.dimensionScores.${dimensionCode}`, 'Une dimension inconnue a ete trouvee.'));
      continue;
    }

    if (!isFiniteNumber(score) || score < OPTION_SCORE_MIN || score > OPTION_SCORE_MAX || !Number.isInteger(score)) {
      issues.push(createIssue('assessment_option_score_out_of_bounds', `option.dimensionScores.${dimensionCode}`, 'Le score doit etre compris entre 0 et 4.'));
    }
  }

  if (!isNonEmptyString(option.adminExplanation)) {
    issues.push(createIssue('assessment_option_missing_admin_explanation', 'option.adminExplanation', 'Une explication administrateur est obligatoire.'));
  }

  const behaviorAxes = context.allowedBehaviorAxisCodes ?? SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES;
  if (context.requireBehaviorSignals || option.behaviorSignals !== undefined) {
    issues.push(...validateAssessmentBehaviorSignals(option.behaviorSignals, 'option', behaviorAxes, Boolean(context.requireBehaviorSignals)).issues);
  }

  return resultFromIssues(issues);
}

export function validateAssessmentQuestion(
  question: AssessmentQuestion,
  version: AssessmentVersionDescriptor,
): AssessmentValidationResult {
  const issues: AssessmentValidationIssue[] = [];
  const questionPath = `questions.${question.id || 'unknown'}`;

  if (!isNonEmptyString(question.id)) {
    issues.push(createIssue('assessment_question_missing_id', `${questionPath}.id`, 'La question doit contenir un identifiant.'));
  }

  if (!isNonEmptyString(question.code)) {
    issues.push(createIssue('assessment_question_missing_code', `${questionPath}.code`, 'La question doit contenir un code.'));
  }

  if (!isNonEmptyString(question.assessmentVersionId) || question.assessmentVersionId !== version.id) {
    issues.push(createIssue('assessment_question_version_mismatch', `${questionPath}.assessmentVersionId`, 'La question doit appartenir a la version fournie.'));
  }

  if (!isKnownPath(question.path)) {
    issues.push(createIssue('assessment_question_missing_path', `${questionPath}.path`, 'La question doit appartenir au parcours essentiel ou approfondi.'));
  }

  if (!isPositiveInteger(question.position)) {
    issues.push(createIssue('assessment_question_invalid_position', `${questionPath}.position`, 'La position de la question doit etre un entier positif.'));
  }

  if (!isNonEmptyString(question.situation)) {
    issues.push(createIssue('assessment_question_missing_situation', `${questionPath}.situation`, 'La situation de la question ne peut pas etre vide.'));
  }

  if (!isNonEmptyString(question.instruction)) {
    issues.push(createIssue('assessment_question_missing_instruction', `${questionPath}.instruction`, 'La consigne de la question ne peut pas etre vide.'));
  }

  const schemaVersion = typeof version.schemaVersion === 'number' && version.schemaVersion >= 2 ? 2 : 1;
  const hasBehaviorModel = Boolean(question.behaviorModel);

  if (schemaVersion >= 2) {
    if (!isKnownBehaviorQuestionType(question.questionType)) {
      issues.push(createIssue('assessment_question_missing_type', `${questionPath}.questionType`, 'Le type de question comportementale est obligatoire.'));
    }

    if (!isKnownSignalReliability(question.signalReliability)) {
      issues.push(createIssue('assessment_question_missing_signal_reliability', `${questionPath}.signalReliability`, 'La fiabilite du signal est obligatoire.'));
    }

    issues.push(...validateAssessmentBehaviorModel(question.behaviorModel, `${questionPath}.behaviorModel`).issues);
  } else {
    if (question.questionType && !isKnownBehaviorQuestionType(question.questionType)) {
      issues.push(createIssue('assessment_question_invalid_type', `${questionPath}.questionType`, 'Le type de question comportementale est invalide.'));
    }

    if (question.signalReliability && !isKnownSignalReliability(question.signalReliability)) {
      issues.push(createIssue('assessment_question_invalid_signal_reliability', `${questionPath}.signalReliability`, 'La fiabilite du signal est invalide.'));
    }

    if (hasBehaviorModel) {
      issues.push(...validateAssessmentBehaviorModel(question.behaviorModel, `${questionPath}.behaviorModel`).issues);
    }
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    issues.push(createIssue('assessment_question_not_enough_options', `${questionPath}.options`, 'Une question doit proposer au moins deux options.'));
  }

  if (!Array.isArray(question.options) || question.options.length === 0) {
    issues.push(createIssue('assessment_question_missing_options', `${questionPath}.options`, 'La question doit contenir des options.'));
  } else {
    const optionIds = question.options.map((option) => toTrimmedString(option.id));
    const duplicateOptionIds = optionIds.filter((id, index) => id && optionIds.indexOf(id) !== index);
    if (duplicateOptionIds.length > 0) {
      issues.push(createIssue('assessment_question_duplicate_option_ids', `${questionPath}.options`, 'Les identifiants d options doivent etre uniques.'));
    }

    const allowedBehaviorAxisCodes = schemaVersion >= 2 && hasBehaviorModel && isRecord(question.behaviorModel)
      ? uniqueStrings([
          ...(isKnownBehaviorAxisCode(question.behaviorModel.primaryAxisCode) ? [question.behaviorModel.primaryAxisCode] : []),
          ...(Array.isArray(question.behaviorModel.secondaryAxisCodes) ? question.behaviorModel.secondaryAxisCodes.filter(isKnownBehaviorAxisCode) : []),
        ]) as AssessmentBehaviorAxisCode[]
      : SEVENO_PROFESSIONAL_ASSESSMENT_BEHAVIOR_AXIS_CODES;

    for (const option of question.options) {
      const optionValidation = validateAssessmentOption(option, {
        allowedBehaviorAxisCodes,
        requireBehaviorSignals: schemaVersion >= 2,
      });
      for (const issue of optionValidation.issues) {
        issues.push({ ...issue, path: `${questionPath}.options.${option.id || 'unknown'}.${issue.path}` });
      }
    }
  }

  const primaryDimensionCodes = Array.isArray(question.primaryDimensionCodes)
    ? question.primaryDimensionCodes.filter(isKnownDimensionCode)
    : [];
  const secondaryDimensionCodes = Array.isArray(question.secondaryDimensionCodes)
    ? question.secondaryDimensionCodes.filter(isKnownDimensionCode)
    : [];
  const allDimensionCodes = uniqueStrings([
    ...primaryDimensionCodes,
    ...secondaryDimensionCodes,
  ]);

  if (primaryDimensionCodes.length < 1 || primaryDimensionCodes.length > 2) {
    issues.push(createIssue('assessment_question_invalid_primary_dimensions', `${questionPath}.primaryDimensionCodes`, 'Une question doit mesurer une ou deux dimensions principales.'));
  }

  if (secondaryDimensionCodes.length > 1) {
    issues.push(createIssue('assessment_question_invalid_secondary_dimensions', `${questionPath}.secondaryDimensionCodes`, 'Une question ne peut pas avoir plus d une dimension secondaire.'));
  }

  if (allDimensionCodes.length === 0) {
    issues.push(createIssue('assessment_question_missing_dimensions', `${questionPath}.primaryDimensionCodes`, 'La question doit mesurer au moins une dimension.'));
  }

  if (allDimensionCodes.length > 3) {
    issues.push(createIssue('assessment_question_too_many_dimensions', questionPath, 'Une question ne peut pas scorer plus de trois dimensions au total.'));
  }

  if (primaryDimensionCodes.some((dimensionCode) => secondaryDimensionCodes.includes(dimensionCode))) {
    issues.push(createIssue('assessment_question_dimension_overlap', questionPath, 'Une dimension principale ne peut pas etre aussi secondaire.'));
  }

  if (Array.isArray(question.options) && question.options.length > 0) {
    const allowedDimensions = new Set<AssessmentDimensionCode>(allDimensionCodes as AssessmentDimensionCode[]);
    for (const option of question.options) {
      const optionEntries = Object.entries(option.dimensionScores ?? {});
      for (const [dimensionCode, score] of optionEntries) {
        if (!isKnownDimensionCode(dimensionCode)) {
          continue;
        }

        if (!allowedDimensions.has(dimensionCode as AssessmentDimensionCode)) {
          issues.push(createIssue(
            'assessment_option_dimension_not_allowed',
            `${questionPath}.options.${option.id || 'unknown'}.dimensionScores.${dimensionCode}`,
            'Une option ne peut scorer que les dimensions de la question.',
          ));
        }

        if (!isFiniteNumber(score) || score < OPTION_SCORE_MIN || score > OPTION_SCORE_MAX || !Number.isInteger(score)) {
          issues.push(createIssue(
            'assessment_option_score_out_of_bounds',
            `${questionPath}.options.${option.id || 'unknown'}.dimensionScores.${dimensionCode}`,
            'Le score doit etre compris entre 0 et 4.',
          ));
        }
      }
    }
  }

  if (!isKnownDifficulty(question.difficulty)) {
    issues.push(createIssue('assessment_question_missing_difficulty', `${questionPath}.difficulty`, 'La difficulte de la question est invalide.'));
  }

  if (!isPositiveInteger(question.estimatedReadingSeconds)) {
    issues.push(createIssue('assessment_question_invalid_reading_duration', `${questionPath}.estimatedReadingSeconds`, 'Le temps de lecture doit etre un entier positif.'));
  }

  if (!isNonEmptyString(question.adminRationale)) {
    issues.push(createIssue('assessment_question_missing_admin_rationale', `${questionPath}.adminRationale`, 'La justification administrateur est obligatoire.'));
  }

  if (typeof question.isActive !== 'boolean') {
    issues.push(createIssue('assessment_question_missing_active_flag', `${questionPath}.isActive`, 'Le statut actif de la question est obligatoire.'));
  }

  return resultFromIssues(issues);
}

export function validateAssessmentDimensions(
  dimensions: AssessmentDimensionDefinition[],
): AssessmentValidationResult {
  const issues: AssessmentValidationIssue[] = [];

  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    issues.push(createIssue('assessment_dimensions_missing', 'dimensions', 'La configuration doit contenir les sept dimensions.'));
    return resultFromIssues(issues);
  }

  if (dimensions.length !== DIMENSION_CODES.length) {
    issues.push(createIssue('assessment_dimensions_count_invalid', 'dimensions', 'La configuration doit contenir exactement sept dimensions.'));
  }

  const dimensionCodes = dimensions.map((dimension) => dimension.code);
  const duplicateDimensionCodes = dimensionCodes.filter((code, index) => dimensionCodes.indexOf(code) !== index);
  if (duplicateDimensionCodes.length > 0) {
    issues.push(createIssue('assessment_dimensions_duplicate_code', 'dimensions', 'Les codes des dimensions doivent etre uniques.'));
  }

  const unknownDimensionCodes = dimensionCodes.filter((code) => !KNOWN_DIMENSION_CODES.has(code));
  if (unknownDimensionCodes.length > 0) {
    issues.push(createIssue('assessment_dimensions_unknown_code', 'dimensions', 'Une dimension inconnue a ete detectee.'));
  }

  const dimensionWeightSum = dimensions.reduce((sum, dimension) => sum + (isFiniteNumber(dimension.weight) ? dimension.weight : 0), 0);
  if (dimensionWeightSum !== 100) {
    issues.push(createIssue('assessment_dimensions_weight_sum_invalid', 'dimensions', 'La somme des poids des dimensions doit etre egale a 100.'));
  }

  const displayOrders = dimensions.map((dimension) => dimension.displayOrder);
  const duplicateDisplayOrders = displayOrders.filter((order, index) => displayOrders.indexOf(order) !== index);
  if (duplicateDisplayOrders.length > 0) {
    issues.push(createIssue('assessment_dimensions_duplicate_display_order', 'dimensions', 'Chaque dimension doit avoir un ordre distinct.'));
  }

  for (const dimension of dimensions) {
    const path = `dimensions.${dimension.code || 'unknown'}`;

    if (!isKnownDimensionCode(dimension.code)) {
      continue;
    }

    if (!isNonEmptyString(dimension.label)) {
      issues.push(createIssue('assessment_dimension_missing_label', `${path}.label`, 'Le libelle de la dimension ne peut pas etre vide.'));
    }

    if (!isNonEmptyString(dimension.description)) {
      issues.push(createIssue('assessment_dimension_missing_description', `${path}.description`, 'La description de la dimension ne peut pas etre vide.'));
    }

    if (!isPositiveInteger(dimension.displayOrder)) {
      issues.push(createIssue('assessment_dimension_invalid_display_order', `${path}.displayOrder`, "L'ordre d'affichage doit etre un entier positif."));
    }

    if (!isPositiveInteger(dimension.minimumEssentialObservations)) {
      issues.push(createIssue('assessment_dimension_invalid_essential_minimum', `${path}.minimumEssentialObservations`, 'Le minimum essentiel doit etre un entier positif.'));
    }

    if (!isPositiveInteger(dimension.minimumExtendedObservations)) {
      issues.push(createIssue('assessment_dimension_invalid_extended_minimum', `${path}.minimumExtendedObservations`, 'Le minimum approfondi doit etre un entier positif.'));
    }

    if (!Array.isArray(dimension.interpretationThresholds) || dimension.interpretationThresholds.length === 0) {
      issues.push(createIssue('assessment_dimension_missing_thresholds', `${path}.interpretationThresholds`, 'La dimension doit contenir des seuils d interpretation.'));
    } else {
      const thresholds = [...dimension.interpretationThresholds].sort((left, right) => left.minScore - right.minScore);
      if (thresholds[0]?.minScore !== 0 || thresholds[thresholds.length - 1]?.maxScore !== 100) {
        issues.push(createIssue('assessment_dimension_threshold_range_invalid', `${path}.interpretationThresholds`, 'Les seuils d interpretation doivent couvrir la plage 0 a 100.'));
      }

      for (let index = 0; index < thresholds.length; index += 1) {
        const threshold = thresholds[index];
        const thresholdPath = `${path}.interpretationThresholds[${index}]`;
        if (!isNonEmptyString(threshold.interpretationCode)) {
          issues.push(createIssue('assessment_dimension_threshold_missing_code', `${thresholdPath}.interpretationCode`, 'Chaque seuil doit avoir un code d interpretation.'));
        }

        if (!isFiniteNumber(threshold.minScore) || !isFiniteNumber(threshold.maxScore) || threshold.minScore < 0 || threshold.maxScore > 100 || threshold.minScore > threshold.maxScore) {
          issues.push(createIssue('assessment_dimension_threshold_invalid_range', thresholdPath, 'Chaque seuil doit definir une plage de score valide.'));
        }

        if (!isNonEmptyString(threshold.candidateSummary)) {
          issues.push(createIssue('assessment_dimension_threshold_missing_candidate_summary', `${thresholdPath}.candidateSummary`, 'Le resume candidat est obligatoire.'));
        }

        if (!isNonEmptyString(threshold.companySummary)) {
          issues.push(createIssue('assessment_dimension_threshold_missing_company_summary', `${thresholdPath}.companySummary`, 'Le resume entreprise est obligatoire.'));
        }

        if (!isNonEmptyString(threshold.interviewFocus)) {
          issues.push(createIssue('assessment_dimension_threshold_missing_interview_focus', `${thresholdPath}.interviewFocus`, "Le focus d'entretien est obligatoire."));
        }

        if (!Array.isArray(threshold.limitations)) {
          issues.push(createIssue('assessment_dimension_threshold_missing_limitations', `${thresholdPath}.limitations`, 'Les limites doivent etre une liste.'));
        }

        if (!Array.isArray(threshold.interviewQuestionIds) || threshold.interviewQuestionIds.length === 0) {
          issues.push(createIssue('assessment_dimension_threshold_missing_questions', `${thresholdPath}.interviewQuestionIds`, "Chaque seuil doit proposer des questions d'entretien."));
        }

        if (index > 0) {
          const previous = thresholds[index - 1];
          if (previous.maxScore + 1 !== threshold.minScore) {
            issues.push(createIssue('assessment_dimension_threshold_gap', `${thresholdPath}.minScore`, 'Les seuils d interpretation ne doivent laisser aucun trou.'));
          }
        }
      }
    }

    if (!Array.isArray(dimension.interviewQuestionIds) || dimension.interviewQuestionIds.length === 0) {
      issues.push(createIssue('assessment_dimension_missing_interview_question_ids', `${path}.interviewQuestionIds`, "La dimension doit proposer des questions d'entretien."));
    }

    const interviewQuestionIds = Array.isArray(dimension.interviewQuestionIds)
      ? dimension.interviewQuestionIds.map((value) => toTrimmedString(value)).filter(Boolean)
      : [];
    const duplicateInterviewQuestionIds = interviewQuestionIds.filter((value, index) => interviewQuestionIds.indexOf(value) !== index);
    if (duplicateInterviewQuestionIds.length > 0) {
      issues.push(createIssue('assessment_dimension_duplicate_interview_question_ids', `${path}.interviewQuestionIds`, 'Les questions d entretien doivent etre uniques.'));
    }

    if (typeof dimension.isActive !== 'boolean') {
      issues.push(createIssue('assessment_dimension_invalid_active_flag', `${path}.isActive`, 'Le statut actif de la dimension est obligatoire.'));
    }

    if (!isPositiveInteger(dimension.weight) || dimension.weight > 100) {
      issues.push(createIssue('assessment_dimension_invalid_weight', `${path}.weight`, 'Le poids de la dimension doit etre compris entre 1 et 100.'));
    }
  }

  return resultFromIssues(issues);
}

export function validateAssessmentCoverage(version: AssessmentVersionDescriptor): AssessmentValidationResult {
  const issues: AssessmentValidationIssue[] = [];
  const essentialQuestions = version.questions.filter((question) => question.path === 'essential');
  const extendedQuestions = version.questions.filter((question) => question.path === 'extended');

  if (version.essentialQuestionCount !== essentialQuestions.length) {
    issues.push(createIssue('assessment_version_essential_count_mismatch', 'version.essentialQuestionCount', 'Le nombre de questions essentielles declare ne correspond pas a la configuration.'));
  }

  if (version.extendedQuestionCount !== extendedQuestions.length) {
    issues.push(createIssue('assessment_version_extended_count_mismatch', 'version.extendedQuestionCount', 'Le nombre de questions approfondies declare ne correspond pas a la configuration.'));
  }

  const expectedCount = version.essentialQuestionCount + version.extendedQuestionCount;
  if (version.questions.length !== expectedCount) {
    issues.push(createIssue('assessment_version_question_count_mismatch', 'version.questions', 'Le nombre total de questions ne correspond pas au detail des parcours.'));
  }

  for (const dimension of version.dimensions.filter((item) => item.isActive)) {
    const covered = version.questions.some((question) => (
      question.isActive
      && (question.primaryDimensionCodes.includes(dimension.code) || question.secondaryDimensionCodes?.includes(dimension.code))
    ));
    if (!covered) {
      issues.push(createIssue('assessment_dimension_not_covered', `dimensions.${dimension.code}`, 'La dimension doit etre couverte par au moins une question active.'));
    }
  }

  return resultFromIssues(issues);
}

export function validateAssessmentResponses(
  version: AssessmentVersionDescriptor,
  questions: AssessmentQuestion[],
  responses: AssessmentResponse[],
): AssessmentValidationResult {
  const issues: AssessmentValidationIssue[] = [];
  const questionLookup = new Map(questions.map((question) => [question.id, question] as const));
  const questionIds = new Set<string>();
  const responseOrders = new Set<number>();
  const sessionIds = new Set<string>();

  if (!Array.isArray(responses) || responses.length === 0) {
    issues.push(createIssue('assessment_responses_incomplete', 'responses', 'Le questionnaire est incomplet tant que toutes les reponses attendues ne sont pas renseignees.', 'warning'));
    return resultFromIssues(issues);
  }

  for (let index = 0; index < responses.length; index += 1) {
    const response = responses[index];
    const responsePath = `responses[${index}]`;

    if (!isNonEmptyString(response.questionId)) {
      issues.push(createIssue('assessment_response_missing_question_id', `${responsePath}.questionId`, 'Chaque reponse doit referencer une question.'));
      continue;
    }

    if (!isNonEmptyString(response.optionId)) {
      issues.push(createIssue('assessment_response_missing_option_id', `${responsePath}.optionId`, 'Chaque reponse doit referencer une option.'));
      continue;
    }

    if (!isPositiveInteger(response.responseOrder)) {
      issues.push(createIssue('assessment_response_invalid_order', `${responsePath}.responseOrder`, 'L ordre de reponse doit etre un entier positif.'));
    } else if (responseOrders.has(response.responseOrder)) {
      issues.push(createIssue('assessment_response_duplicate_order', `${responsePath}.responseOrder`, 'Deux reponses ne peuvent pas partager le meme ordre.'));
    } else {
      responseOrders.add(response.responseOrder);
    }

    if (!isNonEmptyString(response.sessionId)) {
      issues.push(createIssue('assessment_response_missing_session_id', `${responsePath}.sessionId`, 'Chaque reponse doit conserver un identifiant de session.'));
    } else {
      sessionIds.add(response.sessionId);
    }

    if (!isTimestampLike(response.answeredAt)) {
      issues.push(createIssue('assessment_response_invalid_answered_at', `${responsePath}.answeredAt`, 'La date de reponse est invalide.'));
    }

    if (questionIds.has(response.questionId)) {
      issues.push(createIssue('assessment_response_duplicate_question', `${responsePath}.questionId`, 'Une question ne doit recevoir qu une seule reponse.'));
    } else {
      questionIds.add(response.questionId);
    }

    const question = questionLookup.get(response.questionId);
    if (!question) {
      issues.push(createIssue('assessment_response_unknown_question', `${responsePath}.questionId`, 'La reponse reference une question inexistante.'));
      continue;
    }

    if (!question.isActive) {
      issues.push(createIssue('assessment_response_inactive_question', `${responsePath}.questionId`, 'La reponse reference une question inactive.'));
      continue;
    }

    const option = question.options.find((item) => item.id === response.optionId);
    if (!option) {
      issues.push(createIssue('assessment_response_unknown_option', `${responsePath}.optionId`, 'La reponse reference une option inexistante.'));
    }
  }

  if (sessionIds.size > 1) {
    issues.push(createIssue('assessment_response_session_mismatch', 'responses', 'Toutes les reponses doivent appartenir a la meme session.'));
  }

  if (responses.length < questions.length) {
    issues.push(createIssue('assessment_responses_incomplete', 'responses', 'Toutes les questions attendues ne sont pas encore repondues.', 'warning'));
  }

  return resultFromIssues(issues);
}

export function validateAssessmentSourceNotLegacy(value: unknown): AssessmentValidationResult {
  const issues: AssessmentValidationIssue[] = [];
  if (hasLegacyAssessmentShape(value)) {
    issues.push(createIssue(
      'assessment_legacy_payload_rejected',
      '',
      "Le moteur professionnel ne peut pas reutiliser un resultat legacy Seven'O.",
    ));
  }

  return resultFromIssues(issues);
}

export function validateAssessmentVersion(
  version: AssessmentVersionDescriptor,
  options: AssessmentVersionValidationOptions = {},
): AssessmentValidationResult {
  const issues = [
    ...validateAssessmentSourceNotLegacy(version).issues,
    ...collectVersionIssues(version, options),
    ...validateAssessmentDimensions(version.dimensions).issues,
  ];

  const questionIds = version.questions.map((question) => question.id);
  const duplicateQuestionIds = questionIds.filter((id, index) => questionIds.indexOf(id) !== index && id);
  if (duplicateQuestionIds.length > 0) {
    issues.push(createIssue('assessment_version_duplicate_question_ids', 'questions', 'Les identifiants des questions doivent etre uniques.'));
  }

  const questionCodes = version.questions.map((question) => question.code);
  const duplicateQuestionCodes = questionCodes.filter((code, index) => questionCodes.indexOf(code) !== index && code);
  if (duplicateQuestionCodes.length > 0) {
    issues.push(createIssue('assessment_version_duplicate_question_codes', 'questions', 'Les codes des questions doivent etre uniques.'));
  }

  for (const question of version.questions) {
    const questionValidation = validateAssessmentQuestion(question, version);
    issues.push(...questionValidation.issues);
  }

  issues.push(...validateAssessmentCoverage(version).issues);

  return resultFromIssues(issues);
}

function selectRelevantQuestions(
  version: AssessmentVersionDescriptor,
  questions: AssessmentQuestion[],
  completedPath: AssessmentPath,
) {
  const allowedQuestionIds = new Set(
    (completedPath === 'essential'
      ? questions.filter((question) => question.path === 'essential')
      : questions).map((question) => question.id),
  );

  return version.questions
    .filter((question) => question.isActive && allowedQuestionIds.has(question.id))
    .sort((left, right) => left.position - right.position);
}

function getSelectedQuestionOption(question: AssessmentQuestion, response: AssessmentResponse | undefined) {
  if (!response) {
    return null;
  }

  return question.options.find((option) => option.id === response.optionId) ?? null;
}

function computeDimensionResult(
  dimension: AssessmentDimensionDefinition,
  questions: AssessmentQuestion[],
  responseLookup: Map<string, AssessmentResponse>,
  completedPath: AssessmentPath,
): AssessmentDimensionResult {
  const relevantQuestions = questions.filter((question) => (
    question.primaryDimensionCodes.includes(dimension.code)
    || question.secondaryDimensionCodes?.includes(dimension.code)
  ));

  const expectedObservationsCount = completedPath === 'extended'
    ? dimension.minimumExtendedObservations
    : dimension.minimumEssentialObservations;
  const evidenceCodes: string[] = [];
  const limitations: string[] = [];
  let observationsCount = 0;
  let obtainedPoints = 0;
  let minimumPoints = 0;
  let maximumPoints = 0;
  let hasMissingResponse = false;

  for (const question of relevantQuestions) {
    const minContribution = question.options.reduce((min, option) => {
      const contribution = option.dimensionScores[dimension.code] ?? 0;
      return contribution < min ? contribution : min;
    }, OPTION_SCORE_MAX);
    const maxContribution = question.options.reduce((max, option) => {
      const contribution = option.dimensionScores[dimension.code] ?? 0;
      return contribution > max ? contribution : max;
    }, 0);
    minimumPoints += minContribution;
    maximumPoints += maxContribution;

    const response = responseLookup.get(question.id);
    const selectedOption = getSelectedQuestionOption(question, response ?? undefined);
    if (!response || !selectedOption) {
      hasMissingResponse = true;
      continue;
    }

    observationsCount += 1;
    evidenceCodes.push(`${question.code}:${selectedOption.id}`);
    obtainedPoints += selectedOption.dimensionScores[dimension.code] ?? 0;
  }

  if (relevantQuestions.length === 0 || maximumPoints === 0) {
    return {
      dimensionCode: dimension.code,
      status: 'not_measured',
      observationsCount,
      expectedObservationsCount,
      coverageRatio: 0,
      precisionLevel: 'caution',
      interpretationCode: 'not_measured',
      evidenceCodes,
      limitations: [
        'Cette dimension nest pas mesuree par les questions presentees.',
      ],
    };
  }

  if (hasMissingResponse || observationsCount < expectedObservationsCount) {
    if (hasMissingResponse) {
      limitations.push('Toutes les questions attendues nont pas encore de reponse.');
    }

    if (observationsCount < expectedObservationsCount) {
      limitations.push('Le nombre minimum dobservations na pas encore ete atteint.');
    }

    return {
      dimensionCode: dimension.code,
      status: 'insufficient_data',
      observationsCount,
      expectedObservationsCount,
      coverageRatio: Math.min(1, observationsCount / Math.max(1, expectedObservationsCount)),
      precisionLevel: 'caution',
      interpretationCode: 'insufficient_data',
      evidenceCodes,
      limitations: uniqueStrings([
        ...limitations,
        'Les donnees disponibles permettent seulement une lecture prudente.',
      ]),
    };
  }

  const denominator = maximumPoints - minimumPoints;
  if (denominator <= 0) {
    return {
      dimensionCode: dimension.code,
      status: 'not_measured',
      observationsCount,
      expectedObservationsCount,
      coverageRatio: 0,
      precisionLevel: 'caution',
      interpretationCode: 'not_measured',
      evidenceCodes,
      limitations: ['Les bornes de score de cette dimension sont invalides.'],
    };
  }

  const normalizedScore = Math.max(
    SCORE_MIN,
    Math.min(SCORE_MAX, Math.round(((obtainedPoints - minimumPoints) / denominator) * 100)),
  );
  const interpretationBlock = getInterpretationBlock(dimension, normalizedScore);

  if (!interpretationBlock) {
    return {
      dimensionCode: dimension.code,
      status: 'not_measured',
      observationsCount,
      expectedObservationsCount,
      coverageRatio: 0,
      precisionLevel: 'caution',
      interpretationCode: 'not_measured',
      evidenceCodes,
      limitations: ['Aucun seuil d interpretation ne correspond au score obtenu.'],
    };
  }

  return {
    dimensionCode: dimension.code,
    status: 'measured',
    score: normalizedScore,
    observationsCount,
    expectedObservationsCount,
    coverageRatio: Math.min(1, observationsCount / Math.max(1, expectedObservationsCount)),
    precisionLevel: completedPath === 'extended' ? 'reinforced' : 'standard',
    interpretationCode: interpretationBlock.interpretationCode,
    evidenceCodes,
    limitations: uniqueStrings([
      ...interpretationBlock.limitations,
    ]),
  };
}

function selectReportItems(
  dimensionResults: AssessmentDimensionResult[],
  version: AssessmentVersionDescriptor,
) {
  const dimensionsByCode = new Map(version.dimensions.map((dimension) => [dimension.code, dimension] as const));
  const measuredResults = dimensionResults
    .filter((result) => result.status === 'measured' && typeof result.score === 'number')
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || (dimensionsByCode.get(left.dimensionCode)?.displayOrder ?? 0) - (dimensionsByCode.get(right.dimensionCode)?.displayOrder ?? 0));

  const fallbackResults = dimensionResults
    .filter((result) => result.status !== 'measured')
    .sort((left, right) => (dimensionsByCode.get(left.dimensionCode)?.displayOrder ?? 0) - (dimensionsByCode.get(right.dimensionCode)?.displayOrder ?? 0));

  const selectedStrengthResults = measuredResults.slice(0, Math.min(4, Math.max(2, measuredResults.length)));
  const selectedFocusResults = [...measuredResults].sort((left, right) => (left.score ?? 0) - (right.score ?? 0))
    .slice(0, Math.min(4, Math.max(2, measuredResults.length)))
    .concat(fallbackResults.slice(0, Math.max(0, 2 - Math.min(4, Math.max(2, measuredResults.length)))));

  const strengths: AssessmentReportStrength[] = selectedStrengthResults.map((result) => {
    const dimension = dimensionsByCode.get(result.dimensionCode)!;
    const block = result.status === 'measured' && typeof result.score === 'number'
      ? getInterpretationBlock(dimension, result.score)
      : null;
    return {
      code: `${result.dimensionCode}:${block?.interpretationCode ?? 'not_measured'}`,
      dimensionCode: result.dimensionCode,
      label: block?.strengthLabel ?? dimension.label,
      candidateSummary: block?.candidateSummary ?? 'Les reponses indiquent une base interessante a approfondir.',
      companySummary: block?.companySummary ?? 'Les reponses suggere une base a explorer.',
      interviewQuestionIds: block?.interviewQuestionIds ? [...block.interviewQuestionIds] : [...dimension.interviewQuestionIds],
      limitations: [...result.limitations],
    };
  });

  const interviewFocusAreas: AssessmentReportFocusArea[] = selectedFocusResults.map((result) => {
    const dimension = dimensionsByCode.get(result.dimensionCode)!;
    const block = result.status === 'measured' && typeof result.score === 'number'
      ? getInterpretationBlock(dimension, result.score)
      : null;
    return {
      code: `${result.dimensionCode}:${block?.interpretationCode ?? result.status}`,
      dimensionCode: result.dimensionCode,
      label: block?.strengthLabel ?? dimension.label,
      candidateSummary: block?.candidateSummary ?? 'Il peut etre utile d approfondir cette dimension.',
      companySummary: block?.companySummary ?? 'Il peut etre utile de preciser cette dimension en entretien.',
      interviewQuestionIds: block?.interviewQuestionIds ? [...block.interviewQuestionIds] : [...dimension.interviewQuestionIds],
      limitations: [...result.limitations],
    };
  });

  const candidateSummary = buildReportText(
    strengths.slice(0, 2).map((item) => item.candidateSummary).concat(interviewFocusAreas.slice(0, 1).map((item) => item.candidateSummary)),
    'Les donnees disponibles permettent seulement une lecture prudente du profil professionnel.',
  );

  const companySummary = buildReportText(
    strengths.slice(0, 2).map((item) => item.companySummary).concat(interviewFocusAreas.slice(0, 1).map((item) => item.companySummary)),
    'Les donnees disponibles permettent seulement une aide prudente a l entretien.',
  );

  const suggestedInterviewQuestionIds = uniqueStrings([
    ...interviewFocusAreas.flatMap((item) => item.interviewQuestionIds),
    ...strengths.flatMap((item) => item.interviewQuestionIds),
  ]).slice(0, MAX_SUGGESTED_QUESTIONS);

  const suggestedInterviewQuestions: AssessmentSuggestedInterviewQuestion[] = suggestedInterviewQuestionIds.map((id, index) => {
    const dimensionCode = interviewFocusAreas[index % Math.max(1, interviewFocusAreas.length)]?.dimensionCode
      ?? strengths[index % Math.max(1, strengths.length)]?.dimensionCode
      ?? version.dimensions[0]?.code
      ?? 'information_understanding';
    return {
      id,
      dimensionCode,
      prompt: version.interviewQuestionCatalog?.[id] ?? id,
      rationale: interviewFocusAreas[index % Math.max(1, interviewFocusAreas.length)]?.candidateSummary
        ?? strengths[index % Math.max(1, strengths.length)]?.candidateSummary
        ?? 'Question suggeree pour approfondir le profil professionnel.',
    };
  });

  while (suggestedInterviewQuestions.length < MIN_SUGGESTED_QUESTIONS && version.dimensions.length > 0) {
    const dimension = version.dimensions[suggestedInterviewQuestions.length % version.dimensions.length];
    const fallbackQuestionId = dimension.interviewQuestionIds[suggestedInterviewQuestions.length % Math.max(1, dimension.interviewQuestionIds.length)]
      ?? `${dimension.code}-interview-${suggestedInterviewQuestions.length + 1}`;
    if (!suggestedInterviewQuestions.some((item) => item.id === fallbackQuestionId)) {
      suggestedInterviewQuestions.push({
        id: fallbackQuestionId,
        dimensionCode: dimension.code,
        prompt: version.interviewQuestionCatalog?.[fallbackQuestionId] ?? fallbackQuestionId,
        rationale: 'Question suggeree par la configuration de la dimension.',
      });
    } else {
      break;
    }
  }

  return {
    strengths,
    interviewFocusAreas,
    suggestedInterviewQuestions: suggestedInterviewQuestions.slice(0, MAX_SUGGESTED_QUESTIONS),
    candidateSummary,
    companySummary,
  };
}

export function calculateProfessionalAssessmentOutcome(
  input: AssessmentEngineRequest,
): AssessmentCalculationOutcome {
  const versionIssues = validateAssessmentVersion(input.version, { mode: 'definition' });
  if (!versionIssues.valid) {
    throw new AssessmentModelError('La version SevenO professionnelle est invalide.', versionIssues.issues);
  }

  const sourceIssues = validateAssessmentSourceNotLegacy(input.version);
  if (!sourceIssues.valid) {
    throw new AssessmentModelError('Le moteur professionnel a recu un resultat legacy.', sourceIssues.issues);
  }

  const responseIssues = validateAssessmentResponses(input.version, input.questions, input.responses);
  const responseErrorIssues = responseIssues.issues.filter((issue) => issue.severity === 'error');
  if (responseErrorIssues.length > 0) {
    throw new AssessmentModelError('Les reponses de la session SevenO professionnelle sont invalides.', responseIssues.issues);
  }

  const completedPath = input.completedPath;
  const consideredQuestions = selectRelevantQuestions(input.version, input.questions, completedPath);
  const responseLookup = new Map(input.responses.map((response) => [response.questionId, response] as const));
  const dimensionOrder = new Map(input.version.dimensions.map((dimension) => [dimension.code, dimension.displayOrder] as const));
  const dimensionResults = input.version.dimensions
    .filter((dimension) => dimension.isActive)
    .map((dimension) => computeDimensionResult(dimension, consideredQuestions, responseLookup, completedPath))
    .sort((left, right) => (dimensionOrder.get(left.dimensionCode) ?? 0) - (dimensionOrder.get(right.dimensionCode) ?? 0));

  const precisionLevel = buildPrecisionLevelFromResults(completedPath, dimensionResults);
  const coverage = {
    essential: buildCoverageSnapshot(
      'essential',
      input.version.questions.filter((question) => question.path === 'essential').length,
      consideredQuestions.filter((question) => question.path === 'essential' && responseLookup.has(question.id)).length,
      input.version.dimensions.filter((dimension) => dimension.isActive).reduce((sum, dimension) => sum + dimension.minimumEssentialObservations, 0),
    ),
    extended: buildCoverageSnapshot(
      'extended',
      input.version.questions.filter((question) => question.path === 'extended').length,
      consideredQuestions.filter((question) => question.path === 'extended' && responseLookup.has(question.id)).length,
      input.version.dimensions.filter((dimension) => dimension.isActive).reduce((sum, dimension) => sum + dimension.minimumExtendedObservations, 0),
    ),
  };

  const selected = selectReportItems(dimensionResults, input.version);
  const completedAt = input.completedAt ?? input.responses
    .slice()
    .sort((left, right) => left.responseOrder - right.responseOrder)
    .at(-1)?.answeredAt ?? input.version.updatedAt;

  const report: SevenoProfessionalAssessmentReport = {
    assessmentVersion: buildVersionSnapshot(input.version),
    completedPath,
    precisionLevel,
    completedAt,
    dimensionResults,
    strengths: selected.strengths,
    interviewFocusAreas: selected.interviewFocusAreas,
    suggestedInterviewQuestions: selected.suggestedInterviewQuestions,
    candidateSummary: selected.candidateSummary,
    companySummary: selected.companySummary,
    limitations: uniqueStrings(
      dimensionResults.flatMap((result) => result.limitations),
    ),
    legalNoticeCode: input.version.legalNoticeVersion,
    scoringEngineVersion: input.version.scoringEngineVersion,
    interpretationEngineVersion: input.version.interpretationEngineVersion,
  };

  const alerts: AssessmentCalculationAlert[] = [
    ...responseIssues.issues,
    ...dimensionResults
      .filter((result) => result.status !== 'measured')
      .map((result) => createIssue(
        result.status === 'not_measured' ? 'assessment_dimension_not_measured' : 'assessment_dimension_insufficient_data',
        `dimensions.${result.dimensionCode}`,
        result.status === 'not_measured'
          ? 'Cette dimension nest pas mesuree dans la configuration presentee.'
          : 'Cette dimension ne dispose pas encore de suffisamment dobservations.',
        'warning',
      )),
    ...(precisionLevel === 'caution'
      ? [createIssue('assessment_precision_caution', 'report.precisionLevel', 'Le rapport doit etre interprete avec prudence.', 'warning')]
      : []),
  ];

  const observationsCount = dimensionResults.reduce((sum, result) => sum + result.observationsCount, 0);

  return {
    report,
    coverage,
    observationsCount,
    alerts,
  };
}

export function buildProfessionalAssessmentReport(
  input: AssessmentEngineRequest,
): SevenoProfessionalAssessmentReport {
  return calculateProfessionalAssessmentOutcome(input).report;
}

export function projectAssessmentReportForCandidate(
  report: SevenoProfessionalAssessmentReport,
): AssessmentCandidateProjection {
  const legacyIssues = validateAssessmentSourceNotLegacy(report);
  if (!legacyIssues.valid) {
    throw new AssessmentModelError('Le rapport professionnel candidat ne peut pas etre construit a partir dun legacy.', legacyIssues.issues);
  }

  return {
    assessmentVersion: report.assessmentVersion,
    completedPath: report.completedPath,
    precisionLevel: report.precisionLevel,
    completedAt: report.completedAt,
    dimensionResults: report.dimensionResults.map(buildProjectionDimensionResult),
    strengths: report.strengths.map(buildProjectionStrength),
    interviewFocusAreas: report.interviewFocusAreas.map(buildProjectionFocusArea),
    suggestedInterviewQuestions: report.suggestedInterviewQuestions.map((question) => ({ ...question })),
    candidateSummary: report.candidateSummary,
    limitations: [...report.limitations],
    legalNoticeCode: report.legalNoticeCode,
    scoringEngineVersion: report.scoringEngineVersion,
    interpretationEngineVersion: report.interpretationEngineVersion,
  };
}

export function projectAssessmentReportForCompany(
  report: SevenoProfessionalAssessmentReport,
): AssessmentCompanyProjection {
  const legacyIssues = validateAssessmentSourceNotLegacy(report);
  if (!legacyIssues.valid) {
    throw new AssessmentModelError('Le rapport professionnel entreprise ne peut pas etre construit a partir dun legacy.', legacyIssues.issues);
  }

  return {
    assessmentVersion: report.assessmentVersion,
    completedPath: report.completedPath,
    precisionLevel: report.precisionLevel,
    completedAt: report.completedAt,
    dimensionResults: report.dimensionResults.map(buildProjectionDimensionResult),
    strengths: report.strengths.map(buildProjectionStrength),
    interviewFocusAreas: report.interviewFocusAreas.map(buildProjectionFocusArea),
    suggestedInterviewQuestions: report.suggestedInterviewQuestions.map((question) => ({ ...question })),
    companySummary: report.companySummary,
    limitations: [...report.limitations],
    legalNoticeCode: report.legalNoticeCode,
    scoringEngineVersion: report.scoringEngineVersion,
    interpretationEngineVersion: report.interpretationEngineVersion,
  };
}
