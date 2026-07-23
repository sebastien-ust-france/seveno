import type {
  AssessmentCandidateProjection,
  AssessmentCompanyProjection,
  AssessmentPath,
  AssessmentProfileVersionStatus,
  AssessmentValidationIssue,
  AssessmentValidationResult,
  AssessmentVersionDescriptor,
  SevenoProfessionalAssessmentReport,
} from '@/types/seveno-assessment';
import type { SevenoAssessmentReviewManifest } from '@/types/seveno-assessment-review';

export type SevenoAssessmentStoredDate = string | null;
export type SevenoAssessmentPreviewMode = AssessmentPath | 'complementary';

export interface SevenoAssessmentStoredVersion
  extends Omit<AssessmentVersionDescriptor, 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt' | 'activatedAt'> {
  createdAt: SevenoAssessmentStoredDate;
  updatedAt: SevenoAssessmentStoredDate;
  publishedAt: SevenoAssessmentStoredDate;
  archivedAt: SevenoAssessmentStoredDate;
  activatedAt?: SevenoAssessmentStoredDate;
  revisionNumber: number;
  schemaVersion: number;
  sourceVersionId?: string | null;
  hasStartedSessions?: boolean;
}

export interface SevenoAssessmentVersionSummary {
  id: string;
  code: string;
  version: string;
  status: AssessmentProfileVersionStatus;
  name: string;
  questionCount: number;
  essentialQuestionCount: number;
  extendedQuestionCount: number;
  updatedAt: SevenoAssessmentStoredDate;
  publishedAt: SevenoAssessmentStoredDate;
  archivedAt: SevenoAssessmentStoredDate;
  activatedAt?: SevenoAssessmentStoredDate;
  generatedPromptVersion?: string;
  essentialPoolSize?: number;
  extendedPoolSize?: number;
  essentialDrawSize?: number;
  extendedDrawSize?: number;
  sourceVersionId?: string | null;
  hasStartedSessions: boolean;
  validationStatus: 'ready' | 'needs_attention';
  errorCount: number;
  warningCount: number;
}

export interface SevenoAssessmentPreviewPayload {
  mode: SevenoAssessmentPreviewMode;
  questionCount: number;
  report: SevenoProfessionalAssessmentReport;
  candidateProjection: AssessmentCandidateProjection;
  companyProjection: AssessmentCompanyProjection;
}

export interface SevenoAssessmentCandidatePreviewPayload {
  versionId: string;
  versionCode: string;
  versionName: string;
  drawSeed: string;
  questionCount: number;
  essentialQuestionCount: number;
  extendedQuestionCount: number;
  essentialQuestionIds: string[];
  extendedQuestionIds: string[];
}

export interface SevenoAssessmentCandidatePreviewResponse {
  preview: SevenoAssessmentCandidatePreviewPayload;
}

export interface SevenoAssessmentEditorPayload {
  versions: SevenoAssessmentVersionSummary[];
  selectedVersion: SevenoAssessmentStoredVersion | null;
  validation: AssessmentValidationResult | null;
  prompt: string | null;
  preview: SevenoAssessmentPreviewPayload | null;
  reviewManifest: SevenoAssessmentReviewManifest | null;
}

export interface SevenoAssessmentDraftMutationInput {
  versionId: string;
  version: SevenoAssessmentStoredVersion;
}

export interface SevenoAssessmentImportMutationInput {
  jsonText: string;
}

export interface SevenoAssessmentPreviewRequest {
  versionId: string;
  mode: SevenoAssessmentPreviewMode;
}

export interface SevenoAssessmentPromptRequest {
  versionId: string;
}

export interface SevenoAssessmentValidateRequest {
  versionId: string;
  version: SevenoAssessmentStoredVersion;
}

export interface SevenoAssessmentActionResponse {
  payload: SevenoAssessmentEditorPayload;
  message?: string;
  issues?: AssessmentValidationIssue[];
}
