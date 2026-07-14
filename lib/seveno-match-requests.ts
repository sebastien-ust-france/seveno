import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import type {
  AuthProvider,
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidateProfileStatus,
  CompanyProfileStatus,
  CompanySize,
  CompanyVerificationStatus,
  MatchRequestContractType,
  MatchRequestStatus,
  MatchRequestContactInfo,
  SerializedCandidateMatchRequest,
  SerializedMatchRequest,
  UserRole,
} from '@/types/seveno';

const MATCH_REQUESTS_COLLECTION = 'match_requests';
const USERS_COLLECTION = 'users';
const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
const COMPANY_PROFILES_COLLECTION = 'company_profiles';
const ADMIN_LOGS_COLLECTION = 'admin_logs';
const MATCH_REQUEST_GUARDS_COLLECTION = 'match_request_guards';
const MATCH_REQUEST_EXPIRY_DAYS = 14;
const MATCH_REQUEST_EXPIRY_MS = MATCH_REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const MATCH_REQUEST_MESSAGE_LIMIT = 500;
const MATCH_REQUEST_TEXT_LIMIT = 120;
const PUBLIC_CANDIDATE_ID_PATTERN = /^SEV-CAND-[A-Z2-9]{6}$/;
const ACTIVE_MATCH_REQUEST_STATUSES: MatchRequestStatus[] = ['pending_candidate', 'accepted'];
const MATCH_REQUEST_CONTRACT_TYPES: MatchRequestContractType[] = [
  'permanent',
  'fixed_term',
  'temporary',
  'freelance',
  'apprenticeship',
  'internship',
  'other',
];

type FirestoreRecord = Record<string, unknown>;

interface SevenoUserRecord {
  uid: string;
  role: UserRole | null;
  authProvider: AuthProvider;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  onboardingCompleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CandidateProfileRecord {
  uid: string;
  publicCandidateId: string;
  role: 'candidate';
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  availability: CandidateAvailability;
  locationArea: string;
  experienceLevel: CandidateExperienceLevel;
  verifiedScore: number | null;
  testPassed: boolean;
  lastTestAt: Timestamp | null;
  verifiedTestResultId: string | null;
  verifiedTestSessionId: string | null;
  verifiedJobRoleId: string | null;
  verifiedQuestionBankCode: string | null;
  verifiedQuestionBankVersion: string | null;
  profileStatus: CandidateProfileStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CompanyProfileRecord {
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface MatchRequestRecord {
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
  candidateDecisionAt: Timestamp | null;
  acceptedAt: Timestamp | null;
  refusedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  expiresAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface MatchRequestParticipantContext {
  uid: string;
  role: 'company' | 'candidate' | 'admin';
}

export class SevenoMatchRequestError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function requireAdminDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoMatchRequestError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour gerer les mises en relation SevenO.',
    );
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function timestampToIso(value: Timestamp | null | undefined) {
  return value ? value.toDate().toISOString() : null;
}

function isMatchRequestStatus(value: unknown): value is MatchRequestStatus {
  return typeof value === 'string' && ['pending_candidate', 'accepted', 'refused', 'cancelled', 'expired'].includes(value);
}

function isContractType(value: unknown): value is MatchRequestContractType {
  return typeof value === 'string' && MATCH_REQUEST_CONTRACT_TYPES.includes(value as MatchRequestContractType);
}

function matchRequestRef(id: string) {
  return requireAdminDatabase().collection(MATCH_REQUESTS_COLLECTION).doc(id);
}

function companyProfileRef(uid: string) {
  return requireAdminDatabase().collection(COMPANY_PROFILES_COLLECTION).doc(uid);
}

function adminLogRef() {
  return requireAdminDatabase().collection(ADMIN_LOGS_COLLECTION).doc();
}

function normalizeSevenoUser(data: unknown): SevenoUserRecord | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const uid = cleanText(data.uid);
  const role = data.role === null || data.role === 'candidate' || data.role === 'company' || data.role === 'admin' ? data.role : null;
  const authProvider = data.authProvider === 'google' || data.authProvider === 'password'
    ? data.authProvider
    : null;
  const email = cleanText(data.email);
  const emailVerified = data.emailVerified === true
    || (authProvider === 'google' && data.emailVerified !== false);
  const onboardingCompleted = data.onboardingCompleted === true;
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = data.updatedAt == null ? null : toTimestamp(data.updatedAt);

  if (!uid || !authProvider || !email || !createdAt) {
    return null;
  }

  return {
    uid,
    role,
    authProvider,
    email,
    emailVerified,
    ...(cleanText(data.displayName) ? { displayName: cleanText(data.displayName) } : {}),
    ...(cleanText(data.photoURL) ? { photoURL: cleanText(data.photoURL) } : {}),
    ...(cleanText(data.firstName) ? { firstName: cleanText(data.firstName) } : {}),
    ...(cleanText(data.lastName) ? { lastName: cleanText(data.lastName) } : {}),
    ...(cleanText(data.phone) ? { phone: cleanText(data.phone) } : {}),
    onboardingCompleted,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
  };
}

function normalizeCandidateProfile(data: unknown): CandidateProfileRecord | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const uid = cleanText(data.uid);
  const publicCandidateId = cleanText(data.publicCandidateId);
  const role = data.role === 'candidate' ? 'candidate' : null;
  const sectorId = cleanText(data.sectorId);
  const jobFamilyId = cleanText(data.jobFamilyId);
  const jobRoleId = cleanText(data.jobRoleId);
  const availability = typeof data.availability === 'string' ? data.availability : null;
  const locationArea = cleanText(data.locationArea);
  const experienceLevel = typeof data.experienceLevel === 'string' ? data.experienceLevel : null;
  const verifiedScore = typeof data.verifiedScore === 'number' && Number.isFinite(data.verifiedScore) ? data.verifiedScore : null;
  const testPassed = data.testPassed === true;
  const lastTestAt = data.lastTestAt === null ? null : toTimestamp(data.lastTestAt);
  const verifiedTestResultId = cleanText(data.verifiedTestResultId) ?? null;
  const verifiedTestSessionId = cleanText(data.verifiedTestSessionId) ?? null;
  const verifiedJobRoleId = cleanText(data.verifiedJobRoleId) ?? null;
  const verifiedQuestionBankCode = cleanText(data.verifiedQuestionBankCode) ?? null;
  const verifiedQuestionBankVersion = cleanText(data.verifiedQuestionBankVersion) ?? null;
  const profileStatus = typeof data.profileStatus === 'string' ? data.profileStatus : null;
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);

  if (
    !uid ||
    !publicCandidateId ||
    !role ||
    !sectorId ||
    !jobFamilyId ||
    !jobRoleId ||
    !availability ||
    !locationArea ||
    !experienceLevel ||
    !profileStatus ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    uid,
    publicCandidateId,
    role,
    sectorId,
    jobFamilyId,
    jobRoleId,
    availability: availability as CandidateAvailability,
    locationArea,
    experienceLevel: experienceLevel as CandidateExperienceLevel,
    verifiedScore,
    testPassed,
    lastTestAt,
    verifiedTestResultId,
    verifiedTestSessionId,
    verifiedJobRoleId,
    verifiedQuestionBankCode,
    verifiedQuestionBankVersion,
    profileStatus: profileStatus as CandidateProfileStatus,
    createdAt,
    updatedAt,
  };
}

function normalizeCompanyProfile(data: unknown): CompanyProfileRecord | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const uid = cleanText(data.uid);
  const companyName = cleanText(data.companyName);
  const companyType = cleanText(data.companyType);
  const businessSector = cleanText(data.businessSector);
  const companySize = typeof data.companySize === 'string' ? data.companySize : null;
  const headquartersArea = cleanText(data.headquartersArea);
  const recruitmentAreas = Array.isArray(data.recruitmentAreas)
    ? data.recruitmentAreas.map((item) => cleanText(item)).filter((item): item is string => Boolean(item))
    : [];
  const contactRole = cleanText(data.contactRole);
  const profileStatus = typeof data.profileStatus === 'string' ? data.profileStatus : null;
  const verificationStatus = typeof data.verificationStatus === 'string' ? data.verificationStatus : null;
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);

  if (
    !uid ||
    !companyName ||
    !companyType ||
    !businessSector ||
    !companySize ||
    !headquartersArea ||
    recruitmentAreas.length === 0 ||
    !contactRole ||
    !profileStatus ||
    !verificationStatus ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    uid,
    companyName,
    ...(cleanText(data.legalName) ? { legalName: cleanText(data.legalName) } : {}),
    companyType,
    ...(cleanText(data.siret) ? { siret: cleanText(data.siret) } : {}),
    ...(cleanText(data.website) ? { website: cleanText(data.website) } : {}),
    businessSector,
    companySize: companySize as CompanySize,
    headquartersArea,
    recruitmentAreas,
    contactRole,
    profileStatus: profileStatus as CompanyProfileStatus,
    verificationStatus: verificationStatus as CompanyVerificationStatus,
    createdAt,
    updatedAt,
  };
}

function normalizeMatchRequestRecord(docId: string, data: unknown): MatchRequestRecord | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const id = cleanText(data.id) ?? docId;
  const companyUid = cleanText(data.companyUid);
  const candidateUid = cleanText(data.candidateUid);
  const companyNameSnapshot = cleanText(data.companyNameSnapshot);
  const publicCandidateId = cleanText(data.publicCandidateId);
  const jobRoleId = cleanText(data.jobRoleId);
  const sectorId = cleanText(data.sectorId);
  const jobFamilyId = cleanText(data.jobFamilyId);
  const message = cleanText(data.message);
  const proposedJobTitle = cleanText(data.proposedJobTitle);
  const proposedLocation = cleanText(data.proposedLocation);
  const contractType = isContractType(data.contractType) ? data.contractType : undefined;
  const status = isMatchRequestStatus(data.status) ? data.status : null;
  const candidateDecisionAt = data.candidateDecisionAt == null ? null : toTimestamp(data.candidateDecisionAt);
  const acceptedAt = data.acceptedAt == null ? null : toTimestamp(data.acceptedAt);
  const refusedAt = data.refusedAt == null ? null : toTimestamp(data.refusedAt);
  const cancelledAt = data.cancelledAt == null ? null : toTimestamp(data.cancelledAt);
  const expiresAt = data.expiresAt == null ? null : toTimestamp(data.expiresAt);
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);

  if (
    !id ||
    !companyUid ||
    !candidateUid ||
    !companyNameSnapshot ||
    !publicCandidateId ||
    !jobRoleId ||
    !sectorId ||
    !jobFamilyId ||
    !status ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    id,
    companyUid,
    candidateUid,
    companyNameSnapshot,
    publicCandidateId,
    jobRoleId,
    sectorId,
    jobFamilyId,
    ...(message ? { message } : {}),
    ...(proposedJobTitle ? { proposedJobTitle } : {}),
    ...(proposedLocation ? { proposedLocation } : {}),
    ...(contractType ? { contractType } : {}),
    status,
    candidateDecisionAt,
    acceptedAt,
    refusedAt,
    cancelledAt,
    expiresAt,
    createdAt,
    updatedAt,
  };
}

function serializeMatchRequest(record: MatchRequestRecord): SerializedMatchRequest {
  return {
    id: record.id,
    companyNameSnapshot: record.companyNameSnapshot,
    publicCandidateId: record.publicCandidateId,
    jobRoleId: record.jobRoleId,
    sectorId: record.sectorId,
    jobFamilyId: record.jobFamilyId,
    ...(record.message ? { message: record.message } : {}),
    ...(record.proposedJobTitle ? { proposedJobTitle: record.proposedJobTitle } : {}),
    ...(record.proposedLocation ? { proposedLocation: record.proposedLocation } : {}),
    ...(record.contractType ? { contractType: record.contractType } : {}),
    status: record.status,
    candidateDecisionAt: timestampToIso(record.candidateDecisionAt),
    acceptedAt: timestampToIso(record.acceptedAt),
    refusedAt: timestampToIso(record.refusedAt),
    cancelledAt: timestampToIso(record.cancelledAt),
    expiresAt: timestampToIso(record.expiresAt),
    createdAt: record.createdAt.toDate().toISOString(),
    updatedAt: record.updatedAt.toDate().toISOString(),
  };
}

function serializeCandidateMatchRequest(record: MatchRequestRecord, companyBusinessSector: string): SerializedCandidateMatchRequest {
  return {
    ...serializeMatchRequest(record),
    companyBusinessSector,
  };
}

function isActiveStatus(status: MatchRequestStatus) {
  return ACTIVE_MATCH_REQUEST_STATUSES.includes(status);
}

function isPendingCandidateStatus(status: MatchRequestStatus) {
  return status === 'pending_candidate';
}

function isExpired(record: MatchRequestRecord) {
  if (!record.expiresAt || !isPendingCandidateStatus(record.status)) {
    return false;
  }

  return record.expiresAt.toMillis() <= Timestamp.now().toMillis();
}

export async function getSevenoUserByUid(uid: string) {
  const snapshot = await requireAdminDatabase().collection(USERS_COLLECTION).doc(uid).get();
  const user = snapshot.exists ? normalizeSevenoUser(snapshot.data()) : null;
  return user?.uid === uid ? user : null;
}

async function loadCandidateProfileByPublicCandidateId(publicCandidateId: string) {
  const snapshot = await requireAdminDatabase()
    .collection(CANDIDATE_PROFILES_COLLECTION)
    .where('publicCandidateId', '==', publicCandidateId)
    .limit(2)
    .get();

  const candidates = snapshot.docs
    .map((doc) => {
      const profile = normalizeCandidateProfile(doc.data());
      return profile && profile.uid === doc.id ? profile : null;
    })
    .filter((item): item is CandidateProfileRecord => Boolean(item));

  if (candidates.length > 1) {
    throw new SevenoMatchRequestError(
      'duplicate_public_candidate_id',
      409,
      'Plusieurs profils utilisent le meme identifiant public.',
    );
  }

  return candidates[0] ?? null;
}

async function loadCompanyProfileByUid(uid: string) {
  const snapshot = await companyProfileRef(uid).get();
  const profile = snapshot.exists ? normalizeCompanyProfile(snapshot.data()) : null;
  return profile?.uid === uid ? profile : null;
}

async function loadMatchRequestById(id: string) {
  const snapshot = await matchRequestRef(id).get();
  return snapshot.exists ? normalizeMatchRequestRecord(snapshot.id, snapshot.data()) : null;
}

async function loadCompanyMatchRequestRecords(companyUid: string) {
  const snapshot = await requireAdminDatabase()
    .collection(MATCH_REQUESTS_COLLECTION)
    .where('companyUid', '==', companyUid)
    .get();

  return snapshot.docs
    .map((doc) => normalizeMatchRequestRecord(doc.id, doc.data()))
    .filter((item): item is MatchRequestRecord => Boolean(item));
}

async function loadCandidateMatchRequestRecords(candidateUid: string) {
  const snapshot = await requireAdminDatabase()
    .collection(MATCH_REQUESTS_COLLECTION)
    .where('candidateUid', '==', candidateUid)
    .get();

  return snapshot.docs
    .map((doc) => normalizeMatchRequestRecord(doc.id, doc.data()))
    .filter((item): item is MatchRequestRecord => Boolean(item));
}

async function expirePendingRequestIfNeeded(record: MatchRequestRecord): Promise<MatchRequestRecord> {
  if (!isExpired(record)) {
    return record;
  }

  const now = Timestamp.now();
  const ref = matchRequestRef(record.id);
  await ref.update({
    status: 'expired',
    updatedAt: now,
  });

  const expiredRecord: MatchRequestRecord = {
    ...record,
    status: 'expired',
    updatedAt: now,
  };

  return expiredRecord;
}

async function writeAdminLog(
  action: string,
  actor: MatchRequestParticipantContext,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await adminLogRef().set({
    actorUserId: actor.uid,
    actorRole: actor.role,
    action,
    targetCollection: MATCH_REQUESTS_COLLECTION,
    targetId,
    ...(metadata ? { metadata } : {}),
    createdAt: Timestamp.now(),
  });
}

function ensureNoPrivateInput(value: string | undefined, label: string, maxLength: number) {
  if (value === undefined) {
    return undefined;
  }

  const cleaned = value.trim();
  if (cleaned.length === 0) {
    return undefined;
  }

  if (cleaned.length > maxLength) {
    throw new SevenoMatchRequestError('invalid_payload', 400, `Le champ ${label} contient trop de caracteres.`);
  }

  return cleaned;
}

function assertActiveCompanyProfile(profile: CompanyProfileRecord | null): asserts profile is CompanyProfileRecord {
  if (!profile) {
    throw new SevenoMatchRequestError('company_profile_missing', 404, 'Profil entreprise introuvable.');
  }

  if (profile.profileStatus !== 'active') {
    throw new SevenoMatchRequestError('company_profile_inactive', 409, 'Le profil entreprise doit etre actif pour creer une demande.');
  }

  if (
    profile.companyName.trim().length === 0
    || profile.companyType.trim().length === 0
    || profile.businessSector.trim().length === 0
    || profile.headquartersArea.trim().length === 0
    || profile.contactRole.trim().length === 0
    || profile.recruitmentAreas.length === 0
  ) {
    throw new SevenoMatchRequestError('company_profile_incomplete', 409, 'Le profil entreprise est incomplet.');
  }
}

async function assertVerifiedCompanyAccount(companyUid: string) {
  const companyUser = await getSevenoUserByUid(companyUid);
  if (!companyUser || companyUser.role !== 'company') {
    throw new SevenoMatchRequestError('forbidden_role', 403, 'Compte entreprise introuvable.');
  }

  if (!companyUser.emailVerified) {
    throw new SevenoMatchRequestError(
      'email_not_verified',
      403,
      'Verifiez votre adresse email pour utiliser les fonctionnalites entreprise.',
    );
  }
}

function assertVisibleCandidateProfile(profile: CandidateProfileRecord | null): asserts profile is CandidateProfileRecord {
  if (!profile) {
    throw new SevenoMatchRequestError('candidate_profile_missing', 404, 'Profil candidat introuvable.');
  }

  if (profile.profileStatus !== 'active') {
    throw new SevenoMatchRequestError('candidate_profile_inactive', 409, 'Le profil candidat doit etre actif.');
  }

}

function buildActiveRequestConflictError() {
  return new SevenoMatchRequestError(
    'match_request_exists',
    409,
    'Une demande de mise en relation active existe deja pour ce candidat.',
  );
}

function matchRequestGuardRef(companyUid: string, candidateUid: string) {
  const guardId = createHash('sha256').update(`${companyUid}\0${candidateUid}`).digest('hex');
  return requireAdminDatabase().collection(MATCH_REQUEST_GUARDS_COLLECTION).doc(guardId);
}

export async function assertCompanyCanAccessCandidateProfiles(companyUid: string) {
  await assertVerifiedCompanyAccount(companyUid);
  const companyProfile = await loadCompanyProfileByUid(companyUid);
  assertActiveCompanyProfile(companyProfile);
}

function ensureMatchRequestParticipant(record: MatchRequestRecord, actor: MatchRequestParticipantContext) {
  if (actor.role === 'admin') {
    return;
  }

  if (record.companyUid !== actor.uid && record.candidateUid !== actor.uid) {
    throw new SevenoMatchRequestError('forbidden_request', 403, 'Cette demande ne vous appartient pas.');
  }
}

function buildMatchRequestCreatePayload(
  id: string,
  companyUid: string,
  candidateProfile: CandidateProfileRecord,
  companyProfile: CompanyProfileRecord,
  input: {
    proposedJobTitle?: string;
    proposedLocation?: string;
    contractType?: MatchRequestContractType;
    message?: string;
  },
): MatchRequestRecord {
  const now = Timestamp.now();

  return {
    id,
    companyUid,
    candidateUid: candidateProfile.uid,
    companyNameSnapshot: companyProfile.companyName.trim(),
    publicCandidateId: candidateProfile.publicCandidateId,
    jobRoleId: candidateProfile.jobRoleId,
    sectorId: candidateProfile.sectorId,
    jobFamilyId: candidateProfile.jobFamilyId,
    ...(input.message ? { message: input.message } : {}),
    ...(input.proposedJobTitle ? { proposedJobTitle: input.proposedJobTitle } : {}),
    ...(input.proposedLocation ? { proposedLocation: input.proposedLocation } : {}),
    ...(input.contractType ? { contractType: input.contractType } : {}),
    status: 'pending_candidate',
    candidateDecisionAt: null,
    acceptedAt: null,
    refusedAt: null,
    cancelledAt: null,
    expiresAt: Timestamp.fromMillis(now.toMillis() + MATCH_REQUEST_EXPIRY_MS),
    createdAt: now,
    updatedAt: now,
  };
}

export function isMatchRequestActiveStatus(status: MatchRequestStatus) {
  return isActiveStatus(status);
}

export function getMatchRequestContractTypeLabel(value: MatchRequestContractType) {
  switch (value) {
    case 'permanent':
      return 'CDI';
    case 'fixed_term':
      return 'CDD';
    case 'temporary':
      return 'Intérim';
    case 'freelance':
      return 'Freelance';
    case 'apprenticeship':
      return 'Alternance';
    case 'internship':
      return 'Stage';
    case 'other':
    default:
      return 'Autre';
  }
}

export function getMatchRequestStatusLabel(value: MatchRequestStatus) {
  switch (value) {
    case 'pending_candidate':
      return 'En attente du candidat';
    case 'accepted':
      return 'Acceptée';
    case 'refused':
      return 'Refusée';
    case 'cancelled':
      return 'Annulée';
    case 'expired':
    default:
      return 'Expirée';
  }
}

export async function createSevenoMatchRequest(input: {
  companyUid: string;
  publicCandidateId: string;
  proposedJobTitle?: string;
  proposedLocation?: string;
  contractType?: MatchRequestContractType;
  message?: string;
}) {
  const firestore = requireAdminDatabase();
  await assertVerifiedCompanyAccount(input.companyUid);
  const publicCandidateId = input.publicCandidateId.trim();
  if (!PUBLIC_CANDIDATE_ID_PATTERN.test(publicCandidateId)) {
    throw new SevenoMatchRequestError('invalid_public_candidate_id', 400, 'L identifiant public du candidat est invalide.');
  }

  const companyProfile = await loadCompanyProfileByUid(input.companyUid);
  assertActiveCompanyProfile(companyProfile);

  const candidateProfile = await loadCandidateProfileByPublicCandidateId(publicCandidateId);
  assertVisibleCandidateProfile(candidateProfile);

  if (candidateProfile.uid === input.companyUid) {
    throw new SevenoMatchRequestError('invalid_target', 400, 'Une entreprise ne peut pas se contacter elle-meme.');
  }

  const existingRequests = await loadCompanyMatchRequestRecords(input.companyUid);
  const refreshedExistingRequests = await Promise.all(existingRequests.map((request) => expirePendingRequestIfNeeded(request)));
  const conflictingRequest = refreshedExistingRequests.find(
    (request) => request.candidateUid === candidateProfile.uid && isActiveStatus(request.status),
  );
  if (conflictingRequest) {
    throw buildActiveRequestConflictError();
  }

  const id = firestore.collection(MATCH_REQUESTS_COLLECTION).doc().id;
  const requestRef = firestore.collection(MATCH_REQUESTS_COLLECTION).doc(id);
  const guardRef = matchRequestGuardRef(input.companyUid, candidateProfile.uid);
  const payload = buildMatchRequestCreatePayload(id, input.companyUid, candidateProfile, companyProfile, {
    proposedJobTitle: ensureNoPrivateInput(input.proposedJobTitle, 'intitulé du poste', MATCH_REQUEST_TEXT_LIMIT),
    proposedLocation: ensureNoPrivateInput(input.proposedLocation, 'lieu du poste', MATCH_REQUEST_TEXT_LIMIT),
    contractType: input.contractType,
    message: ensureNoPrivateInput(input.message, 'message', MATCH_REQUEST_MESSAGE_LIMIT),
  });

  await firestore.runTransaction(async (transaction) => {
    const guardSnapshot = await transaction.get(guardRef);
    const guardedRequestId = guardSnapshot.exists ? cleanText(guardSnapshot.data()?.activeRequestId) : undefined;

    if (guardedRequestId) {
      const guardedRequestRef = firestore.collection(MATCH_REQUESTS_COLLECTION).doc(guardedRequestId);
      const guardedRequestSnapshot = await transaction.get(guardedRequestRef);
      const guardedRequest = guardedRequestSnapshot.exists
        ? normalizeMatchRequestRecord(guardedRequestSnapshot.id, guardedRequestSnapshot.data())
        : null;

      if (
        guardedRequest
        && guardedRequest.companyUid === input.companyUid
        && guardedRequest.candidateUid === candidateProfile.uid
        && isActiveStatus(guardedRequest.status)
        && !isExpired(guardedRequest)
      ) {
        throw buildActiveRequestConflictError();
      }

      if (guardedRequest && isExpired(guardedRequest)) {
        transaction.update(guardedRequestRef, {
          status: 'expired',
          updatedAt: Timestamp.now(),
        });
      }
    }

    transaction.create(requestRef, payload);
    transaction.set(guardRef, {
      companyUid: input.companyUid,
      candidateUid: candidateProfile.uid,
      activeRequestId: id,
      updatedAt: Timestamp.now(),
    });
  });
  await writeAdminLog(
    'match_request_created',
    {
      uid: input.companyUid,
      role: 'company',
    },
    id,
    {
      companyUid: input.companyUid,
      candidateUid: candidateProfile.uid,
      publicCandidateId: candidateProfile.publicCandidateId,
    },
  );

  return serializeMatchRequest(payload);
}

export async function getCompanyMatchRequests(companyUid: string, publicCandidateId?: string) {
  await assertVerifiedCompanyAccount(companyUid);
  const requests = await loadCompanyMatchRequestRecords(companyUid);
  const filteredRequests = publicCandidateId
    ? requests.filter((request) => request.publicCandidateId === publicCandidateId)
    : requests;

  const refreshedRequests = await Promise.all(
    filteredRequests.map(async (request) => {
      const refreshed = await expirePendingRequestIfNeeded(request);
      return refreshed;
    }),
  );

  return refreshedRequests
    .sort((left, right) => right.createdAt.toMillis() - left.createdAt.toMillis())
    .map((request) => serializeMatchRequest(request));
}

export async function getCandidateMatchRequests(candidateUid: string) {
  const requests = await loadCandidateMatchRequestRecords(candidateUid);
  const refreshedRequests = await Promise.all(
    requests.map(async (request) => {
      const refreshed = await expirePendingRequestIfNeeded(request);
      const companyProfile = await loadCompanyProfileByUid(refreshed.companyUid);
      return serializeCandidateMatchRequest(refreshed, companyProfile?.businessSector ?? '');
    }),
  );

  return refreshedRequests.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export async function getMatchRequestContact(
  actor: MatchRequestParticipantContext,
  matchRequestId: string,
): Promise<MatchRequestContactInfo> {
  if (actor.role === 'company') {
    await assertVerifiedCompanyAccount(actor.uid);
  }

  const request = await loadMatchRequestById(matchRequestId);
  if (!request) {
    throw new SevenoMatchRequestError('match_request_not_found', 404, 'Demande introuvable.');
  }

  const currentRequest = await expirePendingRequestIfNeeded(request);

  ensureMatchRequestParticipant(currentRequest, actor);

  if (currentRequest.status !== 'accepted') {
    if (currentRequest.status === 'expired') {
      throw new SevenoMatchRequestError('match_request_expired', 410, 'Cette demande a expire.');
    }

    throw new SevenoMatchRequestError('match_request_not_accepted', 409, 'Les coordonnees ne sont accessibles qu apres acceptation.');
  }

  const candidateUser = await getSevenoUserByUid(currentRequest.candidateUid);
  if (!candidateUser) {
    throw new SevenoMatchRequestError('candidate_user_missing', 404, 'Compte candidat introuvable.');
  }

  await writeAdminLog(
    'candidate_contact_accessed',
    actor,
    currentRequest.id,
    {
      companyUid: currentRequest.companyUid,
      candidateUid: currentRequest.candidateUid,
    },
  );

  const privateDisplayName = [candidateUser.firstName, candidateUser.lastName].filter(Boolean).join(' ');
  return {
    displayName: privateDisplayName || cleanText(candidateUser.displayName) || candidateUser.email,
    email: candidateUser.email,
    phone: candidateUser.phone ?? null,
  };
}

export async function respondToSevenoMatchRequest(
  candidateUid: string,
  matchRequestId: string,
  decision: 'accepted' | 'refused',
) {
  const firestore = requireAdminDatabase();
  const requestRef = firestore.collection(MATCH_REQUESTS_COLLECTION).doc(matchRequestId);
  const snapshot = await requestRef.get();
  const request = snapshot.exists ? normalizeMatchRequestRecord(snapshot.id, snapshot.data()) : null;

  if (!request) {
    throw new SevenoMatchRequestError('match_request_not_found', 404, 'Demande introuvable.');
  }

  ensureMatchRequestParticipant(request, {
    uid: candidateUid,
    role: 'candidate',
  });

  const refreshed = await expirePendingRequestIfNeeded(request);
  if (refreshed.status !== 'pending_candidate') {
    if (refreshed.status === 'expired') {
      throw new SevenoMatchRequestError('match_request_expired', 410, 'Cette demande a expire.');
    }

    throw new SevenoMatchRequestError('match_request_already_decided', 409, 'Cette demande a deja recu une reponse.');
  }

  const now = Timestamp.now();
  const nextStatus: MatchRequestStatus = decision === 'accepted' ? 'accepted' : 'refused';
  await requestRef.update({
    status: nextStatus,
    candidateDecisionAt: now,
    ...(decision === 'accepted' ? { acceptedAt: now, refusedAt: null } : { acceptedAt: null, refusedAt: now }),
    updatedAt: now,
  });

  const updated: MatchRequestRecord = {
    ...refreshed,
    status: nextStatus,
    candidateDecisionAt: now,
    acceptedAt: decision === 'accepted' ? now : null,
    refusedAt: decision === 'refused' ? now : null,
    updatedAt: now,
  };

  await writeAdminLog(
    decision === 'accepted' ? 'match_request_accepted' : 'match_request_refused',
    {
      uid: candidateUid,
      role: 'candidate',
    },
    matchRequestId,
    {
      companyUid: updated.companyUid,
      candidateUid: updated.candidateUid,
    },
  );

  return serializeMatchRequest(updated);
}

export async function cancelSevenoMatchRequest(companyUid: string, matchRequestId: string) {
  await assertVerifiedCompanyAccount(companyUid);
  const firestore = requireAdminDatabase();
  const requestRef = firestore.collection(MATCH_REQUESTS_COLLECTION).doc(matchRequestId);
  const snapshot = await requestRef.get();
  const request = snapshot.exists ? normalizeMatchRequestRecord(snapshot.id, snapshot.data()) : null;

  if (!request) {
    throw new SevenoMatchRequestError('match_request_not_found', 404, 'Demande introuvable.');
  }

  ensureMatchRequestParticipant(request, {
    uid: companyUid,
    role: 'company',
  });

  const refreshed = await expirePendingRequestIfNeeded(request);
  if (refreshed.status === 'accepted') {
    throw new SevenoMatchRequestError('match_request_already_accepted', 409, 'Une demande acceptee ne peut pas etre annulee.');
  }

  if (refreshed.status !== 'pending_candidate') {
    throw new SevenoMatchRequestError('match_request_not_cancellable', 409, 'Cette demande ne peut plus etre annulee.');
  }

  const now = Timestamp.now();
  await requestRef.update({
    status: 'cancelled',
    cancelledAt: now,
    updatedAt: now,
  });

  const updated: MatchRequestRecord = {
    ...refreshed,
    status: 'cancelled',
    cancelledAt: now,
    updatedAt: now,
  };

  await writeAdminLog(
    'match_request_cancelled',
    {
      uid: companyUid,
      role: 'company',
    },
    matchRequestId,
    {
      companyUid: updated.companyUid,
      candidateUid: updated.candidateUid,
    },
  );

  return serializeMatchRequest(updated);
}
