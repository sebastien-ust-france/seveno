import type {
  AdminLog,
  AssessmentType,
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidatePrivateData,
  CandidateProfileStatus,
  CompanyProfileStatus,
  CompanySize,
  CompanyVerificationStatus,
  MatchRequestStatus,
  SevenoUser,
  TestSessionStatus,
} from '@/types/seveno';
import type { PrerequisiteImportance } from '@/types/seveno-prerequisites';
import type { PrerequisiteSuggestionStatus } from '@/types/seveno-prerequisite-suggestions';

export interface AdminUserSummary {
  uid: string;
  role: SevenoUser['role'];
  authProvider: SevenoUser['authProvider'];
  email: string;
  displayName?: string;
  photoURL?: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCandidateSummary {
  uid: string;
  publicCandidateId: string;
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  availability: CandidateAvailability;
  experienceLevel: CandidateExperienceLevel;
  locationArea: string;
  verifiedScore: number | null;
  testPassed: boolean;
  lastTestAt: string | null;
  profileStatus: CandidateProfileStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCandidateDetailPayload {
  candidate: AdminCandidateSummary | null;
  privateIdentity: CandidatePrivateData | null;
  user: AdminUserSummary | null;
  latestTestResult: AdminTestResultSummary | null;
  recentMatchRequests: AdminMatchRequestSummary[];
}

export interface AdminCompanySummary {
  uid: string;
  companyName: string;
  legalName?: string;
  companyType: string;
  businessSector: string;
  companySize: CompanySize;
  headquartersArea: string;
  recruitmentAreas: string[];
  contactRole: string;
  profileStatus: CompanyProfileStatus;
  verificationStatus: CompanyVerificationStatus;
  siret?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTestSessionSummary {
  id: string;
  uid: string;
  assessmentType?: AssessmentType;
  publicCandidateId?: string;
  candidateProfileId?: string;
  sectorId?: string;
  jobFamilyId?: string;
  jobRoleId?: string;
  questionBankCode: string;
  status: TestSessionStatus;
  questionIds: string[];
  answersCount: number;
  durationSeconds: number;
  threshold: number;
  score: number | null;
  correctAnswers: number | null;
  totalQuestions: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTestResultSummary {
  id: string;
  uid: string;
  assessmentType?: AssessmentType;
  publicCandidateId?: string;
  sessionId: string;
  candidateProfileId?: string;
  sectorId?: string;
  jobFamilyId?: string;
  jobRoleId?: string;
  questionBankCode: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  threshold: number;
  durationSeconds: number;
  answersCount: number | null;
  submittedAt: string | null;
  verifiedAt: string;
  createdAt: string;
}

export interface AdminMatchRequestSummary {
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
  contractType?: string;
  status: MatchRequestStatus;
  candidateDecisionAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLogSummary {
  id: string;
  actorUserId?: string;
  actorRole?: AdminLog['actorRole'];
  action: string;
  targetCollection?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminOverviewPayload {
  counts: Record<string, number>;
  latestCandidates: AdminCandidateSummary[];
  latestCompanies: AdminCompanySummary[];
  latestTests: AdminTestSessionSummary[];
  latestMatchRequests: AdminMatchRequestSummary[];
  latestLogs: AdminLogSummary[];
}

export interface AdminStudyResponseSummary {
  id: string;
  respondentType?: string;
  wantsLaunchNotification?: boolean;
  wantsBetaAccess?: boolean;
  wantsProjectUpdates?: boolean;
  email?: string;
  phone?: string;
  acquisitionChannel?: string;
  acquisitionChannelLabel?: string;
  logoFeedback?: string;
  createdAt: string | null;
}

export interface AdminStudyDashboardPayload {
  totals: {
    studyResponses: number;
  };
  responses: AdminStudyResponseSummary[];
}

export type AdminPrerequisiteSuggestionSort = 'recent' | 'usageCount' | 'companyCount';

export interface AdminPrerequisiteSuggestionContextSummary {
  id: string;
  label: string;
}

export interface AdminPrerequisiteSuggestionSummary {
  suggestionId: string;
  label: string;
  normalizedLabel: string;
  status: PrerequisiteSuggestionStatus;
  statusLabel: string;
  usageCount: number;
  companyCount: number;
  requiredCount: number;
  preferredCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  canonicalPrerequisiteCode?: string | null;
  canonicalPrerequisiteLabel?: string | null;
  schemaVersion: number;
  observedSectors: AdminPrerequisiteSuggestionContextSummary[];
  observedFamilies: AdminPrerequisiteSuggestionContextSummary[];
  observedRoles: AdminPrerequisiteSuggestionContextSummary[];
}

export interface AdminPrerequisiteSuggestionUsageSummary {
  id: string;
  sectorId: string;
  sectorLabel: string;
  jobFamilyId: string;
  jobFamilyLabel: string;
  jobRoleId: string;
  jobRoleLabel: string;
  importance: PrerequisiteImportance;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
}

export interface AdminPrerequisiteSuggestionListPayload {
  items: AdminPrerequisiteSuggestionSummary[];
  nextCursor: string | null;
}

export interface AdminPrerequisiteSuggestionDetailPayload {
  suggestion: AdminPrerequisiteSuggestionSummary | null;
  canonicalPrerequisiteLabel: string | null;
  usages: AdminPrerequisiteSuggestionUsageSummary[];
  usageLimit: number;
  hasMoreUsages: boolean;
}
