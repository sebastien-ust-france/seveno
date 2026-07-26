import type { FirestoreDateValue } from '@/types/seveno';
import type { SevenoAssessmentHumanReviewStatus } from '@/types/seveno-assessment-review';

export type AssessmentProfileVersionStatus = 'draft' | 'pilot' | 'active' | 'archived';
export type AssessmentPath = 'essential' | 'extended';
export type AssessmentDimensionCode =
  | 'information_understanding'
  | 'organization_prioritization'
  | 'problem_solving'
  | 'autonomy_initiative'
  | 'adaptability'
  | 'collaboration'
  | 'rigor_reliability';
export type AssessmentQuestionDifficulty = 'introductory' | 'standard' | 'advanced';
export type AssessmentBehaviorAxisCode =
  | 'decision_pace'
  | 'risk_orientation'
  | 'initiative_validation'
  | 'framework_adaptation'
  | 'persistence_switching'
  | 'analysis_experimentation'
  | 'speed_precision'
  | 'ambiguity_tolerance'
  | 'authority_challenge'
  | 'disagreement_style'
  | 'method_exploration'
  | 'execution_improvement'
  | 'leadership_activation'
  | 'influence'
  | 'followership'
  | 'collective_support'
  | 'value_creation'
  | 'alerting_behavior';
export type AssessmentBehaviorQuestionType = 'behavioral_situation' | 'tradeoff' | 'direct_self_report' | 'work_preference';
export type AssessmentSignalReliability = 'high' | 'medium' | 'low' | 'descriptive';
export type AssessmentBehaviorSignalValue = -2 | -1 | 0 | 1 | 2;
export type ProfessionalAssessmentAxisKind = 'bipolar' | 'independent';
export type ProfessionalAssessmentAxisDirection =
  | 'negative'
  | 'mixed'
  | 'positive'
  | 'low'
  | 'moderate'
  | 'high';
export type ProfessionalAssessmentAxisStability = 'unknown' | 'stable' | 'variable' | 'highly_variable';
export type ProfessionalAssessmentAxisEvidenceLevel = 'limited' | 'moderate' | 'supported';
export type ProfessionalAssessmentContextFactor =
  | 'riskLevel'
  | 'urgency'
  | 'authorityContext'
  | 'informationCompleteness'
  | 'collectiveImpact';

export interface ProfessionalAssessmentAxisResult {
  axisCode: AssessmentBehaviorAxisCode;
  axisKind: ProfessionalAssessmentAxisKind;
  observationCount: number;
  weightedEvidence: number;
  weightedMean: number;
  direction: ProfessionalAssessmentAxisDirection;
  strength: number;
  stability: ProfessionalAssessmentAxisStability;
  evidenceLevel: ProfessionalAssessmentAxisEvidenceLevel;
  contextSensitive: boolean;
  contextFactors: ProfessionalAssessmentContextFactor[];
}

export interface ProfessionalAssessmentBehavioralProfile {
  axisResults: ProfessionalAssessmentAxisResult[];
  candidateSummaryItems: string[];
  companySummaryItems: string[];
  candidateSummary: string;
  companySummary: string;
  candidateNarrativeParagraphs?: string[];
  candidateThemeGroups?: ProfessionalAssessmentCandidateThemeGroup[];
  disclaimer: string;
}
export type ProfessionalAssessmentCandidateThemeGroupCode = 'WORKING_STYLE' | 'COLLECTIVE' | 'CONTRIBUTION';
export interface ProfessionalAssessmentCandidateThemeGroup {
  code: ProfessionalAssessmentCandidateThemeGroupCode;
  title: string;
  items: string[];
}
export type ProfessionalAssessmentCandidateBehavioralProfile = Pick<
  ProfessionalAssessmentBehavioralProfile,
  'axisResults' | 'candidateSummaryItems' | 'candidateSummary' | 'candidateNarrativeParagraphs' | 'candidateThemeGroups' | 'disclaimer'
>;
export type ProfessionalAssessmentCompanyBehavioralProfile = Pick<
  ProfessionalAssessmentBehavioralProfile,
  'axisResults' | 'companySummaryItems' | 'companySummary' | 'disclaimer'
>;
export type AssessmentBehaviorRiskLevel = 'none' | 'low' | 'medium' | 'high';
export type AssessmentBehaviorReversibility = 'not_applicable' | 'high' | 'medium' | 'low';
export type AssessmentBehaviorUrgency = 'none' | 'low' | 'medium' | 'high';
export type AssessmentBehaviorAuthorityContext = 'none' | 'present' | 'absent' | 'directive' | 'disagreement';
export type AssessmentBehaviorInformationCompleteness = 'complete' | 'partial' | 'uncertain';
export type AssessmentBehaviorCollectiveImpact = 'individual' | 'team' | 'third_party' | 'organization';
export type AssessmentBehaviorPriorFailure = 'none' | 'suspected' | 'confirmed';
export type AssessmentBehaviorSocialPressure = 'none' | 'low' | 'medium' | 'high';
export type AssessmentBehaviorHelpAvailability = 'available' | 'limited' | 'unavailable' | 'not_applicable';
export type AssessmentBehaviorWaitingCost = 'none' | 'low' | 'medium' | 'high';
export type AssessmentBehaviorSmallScaleTestPossible = boolean | null;
export type AssessmentValidationSeverity = 'error' | 'warning';
export type AssessmentSessionStatus = 'not_started' | 'in_progress' | 'submitted' | 'expired' | 'abandoned' | 'cancelled';
export type AssessmentDimensionResultStatus = 'measured' | 'insufficient_data' | 'not_measured';
export type AssessmentPrecisionLevel = 'caution' | 'standard' | 'reinforced';
export type AssessmentScoreValue = 0 | 1 | 2 | 3 | 4;

export interface AssessmentValidationIssue {
  code: string;
  path: string;
  message: string;
  severity: AssessmentValidationSeverity;
}

export interface AssessmentValidationResult {
  valid: boolean;
  issues: AssessmentValidationIssue[];
}

export interface AssessmentInterpretationBlock {
  interpretationCode: string;
  minScore: number;
  maxScore: number;
  candidateSummary: string;
  companySummary: string;
  strengthLabel?: string;
  interviewFocus: string;
  limitations: string[];
  interviewQuestionIds: string[];
}

export interface AssessmentDimensionDefinition {
  code: AssessmentDimensionCode;
  label: string;
  description: string;
  weight: number;
  displayOrder: number;
  minimumEssentialObservations: number;
  minimumExtendedObservations: number;
  interpretationThresholds: AssessmentInterpretationBlock[];
  interviewQuestionIds: string[];
  isActive: boolean;
}

export interface AssessmentQuestionOption {
  id: string;
  label: string;
  position: number;
  dimensionScores: Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>>;
  adminExplanation: string;
  behaviorSignals?: Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>>;
}

export interface AssessmentBehaviorContext {
  riskLevel: AssessmentBehaviorRiskLevel;
  reversibility: AssessmentBehaviorReversibility;
  urgency: AssessmentBehaviorUrgency;
  authorityContext: AssessmentBehaviorAuthorityContext;
  informationCompleteness: AssessmentBehaviorInformationCompleteness;
  collectiveImpact: AssessmentBehaviorCollectiveImpact;
  priorFailure: AssessmentBehaviorPriorFailure;
  socialPressure: AssessmentBehaviorSocialPressure;
  helpAvailability: AssessmentBehaviorHelpAvailability;
  waitingCost: AssessmentBehaviorWaitingCost;
  smallScaleTestPossible: AssessmentBehaviorSmallScaleTestPossible;
}

export interface AssessmentBehaviorModel {
  primaryAxisCode: AssessmentBehaviorAxisCode;
  secondaryAxisCodes: AssessmentBehaviorAxisCode[];
  signalReliability: AssessmentSignalReliability;
  context: AssessmentBehaviorContext;
}

export interface AssessmentQuestion {
  id: string;
  code: string;
  assessmentVersionId: string;
  path: AssessmentPath;
  position: number;
  situation: string;
  instruction: string;
  options: AssessmentQuestionOption[];
  primaryDimensionCodes: AssessmentDimensionCode[];
  secondaryDimensionCodes?: AssessmentDimensionCode[];
  questionType?: AssessmentBehaviorQuestionType;
  signalReliability?: AssessmentSignalReliability;
  behaviorModel?: AssessmentBehaviorModel;
  difficulty: AssessmentQuestionDifficulty;
  estimatedReadingSeconds: number;
  adminRationale: string;
  isActive: boolean;
  humanReviewStatus?: SevenoAssessmentHumanReviewStatus;
}

export interface AssessmentVersionDescriptor {
  id: string;
  code: string;
  version: string;
  status: AssessmentProfileVersionStatus;
  name: string;
  description: string;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  publishedAt: FirestoreDateValue | null;
  archivedAt: FirestoreDateValue | null;
  activatedAt?: FirestoreDateValue | null;
  createdBy: string;
  generatedPromptVersion?: string;
  essentialPoolSize?: number;
  extendedPoolSize?: number;
  essentialDrawSize?: number;
  extendedDrawSize?: number;
  schemaVersion?: number;
  dimensions: AssessmentDimensionDefinition[];
  questions: AssessmentQuestion[];
  essentialQuestionCount: number;
  extendedQuestionCount: number;
  estimatedEssentialDurationMinutes: number;
  estimatedExtendedDurationMinutes: number;
  scoringEngineVersion: string;
  interpretationEngineVersion: string;
  legalNoticeVersion: string;
  revisionNotes: string[];
  interviewQuestionCatalog?: Record<string, string>;
}

export interface AssessmentVersionSnapshot {
  id: string;
  code: string;
  version: string;
  status: AssessmentProfileVersionStatus;
  name: string;
  description?: string;
}

export interface AssessmentResponse {
  questionId: string;
  optionId: string;
  answeredAt: FirestoreDateValue;
  responseOrder: number;
  sessionId: string;
  responseDurationSeconds?: number | null;
}

export interface AssessmentSession {
  id: string;
  candidateUid: string;
  assessmentVersionId: string;
  assessmentVersion: string;
  path: AssessmentPath;
  status: AssessmentSessionStatus;
  startedAt: FirestoreDateValue;
  expiresAt: FirestoreDateValue;
  submittedAt: FirestoreDateValue | null;
  questionIds: string[];
  essentialSessionId?: string | null;
  responses: AssessmentResponse[];
  scoringEngineVersion: string;
  interpretationEngineVersion: string;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface AssessmentCoverageSnapshot {
  path: AssessmentPath;
  totalQuestions: number;
  answeredQuestions: number;
  expectedMinimumObservations: number;
  coverageRatio: number;
}

export interface AssessmentDimensionResult {
  dimensionCode: AssessmentDimensionCode;
  score?: number;
  status: AssessmentDimensionResultStatus;
  observationsCount: number;
  expectedObservationsCount: number;
  coverageRatio: number;
  precisionLevel: AssessmentPrecisionLevel;
  interpretationCode: string;
  evidenceCodes: string[];
  limitations: string[];
}

export interface AssessmentReportStrength {
  code: string;
  dimensionCode: AssessmentDimensionCode;
  label: string;
  candidateSummary: string;
  companySummary: string;
  interviewQuestionIds: string[];
  limitations: string[];
}

export interface AssessmentReportFocusArea {
  code: string;
  dimensionCode: AssessmentDimensionCode;
  label: string;
  candidateSummary: string;
  companySummary: string;
  interviewQuestionIds: string[];
  limitations: string[];
}

export interface AssessmentProjectionStrength {
  code: string;
  dimensionCode: AssessmentDimensionCode;
  label: string;
  summary: string;
  interviewQuestionIds: string[];
  limitations: string[];
}

export interface AssessmentProjectionFocusArea {
  code: string;
  dimensionCode: AssessmentDimensionCode;
  label: string;
  summary: string;
  interviewQuestionIds: string[];
  limitations: string[];
}

export interface AssessmentSuggestedInterviewQuestion {
  id: string;
  dimensionCode: AssessmentDimensionCode;
  prompt: string;
  rationale: string;
}

export interface SevenoProfessionalAssessmentReport {
  assessmentVersion: AssessmentVersionSnapshot;
  completedPath: AssessmentPath;
  precisionLevel: AssessmentPrecisionLevel;
  completedAt: FirestoreDateValue;
  dimensionResults: AssessmentDimensionResult[];
  strengths: AssessmentReportStrength[];
  interviewFocusAreas: AssessmentReportFocusArea[];
  suggestedInterviewQuestions: AssessmentSuggestedInterviewQuestion[];
  candidateSummary: string;
  companySummary: string;
  behavioralProfile?: ProfessionalAssessmentBehavioralProfile;
  limitations: string[];
  legalNoticeCode: string;
  scoringEngineVersion: string;
  interpretationEngineVersion: string;
}

export interface AssessmentCalculationAlert {
  code: string;
  path: string;
  message: string;
  severity: AssessmentValidationSeverity;
}

export interface AssessmentCalculationOutcome {
  report: SevenoProfessionalAssessmentReport;
  coverage: {
    essential: AssessmentCoverageSnapshot;
    extended: AssessmentCoverageSnapshot;
  };
  observationsCount: number;
  alerts: AssessmentCalculationAlert[];
}

export interface AssessmentProjectionDimensionResult {
  dimensionCode: AssessmentDimensionCode;
  score?: number;
  status: AssessmentDimensionResultStatus;
  precisionLevel: AssessmentPrecisionLevel;
  interpretationCode: string;
  limitations: string[];
}

export interface AssessmentCandidateProjection {
  assessmentVersion: AssessmentVersionSnapshot;
  completedPath: AssessmentPath;
  precisionLevel: AssessmentPrecisionLevel;
  completedAt: FirestoreDateValue;
  dimensionResults: AssessmentProjectionDimensionResult[];
  strengths: AssessmentProjectionStrength[];
  interviewFocusAreas: AssessmentProjectionFocusArea[];
  suggestedInterviewQuestions: AssessmentSuggestedInterviewQuestion[];
  candidateSummary: string;
  behavioralProfile?: ProfessionalAssessmentCandidateBehavioralProfile;
  limitations: string[];
  legalNoticeCode: string;
  scoringEngineVersion: string;
  interpretationEngineVersion: string;
}

export interface AssessmentCompanyProjection {
  assessmentVersion: AssessmentVersionSnapshot;
  completedPath: AssessmentPath;
  precisionLevel: AssessmentPrecisionLevel;
  completedAt: FirestoreDateValue;
  dimensionResults: AssessmentProjectionDimensionResult[];
  strengths: AssessmentProjectionStrength[];
  interviewFocusAreas: AssessmentProjectionFocusArea[];
  suggestedInterviewQuestions: AssessmentSuggestedInterviewQuestion[];
  companySummary: string;
  behavioralProfile?: ProfessionalAssessmentCompanyBehavioralProfile;
  limitations: string[];
  legalNoticeCode: string;
  scoringEngineVersion: string;
  interpretationEngineVersion: string;
}

export interface AssessmentEngineRequest {
  version: AssessmentVersionDescriptor;
  completedPath: AssessmentPath;
  questions: AssessmentQuestion[];
  responses: AssessmentResponse[];
  completedAt?: FirestoreDateValue;
}

export interface AssessmentVersionEditOptions {
  hasStartedSessions?: boolean;
}

export interface AssessmentVersionValidationOptions extends AssessmentVersionEditOptions {
  mode?: 'definition' | 'edit';
}
