import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import {
  MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER,
} from '@/lib/seveno-active-candidate-files';
import {
  buildOfferActiveCandidateFilesLockId,
  isActiveCandidateFileStatus,
  touchOfferCapacityLockPayload,
} from '@/lib/seveno-active-candidate-files-server';
import { selectCompanyQuestionnairePriorityApplications } from '@/lib/seveno-company-questionnaire-thresholds';
import {
  buildApplicationSubmittedNotificationEventId,
  dispatchCompanyNotificationEvent,
  prepareApplicationSubmittedNotificationEvent,
} from '@/lib/seveno-company-notifications-server';
import type {
  ApplicationSevenoAssessmentSnapshot,
  CandidateOfferListPage,
  CandidateOfferProjection,
  CandidateReusablePrerequisiteAnswer,
  JobApplicationConversationAuthorRole,
  JobApplicationOrigin,
  ImplementedJobApplicationStatus,
  JobApplicationPrerequisiteAnswer,
  PreferredPrerequisiteResult,
  PrerequisiteAnswerInput,
  PrerequisiteAnswerResult,
  PrerequisiteAnswerValue,
  RequiredPrerequisiteResult,
  SerializedCandidateJobApplication,
  SerializedJobApplicationPrerequisiteAnswer,
  SerializedJobApplicationConversationMessage,
  CompanyApplicationPrioritySelection,
} from '@/types/seveno-job-applications';
import type { SerializedCompanyApplicationAssessmentSummary } from '@/types/seveno-application-questionnaires';
import type { OfferPrerequisiteSnapshot, PrerequisiteAnswerOption } from '@/types/seveno-prerequisites';
import type { SevenoAssessmentScores, SevenoAssessmentStatus } from '@/types/seveno';

const OFFERS_COLLECTION = 'job_offers';
const APPLICATIONS_COLLECTION = 'job_applications';
const GUARDS_COLLECTION = 'job_application_guards';
const OFFER_CAPACITY_LOCKS_COLLECTION = 'job_application_offer_locks';
const REUSABLE_COLLECTION = 'candidate_prerequisite_answers';
const APPLICATION_MESSAGES_SUBCOLLECTION = 'messages';
const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
const COMPANY_PROFILES_COLLECTION = 'company_profiles';
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 30;
const IMPLEMENTED_STATUSES: ImplementedJobApplicationStatus[] = [
  'draft',
  'invited',
  'prerequisites_in_progress',
  'eligible',
  'ineligible',
  'submitted',
  'viewed',
  'questionnaire_pending',
  'questionnaire_completed',
  'shortlisted',
  'rejected',
  'contact_requested',
  'conversation_open',
  'candidate_declined',
  'company_declined',
  'candidate_withdrawn',
  'offer_unavailable',
  'withdrawn',
  'closed',
];
type FirestoreRecord = Record<string, unknown>;
type Cursor = { timestamp: number; id: string };
type CandidateContext = {
  uid: string;
  publicCandidateId: string;
  targetJobRoleIds: string[];
  profileStatus: string;
  assessment: ApplicationSevenoAssessmentSnapshot;
};

type CandidateProfileRecord = {
  uid: string;
  publicCandidateId: string;
  role: 'candidate';
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  availability: string;
  locationArea: string;
  experienceLevel: string;
  verifiedScore: number | null;
  testPassed: boolean;
  lastTestAt: Timestamp | null;
  verifiedTestResultId: string | null;
  verifiedTestSessionId: string | null;
  verifiedJobRoleId: string | null;
  verifiedQuestionBankCode: string | null;
  verifiedQuestionBankVersion: string | null;
  profileStatus: string;
  sevenoAssessmentStatus: SevenoAssessmentStatus;
  sevenoAssessmentOverallScore: number | null;
  sevenoAssessmentDimensions: SevenoAssessmentScores;
  sevenoAssessmentVersion: string | null;
  sevenoAssessmentCompletedAt: Timestamp | null;
  sevenoAssessmentSessionId: string | null;
  sevenoAssessmentResultId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type CompanyProfileRecord = {
  uid: string;
  companyName: string;
  companyType: string;
  businessSector: string;
  companySize: string;
  headquartersArea: string;
  recruitmentAreas: string[];
  contactRole: string;
  profileStatus: string;
  verificationStatus: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export class SevenoJobApplicationError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function requireDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoJobApplicationError('firebase_admin_missing', 500, 'Firebase Admin n est pas configure pour les candidatures.');
  }
  return adminDb;
}

async function assertVerifiedCompanyAccount(companyUid: string) {
  const companyUser = await getSevenoUserByUid(companyUid);
  if (!companyUser || companyUser.role !== 'company') {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Compte entreprise introuvable.');
  }
  if (!companyUser.emailVerified) {
    throw new SevenoJobApplicationError(
      'email_not_verified',
      403,
      'Verifiez votre adresse email pour utiliser les fonctionnalites entreprise.',
    );
  }
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 200) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) throw new SevenoJobApplicationError('invalid_payload', 400, 'Un identifiant est invalide.');
  return text;
}

function toTimestamp(value: unknown) {
  return value instanceof Timestamp ? value : null;
}

function timestampToIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function cloneValue(value: PrerequisiteAnswerValue): PrerequisiteAnswerValue {
  return Array.isArray(value) ? [...value] : value;
}

export function buildJobApplicationGuardId(offerId: string, candidateUid: string) {
  return createHash('sha256').update(`${offerId}\0${candidateUid}`).digest('hex');
}

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value?: string): Cursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (!Number.isFinite(parsed.timestamp) || typeof parsed.id !== 'string' || !parsed.id) throw new Error('invalid');
    return parsed;
  } catch {
    throw new SevenoJobApplicationError('invalid_cursor', 400, 'Le curseur de pagination est invalide.');
  }
}

function assessmentFromProfile(data: FirestoreRecord): ApplicationSevenoAssessmentSnapshot {
  const status: SevenoAssessmentStatus = data.sevenoAssessmentStatus === 'completed'
    ? 'completed'
    : data.sevenoAssessmentStatus === 'in_progress' ? 'in_progress' : 'not_started';
  return {
    status,
    overallScore: typeof data.sevenoAssessmentOverallScore === 'number' && Number.isFinite(data.sevenoAssessmentOverallScore)
      ? data.sevenoAssessmentOverallScore
      : null,
    dimensions: isPlainObject(data.sevenoAssessmentDimensions)
      ? data.sevenoAssessmentDimensions as SevenoAssessmentScores
      : {},
    version: typeof data.sevenoAssessmentVersion === 'string' ? data.sevenoAssessmentVersion : null,
    completedAt: toTimestamp(data.sevenoAssessmentCompletedAt),
  };
}

function assessmentFromCandidateRecord(data: CandidateProfileRecord): ApplicationSevenoAssessmentSnapshot {
  return {
    status: data.sevenoAssessmentStatus,
    overallScore: data.sevenoAssessmentOverallScore,
    dimensions: data.sevenoAssessmentDimensions,
    version: data.sevenoAssessmentVersion,
    completedAt: data.sevenoAssessmentCompletedAt,
  };
}

async function loadCandidateContext(uid: string, requireActive = true): Promise<CandidateContext> {
  const firestore = requireDatabase();
  const [user, profileSnapshot] = await Promise.all([
    getSevenoUserByUid(uid),
    firestore.collection(CANDIDATE_PROFILES_COLLECTION).doc(uid).get(),
  ]);
  if (!user || user.role !== 'candidate') {
    throw new SevenoJobApplicationError('forbidden_role', 403, 'Seuls les candidats peuvent acceder aux offres.');
  }
  if (!user.emailVerified) {
    throw new SevenoJobApplicationError('email_not_verified', 403, 'Verifiez votre adresse email avant de candidater.');
  }
  const data = profileSnapshot.data();
  const publicCandidateId = cleanText(data?.publicCandidateId, 40);
  const targetJobRoleIds = Array.isArray(data?.targetJobRoleIds)
    ? data.targetJobRoleIds.map((item) => cleanText(item)).filter(Boolean)
    : [];
  const profileStatus = cleanText(data?.profileStatus, 20);
  if (!profileSnapshot.exists || data?.uid !== uid || !publicCandidateId || targetJobRoleIds.length === 0) {
    throw new SevenoJobApplicationError('candidate_profile_missing', 404, 'Profil candidat actif introuvable.');
  }
  if (requireActive && profileStatus !== 'active') {
    throw new SevenoJobApplicationError('candidate_profile_inactive', 409, 'Activez votre profil avant de candidater.');
  }
  return { uid, publicCandidateId, targetJobRoleIds, profileStatus, assessment: assessmentFromProfile(data) };
}

async function loadCandidateProfileByPublicCandidateId(publicCandidateId: string): Promise<CandidateProfileRecord | null> {
  const normalized = cleanText(publicCandidateId, 40);
  if (!normalized) {
    return null;
  }

  const snapshot = await requireDatabase()
    .collection(CANDIDATE_PROFILES_COLLECTION)
    .where('publicCandidateId', '==', normalized)
    .limit(2)
    .get();

  const candidates = snapshot.docs
    .map((document) => {
      const data = document.data() as FirestoreRecord;
      const candidate: CandidateProfileRecord | null = {
        uid: String(data.uid ?? ''),
        publicCandidateId: String(data.publicCandidateId ?? ''),
        role: data.role === 'candidate' ? 'candidate' : 'candidate',
        sectorId: String(data.sectorId ?? ''),
        jobFamilyId: String(data.jobFamilyId ?? ''),
        jobRoleId: String(data.jobRoleId ?? ''),
        availability: String(data.availability ?? ''),
        locationArea: String(data.locationArea ?? ''),
        experienceLevel: String(data.experienceLevel ?? ''),
        verifiedScore: typeof data.verifiedScore === 'number' && Number.isFinite(data.verifiedScore) ? data.verifiedScore : null,
        testPassed: data.testPassed === true,
        lastTestAt: toTimestamp(data.lastTestAt),
        verifiedTestResultId: cleanText(data.verifiedTestResultId, 120) ?? null,
        verifiedTestSessionId: cleanText(data.verifiedTestSessionId, 120) ?? null,
        verifiedJobRoleId: cleanText(data.verifiedJobRoleId, 200) ?? null,
        verifiedQuestionBankCode: cleanText(data.verifiedQuestionBankCode, 160) ?? null,
        verifiedQuestionBankVersion: cleanText(data.verifiedQuestionBankVersion, 40) ?? null,
        profileStatus: String(data.profileStatus ?? ''),
        sevenoAssessmentStatus: data.sevenoAssessmentStatus === 'completed' || data.sevenoAssessmentStatus === 'in_progress'
          ? data.sevenoAssessmentStatus
          : 'not_started',
        sevenoAssessmentOverallScore: typeof data.sevenoAssessmentOverallScore === 'number' && Number.isFinite(data.sevenoAssessmentOverallScore)
          ? data.sevenoAssessmentOverallScore
          : null,
        sevenoAssessmentDimensions: data.sevenoAssessmentDimensions && typeof data.sevenoAssessmentDimensions === 'object'
          ? data.sevenoAssessmentDimensions as SevenoAssessmentScores
          : {},
        sevenoAssessmentVersion: cleanText(data.sevenoAssessmentVersion, 40) ?? null,
        sevenoAssessmentCompletedAt: toTimestamp(data.sevenoAssessmentCompletedAt),
        sevenoAssessmentSessionId: cleanText(data.sevenoAssessmentSessionId, 120) ?? null,
        sevenoAssessmentResultId: cleanText(data.sevenoAssessmentResultId, 120) ?? null,
        createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
        updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
      };

      if (
        !candidate.uid
        || !candidate.publicCandidateId
        || !candidate.sectorId
        || !candidate.jobFamilyId
        || !candidate.jobRoleId
        || !candidate.availability
        || !candidate.locationArea
        || !candidate.experienceLevel
        || !candidate.profileStatus
      ) {
        return null;
      }

      return candidate;
    })
    .filter((item): item is CandidateProfileRecord => Boolean(item));

  if (candidates.length > 1) {
    throw new SevenoJobApplicationError('duplicate_public_candidate_id', 409, 'Plusieurs profils utilisent le meme identifiant public.');
  }

  return candidates[0] ?? null;
}

async function loadCompanyProfileByUid(uid: string): Promise<CompanyProfileRecord | null> {
  const snapshot = await requireDatabase().collection(COMPANY_PROFILES_COLLECTION).doc(uid).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as FirestoreRecord;
  if (
    data.uid !== uid
    || typeof data.companyName !== 'string'
    || typeof data.companyType !== 'string'
    || typeof data.businessSector !== 'string'
    || typeof data.companySize !== 'string'
    || typeof data.headquartersArea !== 'string'
    || !Array.isArray(data.recruitmentAreas)
    || typeof data.contactRole !== 'string'
    || typeof data.profileStatus !== 'string'
    || typeof data.verificationStatus !== 'string'
  ) {
    return null;
  }

  return {
    uid,
    companyName: data.companyName,
    companyType: data.companyType,
    businessSector: data.businessSector,
    companySize: data.companySize,
    headquartersArea: data.headquartersArea,
    recruitmentAreas: data.recruitmentAreas.map((item) => String(item)).filter(Boolean),
    contactRole: data.contactRole,
    profileStatus: data.profileStatus,
    verificationStatus: data.verificationStatus,
    createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
    updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
  };
}

function snapshotsFromOffer(data: FirestoreRecord) {
  const required = Array.isArray(data.requiredPrerequisites)
    ? data.requiredPrerequisites as OfferPrerequisiteSnapshot[]
    : [];
  const preferred = Array.isArray(data.preferredPrerequisites)
    ? data.preferredPrerequisites as OfferPrerequisiteSnapshot[]
    : [];
  return { required, preferred, all: [...required, ...preferred] };
}

function projectPublishedOffer(offerId: string, version: number, data: FirestoreRecord): CandidateOfferProjection {
  const snapshots = snapshotsFromOffer(data);
  const publishedAt = timestampToIso(data.publishedAt);
  if (!publishedAt || !data.companyPublicId || !data.companyNameSnapshot || !data.jobRoleId) {
    throw new SevenoJobApplicationError('invalid_published_offer', 500, 'La version publiee de l offre est invalide.');
  }
  return {
    offerId,
    offerVersion: version,
    companyPublicId: String(data.companyPublicId),
    companyName: String(data.companyNameSnapshot),
    title: String(data.title ?? ''),
    sectorId: String(data.sectorId ?? ''),
    jobFamilyId: String(data.jobFamilyId ?? ''),
    jobRoleId: String(data.jobRoleId),
    jobRoleLabel: String(data.jobRoleLabel ?? ''),
    location: String(data.location ?? ''),
    workMode: data.workMode as CandidateOfferProjection['workMode'],
    contractType: data.contractType as CandidateOfferProjection['contractType'],
    workingTime: data.workingTime as CandidateOfferProjection['workingTime'],
    description: String(data.description ?? ''),
    missions: String(data.missions ?? ''),
    profileSummary: String(data.profileSummary ?? ''),
    questionnaireRequired: data.questionnaireRequired === true,
    questionnaireId: typeof data.questionnaireId === 'string' ? data.questionnaireId : null,
    questionnaireVersion: typeof data.questionnaireVersion === 'number' ? data.questionnaireVersion : null,
    requiredPrerequisites: snapshots.required,
    preferredPrerequisites: snapshots.preferred,
    publishedAt,
  };
}

async function loadPublishedOfferForCandidate(offerId: string, context: CandidateContext) {
  const firestore = requireDatabase();
  const offerRef = firestore.collection(OFFERS_COLLECTION).doc(cleanText(offerId, 100));
  const currentSnapshot = await offerRef.get();
  const current = currentSnapshot.data();
  if (!currentSnapshot.exists || !current || !isOfferAvailableForNewApplication(current.status)) {
    throw new SevenoJobApplicationError('offer_not_available', 404, 'Cette offre n est plus disponible.');
  }
  const version = typeof current.version === 'number' ? current.version : 0;
  if (!version || !context.targetJobRoleIds.includes(String(current.jobRoleId ?? ''))) {
    throw new SevenoJobApplicationError('offer_not_matching', 403, 'Cette offre ne correspond pas a vos metiers recherches.');
  }
  const versionSnapshot = await offerRef.collection('versions').doc(String(version)).get();
  if (!versionSnapshot.exists) {
    throw new SevenoJobApplicationError('published_version_missing', 409, 'La version publiee de cette offre est indisponible.');
  }
  return {
    current,
    projection: projectPublishedOffer(offerRef.id, version, versionSnapshot.data() as FirestoreRecord),
  };
}

async function loadPublishedOfferForCompany(companyUid: string, offerId: string) {
  const firestore = requireDatabase();
  const offerRef = firestore.collection(OFFERS_COLLECTION).doc(cleanText(offerId, 100));
  const currentSnapshot = await offerRef.get();
  const current = currentSnapshot.data();
  if (!currentSnapshot.exists || !current || current.companyUid !== companyUid) {
    throw new SevenoJobApplicationError('offer_not_found', 404, 'Offre introuvable.');
  }
  if (!isOfferAvailableForNewApplication(current.status)) {
    throw new SevenoJobApplicationError('offer_not_available', 409, 'L offre doit etre publiee pour lancer une relation.');
  }
  const version = typeof current.version === 'number' ? current.version : 0;
  if (!version) {
    throw new SevenoJobApplicationError('published_version_missing', 409, 'La version publiee de cette offre est indisponible.');
  }
  const versionSnapshot = await offerRef.collection('versions').doc(String(version)).get();
  if (!versionSnapshot.exists) {
    throw new SevenoJobApplicationError('published_version_missing', 409, 'La version publiee de cette offre est indisponible.');
  }
  return {
    current,
    projection: projectPublishedOffer(offerRef.id, version, versionSnapshot.data() as FirestoreRecord),
  };
}

export function isOfferAvailableForNewApplication(status: unknown) {
  return status === 'published';
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionRank(options: PrerequisiteAnswerOption[], value: string) {
  const option = options.find((item) => item.value === value);
  return typeof option?.rank === 'number' ? option.rank : null;
}

function validateAnswerValue(snapshot: OfferPrerequisiteSnapshot, value: PrerequisiteAnswerValue) {
  if (value === null) return null;
  if (snapshot.answerType === 'boolean' && typeof value === 'boolean') return value;
  if (snapshot.answerType === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
  if (snapshot.answerType === 'date' && typeof value === 'string' && isValidDate(value)) return value;
  if (['single_choice', 'level'].includes(snapshot.answerType) && typeof value === 'string') {
    if (snapshot.options.some((option) => option.value === value)) return value;
  }
  if (snapshot.answerType === 'multiple_choice' && Array.isArray(value)) {
    const unique = [...new Set(value)];
    if (unique.length === value.length && unique.every((item) => snapshot.options.some((option) => option.value === item))) {
      return unique;
    }
  }
  throw new SevenoJobApplicationError('invalid_answer', 400, `La reponse a ${snapshot.prerequisiteCode} est invalide.`);
}

export function evaluatePrerequisiteAnswer(
  snapshot: OfferPrerequisiteSnapshot,
  rawValue: PrerequisiteAnswerValue,
  confirmed: boolean,
): PrerequisiteAnswerResult {
  const answer = validateAnswerValue(snapshot, rawValue);
  if (answer === null || !confirmed) return 'unanswered';
  const expected = snapshot.expectedCriterion;
  let satisfied = false;

  if (snapshot.comparisonOperator === 'equals') {
    satisfied = JSON.stringify(answer) === JSON.stringify(expected);
  } else if (snapshot.comparisonOperator === 'one_of') {
    if (snapshot.answerType !== 'single_choice' || typeof answer !== 'string' || !Array.isArray(expected)) {
      throw new SevenoJobApplicationError('invalid_snapshot_criterion', 500, 'Le critère one_of du prérequis est invalide.');
    }
    satisfied = expected.includes(answer);
  } else if (snapshot.comparisonOperator === 'contains_any') {
    satisfied = Array.isArray(answer) && Array.isArray(expected) && expected.some((item) => answer.includes(item));
  } else if (snapshot.comparisonOperator === 'contains_all') {
    satisfied = Array.isArray(answer) && Array.isArray(expected) && expected.every((item) => answer.includes(item));
  } else if (snapshot.comparisonOperator === 'before' || snapshot.comparisonOperator === 'after') {
    if (typeof answer !== 'string' || typeof expected !== 'string' || !isValidDate(answer) || !isValidDate(expected)) {
      throw new SevenoJobApplicationError('invalid_snapshot_criterion', 500, 'Le critere de date est invalide.');
    }
    satisfied = snapshot.comparisonOperator === 'before' ? answer < expected : answer > expected;
  } else if (snapshot.comparisonOperator === 'minimum' || snapshot.comparisonOperator === 'maximum') {
    let answerRank: number | null = typeof answer === 'number' ? answer : null;
    let expectedRank: number | null = typeof expected === 'number' ? expected : null;
    if (snapshot.answerType === 'level' && typeof answer === 'string' && typeof expected === 'string') {
      answerRank = optionRank(snapshot.options, answer);
      expectedRank = optionRank(snapshot.options, expected);
    }
    if (answerRank === null || expectedRank === null) {
      throw new SevenoJobApplicationError('invalid_snapshot_criterion', 500, 'Le seuil du prerequis est invalide.');
    }
    satisfied = snapshot.comparisonOperator === 'minimum' ? answerRank >= expectedRank : answerRank <= expectedRank;
  }
  return satisfied ? 'satisfied' : 'unsatisfied';
}

export function calculatePrerequisiteResults(
  snapshots: OfferPrerequisiteSnapshot[],
  answers: Map<string, Pick<JobApplicationPrerequisiteAnswer, 'answerValue' | 'confirmed'>>,
) {
  const count = (importance: 'required' | 'preferred') => {
    const selected = snapshots.filter((item) => item.importance === importance);
    const results = selected.map((snapshot) => {
      const answer = answers.get(snapshot.prerequisiteCode);
      return evaluatePrerequisiteAnswer(snapshot, answer?.answerValue ?? null, answer?.confirmed === true);
    });
    return {
      total: selected.length,
      satisfied: results.filter((item) => item === 'satisfied').length,
      unsatisfied: results.filter((item) => item === 'unsatisfied').length,
      unanswered: results.filter((item) => item === 'unanswered').length,
    };
  };
  const requiredBase = count('required');
  const preferredBase = count('preferred');
  const preferredAnswered = preferredBase.satisfied + preferredBase.unsatisfied;
  const requiredResult: RequiredPrerequisiteResult = {
    ...requiredBase,
    allSatisfied: requiredBase.total > 0 && requiredBase.satisfied === requiredBase.total,
  };
  const preferredResult: PreferredPrerequisiteResult = {
    ...preferredBase,
    compatibilityRate: preferredAnswered > 0 ? Math.round((preferredBase.satisfied / preferredAnswered) * 100) : 0,
  };
  return { requiredResult, preferredResult };
}

export function isReusablePrerequisiteAnswerFresh(
  answer: Pick<CandidateReusablePrerequisiteAnswer, 'prerequisiteVersion' | 'freshnessExpiresAt'>,
  prerequisiteVersion: number,
  now = Date.now(),
) {
  if (answer.prerequisiteVersion !== prerequisiteVersion) return false;
  if (answer.freshnessExpiresAt === null) return true;
  const expiresAt = answer.freshnessExpiresAt instanceof Timestamp
    ? answer.freshnessExpiresAt.toMillis()
    : typeof (answer.freshnessExpiresAt as { toMillis?: unknown })?.toMillis === 'function'
      ? (answer.freshnessExpiresAt as { toMillis: () => number }).toMillis()
      : NaN;
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function emptyResults(snapshots: OfferPrerequisiteSnapshot[]) {
  return calculatePrerequisiteResults(snapshots, new Map());
}

function applicationStatusFromResults(required: RequiredPrerequisiteResult): ImplementedJobApplicationStatus {
  if (required.unanswered > 0) return 'prerequisites_in_progress';
  return required.allSatisfied ? 'eligible' : 'ineligible';
}

function serializeAssessment(value: unknown) {
  const data = isPlainObject(value) ? value : {};
  return {
    status: (data.status === 'completed' || data.status === 'in_progress' ? data.status : 'not_started') as SevenoAssessmentStatus,
    overallScore: typeof data.overallScore === 'number' ? data.overallScore : null,
    dimensions: isPlainObject(data.dimensions) ? data.dimensions as SevenoAssessmentScores : {},
    version: typeof data.version === 'string' ? data.version : null,
    completedAt: timestampToIso(data.completedAt),
  };
}

function defaultCompanyAssessment(questionnaireVersion: string): SerializedCompanyApplicationAssessmentSummary {
  return {
    status: 'not_started',
    automaticScorePercent: null,
    autoScoredPoints: null,
    autoScoredMaximum: null,
    manualReviewRequired: false,
    manualReviewStatus: 'not_required',
    finalScore: null,
    minimumPassingScorePercent: null,
    questionnaireVersion,
    completedAt: null,
    startedAt: null,
    submittedAt: null,
    sessionId: null,
    resultId: null,
    manualQuestionsCount: 0,
  };
}

function serializeCompanyAssessment(
  value: unknown,
  fallbackQuestionnaireVersion: number | null,
  offerSnapshot?: CandidateOfferProjection,
): SerializedCompanyApplicationAssessmentSummary | null {
  const questionnaireVersion = typeof fallbackQuestionnaireVersion === 'number'
    ? String(fallbackQuestionnaireVersion)
    : typeof offerSnapshot?.questionnaireVersion === 'number'
      ? String(offerSnapshot.questionnaireVersion)
      : '';

  const data = isPlainObject(value) ? value : null;
  if (!data) {
    return questionnaireVersion ? defaultCompanyAssessment(questionnaireVersion) : null;
  }

  const normalizedQuestionnaireVersion = typeof data.questionnaireVersion === 'string'
    ? data.questionnaireVersion
    : questionnaireVersion;
  if (!normalizedQuestionnaireVersion) {
    return null;
  }

  const status = data.status === 'in_progress'
    || data.status === 'submitted'
    || data.status === 'completed'
    || data.status === 'expired'
    || data.status === 'abandoned'
      ? data.status
      : 'not_started';

  const manualReviewStatus = data.manualReviewStatus === 'pending'
    || data.manualReviewStatus === 'in_review'
    || data.manualReviewStatus === 'completed'
      ? data.manualReviewStatus
      : 'not_required';

  return {
    status,
    automaticScorePercent: typeof data.automaticScorePercent === 'number' && Number.isFinite(data.automaticScorePercent)
      ? data.automaticScorePercent
      : null,
    autoScoredPoints: typeof data.autoScoredPoints === 'number' && Number.isFinite(data.autoScoredPoints)
      ? data.autoScoredPoints
      : null,
    autoScoredMaximum: typeof data.autoScoredMaximum === 'number' && Number.isFinite(data.autoScoredMaximum)
      ? data.autoScoredMaximum
      : null,
    manualReviewRequired: data.manualReviewRequired === true,
    manualReviewStatus,
    finalScore: typeof data.finalScore === 'number' && Number.isFinite(data.finalScore)
      ? data.finalScore
      : null,
    minimumPassingScorePercent: typeof data.minimumPassingScorePercent === 'number' && Number.isFinite(data.minimumPassingScorePercent)
      ? data.minimumPassingScorePercent
      : null,
    questionnaireVersion: normalizedQuestionnaireVersion,
    completedAt: timestampToIso(data.completedAt),
    startedAt: timestampToIso(data.startedAt),
    submittedAt: timestampToIso(data.submittedAt),
    sessionId: cleanText(data.sessionId, 120) || null,
    resultId: cleanText(data.resultId, 120) || null,
    manualQuestionsCount: typeof data.manualQuestionsCount === 'number' && Number.isFinite(data.manualQuestionsCount)
      ? data.manualQuestionsCount
      : 0,
  };
}

function serializeApplication(id: string, data: FirestoreRecord): SerializedCandidateJobApplication {
  const status = IMPLEMENTED_STATUSES.includes(data.status as ImplementedJobApplicationStatus)
    ? data.status as ImplementedJobApplicationStatus
    : 'draft';
  const offerSnapshot = data.offerSnapshot as CandidateOfferProjection | undefined;
  return {
    id,
    publicCandidateId: String(data.publicCandidateId ?? ''),
    companyPublicId: String(data.companyPublicId ?? ''),
    companyNameSnapshot: String(data.companyNameSnapshot ?? ''),
    offerId: String(data.offerId ?? ''),
    offerVersion: typeof data.offerVersion === 'number' ? data.offerVersion : 0,
    jobRoleId: String(data.jobRoleId ?? ''),
    origin: data.origin === 'company' ? 'company' : 'candidate',
    offerSnapshot: offerSnapshot as CandidateOfferProjection,
    status,
    requiredResult: data.requiredResult as RequiredPrerequisiteResult,
    preferredResult: data.preferredResult as PreferredPrerequisiteResult,
    sevenoAssessmentSnapshot: serializeAssessment(data.sevenoAssessmentSnapshot),
    companyAssessment: serializeCompanyAssessment(data.companyAssessment, offerSnapshot?.questionnaireVersion ?? null, offerSnapshot),
    invitedAt: timestampToIso(data.invitedAt),
    candidateDecisionAt: timestampToIso(data.candidateDecisionAt),
    companyDecisionAt: timestampToIso(data.companyDecisionAt),
    conversationId: typeof data.conversationId === 'string' && data.conversationId ? data.conversationId : null,
    conversationStatus: data.conversationStatus === 'open' || data.status === 'conversation_open'
      ? 'open'
      : data.conversationStatus === 'closed'
        ? 'closed'
        : null,
    conversationUnreadCandidateCount: typeof data.conversationUnreadCandidateCount === 'number' && Number.isFinite(data.conversationUnreadCandidateCount)
      ? data.conversationUnreadCandidateCount
      : 0,
    conversationUnreadCompanyCount: typeof data.conversationUnreadCompanyCount === 'number' && Number.isFinite(data.conversationUnreadCompanyCount)
      ? data.conversationUnreadCompanyCount
      : 0,
    conversationLastMessageAt: timestampToIso(data.conversationLastMessageAt),
    conversationLastMessagePreview: typeof data.conversationLastMessagePreview === 'string' && data.conversationLastMessagePreview.trim().length > 0
      ? data.conversationLastMessagePreview
      : null,
    conversationLastMessageAuthorRole: data.conversationLastMessageAuthorRole === 'candidate' || data.conversationLastMessageAuthorRole === 'company'
      ? data.conversationLastMessageAuthorRole
      : null,
    createdAt: timestampToIso(data.createdAt) ?? '',
    updatedAt: timestampToIso(data.updatedAt) ?? '',
    submittedAt: timestampToIso(data.submittedAt),
    withdrawnAt: timestampToIso(data.withdrawnAt),
  };
}

function hasOpenJobApplicationConversation(application: SerializedCandidateJobApplication) {
  return application.conversationStatus === 'open' || application.status === 'conversation_open';
}

function serializeAnswer(data: FirestoreRecord): SerializedJobApplicationPrerequisiteAnswer {
  return {
    prerequisiteId: String(data.prerequisiteId ?? ''),
    prerequisiteCode: String(data.prerequisiteCode ?? ''),
    prerequisiteVersion: typeof data.prerequisiteVersion === 'number' ? data.prerequisiteVersion : 0,
    importance: data.importance === 'preferred' ? 'preferred' : 'required',
    answerType: data.answerType as SerializedJobApplicationPrerequisiteAnswer['answerType'],
    answerValue: data.answerValue as PrerequisiteAnswerValue,
    answeredAt: timestampToIso(data.answeredAt),
    source: data.source === 'reusable_profile' ? 'reusable_profile' : 'application',
    confirmed: data.confirmed === true,
    result: data.result === 'satisfied' || data.result === 'unsatisfied' ? data.result : 'unanswered',
  };
}

export async function listCandidateOffers(uid: string, options: { limit?: number; cursor?: string } = {}): Promise<CandidateOfferListPage> {
  const context = await loadCandidateContext(uid);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, options.limit ?? DEFAULT_PAGE_LIMIT));
  let query: Query = requireDatabase().collection(OFFERS_COLLECTION)
    .where('jobRoleId', 'in', context.targetJobRoleIds.slice(0, 30))
    .where('status', '==', 'published')
    .orderBy('publishedAt', 'desc')
    .orderBy('id', 'asc');
  const cursor = decodeCursor(options.cursor);
  if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.timestamp), cursor.id);
  const snapshot = await query.limit(limit + 1).get();
  const documents = snapshot.docs.slice(0, limit);
  const firestore = requireDatabase();
  const guardRefs = documents.map((document) => firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(document.id, uid)));
  const guards = guardRefs.length ? await firestore.getAll(...guardRefs) : [];
  const applicationIds = guards.map((guard) => cleanText(guard.data()?.applicationId, 100)).filter(Boolean);
  const applicationDocuments = applicationIds.length
    ? await firestore.getAll(...applicationIds.map((id) => firestore.collection(APPLICATIONS_COLLECTION).doc(id)))
    : [];
  const applicationsByOffer = new Map(applicationDocuments.filter((item) => item.exists).map((item) => {
    const data = item.data() as FirestoreRecord;
    return [String(data.offerId), { id: item.id, status: data.status as ImplementedJobApplicationStatus }];
  }));
  const offers = documents.map((document) => {
    const data = document.data() as FirestoreRecord;
    const version = typeof data.version === 'number' ? data.version : 0;
    const projected = projectPublishedOffer(document.id, version, data);
    const application = applicationsByOffer.get(document.id);
    return {
      offerId: projected.offerId,
      offerVersion: projected.offerVersion,
      companyPublicId: projected.companyPublicId,
      companyName: projected.companyName,
      title: projected.title,
      sectorId: projected.sectorId,
      jobFamilyId: projected.jobFamilyId,
      jobRoleId: projected.jobRoleId,
      jobRoleLabel: projected.jobRoleLabel,
      location: projected.location,
      workMode: projected.workMode,
      contractType: projected.contractType,
      workingTime: projected.workingTime,
      questionnaireRequired: projected.questionnaireRequired,
      questionnaireId: projected.questionnaireId,
      questionnaireVersion: projected.questionnaireVersion,
      publishedAt: projected.publishedAt,
      requiredPrerequisitesCount: projected.requiredPrerequisites.length,
      preferredPrerequisitesCount: projected.preferredPrerequisites.length,
      applicationId: application?.id ?? null,
      applicationStatus: application?.status ?? null,
    };
  });
  const last = documents.at(-1);
  const publishedAt = last?.get('publishedAt');
  return {
    offers,
    nextCursor: snapshot.docs.length > limit && publishedAt instanceof Timestamp
      ? encodeCursor({ timestamp: publishedAt.toMillis(), id: last?.id ?? '' })
      : null,
  };
}

export async function getCandidateOffer(uid: string, offerId: string) {
  const context = await loadCandidateContext(uid);
  const firestore = requireDatabase();
  const guard = await firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(offerId, uid)).get();
  const applicationId = cleanText(guard.data()?.applicationId, 100) || null;
  if (applicationId) {
    const applicationSnapshot = await firestore.collection(APPLICATIONS_COLLECTION).doc(applicationId).get();
    if (applicationSnapshot.exists && applicationSnapshot.data()?.candidateUid === uid) {
      const application = serializeApplication(applicationSnapshot.id, applicationSnapshot.data() as FirestoreRecord);
      return { offer: application.offerSnapshot, applicationId };
    }
  }
  const { projection } = await loadPublishedOfferForCandidate(offerId, context);
  return { offer: projection, applicationId };
}

async function reusablePrefill(uid: string, snapshots: OfferPrerequisiteSnapshot[]) {
  const firestore = requireDatabase();
  const reusable = snapshots.filter((item) => item.responseScope === 'profile_reusable');
  const docs = reusable.length ? await firestore.getAll(...reusable.map((item) =>
    firestore.collection(REUSABLE_COLLECTION).doc(uid).collection('answers').doc(item.prerequisiteCode),
  )) : [];
  return new Map(docs.filter((item) => item.exists).map((item) => [item.id, item.data() as FirestoreRecord]));
}

export async function beginJobApplication(uid: string, offerId: string) {
  const context = await loadCandidateContext(uid);
  const { current, projection } = await loadPublishedOfferForCandidate(offerId, context);
  const snapshots = [...projection.requiredPrerequisites, ...projection.preferredPrerequisites];
  const reusable = await reusablePrefill(uid, snapshots);
  const firestore = requireDatabase();
  const guardRef = firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(projection.offerId, uid));
  const applicationId = randomUUID();
  const applicationRef = firestore.collection(APPLICATIONS_COLLECTION).doc(applicationId);

  return firestore.runTransaction(async (transaction) => {
    const guard = await transaction.get(guardRef);
    const guardedApplicationId = cleanText(guard.data()?.applicationId, 100);
    if (guard.exists && guard.data()?.active === true && guardedApplicationId) {
      const existing = await transaction.get(firestore.collection(APPLICATIONS_COLLECTION).doc(guardedApplicationId));
      if (existing.exists && existing.data()?.candidateUid === uid) return serializeApplication(existing.id, existing.data() as FirestoreRecord);
    }
    const now = Timestamp.now();
    const results = emptyResults(snapshots);
    const stored = {
      id: applicationId,
      candidateUid: uid,
      publicCandidateId: context.publicCandidateId,
      companyUid: String(current.companyUid ?? ''),
      companyPublicId: projection.companyPublicId,
      companyNameSnapshot: String(current.companyNameSnapshot ?? ''),
      offerId: projection.offerId,
      offerVersion: projection.offerVersion,
      jobRoleId: projection.jobRoleId,
      origin: 'candidate' as JobApplicationOrigin,
      offerSnapshot: projection,
      status: 'draft',
      ...results,
      sevenoAssessmentSnapshot: context.assessment,
      invitedAt: null,
      candidateDecisionAt: null,
      companyDecisionAt: null,
      conversationId: null,
      conversationStatus: null,
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      conversationLastMessageAt: null,
      conversationLastMessagePreview: null,
      conversationLastMessageAuthorRole: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      withdrawnAt: null,
    };
    transaction.create(applicationRef, stored);
    transaction.set(guardRef, { offerId: projection.offerId, candidateUid: uid, applicationId, active: true, updatedAt: now });
    for (const snapshot of snapshots) {
      const reusableData = reusable.get(snapshot.prerequisiteCode);
      const canPrefill = reusableData && isReusablePrerequisiteAnswerFresh(
        {
          prerequisiteVersion: typeof reusableData.prerequisiteVersion === 'number' ? reusableData.prerequisiteVersion : 0,
          freshnessExpiresAt: toTimestamp(reusableData.freshnessExpiresAt),
        },
        snapshot.prerequisiteVersion,
      ) && (!snapshot.freshnessDays || toTimestamp(reusableData.freshnessExpiresAt) !== null);
      transaction.set(applicationRef.collection('prerequisite_answers').doc(snapshot.prerequisiteCode), {
        prerequisiteId: snapshot.prerequisiteId,
        prerequisiteCode: snapshot.prerequisiteCode,
        prerequisiteVersion: snapshot.prerequisiteVersion,
        importance: snapshot.importance,
        answerType: snapshot.answerType,
        answerValue: canPrefill ? reusableData?.answerValue ?? null : null,
        answeredAt: canPrefill ? reusableData?.answeredAt ?? null : null,
        source: canPrefill ? 'reusable_profile' : 'application',
        confirmed: false,
        result: 'unanswered',
      });
    }
    return serializeApplication(applicationId, stored);
  });
}

function applicationRef(applicationId: string) {
  return requireDatabase().collection(APPLICATIONS_COLLECTION).doc(cleanText(applicationId, 100));
}

function applicationMessagesRef(applicationId: string) {
  return applicationRef(applicationId).collection(APPLICATION_MESSAGES_SUBCOLLECTION);
}

function normalizeConversationBody(raw: unknown) {
  if (typeof raw !== 'string') {
    throw new SevenoJobApplicationError('invalid_message', 400, 'Le message envoye est invalide.');
  }

  const body = raw.trim();
  if (!body || body.length > 2000) {
    throw new SevenoJobApplicationError('invalid_message', 400, 'Le message envoye est invalide.');
  }

  return body;
}

function buildConversationPreview(body: string) {
  const normalized = body.replace(/\s+/g, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function ensureCompanyProfileComplete(profile: CompanyProfileRecord | null): asserts profile is CompanyProfileRecord {
  if (!profile) {
    throw new SevenoJobApplicationError('company_profile_missing', 404, 'Profil entreprise introuvable.');
  }

  if (profile.profileStatus !== 'active') {
    throw new SevenoJobApplicationError('company_profile_inactive', 409, 'Le profil entreprise doit etre actif.');
  }

  if (
    !profile.companyName.trim()
    || !profile.companyType.trim()
    || !profile.businessSector.trim()
    || !profile.headquartersArea.trim()
    || !profile.contactRole.trim()
    || profile.recruitmentAreas.length === 0
  ) {
    throw new SevenoJobApplicationError('company_profile_incomplete', 409, 'Le profil entreprise est incomplet.');
  }
}

function ensureVisibleCandidateProfile(profile: CandidateProfileRecord | null): asserts profile is CandidateProfileRecord {
  if (!profile) {
    throw new SevenoJobApplicationError('candidate_profile_missing', 404, 'Profil candidat introuvable.');
  }

  if (profile.profileStatus !== 'active') {
    throw new SevenoJobApplicationError('candidate_profile_inactive', 409, 'Le profil candidat doit etre actif.');
  }

  if (
    !profile.publicCandidateId
    || !profile.sectorId
    || !profile.jobFamilyId
    || !profile.jobRoleId
    || !profile.locationArea
  ) {
    throw new SevenoJobApplicationError('candidate_profile_incomplete', 409, 'Le profil candidat est incomplet.');
  }

  if (
    profile.verifiedScore === null
    || profile.testPassed !== true
    || profile.verifiedJobRoleId !== profile.jobRoleId
    || !profile.verifiedQuestionBankCode
    || !profile.verifiedQuestionBankVersion
  ) {
    throw new SevenoJobApplicationError('candidate_profile_not_verified', 409, 'Le candidat doit etre verifie sur ce metier.');
  }
}

function ensureCandidateOfferMatch(profile: CandidateProfileRecord, offer: CandidateOfferProjection) {
  if (
    profile.sectorId !== offer.sectorId
    || profile.jobFamilyId !== offer.jobFamilyId
    || profile.jobRoleId !== offer.jobRoleId
  ) {
    throw new SevenoJobApplicationError('candidate_offer_mismatch', 409, 'Le metier cible du candidat ne correspond pas a l offre.');
  }
}

function isFinalApplicationStatus(status: ImplementedJobApplicationStatus) {
  return ['candidate_declined', 'company_declined', 'candidate_withdrawn', 'offer_unavailable', 'withdrawn', 'closed'].includes(status);
}

function serializeConversationMessage(id: string, data: FirestoreRecord): SerializedJobApplicationConversationMessage {
  return {
    id,
    applicationId: String(data.applicationId ?? ''),
    senderUid: String(data.senderUid ?? ''),
    senderRole: data.senderRole === 'company' ? 'company' : 'candidate',
    body: String(data.body ?? ''),
    createdAt: timestampToIso(data.createdAt) ?? '',
  };
}

async function loadApplicationSnapshot(applicationId: string) {
  const snapshot = await applicationRef(applicationId).get();
  if (!snapshot.exists) {
    throw new SevenoJobApplicationError('application_not_found', 404, 'Candidature introuvable.');
  }
  return snapshot;
}

function buildEmptyApplicationResults(snapshots: OfferPrerequisiteSnapshot[]) {
  return emptyResults(snapshots);
}

async function loadConversationMessages(applicationId: string) {
  const snapshot = await applicationMessagesRef(applicationId).orderBy('createdAt', 'asc').get();
  return snapshot.docs.map((doc) => serializeConversationMessage(doc.id, doc.data() as FirestoreRecord));
}

export async function createCompanyApplicationInvitation(input: {
  companyUid: string;
  offerId: string;
  publicCandidateId: string;
  message?: string;
}) {
  await assertVerifiedCompanyAccount(input.companyUid);
  const companyProfile = await loadCompanyProfileByUid(input.companyUid);
  ensureCompanyProfileComplete(companyProfile);

  const candidateProfile = await loadCandidateProfileByPublicCandidateId(input.publicCandidateId);
  ensureVisibleCandidateProfile(candidateProfile);

  if (!candidateProfile || candidateProfile.uid === input.companyUid) {
    throw new SevenoJobApplicationError('invalid_target', 400, 'Une entreprise ne peut pas se contacter elle-meme.');
  }

  const { current, projection } = await loadPublishedOfferForCompany(input.companyUid, input.offerId);
  ensureCandidateOfferMatch(candidateProfile, projection);

  const snapshots = [...projection.requiredPrerequisites, ...projection.preferredPrerequisites];
  const firestore = requireDatabase();
  const guardRef = firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(projection.offerId, candidateProfile.uid));
  const offerCapacityLockRef = firestore.collection(OFFER_CAPACITY_LOCKS_COLLECTION).doc(
    buildOfferActiveCandidateFilesLockId(input.companyUid, projection.offerId),
  );
  const activeApplicationsQuery = firestore.collection(APPLICATIONS_COLLECTION)
    .where('companyUid', '==', input.companyUid)
    .where('offerId', '==', projection.offerId)
    .orderBy('updatedAt', 'desc')
    .orderBy('id', 'asc');
  const applicationId = randomUUID();
  const applicationRef = firestore.collection(APPLICATIONS_COLLECTION).doc(applicationId);
  const message = typeof input.message === 'string' ? input.message.trim() : '';

  return firestore.runTransaction(async (transaction) => {
    const guardSnapshot = await transaction.get(guardRef);
    const guardedApplicationId = cleanText(guardSnapshot.data()?.applicationId, 100);
    if (guardSnapshot.exists && guardedApplicationId) {
      const guardedSnapshot = await transaction.get(firestore.collection(APPLICATIONS_COLLECTION).doc(guardedApplicationId));
      if (guardedSnapshot.exists && guardedSnapshot.data()?.candidateUid === candidateProfile.uid) {
        const guarded = serializeApplication(guardedSnapshot.id, guardedSnapshot.data() as FirestoreRecord);
        if (!isFinalApplicationStatus(guarded.status)) {
          return guarded;
        }
      }
    }

    await transaction.get(offerCapacityLockRef);
    const activeApplicationsSnapshot = await transaction.get(activeApplicationsQuery);
    const activeCount = activeApplicationsSnapshot.docs.reduce((count, document) => {
      const status = String(document.get('status') ?? '');
      return isActiveCandidateFileStatus(status) ? count + 1 : count;
    }, 0);
    if (activeCount >= MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER) {
      throw new SevenoJobApplicationError(
        'active_candidate_limit_reached',
        409,
        'Finalisez une candidature en cours avant d engager un nouveau candidat.',
      );
    }

    const now = Timestamp.now();
    const stored = {
      id: applicationId,
      candidateUid: candidateProfile.uid,
      publicCandidateId: candidateProfile.publicCandidateId,
      companyUid: input.companyUid,
      companyPublicId: String(current.companyPublicId ?? ''),
      companyNameSnapshot: companyProfile.companyName.trim(),
      offerId: projection.offerId,
      offerVersion: projection.offerVersion,
      jobRoleId: projection.jobRoleId,
      origin: 'company' as JobApplicationOrigin,
      offerSnapshot: projection,
      status: 'invited' as ImplementedJobApplicationStatus,
      ...buildEmptyApplicationResults(snapshots),
      sevenoAssessmentSnapshot: assessmentFromCandidateRecord(candidateProfile),
      invitedAt: now,
      candidateDecisionAt: null,
      companyDecisionAt: null,
      conversationId: null,
      conversationStatus: null,
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      conversationLastMessageAt: null,
      conversationLastMessagePreview: null,
      conversationLastMessageAuthorRole: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      withdrawnAt: null,
      ...(message ? { companyInvitationMessage: message } : {}),
    };

    transaction.create(applicationRef, stored);
    transaction.set(offerCapacityLockRef, touchOfferCapacityLockPayload(input.companyUid, projection.offerId), { merge: true });
    transaction.set(guardRef, {
      offerId: projection.offerId,
      candidateUid: candidateProfile.uid,
      applicationId,
      active: true,
      updatedAt: now,
    });

    if (message) {
      transaction.create(applicationMessagesRef(applicationId).doc(), {
        applicationId,
        senderUid: input.companyUid,
        senderRole: 'company',
        body: message,
        createdAt: now,
      });
      transaction.update(applicationRef, {
        conversationLastMessageAt: now,
        conversationLastMessagePreview: buildConversationPreview(message),
        conversationLastMessageAuthorRole: 'company',
      });
    }

    return serializeApplication(applicationId, stored);
  });
}

export async function listCompanyApplications(
  companyUid: string,
  options: { limit?: number; cursor?: string; publicCandidateId?: string; offerId?: string } = {},
) {
  await assertVerifiedCompanyAccount(companyUid);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, options.limit ?? DEFAULT_PAGE_LIMIT));
  let query: Query = requireDatabase().collection(APPLICATIONS_COLLECTION)
    .where('companyUid', '==', companyUid);
  const offerId = cleanText(options.offerId, 100);
  if (offerId) {
    query = query.where('offerId', '==', offerId);
  }
  if (options.publicCandidateId) {
    query = query.where('publicCandidateId', '==', cleanText(options.publicCandidateId, 40));
  }
  query = query.orderBy('updatedAt', 'desc').orderBy('id', 'asc');
  const cursor = decodeCursor(options.cursor);
  if (cursor) {
    query = query.startAfter(Timestamp.fromMillis(cursor.timestamp), cursor.id);
  }
  const snapshot = await query.limit(limit + 1).get();
  const documents = snapshot.docs.slice(0, limit);
  const last = documents.at(-1);
  const updatedAt = last?.get('updatedAt');
  let prioritySelection: CompanyApplicationPrioritySelection | null = null;
  if (offerId) {
    const selectionSnapshot = await requireDatabase()
      .collection(APPLICATIONS_COLLECTION)
      .where('companyUid', '==', companyUid)
      .where('offerId', '==', offerId)
      .orderBy('updatedAt', 'desc')
      .orderBy('id', 'asc')
      .get();
    const allOfferApplications = selectionSnapshot.docs.map((item) => serializeApplication(item.id, item.data() as FirestoreRecord));
    prioritySelection = selectCompanyQuestionnairePriorityApplications(allOfferApplications);
  }
  return {
    applications: documents.map((item) => serializeApplication(item.id, item.data() as FirestoreRecord)),
    nextCursor: snapshot.docs.length > limit && updatedAt instanceof Timestamp
      ? encodeCursor({ timestamp: updatedAt.toMillis(), id: last?.id ?? '' })
      : null,
    prioritySelection,
  };
}

export async function respondToJobApplicationInvitation(
  candidateUid: string,
  applicationId: string,
  decision: 'accepted' | 'declined',
) {
  await loadCandidateContext(candidateUid, false);
  const firestore = requireDatabase();
  const ref = applicationRef(applicationId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.candidateUid !== candidateUid) {
      throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
    }
    const application = serializeApplication(snapshot.id, snapshot.data() as FirestoreRecord);
    const isProposal = application.status === 'contact_requested';
    const isInvitation = application.origin === 'company' && application.status === 'invited';
    const isOpenConversation = hasOpenJobApplicationConversation(application);

    if (!isProposal && !isInvitation && !isOpenConversation) {
      throw new SevenoJobApplicationError('invitation_unavailable', 409, 'Cette invitation ne peut plus etre repondue.');
    }

    const now = Timestamp.now();
    if (isOpenConversation) {
      if (decision === 'accepted') {
        return application;
      }

      throw new SevenoJobApplicationError('conversation_already_open', 409, 'La relation est deja ouverte.');
    }

    if (isProposal) {
      if (decision === 'accepted') {
        const conversationId = application.conversationId ?? ref.id;
        transaction.update(ref, {
          status: 'conversation_open',
          candidateDecisionAt: now,
          conversationId,
          conversationStatus: 'open',
          conversationUnreadCandidateCount: 0,
          conversationUnreadCompanyCount: 0,
          updatedAt: now,
        });
        return {
          ...application,
          status: 'conversation_open' as const,
          candidateDecisionAt: now.toDate().toISOString(),
          conversationId,
          conversationStatus: 'open' as const,
          conversationUnreadCandidateCount: 0,
          conversationUnreadCompanyCount: 0,
          updatedAt: now.toDate().toISOString(),
        };
      }

      transaction.update(ref, {
        status: 'candidate_declined',
        candidateDecisionAt: now,
        conversationId: null,
        conversationStatus: 'closed',
        conversationUnreadCandidateCount: 0,
        conversationUnreadCompanyCount: 0,
        withdrawnAt: now,
        updatedAt: now,
      });
      transaction.set(
        firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(application.offerId, candidateUid)),
        {
          offerId: application.offerId,
          candidateUid,
          applicationId: ref.id,
          active: false,
          updatedAt: now,
        },
      );
      return {
        ...application,
        status: 'candidate_declined' as const,
        candidateDecisionAt: now.toDate().toISOString(),
        conversationId: null,
        conversationStatus: 'closed' as const,
        conversationUnreadCandidateCount: 0,
        conversationUnreadCompanyCount: 0,
        withdrawnAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      };
    }

    if (decision === 'accepted') {
      transaction.update(ref, {
        status: 'prerequisites_in_progress',
        candidateDecisionAt: now,
        updatedAt: now,
      });
      return {
        ...application,
        status: 'prerequisites_in_progress' as const,
        candidateDecisionAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      };
    }

    transaction.update(ref, {
      status: 'candidate_declined',
      candidateDecisionAt: now,
      conversationStatus: 'closed',
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      withdrawnAt: now,
      updatedAt: now,
    });
    transaction.set(
      firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(application.offerId, candidateUid)),
      {
        offerId: application.offerId,
        candidateUid,
        applicationId: ref.id,
        active: false,
        updatedAt: now,
      },
    );
    return {
      ...application,
      status: 'candidate_declined' as const,
      candidateDecisionAt: now.toDate().toISOString(),
      conversationStatus: 'closed' as const,
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      withdrawnAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    };
  });
}

export async function reviewCompanyJobApplication(
  companyUid: string,
  applicationId: string,
  decision: 'interested' | 'declined',
) {
  await assertVerifiedCompanyAccount(companyUid);
  const firestore = requireDatabase();
  const ref = applicationRef(applicationId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.companyUid !== companyUid) {
      throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
    }

    const record = snapshot.data() as FirestoreRecord;
    const application = serializeApplication(snapshot.id, record);
    if (application.origin !== 'candidate' && application.origin !== 'company') {
      throw new SevenoJobApplicationError('invalid_application', 409, 'La relation est invalide.');
    }

    if (application.status === 'contact_requested') {
      if (decision === 'interested') {
        return application;
      }

      throw new SevenoJobApplicationError(
        'proposal_already_pending',
        409,
        'Une proposition de mise en relation est deja en attente.',
      );
    }

    if (hasOpenJobApplicationConversation(application)) {
      if (decision === 'interested') {
        return application;
      }

      throw new SevenoJobApplicationError(
        'conversation_already_open',
        409,
        'La conversation est deja ouverte.',
      );
    }

    if (!['submitted', 'questionnaire_pending', 'questionnaire_completed'].includes(application.status)) {
      throw new SevenoJobApplicationError('application_not_ready', 409, 'La relation doit etre soumise et completee avant revue.');
    }

    const offerSnapshot = await transaction.get(firestore.collection(OFFERS_COLLECTION).doc(application.offerId));
    const liveOffer = offerSnapshot.exists && offerSnapshot.data()?.companyUid === companyUid
      ? offerSnapshot.data() as FirestoreRecord
      : null;
    const questionnaireRequired = liveOffer?.questionnaireRequired === true
      || Boolean(liveOffer?.questionnaireId)
      || application.offerSnapshot.questionnaireRequired === true
      || Boolean(application.offerSnapshot.questionnaireId);
    if (questionnaireRequired && application.companyAssessment?.status !== 'completed') {
      throw new SevenoJobApplicationError('questionnaire_required', 409, 'Le questionnaire de l offre doit etre termine avant la revue.');
    }

    const now = Timestamp.now();
    if (decision === 'interested') {
      transaction.update(ref, {
        status: 'contact_requested',
        companyDecisionAt: now,
        conversationId: null,
        conversationStatus: 'closed',
        conversationUnreadCandidateCount: 0,
        conversationUnreadCompanyCount: 0,
        updatedAt: now,
      });
      return {
        ...application,
        status: 'contact_requested' as const,
        companyDecisionAt: now.toDate().toISOString(),
        conversationId: null,
        conversationStatus: 'closed' as const,
        conversationUnreadCandidateCount: 0,
        conversationUnreadCompanyCount: 0,
        updatedAt: now.toDate().toISOString(),
      };
    }

    transaction.update(ref, {
      status: 'company_declined',
      companyDecisionAt: now,
      conversationStatus: 'closed',
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      updatedAt: now,
    });
    transaction.set(
      firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(application.offerId, String(record.candidateUid ?? ''))),
      {
        offerId: application.offerId,
        candidateUid: String(record.candidateUid ?? ''),
        applicationId: ref.id,
        active: false,
        updatedAt: now,
      },
    );
    return {
      ...application,
      status: 'company_declined' as const,
      companyDecisionAt: now.toDate().toISOString(),
      conversationStatus: 'closed' as const,
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      updatedAt: now.toDate().toISOString(),
    };
  });
}

export async function getJobApplicationConversation(applicationId: string, participant: { uid: string; role: 'candidate' | 'company' | 'admin' }) {
  const snapshot = await loadApplicationSnapshot(applicationId);
  const record = snapshot.data() as FirestoreRecord;
  const application = serializeApplication(snapshot.id, record);
  if (participant.role !== 'admin') {
    if (participant.role === 'candidate' && String(record.candidateUid ?? '') !== participant.uid) {
      throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
    }
    if (participant.role === 'company' && String(record.companyUid ?? '') !== participant.uid) {
      throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
    }
  }

  if (!hasOpenJobApplicationConversation(application)) {
    return { application, messages: [] };
  }

  const messages = await loadConversationMessages(applicationId);
  return { application, messages };
}

export async function sendJobApplicationConversationMessage(
  applicationId: string,
  participant: { uid: string; role: 'candidate' | 'company' | 'admin' },
  body: string,
) {
  const firestore = requireDatabase();
  const ref = applicationRef(applicationId);
  const messageBody = normalizeConversationBody(body);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new SevenoJobApplicationError('application_not_found', 404, 'Candidature introuvable.');
    }
    const record = snapshot.data() as FirestoreRecord;
    const application = serializeApplication(snapshot.id, record);
    if (participant.role !== 'admin') {
      if (participant.role === 'candidate' && String(record.candidateUid ?? '') !== participant.uid) {
        throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
      }
      if (participant.role === 'company' && String(record.companyUid ?? '') !== participant.uid) {
        throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
      }
    }
    if (!hasOpenJobApplicationConversation(application)) {
      throw new SevenoJobApplicationError('conversation_closed', 409, 'La conversation n est pas ouverte.');
    }

    const senderRole: JobApplicationConversationAuthorRole = participant.role === 'company' ? 'company' : 'candidate';
    const now = Timestamp.now();
    const messageRef = applicationMessagesRef(applicationId).doc();
    transaction.create(messageRef, {
      applicationId,
      senderUid: participant.uid,
      senderRole,
      body: messageBody,
      createdAt: now,
    });
    transaction.update(ref, {
      conversationLastMessageAt: now,
      conversationLastMessagePreview: buildConversationPreview(messageBody),
      conversationLastMessageAuthorRole: senderRole,
      conversationUnreadCandidateCount: senderRole === 'candidate'
        ? 0
        : (typeof snapshot.data()?.conversationUnreadCandidateCount === 'number' ? snapshot.data()?.conversationUnreadCandidateCount : 0) + 1,
      conversationUnreadCompanyCount: senderRole === 'company'
        ? 0
        : (typeof snapshot.data()?.conversationUnreadCompanyCount === 'number' ? snapshot.data()?.conversationUnreadCompanyCount : 0) + 1,
      updatedAt: now,
    });
    return { application: serializeApplication(snapshot.id, {
      ...(snapshot.data() as FirestoreRecord),
      conversationLastMessageAt: now,
      conversationLastMessagePreview: buildConversationPreview(messageBody),
      conversationLastMessageAuthorRole: senderRole,
      conversationUnreadCandidateCount: senderRole === 'candidate'
        ? 0
        : (typeof snapshot.data()?.conversationUnreadCandidateCount === 'number' ? snapshot.data()?.conversationUnreadCandidateCount : 0) + 1,
      conversationUnreadCompanyCount: senderRole === 'company'
        ? 0
        : (typeof snapshot.data()?.conversationUnreadCompanyCount === 'number' ? snapshot.data()?.conversationUnreadCompanyCount : 0) + 1,
      updatedAt: now,
    }) };
  });
}

export async function markJobApplicationConversationRead(
  applicationId: string,
  participant: { uid: string; role: 'candidate' | 'company' | 'admin' },
) {
  const firestore = requireDatabase();
  const ref = applicationRef(applicationId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new SevenoJobApplicationError('application_not_found', 404, 'Candidature introuvable.');
    }
    const record = snapshot.data() as FirestoreRecord;
    if (participant.role !== 'admin') {
      if (participant.role === 'candidate' && String(record.candidateUid ?? '') !== participant.uid) {
        throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
      }
      if (participant.role === 'company' && String(record.companyUid ?? '') !== participant.uid) {
        throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette relation ne vous appartient pas.');
      }
    }

    if (!hasOpenJobApplicationConversation(serializeApplication(snapshot.id, record))) {
      throw new SevenoJobApplicationError('conversation_closed', 409, 'La conversation n est pas ouverte.');
    }

    const now = Timestamp.now();
    const patch: Record<string, unknown> = {
      updatedAt: now,
    };
    if (participant.role === 'admin') {
      patch.conversationUnreadCandidateCount = 0;
      patch.conversationUnreadCompanyCount = 0;
    } else if (participant.role === 'company') {
      patch.conversationUnreadCompanyCount = 0;
    } else {
      patch.conversationUnreadCandidateCount = 0;
    }
    transaction.update(ref, patch);
    return { application: serializeApplication(snapshot.id, { ...(snapshot.data() as FirestoreRecord), ...patch }) };
  });
}

function normalizeAnswerInputs(raw: unknown): PrerequisiteAnswerInput[] {
  if (!Array.isArray(raw) || raw.length > 100) {
    throw new SevenoJobApplicationError('invalid_answers', 400, 'Les reponses envoyees sont invalides.');
  }
  const answers = raw.map((item) => {
    if (!isPlainObject(item)) throw new SevenoJobApplicationError('invalid_answers', 400, 'Une reponse est invalide.');
    const answerValue = item.answerValue === null
      || typeof item.answerValue === 'string'
      || typeof item.answerValue === 'boolean'
      || (typeof item.answerValue === 'number' && Number.isFinite(item.answerValue))
      || (Array.isArray(item.answerValue) && item.answerValue.every((value) => typeof value === 'string'))
      ? item.answerValue as PrerequisiteAnswerValue
      : null;
    return {
      prerequisiteCode: cleanText(item.prerequisiteCode, 100),
      answerValue: cloneValue(answerValue),
      confirmed: item.confirmed === true,
    };
  });
  if (answers.some((item) => !item.prerequisiteCode) || new Set(answers.map((item) => item.prerequisiteCode)).size !== answers.length) {
    throw new SevenoJobApplicationError('invalid_answers', 400, 'Les reponses contiennent un code absent ou duplique.');
  }
  return answers;
}

async function loadOwnedApplication(uid: string, applicationId: string) {
  const ref = requireDatabase().collection(APPLICATIONS_COLLECTION).doc(cleanText(applicationId, 100));
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new SevenoJobApplicationError('application_not_found', 404, 'Candidature introuvable.');
  if (snapshot.data()?.candidateUid !== uid) throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
  return { ref, snapshot, application: serializeApplication(snapshot.id, snapshot.data() as FirestoreRecord) };
}

export async function savePrerequisiteAnswers(uid: string, applicationId: string, rawAnswers: unknown) {
  await loadCandidateContext(uid);
  const inputs = normalizeAnswerInputs(rawAnswers);
  const firestore = requireDatabase();
  const ref = firestore.collection(APPLICATIONS_COLLECTION).doc(cleanText(applicationId, 100));
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.candidateUid !== uid) {
      throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
    }
    if (['submitted', 'withdrawn', 'candidate_declined', 'company_declined', 'candidate_withdrawn', 'offer_unavailable', 'closed'].includes(String(snapshot.data()?.status ?? ''))) {
      throw new SevenoJobApplicationError('application_locked', 409, 'Les reponses de cette candidature sont figees.');
    }
    const application = serializeApplication(snapshot.id, snapshot.data() as FirestoreRecord);
    if (application.status === 'invited') {
      throw new SevenoJobApplicationError('invitation_pending', 409, 'Acceptez d abord la proposition avant de modifier les reponses.');
    }
    const offerSnapshots = [...application.offerSnapshot.requiredPrerequisites, ...application.offerSnapshot.preferredPrerequisites];
    const snapshotsByCode = new Map(offerSnapshots.map((item) => [item.prerequisiteCode, item]));
    if (inputs.some((item) => !snapshotsByCode.has(item.prerequisiteCode))) {
      throw new SevenoJobApplicationError('unknown_prerequisite', 400, 'Une reponse ne correspond pas a cette offre.');
    }
    const answerRefs = offerSnapshots.map((item) => ref.collection('prerequisite_answers').doc(item.prerequisiteCode));
    const answerDocs = await Promise.all(answerRefs.map((answerRef) => transaction.get(answerRef)));
    const existingByCode = new Map(answerDocs.filter((item) => item.exists).map((item) => [item.id, item.data() as FirestoreRecord]));
    const inputsByCode = new Map(inputs.map((item) => [item.prerequisiteCode, item]));
    const resultAnswers = new Map<string, JobApplicationPrerequisiteAnswer>();
    const now = Timestamp.now();
    for (const offerSnapshot of offerSnapshots) {
      const existing = existingByCode.get(offerSnapshot.prerequisiteCode);
      const input = inputsByCode.get(offerSnapshot.prerequisiteCode);
      const answerValue = validateAnswerValue(
        offerSnapshot,
        input ? input.answerValue : existing?.answerValue as PrerequisiteAnswerValue ?? null,
      );
      const confirmed = input ? input.confirmed : existing?.confirmed === true;
      const source = input && JSON.stringify(input.answerValue) !== JSON.stringify(existing?.answerValue)
        ? 'application'
        : existing?.source === 'reusable_profile' ? 'reusable_profile' : 'application';
      const result = evaluatePrerequisiteAnswer(offerSnapshot, answerValue, confirmed);
      const storedAnswer: JobApplicationPrerequisiteAnswer = {
        prerequisiteId: offerSnapshot.prerequisiteId,
        prerequisiteCode: offerSnapshot.prerequisiteCode,
        prerequisiteVersion: offerSnapshot.prerequisiteVersion,
        importance: offerSnapshot.importance,
        answerType: offerSnapshot.answerType,
        answerValue,
        answeredAt: answerValue === null ? null : now,
        source,
        confirmed,
        result,
      };
      resultAnswers.set(offerSnapshot.prerequisiteCode, storedAnswer);
      transaction.set(ref.collection('prerequisite_answers').doc(offerSnapshot.prerequisiteCode), storedAnswer);
    }
    const results = calculatePrerequisiteResults(offerSnapshots, resultAnswers);
    const status = applicationStatusFromResults(results.requiredResult);
    transaction.update(ref, { ...results, status, updatedAt: now });
    return { application: { ...application, ...results, status, updatedAt: now.toDate().toISOString() } };
  });
}

export async function getCandidateApplication(uid: string, applicationId: string) {
  await loadCandidateContext(uid, false);
  const { ref, application } = await loadOwnedApplication(uid, applicationId);
  const answersSnapshot = await ref.collection('prerequisite_answers').get();
  return {
    application: {
      ...application,
      answers: answersSnapshot.docs.map((item) => serializeAnswer(item.data() as FirestoreRecord)),
    },
  };
}

export async function listCandidateApplications(uid: string, options: { limit?: number; cursor?: string } = {}) {
  await loadCandidateContext(uid, false);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, options.limit ?? DEFAULT_PAGE_LIMIT));
  let query: Query = requireDatabase().collection(APPLICATIONS_COLLECTION)
    .where('candidateUid', '==', uid)
    .orderBy('updatedAt', 'desc')
    .orderBy('id', 'asc');
  const cursor = decodeCursor(options.cursor);
  if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.timestamp), cursor.id);
  const snapshot = await query.limit(limit + 1).get();
  const documents = snapshot.docs.slice(0, limit);
  const last = documents.at(-1);
  const updatedAt = last?.get('updatedAt');
  return {
    applications: documents.map((item) => serializeApplication(item.id, item.data() as FirestoreRecord)),
    nextCursor: snapshot.docs.length > limit && updatedAt instanceof Timestamp
      ? encodeCursor({ timestamp: updatedAt.toMillis(), id: last?.id ?? '' })
      : null,
  };
}

export async function submitJobApplication(uid: string, applicationId: string) {
  const context = await loadCandidateContext(uid);
  const firestore = requireDatabase();
  const ref = firestore.collection(APPLICATIONS_COLLECTION).doc(cleanText(applicationId, 100));
  const submittedApplication = await firestore.runTransaction(async (transaction) => {
    const applicationSnapshot = await transaction.get(ref);
    if (!applicationSnapshot.exists || applicationSnapshot.data()?.candidateUid !== uid) {
      throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
    }
    const application = serializeApplication(ref.id, applicationSnapshot.data() as FirestoreRecord);
    if (application.status === 'submitted') return application;
    if (['withdrawn', 'candidate_withdrawn', 'candidate_declined', 'company_declined', 'offer_unavailable', 'closed'].includes(application.status)) {
      throw new SevenoJobApplicationError('application_withdrawn', 409, 'Cette candidature a ete retiree.');
    }
    if (application.status === 'invited') {
      throw new SevenoJobApplicationError('invitation_pending', 409, 'Acceptez d abord la proposition avant de soumettre la candidature.');
    }
    const offerRef = firestore.collection(OFFERS_COLLECTION).doc(application.offerId);
    const offerSnapshot = await transaction.get(offerRef);
    const companyUid = cleanText(applicationSnapshot.data()?.companyUid, 100);
    if (
      !companyUid
      || !offerSnapshot.exists
      || offerSnapshot.data()?.companyUid !== companyUid
      || offerSnapshot.data()?.status !== 'published'
      || offerSnapshot.data()?.version !== application.offerVersion
    ) {
      throw new SevenoJobApplicationError('offer_version_changed', 409, 'L offre a change. Recommencez la candidature sur sa version actuelle.');
    }
    const versionSnapshot = await transaction.get(offerRef.collection('versions').doc(String(application.offerVersion)));
    if (!versionSnapshot.exists) throw new SevenoJobApplicationError('published_version_missing', 409, 'La version publiee est indisponible.');
    const offerSnapshots = [...application.offerSnapshot.requiredPrerequisites, ...application.offerSnapshot.preferredPrerequisites];
    const answerRefs = offerSnapshots.map((item) => ref.collection('prerequisite_answers').doc(item.prerequisiteCode));
    const answerDocs = await Promise.all(answerRefs.map((answerRef) => transaction.get(answerRef)));
    const answers = new Map(answerDocs.filter((item) => item.exists).map((item) => [item.id, item.data() as JobApplicationPrerequisiteAnswer]));
    const results = calculatePrerequisiteResults(offerSnapshots, answers);
    if (!results.requiredResult.allSatisfied) {
      throw new SevenoJobApplicationError('required_prerequisites_not_satisfied', 409, 'Tous les prerequis obligatoires doivent etre satisfaits.');
    }
    const now = Timestamp.now();
    await prepareApplicationSubmittedNotificationEvent(transaction, firestore, {
      applicationId: ref.id,
      offerId: application.offerId,
      companyUid,
      now,
    });
    transaction.update(ref, {
      ...results,
      status: 'submitted',
      sevenoAssessmentSnapshot: context.assessment,
      submittedAt: now,
      updatedAt: now,
    });
    for (const snapshot of offerSnapshots.filter((item) => item.responseScope === 'profile_reusable')) {
      const answer = answers.get(snapshot.prerequisiteCode);
      if (!answer || answer.answerValue === null || !answer.confirmed) continue;
      const expiresAt = snapshot.freshnessDays
        ? Timestamp.fromMillis(now.toMillis() + snapshot.freshnessDays * 24 * 60 * 60 * 1000)
        : null;
      transaction.set(
        firestore.collection(REUSABLE_COLLECTION).doc(uid).collection('answers').doc(snapshot.prerequisiteCode),
        {
          candidateUid: uid,
          prerequisiteId: snapshot.prerequisiteId,
          prerequisiteCode: snapshot.prerequisiteCode,
          prerequisiteVersion: snapshot.prerequisiteVersion,
          answerType: snapshot.answerType,
          answerValue: answer.answerValue,
          answeredAt: now,
          freshnessExpiresAt: expiresAt,
          updatedAt: now,
        },
      );
    }
    return {
      ...application,
      ...results,
      status: 'submitted' as const,
      sevenoAssessmentSnapshot: { ...context.assessment, completedAt: timestampToIso(context.assessment.completedAt) },
      submittedAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    };
  });

  const notificationEventId = buildApplicationSubmittedNotificationEventId(ref.id);
  try {
    await dispatchCompanyNotificationEvent(notificationEventId);
  } catch (error) {
    console.error('[SevenO company notifications] Immediate delivery deferred', {
      eventId: notificationEventId,
      code: error instanceof Error && 'code' in error ? String((error as { code?: unknown }).code ?? 'unknown') : 'unknown',
    });
  }

  return submittedApplication;
}

export async function withdrawJobApplication(uid: string, applicationId: string) {
  await loadCandidateContext(uid, false);
  const firestore = requireDatabase();
  const ref = firestore.collection(APPLICATIONS_COLLECTION).doc(cleanText(applicationId, 100));
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.candidateUid !== uid) {
      throw new SevenoJobApplicationError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
    }
    const application = serializeApplication(ref.id, snapshot.data() as FirestoreRecord);
    if (application.status === 'withdrawn' || application.status === 'candidate_withdrawn') return application;
    if (application.status === 'invited' || application.status === 'candidate_declined' || application.status === 'company_declined') {
      throw new SevenoJobApplicationError('withdrawal_not_allowed', 409, 'Cette relation ne peut plus etre retiree.');
    }
    if (!['draft', 'prerequisites_in_progress', 'eligible', 'ineligible', 'submitted', 'questionnaire_pending', 'questionnaire_completed'].includes(application.status)) {
      throw new SevenoJobApplicationError('withdrawal_not_allowed', 409, 'Cette relation ne peut plus etre retiree.');
    }
    const now = Timestamp.now();
    const nextStatus: 'candidate_withdrawn' | 'withdrawn' = application.origin === 'company'
      ? 'candidate_withdrawn'
      : 'withdrawn';
    transaction.update(ref, {
      status: nextStatus,
      withdrawnAt: now,
      conversationStatus: 'closed',
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      updatedAt: now,
    });
    transaction.set(
      firestore.collection(GUARDS_COLLECTION).doc(buildJobApplicationGuardId(application.offerId, uid)),
      { offerId: application.offerId, candidateUid: uid, applicationId: ref.id, active: false, updatedAt: now },
    );
    return {
      ...application,
      status: nextStatus,
      withdrawnAt: now.toDate().toISOString(),
      conversationStatus: 'closed' as const,
      conversationUnreadCandidateCount: 0,
      conversationUnreadCompanyCount: 0,
      updatedAt: now.toDate().toISOString(),
    };
  });
}
