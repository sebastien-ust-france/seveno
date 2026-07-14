import type { FirestoreDateValue } from '@/types/seveno';
import type {
  CompanyQuestion,
  CompanyQuestionType,
} from '@/types/seveno-company-questionnaires';

export type CompanyApplicationQuestionnaireStatus = 'draft' | 'active' | 'archived';
export type CompanyApplicationQuestionnaireSessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'completed'
  | 'expired'
  | 'abandoned';
export type CompanyApplicationQuestionnaireManualReviewStatus =
  | 'not_required'
  | 'pending'
  | 'in_review'
  | 'completed';
export type CompanyApplicationQuestionnaireAutomaticResult = 'correct' | 'incorrect' | 'manual';

export interface CompanyApplicationQuestionnaireOption {
  id: string;
  label: string;
  order: number;
}

export interface CompanyApplicationQuestionnaireQuestion {
  id: string;
  prompt: string;
  help?: string;
  type: CompanyQuestionType;
  required: boolean;
  options: CompanyApplicationQuestionnaireOption[];
  points: number;
  order: number;
  maxLength?: number | null;
}

/**
 * Public questionnaire projection for the candidate.
 * It intentionally excludes all correction criteria and company-private fields.
 */
export interface CompanyApplicationQuestionnaireProjection {
  questionnaireVersion: string;
  title: string;
  instructions: string;
  durationMinutes: number | null;
  status: CompanyApplicationQuestionnaireStatus;
  questions: CompanyApplicationQuestionnaireQuestion[];
}

export interface CompanyApplicationQuestionnaireAnswerRecord {
  questionId: string;
  questionType: CompanyQuestionType;
  answerValue: string | string[] | boolean | number | null;
  answeredAt: string | null;
  automaticResult?: CompanyApplicationQuestionnaireAutomaticResult;
  awardedPoints?: number | null;
  manualReviewStatus?: CompanyApplicationQuestionnaireManualReviewStatus;
}

export interface CompanyApplicationQuestionnaireAttemptSummary {
  sessionId: string;
  status: Exclude<CompanyApplicationQuestionnaireSessionStatus, 'not_started'>;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  serverNow: string;
  durationMinutes: number | null;
  totalQuestions: number;
  answerCount: number;
}

export interface CompanyApplicationAssessmentSummary {
  status: CompanyApplicationQuestionnaireSessionStatus;
  automaticScorePercent: number | null;
  autoScoredPoints: number | null;
  autoScoredMaximum: number | null;
  manualReviewRequired: boolean;
  manualReviewStatus: CompanyApplicationQuestionnaireManualReviewStatus;
  finalScore: number | null;
  questionnaireVersion: string;
  completedAt: FirestoreDateValue | null;
  startedAt: FirestoreDateValue | null;
  submittedAt: FirestoreDateValue | null;
  sessionId: string | null;
  resultId: string | null;
  manualQuestionsCount: number;
}

export interface SerializedCompanyApplicationAssessmentSummary extends Omit<
  CompanyApplicationAssessmentSummary,
  'completedAt' | 'startedAt' | 'submittedAt'
> {
  completedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
}

export interface CompanyApplicationQuestionnaireView {
  questionnaire: CompanyApplicationQuestionnaireProjection | null;
  access: {
    available: boolean;
    status: 'available' | 'in_progress' | 'completed' | 'unavailable';
    reasonCode?: string;
    reason?: string;
  };
  assessment: SerializedCompanyApplicationAssessmentSummary | null;
  attempt: CompanyApplicationQuestionnaireAttemptSummary | null;
  applicationStatus: string;
  serverNow: string;
}

export interface CompanyApplicationQuestionnaireReviewProjection {
  questionnaireVersion: string;
  title: string;
  instructions: string;
  durationMinutes: number | null;
  status: CompanyApplicationQuestionnaireStatus;
  questions: CompanyQuestion[];
}

export interface CompanyApplicationQuestionnaireReviewView {
  questionnaire: CompanyApplicationQuestionnaireReviewProjection | null;
  assessment: SerializedCompanyApplicationAssessmentSummary | null;
  attempt: CompanyApplicationQuestionnaireAttemptSummary | null;
  answers: CompanyApplicationQuestionnaireAnswerRecord[];
  applicationStatus: string;
  serverNow: string;
}

export interface CompanyApplicationQuestionnaireSubmissionPayload {
  sessionId: string;
  answers: Record<string, string | string[] | boolean | number | null>;
}
