import type { FieldValue, Timestamp } from 'firebase/firestore';

export type FirestoreDateValue = Timestamp | FieldValue;

export type UserRole = 'candidate' | 'company' | 'admin';
export type UserRoleOrNull = UserRole | null;
export type PublicUserRole = Exclude<UserRole, 'admin'>;
export type AuthProvider = 'google' | 'password';
export type CandidateIdentityRequiredField = 'firstName' | 'lastName' | 'email' | 'phone';
export type CandidateProfileStatus = 'draft' | 'active' | 'paused';
export type CandidateSkillVerificationStatus = 'not_tested' | 'verified' | 'failed';
export type CandidateVerificationFilter = 'all' | 'verified';
export type AssessmentType = 'seveno_general' | 'company_application' | 'legacy_job';
export type SevenoAssessmentStatus = 'not_started' | 'in_progress' | 'completed';
export type SevenoAssessmentFilter = 'all' | 'completed';
export type SevenoAssessmentDimension = 'collaboration' | 'adaptability' | 'autonomy' | 'problem_solving';
export type SevenoAssessmentScores = Partial<Record<SevenoAssessmentDimension, number>>;

export interface SevenoAssessmentSummary {
  candidateUid: string;
  assessmentType: 'seveno_general';
  status: 'completed';
  overallScore: number;
  scoresByDimension: SevenoAssessmentScores;
  questionnaireVersion: string;
  sessionId: string;
  resultId: string;
  completedAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}
export type CompanyProfileStatus = 'draft' | 'active' | 'suspended';
export type CompanyVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type CompanySize = 'solo' | '1_9' | '10_49' | '50_249' | '250_plus';
export type CandidateExperienceLevel = 'beginner' | 'intermediate' | 'confirmed' | 'senior' | 'expert';
export type CandidateAvailability =
  | 'immediate'
  | 'less_than_1_month'
  | 'one_to_three_months'
  | 'listening'
  | 'not_available';

export interface SevenoUser {
  uid: string;
  role: UserRoleOrNull;
  authProvider: AuthProvider;
  email: string;
  emailVerified?: boolean;
  displayName?: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  onboardingCompleted: boolean;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

/**
 * Private-only candidate data.
 * Never store this object in `candidate_profiles` and never expose it to companies.
 * Keep it in `users/{uid}` or another private-only storage path.
 */
export interface CandidatePrivateData {
  uid: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerified?: boolean;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  photoURL?: string;
  cvUrl?: string;
  linkedinUrl?: string;
}

export interface CandidatePrivateIdentityInput {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  country: string;
}

export interface CandidateTargetJob {
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  label: string;
}

/**
 * Anonymized candidate profile stored in `candidate_profiles`.
 * This projection is safe to expose to companies because it contains no private identity fields.
 */
export interface CandidateProfile {
  uid: string;
  publicCandidateId: string;
  role: 'candidate';
  targetJobRoleIds: string[];
  targetJobs: CandidateTargetJob[];
  /** @deprecated Temporary mirror of the first target job during migration. */
  sectorId: string;
  /** @deprecated Temporary mirror of the first target job during migration. */
  jobFamilyId: string;
  /** @deprecated Temporary mirror of the first target job during migration. */
  jobRoleId: string;
  availability: CandidateAvailability;
  availabilityAvailableFromAt?: FirestoreDateValue | null;
  availabilityConfirmedAt?: FirestoreDateValue | null;
  availabilityValidUntil?: FirestoreDateValue | null;
  locationArea: string;
  experienceLevel: CandidateExperienceLevel;
  verifiedScore: number | null;
  testPassed: boolean;
  lastTestAt: FirestoreDateValue | null;
  verifiedTestResultId?: string | null;
  verifiedTestSessionId?: string | null;
  verifiedJobRoleId?: string | null;
  verifiedQuestionBankCode?: string | null;
  verifiedQuestionBankVersion?: string | null;
  sevenoAssessmentStatus: SevenoAssessmentStatus;
  sevenoAssessmentOverallScore: number | null;
  sevenoAssessmentDimensions: SevenoAssessmentScores;
  sevenoAssessmentVersion: string | null;
  sevenoAssessmentCompletedAt: FirestoreDateValue | null;
  sevenoAssessmentSessionId?: string | null;
  sevenoAssessmentResultId?: string | null;
  profileStatus: CandidateProfileStatus;
  dailyAvailabilityConfirmationEnabled?: boolean;
  nextAvailabilityReminderAt?: FirestoreDateValue | null;
  lastAvailabilityNotificationAt?: FirestoreDateValue | null;
  availabilityTimezone?: string | null;
  availabilityPushPermission?: 'default' | 'granted' | 'denied' | null;
  hasActiveAvailabilityPushSubscription?: boolean;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

/**
 * Public anonymous projection of a candidate profile.
 * This shape intentionally excludes the Firebase `uid` and any private identity data.
 */
export interface VisibleCandidateProfile {
  publicCandidateId: string;
  targetJobs: CandidateTargetJob[];
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  availability: CandidateAvailability;
  availabilityAvailableFromAt?: FirestoreDateValue | null;
  availabilityConfirmedAt?: FirestoreDateValue | null;
  availabilityValidUntil?: FirestoreDateValue | null;
  locationArea: string;
  experienceLevel: CandidateExperienceLevel;
  sevenoAssessmentStatus: SevenoAssessmentStatus;
  sevenoAssessmentOverallScore: number | null;
  sevenoAssessmentDimensions: SevenoAssessmentScores;
  sevenoAssessmentVersion: string | null;
  sevenoAssessmentCompletedAt: FirestoreDateValue | null;
  profileStatus: 'active';
}

export interface CandidateSearchFilters {
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  locationArea?: string;
  availability?: CandidateAvailability;
  experienceLevel?: CandidateExperienceLevel;
  minSevenoAssessmentScore?: number;
  assessment?: SevenoAssessmentFilter;
}

export interface CandidateSearchPage {
  candidates: VisibleCandidateProfile[];
  nextCursor: string | null;
}

export interface CandidateProfileUpsertData {
  targetJobRoleIds: string[];
  availability: CandidateAvailability;
  availabilityAvailableFromAt?: string | null;
  locationArea: string;
  experienceLevel: CandidateExperienceLevel;
  profileStatus: CandidateProfileStatus;
  anonymousVisibilityConsent: boolean;
}

export type CandidateAvailabilityConfirmationAction = 'yes' | 'no';
export type AvailabilityNotificationSource =
  | 'push_action'
  | 'notification_page'
  | 'dashboard'
  | 'profile'
  | 'scheduler';
export type AvailabilityConfirmationStatus = 'pending' | 'confirmed' | 'unavailable' | 'expired';

export interface CandidatePushSubscriptionDevice {
  uid: string;
  deviceId: string;
  token: string;
  permission: 'default' | 'granted' | 'denied';
  enabled: boolean;
  platform?: string;
  userAgent?: string;
  timezone?: string;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  lastSeenAt?: FirestoreDateValue | null;
  lastNotificationAt?: FirestoreDateValue | null;
  revokedAt?: FirestoreDateValue | null;
}

export interface AvailabilityConfirmationRequest {
  id: string;
  candidateUid: string;
  publicCandidateId: string;
  periodKey: string;
  status: AvailabilityConfirmationStatus;
  tokenHash?: string | null;
  expiresAt: FirestoreDateValue | null;
  notificationSentAt: FirestoreDateValue | null;
  answeredAt: FirestoreDateValue | null;
  answer: CandidateAvailabilityConfirmationAction | null;
  source: AvailabilityNotificationSource | null;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  schemaVersion: number;
}

export interface AvailabilityConfirmationEvent {
  candidateUid: string;
  requestId?: string | null;
  action: 'notification_sent' | 'notification_failed' | 'confirmed' | 'unavailable' | 'expired';
  source: AvailabilityNotificationSource;
  createdAt: FirestoreDateValue;
  schemaVersion: number;
}

export interface CompanyProfile {
  uid: string;
  companyName: string;
  legalName?: string;
  companyType: string;
  siret?: string;
  website?: string;
  businessSector: string;
  companySize: CompanySize;
  headquartersArea: string;
  recruitmentAreas: string[];
  contactRole: string;
  profileStatus: CompanyProfileStatus;
  verificationStatus: CompanyVerificationStatus;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface CompanyProfileUpsertData {
  companyName: string;
  legalName?: string;
  companyType: string;
  siret?: string;
  website?: string;
  businessSector: string;
  companySize: CompanySize;
  headquartersArea: string;
  recruitmentAreas: string[];
  contactRole: string;
}

export interface JobSector {
  code: string;
  label: string;
  description?: string;
  order?: number;
  isActive?: boolean;
  families: JobFamily[];
  createdAt?: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
}

export interface JobFamily {
  code: string;
  sectorCode?: string;
  label: string;
  description?: string;
  order?: number;
  isActive?: boolean;
  roles: JobRole[];
  createdAt?: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
}

export interface JobRole {
  code: string;
  sectorCode?: string;
  familyCode?: string;
  label: string;
  aliases?: string[];
  description?: string;
  order?: number;
  isActive?: boolean;
  createdAt?: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
}

export interface JobTaxonomy {
  version: string;
  sectors: JobSector[];
}

export type TestQuestionType = 'single_choice' | 'multi_choice' | 'boolean' | 'text' | 'numeric';
export type TestQuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface TestQuestionOption {
  id: string;
  label: string;
  order?: number;
  /** Server-only value used to score a Seven'O general assessment. */
  score?: number;
}

export interface PublicTestQuestion {
  id: string;
  question: string;
  options: TestQuestionOption[];
  type?: TestQuestionType;
  difficulty?: TestQuestionDifficulty;
  skillTags?: string[];
  dimension?: SevenoAssessmentDimension;
}

export interface TestQuestion extends PublicTestQuestion {
  correctOptionId?: string;
  explanation?: string;
}

export interface QuestionBank {
  code: string;
  label: string;
  description?: string;
  assessmentType?: AssessmentType;
  sectorCode?: string;
  familyCode?: string;
  roleCode?: string;
  version: string;
  isActive: boolean;
  durationSeconds?: number;
  threshold?: number;
  questions: TestQuestion[];
  createdAt: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
}

export type TestSessionStatus = 'in_progress' | 'submitted' | 'expired' | 'abandoned' | 'cancelled';

export type TestAnswerValue = string | string[] | number | boolean | null;

export interface TestSession {
  uid: string;
  candidateUid?: string;
  publicCandidateId?: string;
  candidateProfileId?: string;
  assessmentType?: AssessmentType;
  questionnaireVersion?: string;
  applicationId?: string;
  offerId?: string;
  companyUid?: string;
  questionnaireId?: string;
  sectorId?: string;
  jobFamilyId?: string;
  jobRoleId?: string;
  questionBankCode: string;
  questionBankVersion?: string;
  status: TestSessionStatus;
  questionIds: string[];
  answersCount: number;
  durationSeconds: number;
  threshold: number;
  score?: number;
  correctAnswers?: number;
  totalQuestions?: number;
  passed?: boolean;
  startedAt: FirestoreDateValue;
  submittedAt?: FirestoreDateValue | null;
  expiresAt: FirestoreDateValue;
  expiredAt?: FirestoreDateValue | null;
  cancelledAt?: FirestoreDateValue | null;
  abandonedAt?: FirestoreDateValue | null;
  lastQuestionId?: string | null;
  answers?: Record<string, TestAnswerValue>;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface TestResult {
  uid: string;
  candidateUid?: string;
  publicCandidateId?: string;
  sessionId: string;
  candidateProfileId?: string;
  assessmentType?: AssessmentType;
  questionnaireVersion?: string;
  applicationId?: string;
  offerId?: string;
  companyUid?: string;
  questionnaireId?: string;
  status?: 'completed';
  sectorId?: string;
  jobFamilyId?: string;
  jobRoleId?: string;
  questionBankCode: string;
  questionBankVersion?: string;
  score: number;
  overallScore?: number;
  scoresByDimension?: SevenoAssessmentScores;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  threshold: number;
  durationSeconds: number;
  answersCount?: number;
  submittedAt?: FirestoreDateValue | null;
  questionIds?: string[];
  /** Private detailed answers. Never expose through candidate profile APIs. */
  answers?: Record<string, TestAnswerValue>;
  createdAt: FirestoreDateValue;
  verifiedAt: FirestoreDateValue;
}

export interface SevenoGeneralAssessmentContext {
  assessmentType: 'seveno_general';
  candidateUid: string;
  questionnaireId: string;
  questionnaireVersion: string;
}

/**
 * Required ownership context for a future company questionnaire.
 * Its result must never update the `sevenoAssessment*` fields on a candidate profile.
 */
export interface CompanyApplicationAssessmentContext {
  assessmentType: 'company_application';
  applicationId: string;
  offerId: string;
  companyUid: string;
  candidateUid: string;
  questionnaireId: string;
  questionnaireVersion: string;
}

export type SevenoGeneralAssessmentSession = TestSession & SevenoGeneralAssessmentContext;
export type SevenoGeneralAssessmentResult = TestResult & SevenoGeneralAssessmentContext;
export type CompanyApplicationAssessmentSession = TestSession & CompanyApplicationAssessmentContext;
export type CompanyApplicationAssessmentResult = TestResult & CompanyApplicationAssessmentContext;

export interface TestSessionStartResult {
  sessionId: string;
  questionBankCode: string;
  durationSeconds: number;
  threshold: number;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  questions: PublicTestQuestion[];
  totalQuestions: number;
}

export interface SevenoAssessmentPreparation {
  questionBankCode: string;
  questionnaireVersion: string;
  durationSeconds: number;
  totalQuestions: number;
}

export interface TestSessionSubmitResult {
  sessionId: string;
  score: number;
  overallScore?: number;
  scoresByDimension?: SevenoAssessmentScores;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  threshold: number;
  durationSeconds: number;
  verifiedAt: string;
}

export type MatchRequestStatus = 'pending_candidate' | 'accepted' | 'refused' | 'cancelled' | 'expired';
export type MatchRequestContractType =
  | 'permanent'
  | 'fixed_term'
  | 'temporary'
  | 'freelance'
  | 'apprenticeship'
  | 'internship'
  | 'other';

/**
 * Internal match request stored in `match_requests`.
 * It contains participant UIDs and must only be handled by trusted server code or admins.
 * Candidate contact details must never be stored in this document.
 */
export interface MatchRequest {
  id: string;
  companyUid: string;
  candidateUid: string;
  companyNameSnapshot: string;
  publicCandidateId: string;
  jobRoleId: string;
  sectorId: string;
  jobFamilyId: string;
  message?: string;
  proposedJobTitle?: string;
  proposedLocation?: string;
  contractType?: MatchRequestContractType;
  status: MatchRequestStatus;
  candidateDecisionAt: FirestoreDateValue | null;
  acceptedAt: FirestoreDateValue | null;
  refusedAt: FirestoreDateValue | null;
  cancelledAt: FirestoreDateValue | null;
  expiresAt: FirestoreDateValue | null;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface SerializedMatchRequest {
  id: string;
  companyNameSnapshot: string;
  publicCandidateId: string;
  jobRoleId: string;
  sectorId: string;
  jobFamilyId: string;
  message?: string;
  proposedJobTitle?: string;
  proposedLocation?: string;
  contractType?: MatchRequestContractType;
  status: MatchRequestStatus;
  candidateDecisionAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedCandidateMatchRequest extends SerializedMatchRequest {
  companyBusinessSector: string;
}

export interface MatchRequestContactInfo {
  displayName: string;
  email: string;
  phone?: string | null;
}

export interface AdminLog {
  actorUserId?: string;
  actorRole?: UserRole;
  action: string;
  targetCollection?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: FirestoreDateValue;
}
