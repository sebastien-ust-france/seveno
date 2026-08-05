import type { FirestoreDateValue, SevenoAssessmentScores, SevenoAssessmentStatus } from '@/types/seveno';
import type {
  CompanyApplicationAssessmentSummary,
  SerializedCompanyApplicationAssessmentSummary,
} from '@/types/seveno-application-questionnaires';
import type { CompanyQuestionnaireScoreClassification } from '@/types/seveno-company-questionnaires';
import type {
  JobOfferContractType,
  JobOfferWorkingTime,
  JobOfferWorkMode,
} from '@/types/seveno-job-offers';
import type {
  OfferPrerequisiteSnapshot,
  PrerequisiteAnswerType,
  PrerequisiteCriterionValue,
  PrerequisiteImportance,
} from '@/types/seveno-prerequisites';

export type JobApplicationStatus =
  | 'draft'
  | 'invited'
  | 'prerequisites_in_progress'
  | 'eligible'
  | 'ineligible'
  | 'submitted'
  | 'viewed'
  | 'questionnaire_pending'
  | 'questionnaire_completed'
  | 'shortlisted'
  | 'rejected'
  | 'contact_requested'
  | 'conversation_open'
  | 'candidate_declined'
  | 'company_declined'
  | 'candidate_withdrawn'
  | 'offer_unavailable'
  | 'withdrawn'
  | 'closed';
export type ImplementedJobApplicationStatus = JobApplicationStatus;
export type JobApplicationOrigin = 'candidate' | 'company';
export type JobApplicationConversationStatus = 'open' | 'closed';
export type JobApplicationConversationAuthorRole = 'candidate' | 'company';
export type JobApplicationContactSharing = {
  shared: boolean;
  sharedAt: FirestoreDateValue | null;
  sharedByUid: string | null;
};
export type SerializedJobApplicationContactSharing = Omit<JobApplicationContactSharing, 'sharedAt'> & {
  sharedAt: string | null;
};
export type JobApplicationContactSharingView = {
  candidate: SerializedJobApplicationContactSharing & {
    contact: { displayName?: string; email?: string; phone?: string } | null;
  };
  company: SerializedJobApplicationContactSharing & {
    contact: { companyName?: string; contactName?: string; email?: string; phone?: string } | null;
  };
};
export type PrerequisiteAnswerResult = 'satisfied' | 'unsatisfied' | 'unanswered';
export type PrerequisiteAnswerSource = 'application' | 'reusable_profile';
export type PrerequisiteAnswerValue = PrerequisiteCriterionValue | null;

export interface RequiredPrerequisiteResult {
  total: number;
  satisfied: number;
  unsatisfied: number;
  unanswered: number;
  allSatisfied: boolean;
}

export interface PreferredPrerequisiteResult {
  total: number;
  satisfied: number;
  unsatisfied: number;
  unanswered: number;
  compatibilityRate: number;
}

export interface ApplicationSevenoAssessmentSnapshot {
  status: SevenoAssessmentStatus;
  overallScore: number | null;
  dimensions: SevenoAssessmentScores;
  version: string | null;
  completedAt: FirestoreDateValue | null;
}

export interface SerializedApplicationSevenoAssessmentSnapshot extends Omit<ApplicationSevenoAssessmentSnapshot, 'completedAt'> {
  completedAt: string | null;
}

export interface CandidateOfferProjection {
  offerId: string;
  offerVersion: number;
  companyPublicId: string;
  companyName: string;
  title: string;
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  jobRoleLabel: string;
  location: string;
  workMode: JobOfferWorkMode | '';
  contractType: JobOfferContractType | '';
  workingTime: JobOfferWorkingTime | '';
  description: string;
  missions: string;
  profileSummary: string;
  questionnaireRequired: boolean;
  questionnaireId: string | null;
  questionnaireVersion: number | null;
  requiredPrerequisites: OfferPrerequisiteSnapshot[];
  preferredPrerequisites: OfferPrerequisiteSnapshot[];
  publishedAt: string;
}

export interface CandidateOfferListItem extends Omit<CandidateOfferProjection,
  'description' | 'missions' | 'profileSummary' | 'requiredPrerequisites' | 'preferredPrerequisites'
> {
  requiredPrerequisitesCount: number;
  preferredPrerequisitesCount: number;
  applicationId: string | null;
  applicationStatus: ImplementedJobApplicationStatus | null;
}

export interface CandidateOfferListPage {
  offers: CandidateOfferListItem[];
  nextCursor: string | null;
}

export interface CompanyApplicationPrioritySelectionItem {
  application: SerializedCandidateJobApplication;
  scorePercent: number;
  classification: CompanyQuestionnaireScoreClassification;
}

export interface CompanyApplicationPrioritySelection {
  applications: CompanyApplicationPrioritySelectionItem[];
  qualifiedCount: number;
  nearThresholdCount: number;
  eligibleCount: number;
}

export interface PrerequisiteAnswerInput {
  prerequisiteCode: string;
  answerValue: PrerequisiteAnswerValue;
  confirmed: boolean;
}

export interface JobApplicationPrerequisiteAnswer {
  prerequisiteId: string;
  prerequisiteCode: string;
  prerequisiteVersion: number;
  importance: PrerequisiteImportance;
  answerType: PrerequisiteAnswerType;
  answerValue: PrerequisiteAnswerValue;
  answeredAt: FirestoreDateValue | null;
  source: PrerequisiteAnswerSource;
  confirmed: boolean;
  result: PrerequisiteAnswerResult;
}

export interface SerializedJobApplicationPrerequisiteAnswer extends Omit<JobApplicationPrerequisiteAnswer, 'answeredAt'> {
  answeredAt: string | null;
}

export interface CandidateReusablePrerequisiteAnswer {
  candidateUid: string;
  prerequisiteId: string;
  prerequisiteCode: string;
  prerequisiteVersion: number;
  answerType: PrerequisiteAnswerType;
  answerValue: Exclude<PrerequisiteAnswerValue, null>;
  answeredAt: FirestoreDateValue;
  freshnessExpiresAt: FirestoreDateValue | null;
  updatedAt: FirestoreDateValue;
}

export interface JobApplication {
  id: string;
  candidateUid: string;
  publicCandidateId: string;
  companyUid: string;
  companyPublicId: string;
  companyNameSnapshot: string;
  offerId: string;
  offerVersion: number;
  jobRoleId: string;
  origin: JobApplicationOrigin;
  offerSnapshot: CandidateOfferProjection;
  status: ImplementedJobApplicationStatus;
  requiredResult: RequiredPrerequisiteResult;
  preferredResult: PreferredPrerequisiteResult;
  sevenoAssessmentSnapshot: ApplicationSevenoAssessmentSnapshot;
  companyAssessment?: CompanyApplicationAssessmentSummary | null;
  invitedAt: FirestoreDateValue | null;
  candidateDecisionAt: FirestoreDateValue | null;
  companyDecisionAt: FirestoreDateValue | null;
  conversationId: string | null;
  conversationStatus: JobApplicationConversationStatus | null;
  conversationUnreadCandidateCount: number;
  conversationUnreadCompanyCount: number;
  conversationLastMessageAt: FirestoreDateValue | null;
  conversationLastMessagePreview: string | null;
  conversationLastMessageAuthorRole: JobApplicationConversationAuthorRole | null;
  candidateContactSharing: JobApplicationContactSharing;
  companyContactSharing: JobApplicationContactSharing;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  submittedAt: FirestoreDateValue | null;
  withdrawnAt: FirestoreDateValue | null;
}

export interface SerializedCandidateJobApplication extends Omit<
  JobApplication,
  | 'candidateUid'
  | 'companyUid'
  | 'sevenoAssessmentSnapshot'
  | 'companyAssessment'
  | 'createdAt'
  | 'updatedAt'
  | 'submittedAt'
  | 'withdrawnAt'
  | 'invitedAt'
  | 'candidateDecisionAt'
  | 'companyDecisionAt'
  | 'conversationLastMessageAt'
  | 'candidateContactSharing'
  | 'companyContactSharing'
> {
  sevenoAssessmentSnapshot: SerializedApplicationSevenoAssessmentSnapshot;
  companyAssessment?: SerializedCompanyApplicationAssessmentSummary | null;
  invitedAt: string | null;
  candidateDecisionAt: string | null;
  companyDecisionAt: string | null;
  conversationLastMessageAt: string | null;
  candidateContactSharing: SerializedJobApplicationContactSharing;
  companyContactSharing: SerializedJobApplicationContactSharing;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  withdrawnAt: string | null;
  answers?: SerializedJobApplicationPrerequisiteAnswer[];
}

/** Future company projection. Firebase UIDs and candidate identity are intentionally absent. */
export interface AnonymousCompanyJobApplicationProjection {
  applicationId: string;
  publicCandidateId: string;
  offerId: string;
  offerVersion: number;
  jobRoleId: string;
  origin: JobApplicationOrigin;
  status: JobApplicationStatus;
  requiredResult: RequiredPrerequisiteResult;
  preferredResult: PreferredPrerequisiteResult;
  sevenoAssessmentSnapshot: ApplicationSevenoAssessmentSnapshot;
  answers: SerializedJobApplicationPrerequisiteAnswer[];
  submittedAt: string | null;
}

export interface JobApplicationConversationMessage {
  id: string;
  applicationId: string;
  senderUid: string;
  senderRole: JobApplicationConversationAuthorRole;
  body: string;
  createdAt: FirestoreDateValue;
}

export interface SerializedJobApplicationConversationMessage extends Omit<
  JobApplicationConversationMessage,
  'createdAt'
> {
  createdAt: string;
}
