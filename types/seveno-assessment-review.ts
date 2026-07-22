import type { AssessmentDimensionCode, AssessmentPath } from '@/types/seveno-assessment';

export type SevenoAssessmentAutomatedCheckStatus = 'passed' | 'warning' | 'failed';
export type SevenoAssessmentHumanReviewStatus = 'pending' | 'reviewed_with_changes' | 'approved_for_pilot' | 'rejected';

export interface SevenoAssessmentReviewQuestionOption {
  id: string;
  label: string;
  order: number;
  dimensionScores: Partial<Record<AssessmentDimensionCode, number>>;
  adminExplanation: string;
}

export interface SevenoAssessmentReviewQuestionRecord {
  questionId: string;
  code: string;
  path: AssessmentPath;
  situation: string;
  instruction: string;
  primaryDimensionCodes: AssessmentDimensionCode[];
  secondaryDimensionCode?: AssessmentDimensionCode | null;
  options: SevenoAssessmentReviewQuestionOption[];
  scoringScale: '0-4';
  justificationAdministrateur: string;
  automatedCheckStatus: SevenoAssessmentAutomatedCheckStatus;
  humanReviewStatus: SevenoAssessmentHumanReviewStatus;
  reviewComments: string[];
  proposedCorrections: string[];
  decisionFinal: SevenoAssessmentHumanReviewStatus;
}

export interface SevenoAssessmentReviewManifestSummary {
  totalQuestions: number;
  pending: number;
  reviewedWithChanges: number;
  approvedForPilot: number;
  rejected: number;
  pendingHumanReviewCount: number;
  reviewedWithChangesCount: number;
  approvedForPilotCount: number;
  rejectedCount: number;
}

export interface SevenoAssessmentReviewChangeLogEntry {
  questionCode: string;
  oldContent: string;
  newContent: string;
  reason: string;
  impactOnDimensions: string;
  impactOnBarreme: string;
}

export interface SevenoAssessmentReviewSeries {
  seriesNumber: number;
  title: string;
  questionCodes: string[];
  questions: SevenoAssessmentReviewQuestionRecord[];
}

export interface SevenoAssessmentReviewManifest {
  versionId: string;
  versionCode: string;
  versionNumber: string;
  versionStatus: string;
  generatedAt: string;
  automatedCheckStatus: SevenoAssessmentAutomatedCheckStatus;
  humanReviewSummary: SevenoAssessmentReviewManifestSummary;
  questionCount: number;
  questions: SevenoAssessmentReviewQuestionRecord[];
  reviewSeries: SevenoAssessmentReviewSeries[];
  changeLog: SevenoAssessmentReviewChangeLogEntry[];
}
