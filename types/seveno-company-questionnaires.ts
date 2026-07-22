import type { FirestoreDateValue } from '@/types/seveno';

export type CompanyQuestionnaireStatus = 'draft' | 'active' | 'archived';
export type CompanyQuestionnaireCreationMode = 'manual' | 'ai_import';
export type CompanyQuestionnaireScoreClassification = 'qualified' | 'near_threshold' | 'below_threshold';
export type CompanyQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'boolean'
  | 'number'
  | 'short_text'
  | 'long_text';
export type CompanyQuestionCorrectionMode = 'automatic' | 'manual';
export type CompanyQuestionNumberOperator = 'equals' | 'minimum' | 'maximum';
export type CompanyQuestionDifficulty = 'easy' | 'medium' | 'hard';
export type CompanyQuestionExpectedAnswer = string | string[] | boolean | number;

export interface CompanyQuestionOption {
  id: string;
  label: string;
  order: number;
}

export interface CompanyQuestionInput {
  id: string;
  prompt: string;
  help?: string;
  explanation?: string;
  type: CompanyQuestionType;
  required: boolean;
  options: CompanyQuestionOption[];
  correctionMode: CompanyQuestionCorrectionMode;
  expectedAnswer?: CompanyQuestionExpectedAnswer;
  numberOperator?: CompanyQuestionNumberOperator;
  points: number;
  order: number;
  difficulty?: CompanyQuestionDifficulty;
}

export interface CompanyQuestionnaireInput {
  title: string;
  instructions: string;
  creationMode?: CompanyQuestionnaireCreationMode;
  minimumPassingScorePercent?: number;
  /** @deprecated Legacy global duration kept for compatibility. New questionnaires use 15 seconds per question. */
  durationMinutes: number | null;
  questions: CompanyQuestionInput[];
}

export interface CompanyQuestion extends Omit<CompanyQuestionInput, 'expectedAnswer'> {
  expectedAnswer?: CompanyQuestionExpectedAnswer;
}

/** Owner-only editor projection. Choice corrections are never exposed by candidate APIs. */
export interface CompanyQuestionEditorProjection extends Omit<CompanyQuestion, 'expectedAnswer' | 'numberOperator'> {
  hasExpectedAnswer: boolean;
  hasNumberCriterion: boolean;
  correctOptionIds: string[];
}

export interface CompanyQuestionnaire {
  id: string;
  companyUid: string;
  offerId: string;
  offerVersion: number;
  title: string;
  instructions: string;
  creationMode: CompanyQuestionnaireCreationMode;
  status: CompanyQuestionnaireStatus;
  minimumPassingScorePercent: number;
  /** @deprecated Legacy global duration kept for compatibility. New questionnaires use 15 seconds per question. */
  durationMinutes: number | null;
  questions: CompanyQuestion[];
  version: number;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  publishedAt: FirestoreDateValue | null;
}

export interface CompanyQuestionnaireEditorProjection {
  id: string;
  offerId: string;
  offerVersion: number;
  title: string;
  instructions: string;
  creationMode: CompanyQuestionnaireCreationMode;
  status: CompanyQuestionnaireStatus;
  minimumPassingScorePercent: number;
  /** @deprecated Legacy global duration kept for compatibility. New questionnaires use 15 seconds per question. */
  durationMinutes: number | null;
  questions: CompanyQuestionEditorProjection[];
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface CompanyQuestionnaireListItem {
  id: string;
  offerId: string;
  title: string;
  questionCount: number;
  status: CompanyQuestionnaireStatus;
  minimumPassingScorePercent: number;
  version: number;
  updatedAt: string;
  publishedAt: string | null;
}
