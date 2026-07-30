import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import type {
  AdminLog,
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidatePrivateData,
  CandidateProfile,
  CandidateProfileStatus,
  CompanyProfile,
  CompanyProfileStatus,
  CompanyVerificationStatus,
  MatchRequest,
  MatchRequestStatus,
  ProfessionalAssessmentBehavioralProfile,
  SevenoAssessmentScores,
  SevenoUser,
  TestResult,
  TestSession,
} from '@/types/seveno';

const USERS_COLLECTION = 'users';
const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
const COMPANY_PROFILES_COLLECTION = 'company_profiles';
const TEST_SESSIONS_COLLECTION = 'test_sessions';
const TEST_RESULTS_COLLECTION = 'test_results';
const MATCH_REQUESTS_COLLECTION = 'match_requests';
const ADMIN_LOGS_COLLECTION = 'admin_logs';
const STUDY_RESPONSES_COLLECTION = 'study_responses';

type FirestoreRecord = Record<string, unknown>;

type StoredCandidateProfile = Omit<CandidateProfile, 'lastTestAt' | 'sevenoAssessmentCompletedAt' | 'createdAt' | 'updatedAt'> & {
  lastTestAt: Timestamp | null;
  sevenoAssessmentCompletedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type StoredCompanyProfile = Omit<CompanyProfile, 'createdAt' | 'updatedAt'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type StoredTestSession = Omit<
  TestSession,
  | 'score'
  | 'correctAnswers'
  | 'totalQuestions'
  | 'passed'
  | 'startedAt'
  | 'submittedAt'
  | 'expiresAt'
  | 'cancelledAt'
  | 'lastQuestionId'
  | 'createdAt'
  | 'updatedAt'
> & {
  score: number | undefined;
  correctAnswers: number | undefined;
  totalQuestions: number | undefined;
  passed: boolean | undefined;
  startedAt: Timestamp;
  submittedAt: Timestamp | null;
  expiresAt: Timestamp;
  cancelledAt: Timestamp | null;
  lastQuestionId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type StoredTestResult = Omit<TestResult, 'answersCount' | 'submittedAt' | 'questionIds' | 'createdAt' | 'verifiedAt'> & {
  answersCount: number | undefined;
  submittedAt: Timestamp | null;
  questionIds: string[] | undefined;
  createdAt: Timestamp;
  verifiedAt: Timestamp;
};

type StoredMatchRequest = Omit<
  MatchRequest,
  'candidateDecisionAt' | 'acceptedAt' | 'refusedAt' | 'cancelledAt' | 'expiresAt' | 'createdAt' | 'updatedAt'
> & {
  candidateDecisionAt: Timestamp | null;
  acceptedAt: Timestamp | null;
  refusedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type StoredAdminLog = Omit<AdminLog, 'createdAt'> & {
  createdAt: Timestamp;
};

export class SevenoAdminServiceError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface AdminCountItem {
  label: string;
  value: number;
}

export type AdminSevenoAssessmentStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'abandoned'
  | 'unknown';

export interface AdminSevenoAssessmentSummary {
  status: AdminSevenoAssessmentStatus;
  overallScore: number | null;
  scoresByDimension: SevenoAssessmentScores;
  completedAt: string | null;
  sessionId: string | null;
  resultId: string | null;
  questionnaireVersion: string | null;
  professionalAssessmentVersionId: string | null;
  professionalAssessmentSchemaVersion: number | null;
  candidateSummaryItems: string[];
  candidateSummary: string | null;
  behavioralProfile: ProfessionalAssessmentBehavioralProfile | null;
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
  sevenoAssessment: AdminSevenoAssessmentSummary;
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

export interface AdminCompanySummary {
  uid: string;
  companyName: string;
  legalName?: string;
  companyType: string;
  businessSector: string;
  companySize: CompanyProfile['companySize'];
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
  assessmentType?: TestSession['assessmentType'];
  publicCandidateId?: string;
  candidateProfileId?: string;
  sectorId?: string;
  jobFamilyId?: string;
  jobRoleId?: string;
  professionalAssessmentVersionId?: string | null;
  questionBankCode: string;
  status: TestSession['status'];
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
  assessmentType?: TestResult['assessmentType'];
  publicCandidateId?: string;
  sessionId: string;
  candidateProfileId?: string;
  sectorId?: string;
  jobFamilyId?: string;
  jobRoleId?: string;
  professionalAssessmentVersionId?: string | null;
  professionalAssessmentSchemaVersion?: number | null;
  questionBankCode: string;
  score: number;
  overallScore?: number | null;
  scoresByDimension?: SevenoAssessmentScores;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  threshold: number;
  durationSeconds: number;
  answersCount: number | null;
  submittedAt: string | null;
  verifiedAt: string;
  createdAt: string;
  candidateSummaryItems?: string[];
  candidateSummary?: string | null;
  behavioralProfile?: ProfessionalAssessmentBehavioralProfile | null;
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
  contractType?: MatchRequest['contractType'];
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

export interface AdminStudyStudyResponseSummary {
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
  responses: AdminStudyStudyResponseSummary[];
}

function requireAdminDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoAdminServiceError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour lire les donnees admin SevenO.',
    );
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyPlainObject(value: unknown): value is FirestoreRecord {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function resolveMeaningfulOverallScore(overallScore: unknown, scoresByDimension: unknown) {
  return isNonEmptyPlainObject(scoresByDimension) && typeof overallScore === 'number'
    ? overallScore
    : null;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined;
}

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }

  if (isPlainObject(value) && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }

  return null;
}

function toIsoString(value: unknown): string | null {
  const timestamp = toTimestamp(value);
  if (timestamp) {
    return timestamp.toDate().toISOString();
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  return null;
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => cleanText(item)).filter((item): item is string => Boolean(item));
}

function buildSevenoAssessmentSummaryFromProfile(data: Pick<
  CandidateProfile,
  | 'sevenoAssessmentStatus'
  | 'sevenoAssessmentOverallScore'
  | 'sevenoAssessmentDimensions'
  | 'sevenoAssessmentVersion'
  | 'sevenoAssessmentCompletedAt'
  | 'sevenoAssessmentSessionId'
  | 'sevenoAssessmentResultId'
>): AdminSevenoAssessmentSummary {
  const status: AdminSevenoAssessmentStatus = data.sevenoAssessmentStatus === 'completed'
    || data.sevenoAssessmentStatus === 'in_progress'
    ? data.sevenoAssessmentStatus
    : 'not_started';

  return {
    status,
    overallScore: resolveMeaningfulOverallScore(data.sevenoAssessmentOverallScore, data.sevenoAssessmentDimensions),
    scoresByDimension: data.sevenoAssessmentDimensions && typeof data.sevenoAssessmentDimensions === 'object'
      ? data.sevenoAssessmentDimensions as SevenoAssessmentScores
      : {},
    completedAt: toIsoString(data.sevenoAssessmentCompletedAt),
    sessionId: data.sevenoAssessmentSessionId ?? null,
    resultId: data.sevenoAssessmentResultId ?? null,
    questionnaireVersion: data.sevenoAssessmentVersion ?? null,
    professionalAssessmentVersionId: null,
    professionalAssessmentSchemaVersion: null,
    candidateSummaryItems: [],
    candidateSummary: null,
    behavioralProfile: null,
  };
}

function isCurrentSevenoAssessmentResult(data: Partial<TestResult>) {
  const professionalAssessmentVersionId = cleanText(data.professionalAssessmentVersionId);
  const questionBankCode = cleanText(data.questionBankCode);
  return Boolean(
    professionalAssessmentVersionId
    || typeof data.professionalAssessmentSchemaVersion === 'number'
    || (questionBankCode && questionBankCode.startsWith('seveno_professional_assessment_bank_')),
  );
}

function buildSevenoAssessmentSummaryFromResult(data: Partial<TestResult>): AdminSevenoAssessmentSummary {
  const behavioralProfile = data.behavioralProfile ?? null;
  const scoresByDimension = data.scoresByDimension && typeof data.scoresByDimension === 'object'
    ? data.scoresByDimension as SevenoAssessmentScores
    : {};
  return {
    status: 'completed',
    overallScore: resolveMeaningfulOverallScore(
      typeof data.overallScore === 'number' ? data.overallScore : data.score ?? null,
      scoresByDimension,
    ),
    scoresByDimension,
    completedAt: toIsoString(data.verifiedAt ?? data.submittedAt ?? null),
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : null,
    resultId: typeof data.sessionId === 'string' ? data.sessionId : null,
    questionnaireVersion: cleanText(data.questionnaireVersion) ?? cleanText(data.questionBankVersion) ?? null,
    professionalAssessmentVersionId: cleanText(data.professionalAssessmentVersionId) ?? null,
    professionalAssessmentSchemaVersion: typeof data.professionalAssessmentSchemaVersion === 'number'
      ? data.professionalAssessmentSchemaVersion
      : null,
    candidateSummaryItems: behavioralProfile?.candidateSummaryItems ? [...behavioralProfile.candidateSummaryItems] : [],
    candidateSummary: behavioralProfile?.candidateSummary ?? null,
    behavioralProfile,
  };
}

function resolveNonEmptyScoresByDimension(
  summaryScoresByDimension: unknown,
  profileScoresByDimension: unknown,
  resultScoresByDimension: unknown,
) {
  if (isNonEmptyPlainObject(summaryScoresByDimension)) {
    return summaryScoresByDimension as SevenoAssessmentScores;
  }

  if (isNonEmptyPlainObject(profileScoresByDimension)) {
    return profileScoresByDimension as SevenoAssessmentScores;
  }

  if (isNonEmptyPlainObject(resultScoresByDimension)) {
    return resultScoresByDimension as SevenoAssessmentScores;
  }

  return {};
}

function resolveNonEmptyCandidateSummaryItems(
  summaryItems: unknown,
  resultItems: unknown,
) {
  if (Array.isArray(summaryItems) && summaryItems.length > 0) {
    return [...summaryItems] as string[];
  }

  if (Array.isArray(resultItems) && resultItems.length > 0) {
    return [...resultItems] as string[];
  }

  return [];
}

export function resolveAdminSevenoAssessmentSummary(options: {
  profile?: Pick<
    CandidateProfile,
    | 'sevenoAssessmentStatus'
    | 'sevenoAssessmentOverallScore'
    | 'sevenoAssessmentDimensions'
    | 'sevenoAssessmentVersion'
    | 'sevenoAssessmentCompletedAt'
    | 'sevenoAssessmentSessionId'
    | 'sevenoAssessmentResultId'
  > | null;
  summary?: Partial<AdminSevenoAssessmentSummary> | null;
  result?: Partial<TestResult> | null;
} = {}): AdminSevenoAssessmentSummary {
  const profileSummary = options.profile ? buildSevenoAssessmentSummaryFromProfile(options.profile) : null;
  const resultSummary = options.result && isCurrentSevenoAssessmentResult(options.result)
    ? buildSevenoAssessmentSummaryFromResult(options.result)
    : null;
  const summary = options.summary ?? null;
  const summaryCandidateSummary = cleanText(summary?.candidateSummary);
  const resultCandidateSummary = cleanText(resultSummary?.candidateSummary);
  const summaryOverallScore = resolveMeaningfulOverallScore(summary?.overallScore, summary?.scoresByDimension);

  const status: AdminSevenoAssessmentStatus =
    summary?.status === 'completed'
      ? 'completed'
      : summary?.status === 'in_progress'
        ? 'in_progress'
        : summary?.status === 'expired'
          ? 'expired'
          : summary?.status === 'abandoned'
            ? 'abandoned'
            : profileSummary?.status === 'completed'
              ? 'completed'
              : profileSummary?.status === 'in_progress'
                ? 'in_progress'
                : resultSummary
                  ? 'completed'
                  : 'not_started';

  return {
    status,
    overallScore: summaryOverallScore ?? profileSummary?.overallScore ?? resultSummary?.overallScore ?? null,
    scoresByDimension: resolveNonEmptyScoresByDimension(
      summary?.scoresByDimension,
      profileSummary?.scoresByDimension,
      resultSummary?.scoresByDimension,
    ),
    completedAt: summary?.completedAt ?? profileSummary?.completedAt ?? resultSummary?.completedAt ?? null,
    sessionId: summary?.sessionId ?? profileSummary?.sessionId ?? resultSummary?.sessionId ?? null,
    resultId: summary?.resultId ?? profileSummary?.resultId ?? resultSummary?.resultId ?? null,
    questionnaireVersion: summary?.questionnaireVersion ?? profileSummary?.questionnaireVersion ?? resultSummary?.questionnaireVersion ?? null,
    professionalAssessmentVersionId: summary?.professionalAssessmentVersionId ?? resultSummary?.professionalAssessmentVersionId ?? null,
    professionalAssessmentSchemaVersion: summary?.professionalAssessmentSchemaVersion ?? resultSummary?.professionalAssessmentSchemaVersion ?? null,
    candidateSummaryItems: resolveNonEmptyCandidateSummaryItems(summary?.candidateSummaryItems, resultSummary?.candidateSummaryItems),
    candidateSummary: summaryCandidateSummary ?? resultCandidateSummary ?? null,
    behavioralProfile: summary?.behavioralProfile ?? resultSummary?.behavioralProfile ?? null,
  };
}

function serializeCandidateSummary(
  data: CandidateProfile,
  sevenoAssessment: AdminSevenoAssessmentSummary = resolveAdminSevenoAssessmentSummary({ profile: data }),
): AdminCandidateSummary {
  return {
    uid: data.uid,
    publicCandidateId: data.publicCandidateId,
    sectorId: data.sectorId,
    jobFamilyId: data.jobFamilyId,
    jobRoleId: data.jobRoleId,
    availability: data.availability,
    experienceLevel: data.experienceLevel,
    locationArea: data.locationArea,
    verifiedScore: data.verifiedScore ?? null,
    testPassed: data.testPassed,
    lastTestAt: toIsoString(data.lastTestAt),
    sevenoAssessment,
    profileStatus: data.profileStatus,
    createdAt: toIsoString(data.createdAt) ?? '',
    updatedAt: toIsoString(data.updatedAt) ?? '',
  };
}

function serializeCompanySummary(data: CompanyProfile): AdminCompanySummary {
  return {
    uid: data.uid,
    companyName: data.companyName,
    ...(data.legalName ? { legalName: data.legalName } : {}),
    companyType: data.companyType,
    businessSector: data.businessSector,
    companySize: data.companySize,
    headquartersArea: data.headquartersArea,
    recruitmentAreas: [...data.recruitmentAreas],
    contactRole: data.contactRole,
    profileStatus: data.profileStatus,
    verificationStatus: data.verificationStatus,
    ...(data.siret ? { siret: data.siret } : {}),
    ...(data.website ? { website: data.website } : {}),
    createdAt: toIsoString(data.createdAt) ?? '',
    updatedAt: toIsoString(data.updatedAt) ?? '',
  };
}

function serializeUserSummary(data: SevenoUser): AdminUserSummary {
  return {
    uid: data.uid,
    role: data.role,
    authProvider: data.authProvider,
    email: data.email,
    ...(data.displayName ? { displayName: data.displayName } : {}),
    ...(data.photoURL ? { photoURL: data.photoURL } : {}),
    onboardingCompleted: data.onboardingCompleted,
    createdAt: toIsoString(data.createdAt) ?? '',
    updatedAt: toIsoString(data.updatedAt) ?? '',
  };
}

function serializeTestSession(data: TestSession, id: string): AdminTestSessionSummary {
  return {
    id,
    uid: data.uid,
    ...(data.assessmentType ? { assessmentType: data.assessmentType } : {}),
    ...(data.publicCandidateId ? { publicCandidateId: data.publicCandidateId } : {}),
    ...(data.candidateProfileId ? { candidateProfileId: data.candidateProfileId } : {}),
    ...(data.sectorId ? { sectorId: data.sectorId } : {}),
    ...(data.jobFamilyId ? { jobFamilyId: data.jobFamilyId } : {}),
    ...(data.jobRoleId ? { jobRoleId: data.jobRoleId } : {}),
    ...(data.professionalAssessmentVersionId ? { professionalAssessmentVersionId: data.professionalAssessmentVersionId } : {}),
    questionBankCode: data.questionBankCode,
    status: data.status,
    questionIds: Array.isArray(data.questionIds) ? [...data.questionIds] : [],
    answersCount: data.answersCount ?? 0,
    durationSeconds: data.durationSeconds,
    threshold: data.threshold,
    score: toNumber(data.score),
    correctAnswers: toNumber(data.correctAnswers),
    totalQuestions: toNumber(data.totalQuestions),
    passed: typeof data.passed === 'boolean' ? data.passed : null,
    startedAt: toIsoString(data.startedAt) ?? '',
    submittedAt: toIsoString(data.submittedAt ?? null),
    expiresAt: toIsoString(data.expiresAt) ?? '',
    createdAt: toIsoString(data.createdAt) ?? '',
    updatedAt: toIsoString(data.updatedAt) ?? '',
  };
}

function serializeTestResult(data: TestResult, id: string): AdminTestResultSummary {
  const scoresByDimension = isNonEmptyPlainObject(data.scoresByDimension)
    ? data.scoresByDimension as SevenoAssessmentScores
    : {};
  return {
    id,
    uid: data.uid,
    ...(data.assessmentType ? { assessmentType: data.assessmentType } : {}),
    ...(data.publicCandidateId ? { publicCandidateId: data.publicCandidateId } : {}),
    sessionId: data.sessionId,
    ...(data.candidateProfileId ? { candidateProfileId: data.candidateProfileId } : {}),
    ...(data.sectorId ? { sectorId: data.sectorId } : {}),
    ...(data.jobFamilyId ? { jobFamilyId: data.jobFamilyId } : {}),
    ...(data.jobRoleId ? { jobRoleId: data.jobRoleId } : {}),
    ...(cleanText(data.professionalAssessmentVersionId) ? { professionalAssessmentVersionId: cleanText(data.professionalAssessmentVersionId) ?? null } : {}),
    ...(typeof data.professionalAssessmentSchemaVersion === 'number' ? { professionalAssessmentSchemaVersion: data.professionalAssessmentSchemaVersion } : {}),
    questionBankCode: data.questionBankCode,
    score: data.score,
    overallScore: resolveMeaningfulOverallScore(
      typeof data.overallScore === 'number' ? data.overallScore : data.score,
      scoresByDimension,
    ),
    scoresByDimension,
    correctAnswers: data.correctAnswers,
    totalQuestions: data.totalQuestions,
    passed: data.passed,
    threshold: data.threshold,
    durationSeconds: data.durationSeconds,
    answersCount: typeof data.answersCount === 'number' ? data.answersCount : null,
    submittedAt: toIsoString(data.submittedAt ?? null),
    verifiedAt: toIsoString(data.verifiedAt) ?? '',
    createdAt: toIsoString(data.createdAt) ?? '',
    ...(Array.isArray(data.behavioralProfile?.candidateSummaryItems)
      ? { candidateSummaryItems: [...data.behavioralProfile!.candidateSummaryItems] }
      : {}),
    ...(typeof data.behavioralProfile?.candidateSummary === 'string'
      ? { candidateSummary: data.behavioralProfile.candidateSummary }
      : {}),
    ...(data.behavioralProfile ? { behavioralProfile: data.behavioralProfile } : {}),
  };
}

function serializeMatchRequest(data: MatchRequest): AdminMatchRequestSummary {
  return {
    id: data.id,
    companyUid: data.companyUid,
    candidateUid: data.candidateUid,
    companyNameSnapshot: data.companyNameSnapshot,
    publicCandidateId: data.publicCandidateId,
    jobRoleId: data.jobRoleId,
    sectorId: data.sectorId,
    jobFamilyId: data.jobFamilyId,
    ...(data.message ? { message: data.message } : {}),
    ...(data.proposedJobTitle ? { proposedJobTitle: data.proposedJobTitle } : {}),
    ...(data.proposedLocation ? { proposedLocation: data.proposedLocation } : {}),
    ...(data.contractType ? { contractType: data.contractType } : {}),
    status: data.status,
    candidateDecisionAt: toIsoString(data.candidateDecisionAt),
    acceptedAt: toIsoString(data.acceptedAt),
    refusedAt: toIsoString(data.refusedAt),
    cancelledAt: toIsoString(data.cancelledAt),
    expiresAt: toIsoString(data.expiresAt),
    createdAt: toIsoString(data.createdAt) ?? '',
    updatedAt: toIsoString(data.updatedAt) ?? '',
  };
}

function serializeLog(data: AdminLog, id: string): AdminLogSummary {
  return {
    id,
    ...(data.actorUserId ? { actorUserId: data.actorUserId } : {}),
    ...(data.actorRole ? { actorRole: data.actorRole } : {}),
    action: data.action,
    ...(data.targetCollection ? { targetCollection: data.targetCollection } : {}),
    ...(data.targetId ? { targetId: data.targetId } : {}),
    ...(data.metadata ? { metadata: data.metadata } : {}),
    createdAt: toIsoString(data.createdAt) ?? '',
  };
}

function getSevenoCollectionSizes() {
  return Promise.all([
    requireAdminDatabase().collection(USERS_COLLECTION).get(),
    requireAdminDatabase().collection(CANDIDATE_PROFILES_COLLECTION).get(),
    requireAdminDatabase().collection(COMPANY_PROFILES_COLLECTION).get(),
    requireAdminDatabase().collection(TEST_SESSIONS_COLLECTION).get(),
    requireAdminDatabase().collection(TEST_RESULTS_COLLECTION).get(),
    requireAdminDatabase().collection(MATCH_REQUESTS_COLLECTION).get(),
    requireAdminDatabase().collection(ADMIN_LOGS_COLLECTION).get(),
    requireAdminDatabase().collection(STUDY_RESPONSES_COLLECTION).get(),
  ]).then(
    ([
      usersSnapshot,
      candidatesSnapshot,
      companiesSnapshot,
      sessionsSnapshot,
      resultsSnapshot,
      matchRequestsSnapshot,
      logsSnapshot,
      studyResponsesSnapshot,
    ]) => ({
      users: usersSnapshot.size,
      candidates: candidatesSnapshot.size,
      companies: companiesSnapshot.size,
      sessions: sessionsSnapshot.size,
      results: resultsSnapshot.size,
      matchRequests: matchRequestsSnapshot.size,
      logs: logsSnapshot.size,
      studyResponses: studyResponsesSnapshot.size,
    }),
  );
}

async function loadDocs(collectionName: string) {
  const snapshot = await requireAdminDatabase().collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() as FirestoreRecord }));
}

function readCurrentSevenoAssessmentSummary(docId: string, data: FirestoreRecord): AdminSevenoAssessmentSummary | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const candidateUid = cleanText(data.candidateUid);
  if (!candidateUid || candidateUid !== docId) {
    return null;
  }

  if (
    data.status !== 'completed'
    || !cleanText(data.professionalAssessmentVersionId)
    || !toIsoString(data.completedAt)
  ) {
    return null;
  }

  const summary = resolveAdminSevenoAssessmentSummary({
    summary: {
      status: 'completed',
      overallScore: typeof data.overallScore === 'number' ? data.overallScore : null,
      scoresByDimension: isPlainObject(data.scoresByDimension)
        ? data.scoresByDimension as SevenoAssessmentScores
        : {},
      completedAt: toIsoString(data.completedAt),
      sessionId: cleanText(data.sessionId) ?? null,
      resultId: cleanText(data.resultId) ?? null,
      questionnaireVersion: cleanText(data.questionnaireVersion) ?? null,
      professionalAssessmentVersionId: cleanText(data.professionalAssessmentVersionId) ?? null,
      professionalAssessmentSchemaVersion: typeof data.professionalAssessmentSchemaVersion === 'number'
        ? data.professionalAssessmentSchemaVersion
        : null,
      candidateSummaryItems: toStringArray(data.candidateSummaryItems),
      candidateSummary: cleanText(data.candidateSummary) ?? null,
      behavioralProfile: isPlainObject(data.behavioralProfile)
        ? data.behavioralProfile as unknown as ProfessionalAssessmentBehavioralProfile
        : null,
    },
  });

  if (!summary.professionalAssessmentVersionId) {
    return null;
  }

  return summary;
}

async function loadSevenoAssessmentSummaryMap() {
  const docs = await loadDocs('candidate_assessment_summaries');
  const summaries = new Map<string, AdminSevenoAssessmentSummary>();

  for (const { id, data } of docs) {
    const summary = readCurrentSevenoAssessmentSummary(id, data);
    if (summary) {
      summaries.set(id, summary);
    }
  }

  return summaries;
}

type LoadedCandidateEntry = {
  id: string;
  profile: StoredCandidateProfile;
  sevenoAssessment: AdminSevenoAssessmentSummary;
};

async function loadCandidates() {
  const docs = await loadDocs(CANDIDATE_PROFILES_COLLECTION);
  const sevenoAssessmentSummaries = await loadSevenoAssessmentSummaryMap();
  return docs
    .map(({ id, data }) => {
      if (
        !data.uid ||
        !data.publicCandidateId ||
        !data.sectorId ||
        !data.jobFamilyId ||
        !data.jobRoleId ||
        !data.availability ||
        !data.locationArea ||
        !data.experienceLevel ||
        !data.profileStatus ||
        !data.createdAt ||
        !data.updatedAt
      ) {
        return null;
      }

      const profile: StoredCandidateProfile = {
        uid: String(data.uid),
        publicCandidateId: String(data.publicCandidateId),
        role: 'candidate' as const,
        targetJobRoleIds: Array.isArray(data.targetJobRoleIds)
          ? data.targetJobRoleIds.map(String).slice(0, 3)
          : [String(data.jobRoleId)],
        targetJobs: Array.isArray(data.targetJobs)
          ? data.targetJobs as CandidateProfile['targetJobs']
          : [{
              sectorId: String(data.sectorId),
              jobFamilyId: String(data.jobFamilyId),
              jobRoleId: String(data.jobRoleId),
              label: String(data.jobRoleId),
            }],
        sectorId: String(data.sectorId),
        jobFamilyId: String(data.jobFamilyId),
        jobRoleId: String(data.jobRoleId),
        availability: data.availability as CandidateAvailability,
        locationArea: String(data.locationArea),
        experienceLevel: data.experienceLevel as CandidateExperienceLevel,
        verifiedScore: typeof data.verifiedScore === 'number' ? data.verifiedScore : null,
        testPassed: data.testPassed === true,
        lastTestAt: data.lastTestAt === null ? null : toTimestamp(data.lastTestAt),
        sevenoAssessmentStatus: data.sevenoAssessmentStatus === 'completed' || data.sevenoAssessmentStatus === 'in_progress'
          ? data.sevenoAssessmentStatus
          : 'not_started',
        sevenoAssessmentOverallScore: typeof data.sevenoAssessmentOverallScore === 'number'
          ? data.sevenoAssessmentOverallScore
          : null,
        sevenoAssessmentDimensions: data.sevenoAssessmentDimensions && typeof data.sevenoAssessmentDimensions === 'object'
          ? data.sevenoAssessmentDimensions as CandidateProfile['sevenoAssessmentDimensions']
          : {},
        sevenoAssessmentVersion: typeof data.sevenoAssessmentVersion === 'string' ? data.sevenoAssessmentVersion : null,
        sevenoAssessmentCompletedAt: data.sevenoAssessmentCompletedAt === null
          ? null
          : toTimestamp(data.sevenoAssessmentCompletedAt),
        sevenoAssessmentSessionId: cleanText(data.sevenoAssessmentSessionId) ?? null,
        sevenoAssessmentResultId: cleanText(data.sevenoAssessmentResultId) ?? null,
        profileStatus: data.profileStatus as CandidateProfileStatus,
        createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
        updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
      };

      return {
        id,
        profile,
        sevenoAssessment: resolveAdminSevenoAssessmentSummary({
          profile: {
            sevenoAssessmentStatus: profile.sevenoAssessmentStatus,
            sevenoAssessmentOverallScore: profile.sevenoAssessmentOverallScore,
            sevenoAssessmentDimensions: profile.sevenoAssessmentDimensions,
            sevenoAssessmentVersion: profile.sevenoAssessmentVersion,
            sevenoAssessmentCompletedAt: profile.sevenoAssessmentCompletedAt,
            sevenoAssessmentSessionId: profile.sevenoAssessmentSessionId,
            sevenoAssessmentResultId: profile.sevenoAssessmentResultId,
          },
          summary: sevenoAssessmentSummaries.get(String(data.uid)) ?? null,
        }),
      };
    })
    .filter((item): item is LoadedCandidateEntry => Boolean(item))
    .sort((left, right) => {
      const leftUpdated = left.profile.updatedAt instanceof Timestamp ? left.profile.updatedAt.toMillis() : 0;
      const rightUpdated = right.profile.updatedAt instanceof Timestamp ? right.profile.updatedAt.toMillis() : 0;
      return rightUpdated - leftUpdated;
    });
}

async function loadCompanies() {
  const docs = await loadDocs(COMPANY_PROFILES_COLLECTION);
  return docs
    .map(({ id, data }) => {
      if (
        !data.uid ||
        !data.companyName ||
        !data.companyType ||
        !data.businessSector ||
        !data.companySize ||
        !data.headquartersArea ||
        !Array.isArray(data.recruitmentAreas) ||
        !data.contactRole ||
        !data.profileStatus ||
        !data.verificationStatus ||
        !data.createdAt ||
        !data.updatedAt
      ) {
        return null;
      }

      return {
        id,
        profile: {
          uid: String(data.uid),
          companyName: String(data.companyName),
          ...(cleanText(data.legalName) ? { legalName: cleanText(data.legalName) } : {}),
          companyType: String(data.companyType),
          ...(cleanText(data.siret) ? { siret: cleanText(data.siret) } : {}),
          ...(cleanText(data.website) ? { website: cleanText(data.website) } : {}),
          businessSector: String(data.businessSector),
          companySize: data.companySize as CompanyProfile['companySize'],
          headquartersArea: String(data.headquartersArea),
          recruitmentAreas: toStringArray(data.recruitmentAreas),
          contactRole: String(data.contactRole),
          profileStatus: data.profileStatus as CompanyProfileStatus,
          verificationStatus: data.verificationStatus as CompanyVerificationStatus,
          createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
          updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
        } satisfies StoredCompanyProfile,
      };
    })
    .filter((item): item is { id: string; profile: StoredCompanyProfile } => Boolean(item))
    .sort((left, right) => {
      const leftUpdated = left.profile.updatedAt instanceof Timestamp ? left.profile.updatedAt.toMillis() : 0;
      const rightUpdated = right.profile.updatedAt instanceof Timestamp ? right.profile.updatedAt.toMillis() : 0;
      return rightUpdated - leftUpdated;
    });
}

async function loadTestSessions() {
  const docs = await loadDocs(TEST_SESSIONS_COLLECTION);
  return docs
    .map(({ id, data }) => {
      if (
        !data.uid ||
        !data.publicCandidateId ||
        !data.candidateProfileId ||
        !data.sectorId ||
        !data.jobFamilyId ||
        !data.jobRoleId ||
        !data.questionBankCode ||
        !data.status ||
        !Array.isArray(data.questionIds) ||
        !data.startedAt ||
        !data.expiresAt ||
        !data.createdAt ||
        !data.updatedAt
      ) {
        return null;
      }

      return {
        id,
        session: {
          uid: String(data.uid),
          publicCandidateId: String(data.publicCandidateId),
          candidateProfileId: String(data.candidateProfileId),
          sectorId: String(data.sectorId),
          jobFamilyId: String(data.jobFamilyId),
          jobRoleId: String(data.jobRoleId),
          questionBankCode: String(data.questionBankCode),
          status: data.status as TestSession['status'],
          questionIds: toStringArray(data.questionIds),
          answersCount: typeof data.answersCount === 'number' ? data.answersCount : 0,
          durationSeconds: typeof data.durationSeconds === 'number' ? data.durationSeconds : 0,
          threshold: typeof data.threshold === 'number' ? data.threshold : 0,
          score: typeof data.score === 'number' ? data.score : undefined,
          correctAnswers: typeof data.correctAnswers === 'number' ? data.correctAnswers : undefined,
          totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : undefined,
          passed: typeof data.passed === 'boolean' ? data.passed : undefined,
          startedAt: toTimestamp(data.startedAt) ?? Timestamp.now(),
          submittedAt: data.submittedAt == null ? null : toTimestamp(data.submittedAt),
          expiresAt: toTimestamp(data.expiresAt) ?? Timestamp.now(),
          cancelledAt: data.cancelledAt == null ? null : toTimestamp(data.cancelledAt),
          lastQuestionId: cleanText(data.lastQuestionId) ?? null,
          createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
          updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
        } satisfies StoredTestSession,
      };
    })
    .filter((item) => item !== null)
    .sort((left, right) => {
      const leftStarted = left.session.startedAt instanceof Timestamp ? left.session.startedAt.toMillis() : 0;
      const rightStarted = right.session.startedAt instanceof Timestamp ? right.session.startedAt.toMillis() : 0;
      return rightStarted - leftStarted;
    });
}

async function loadTestResults() {
  const docs = await loadDocs(TEST_RESULTS_COLLECTION);
  return docs
    .map(({ id, data }) => {
      if (
        !data.uid ||
        !data.publicCandidateId ||
        !data.sessionId ||
        !data.candidateProfileId ||
        !data.sectorId ||
        !data.jobFamilyId ||
        !data.jobRoleId ||
        !data.questionBankCode ||
        typeof data.score !== 'number' ||
        typeof data.correctAnswers !== 'number' ||
        typeof data.totalQuestions !== 'number' ||
        typeof data.passed !== 'boolean' ||
        typeof data.threshold !== 'number' ||
        typeof data.durationSeconds !== 'number' ||
        !data.createdAt ||
        !data.verifiedAt
      ) {
        return null;
      }

      return {
        id,
        result: {
          uid: String(data.uid),
          publicCandidateId: String(data.publicCandidateId),
          sessionId: String(data.sessionId),
          candidateProfileId: String(data.candidateProfileId),
          sectorId: String(data.sectorId),
          jobFamilyId: String(data.jobFamilyId),
          jobRoleId: String(data.jobRoleId),
          questionBankCode: String(data.questionBankCode),
          score: data.score,
          correctAnswers: data.correctAnswers,
          totalQuestions: data.totalQuestions,
          passed: data.passed,
          threshold: data.threshold,
          durationSeconds: data.durationSeconds,
          answersCount: typeof data.answersCount === 'number' ? data.answersCount : undefined,
          submittedAt: data.submittedAt == null ? null : toTimestamp(data.submittedAt),
          questionIds: Array.isArray(data.questionIds) ? toStringArray(data.questionIds) : undefined,
          createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
          verifiedAt: toTimestamp(data.verifiedAt) ?? Timestamp.now(),
        } satisfies StoredTestResult,
      };
    })
    .filter((item) => item !== null)
    .sort((left, right) => {
      const leftVerified = left.result.verifiedAt instanceof Timestamp ? left.result.verifiedAt.toMillis() : 0;
      const rightVerified = right.result.verifiedAt instanceof Timestamp ? right.result.verifiedAt.toMillis() : 0;
      return rightVerified - leftVerified;
    });
}

async function loadMatchRequests() {
  const docs = await loadDocs(MATCH_REQUESTS_COLLECTION);
  return docs
    .map(({ id, data }) => {
      if (
        !data.id ||
        !data.companyUid ||
        !data.candidateUid ||
        !data.companyNameSnapshot ||
        !data.publicCandidateId ||
        !data.jobRoleId ||
        !data.sectorId ||
        !data.jobFamilyId ||
        !data.status ||
        !data.createdAt ||
        !data.updatedAt
      ) {
        return null;
      }

      return {
        id,
        request: {
          id: String(data.id),
          companyUid: String(data.companyUid),
          candidateUid: String(data.candidateUid),
          companyNameSnapshot: String(data.companyNameSnapshot),
          publicCandidateId: String(data.publicCandidateId),
          jobRoleId: String(data.jobRoleId),
          sectorId: String(data.sectorId),
          jobFamilyId: String(data.jobFamilyId),
          ...(cleanText(data.message) ? { message: cleanText(data.message) } : {}),
          ...(cleanText(data.proposedJobTitle) ? { proposedJobTitle: cleanText(data.proposedJobTitle) } : {}),
          ...(cleanText(data.proposedLocation) ? { proposedLocation: cleanText(data.proposedLocation) } : {}),
          ...(cleanText(data.contractType) ? { contractType: cleanText(data.contractType) as MatchRequest['contractType'] } : {}),
          status: data.status as MatchRequestStatus,
          candidateDecisionAt: data.candidateDecisionAt == null ? null : toTimestamp(data.candidateDecisionAt),
          acceptedAt: data.acceptedAt == null ? null : toTimestamp(data.acceptedAt),
          refusedAt: data.refusedAt == null ? null : toTimestamp(data.refusedAt),
          cancelledAt: data.cancelledAt == null ? null : toTimestamp(data.cancelledAt),
          expiresAt: data.expiresAt == null ? null : toTimestamp(data.expiresAt),
          createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
          updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
        } satisfies StoredMatchRequest,
      };
    })
    .filter((item): item is { id: string; request: StoredMatchRequest } => Boolean(item))
    .sort((left, right) => {
      const leftCreated = left.request.createdAt instanceof Timestamp ? left.request.createdAt.toMillis() : 0;
      const rightCreated = right.request.createdAt instanceof Timestamp ? right.request.createdAt.toMillis() : 0;
      return rightCreated - leftCreated;
    });
}

async function loadLogs() {
  const docs = await loadDocs(ADMIN_LOGS_COLLECTION);
  return docs
    .map(({ id, data }) => {
      if (!data.action || !data.createdAt) {
        return null;
      }

      return {
        id,
        log: {
          ...(cleanText(data.actorUserId) ? { actorUserId: cleanText(data.actorUserId) } : {}),
          ...(cleanText(data.actorRole) ? { actorRole: cleanText(data.actorRole) as AdminLog['actorRole'] } : {}),
          action: String(data.action),
          ...(cleanText(data.targetCollection) ? { targetCollection: cleanText(data.targetCollection) } : {}),
          ...(cleanText(data.targetId) ? { targetId: cleanText(data.targetId) } : {}),
          ...(isPlainObject(data.metadata) ? { metadata: data.metadata } : {}),
          createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
        } satisfies StoredAdminLog,
      };
    })
    .filter((item): item is { id: string; log: StoredAdminLog } => Boolean(item))
    .sort((left, right) => {
      const leftCreated = left.log.createdAt instanceof Timestamp ? left.log.createdAt.toMillis() : 0;
      const rightCreated = right.log.createdAt instanceof Timestamp ? right.log.createdAt.toMillis() : 0;
      return rightCreated - leftCreated;
    });
}

function getCollectionDoc(collectionName: string, id: string) {
  return requireAdminDatabase().collection(collectionName).doc(id);
}

export async function writeAdminLog(
  action: string,
  actor: Pick<SevenoUser, 'uid' | 'role'>,
  targetCollection?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
) {
  await requireAdminDatabase().collection(ADMIN_LOGS_COLLECTION).doc().set({
    actorUserId: actor.uid,
    ...(actor.role ? { actorRole: actor.role } : {}),
    action,
    ...(targetCollection ? { targetCollection } : {}),
    ...(targetId ? { targetId } : {}),
    ...(metadata ? { metadata } : {}),
    createdAt: Timestamp.now(),
  } satisfies AdminLog);
}

export async function loadAdminOverview(): Promise<AdminOverviewPayload> {
  const [sizes, candidates, companies, tests, matchRequests, logs] = await Promise.all([
    getSevenoCollectionSizes(),
    loadCandidates(),
    loadCompanies(),
    loadTestSessions(),
    loadMatchRequests(),
    loadLogs(),
  ]);

  return {
    counts: {
      users: sizes.users,
      candidateProfiles: sizes.candidates,
      companyProfiles: sizes.companies,
      testSessions: sizes.sessions,
      testResults: sizes.results,
      matchRequests: sizes.matchRequests,
      adminLogs: sizes.logs,
      studyResponses: sizes.studyResponses,
      activeCandidates: candidates.filter((item) => item.profile.profileStatus === 'active').length,
      pausedCandidates: candidates.filter((item) => item.profile.profileStatus === 'paused').length,
      activeCompanies: companies.filter((item) => item.profile.profileStatus === 'active').length,
      suspendedCompanies: companies.filter((item) => item.profile.profileStatus === 'suspended').length,
      verifiedCompanies: companies.filter((item) => item.profile.verificationStatus === 'verified').length,
      pendingCompanies: companies.filter((item) => item.profile.verificationStatus === 'pending').length,
      acceptedMatchRequests: matchRequests.filter((item) => item.request.status === 'accepted').length,
      pendingMatchRequests: matchRequests.filter((item) => item.request.status === 'pending_candidate').length,
    },
    latestCandidates: candidates.slice(0, 8).map(({ profile, sevenoAssessment }) => serializeCandidateSummary(profile, sevenoAssessment)),
    latestCompanies: companies.slice(0, 8).map(({ profile }) => serializeCompanySummary(profile)),
    latestTests: tests.slice(0, 8).map(({ id, session }) => serializeTestSession(session, id)),
    latestMatchRequests: matchRequests.slice(0, 8).map(({ request }) => serializeMatchRequest(request)),
    latestLogs: logs.slice(0, 12).map(({ id, log }) => serializeLog(log, id)),
  };
}

export async function loadAdminCandidates() {
  const candidates = await loadCandidates();
  return {
    candidates: candidates.map(({ profile, sevenoAssessment }) => serializeCandidateSummary(profile, sevenoAssessment)),
  };
}

export async function getAdminCandidateDetail(uid: string): Promise<AdminCandidateDetailPayload> {
  const [candidateSnapshot, userSnapshot, summarySnapshot, testResults, matchRequests] = await Promise.all([
    getCollectionDoc(CANDIDATE_PROFILES_COLLECTION, uid).get(),
    getCollectionDoc(USERS_COLLECTION, uid).get(),
    getCollectionDoc('candidate_assessment_summaries', uid).get(),
    requireAdminDatabase().collection(TEST_RESULTS_COLLECTION).where('uid', '==', uid).get(),
    loadMatchRequests(),
  ]);

  const candidateProfile = candidateSnapshot.exists ? (candidateSnapshot.data() as CandidateProfile) : null;
  const user = userSnapshot.exists ? (userSnapshot.data() as SevenoUser) : null;
  const currentSevenoAssessmentResultEntry = testResults.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as TestResult }))
    .filter((entry) => isCurrentSevenoAssessmentResult(entry.data))
    .sort((left, right) => {
      const leftVerified = toTimestamp(left.data.verifiedAt)?.toMillis() ?? toTimestamp(left.data.createdAt)?.toMillis() ?? 0;
      const rightVerified = toTimestamp(right.data.verifiedAt)?.toMillis() ?? toTimestamp(right.data.createdAt)?.toMillis() ?? 0;
      return rightVerified - leftVerified;
    })[0] ?? null;
  const currentSevenoAssessmentSummary = candidateSnapshot.exists
    ? resolveAdminSevenoAssessmentSummary({
      profile: {
        sevenoAssessmentStatus: candidateProfile?.sevenoAssessmentStatus === 'completed'
          || candidateProfile?.sevenoAssessmentStatus === 'in_progress'
          ? candidateProfile.sevenoAssessmentStatus
          : 'not_started',
        sevenoAssessmentOverallScore: candidateProfile?.sevenoAssessmentOverallScore ?? null,
        sevenoAssessmentDimensions: candidateProfile?.sevenoAssessmentDimensions ?? {},
        sevenoAssessmentVersion: candidateProfile?.sevenoAssessmentVersion ?? null,
        sevenoAssessmentCompletedAt: candidateProfile?.sevenoAssessmentCompletedAt ?? null,
        sevenoAssessmentSessionId: candidateProfile?.sevenoAssessmentSessionId ?? null,
        sevenoAssessmentResultId: candidateProfile?.sevenoAssessmentResultId ?? null,
      },
      summary: summarySnapshot.exists
        ? readCurrentSevenoAssessmentSummary(
            summarySnapshot.id,
            summarySnapshot.data() as FirestoreRecord,
          )
        : null,
      result: currentSevenoAssessmentResultEntry?.data ?? null,
    })
    : null;
  const candidate = candidateProfile
    ? serializeCandidateSummary(candidateProfile, currentSevenoAssessmentSummary ?? undefined)
    : null;
  const latestTestResult = currentSevenoAssessmentResultEntry
    ? serializeTestResult(currentSevenoAssessmentResultEntry.data, currentSevenoAssessmentResultEntry.id)
    : null;
  const recentMatchRequests = matchRequests
    .filter((item) => item.request.candidateUid === uid)
    .slice(0, 10)
    .map(({ request }) => serializeMatchRequest(request));

  const privateIdentity: CandidatePrivateData | null = user
    ? {
        uid: user.uid,
        email: user.email,
        ...(user.photoURL ? { photoURL: user.photoURL } : {}),
      }
    : null;

  return {
    candidate,
    privateIdentity,
    user: user ? serializeUserSummary(user) : null,
    latestTestResult,
    recentMatchRequests,
  };
}

export async function updateAdminCandidateStatus(uid: string, profileStatus: CandidateProfileStatus) {
  const ref = getCollectionDoc(CANDIDATE_PROFILES_COLLECTION, uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new SevenoAdminServiceError('candidate_not_found', 404, 'Profil candidat introuvable.');
  }

  await ref.update({
    profileStatus,
    updatedAt: Timestamp.now(),
  });

  const updatedSnapshot = await ref.get();
  const updated = updatedSnapshot.data() as CandidateProfile;
  return serializeCandidateSummary(updated);
}

export async function loadAdminCompanies() {
  const companies = await loadCompanies();
  return {
    companies: companies.map(({ profile }) => serializeCompanySummary(profile)),
  };
}

export async function updateAdminCompanyStatus(
  uid: string,
  input: {
    profileStatus?: CompanyProfileStatus;
    verificationStatus?: CompanyVerificationStatus;
  },
) {
  const ref = getCollectionDoc(COMPANY_PROFILES_COLLECTION, uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new SevenoAdminServiceError('company_not_found', 404, 'Profil entreprise introuvable.');
  }

  const patch: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
  };

  if (input.profileStatus) {
    patch.profileStatus = input.profileStatus;
  }

  if (input.verificationStatus) {
    patch.verificationStatus = input.verificationStatus;
  }

  await ref.update(patch);

  const updatedSnapshot = await ref.get();
  const updated = updatedSnapshot.data() as CompanyProfile;
  return serializeCompanySummary(updated);
}

export async function loadAdminTests() {
  const [sessions, results] = await Promise.all([loadTestSessions(), loadTestResults()]);

  return {
    sessions: sessions.slice(0, 80).map(({ id, session }) => serializeTestSession(session, id)),
    results: results.slice(0, 80).map(({ id, result }) => serializeTestResult(result, id)),
  };
}

export async function loadAdminMatchRequests() {
  const matchRequests = await loadMatchRequests();
  return {
    matchRequests: matchRequests.slice(0, 80).map(({ request }) => serializeMatchRequest(request)),
  };
}

export async function updateAdminMatchRequestStatus(
  id: string,
  status: 'cancelled' | 'expired',
  actor: Pick<SevenoUser, 'uid' | 'role'>,
) {
  const ref = getCollectionDoc(MATCH_REQUESTS_COLLECTION, id);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new SevenoAdminServiceError('match_request_not_found', 404, 'Demande introuvable.');
  }

  const current = snapshot.data() as MatchRequest;
  const now = Timestamp.now();

  await ref.update({
    status,
    ...(status === 'cancelled' ? { cancelledAt: now } : { expiresAt: now }),
    updatedAt: now,
  });

  await writeAdminLog(
    status === 'cancelled' ? 'match_request_admin_cancelled' : 'match_request_admin_expired',
    actor,
    MATCH_REQUESTS_COLLECTION,
    id,
    {
      companyUid: current.companyUid,
      candidateUid: current.candidateUid,
      publicCandidateId: current.publicCandidateId,
    },
  );

  const updatedSnapshot = await ref.get();
  const updated = updatedSnapshot.data() as MatchRequest;
  return serializeMatchRequest(updated);
}

export async function loadAdminLogs() {
  const logs = await loadLogs();
  return {
    logs: logs.slice(0, 120).map(({ id, log }) => serializeLog(log, id)),
  };
}
