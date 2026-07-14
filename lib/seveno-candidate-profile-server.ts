import 'server-only';

import { randomBytes } from 'node:crypto';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import {
  DAILY_AVAILABILITY_VALIDITY_HOURS,
  buildNextAvailabilityReminderAt,
  normalizeAvailabilityTimezone,
  toAvailabilityDate,
} from '@/lib/seveno-candidate-availability';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import type {
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidateIdentityRequiredField,
  CandidateProfileStatus,
  CandidateProfileUpsertData,
  CandidateTargetJob,
  SevenoAssessmentSummary,
} from '@/types/seveno';

const AVAILABILITY_VALUES: CandidateAvailability[] = [
  'immediate',
  'less_than_1_month',
  'one_to_three_months',
  'listening',
  'not_available',
];
const EXPERIENCE_VALUES: CandidateExperienceLevel[] = [
  'beginner',
  'intermediate',
  'confirmed',
  'senior',
  'expert',
];
const PROFILE_STATUS_VALUES: CandidateProfileStatus[] = ['draft', 'active', 'paused'];
const PUBLIC_CANDIDATE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_TARGET_JOBS = 3;

type FirestoreRecord = Record<string, unknown>;

type VerificationFields = {
  verifiedScore: number | null;
  testPassed: boolean;
  lastTestAt: Timestamp | null;
  verifiedTestResultId: string | null;
  verifiedTestSessionId: string | null;
  verifiedJobRoleId: string | null;
  verifiedQuestionBankCode: string | null;
  verifiedQuestionBankVersion: string | null;
};

const EMPTY_VERIFICATION: VerificationFields = {
  verifiedScore: null,
  testPassed: false,
  lastTestAt: null,
  verifiedTestResultId: null,
  verifiedTestSessionId: null,
  verifiedJobRoleId: null,
  verifiedQuestionBankCode: null,
  verifiedQuestionBankVersion: null,
};

export class SevenoCandidateProfileError extends Error {
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
    throw new SevenoCandidateProfileError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour enregistrer le profil candidat.',
    );
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireText(value: unknown, field: string, maxLength: number) {
  const cleaned = cleanText(value);
  if (!cleaned || cleaned.length > maxLength) {
    throw new SevenoCandidateProfileError('invalid_candidate_profile', 400, `Le champ ${field} est invalide.`);
  }
  return cleaned;
}

function normalizeInput(value: unknown): CandidateProfileUpsertData {
  if (!isPlainObject(value)) {
    throw new SevenoCandidateProfileError('invalid_candidate_profile', 400, 'Le profil candidat est invalide.');
  }

  const legacyJobRoleId = cleanText(value.jobRoleId);
  const rawTargetJobRoleIds = Array.isArray(value.targetJobRoleIds)
    ? value.targetJobRoleIds
    : legacyJobRoleId
      ? [legacyJobRoleId]
      : [];
  const targetJobRoleIds = rawTargetJobRoleIds.map((item) => cleanText(item)).filter(Boolean);
  if (
    targetJobRoleIds.length < 1
    || targetJobRoleIds.length > MAX_TARGET_JOBS
    || new Set(targetJobRoleIds).size !== targetJobRoleIds.length
  ) {
    throw new SevenoCandidateProfileError(
      'invalid_candidate_job',
      400,
      'Selectionnez entre un et trois metiers distincts.',
    );
  }

  for (const targetJobRoleId of targetJobRoleIds) {
    const exists = JOB_SECTORS.some((sector) => sector.families.some(
      (family) => family.roles.some((role) => role.code === targetJobRoleId),
    ));
    if (!exists) {
      throw new SevenoCandidateProfileError(
        'invalid_candidate_job',
        400,
        'Un metier selectionne ne correspond pas a la taxonomie SevenO.',
      );
    }
  }

  const availability = cleanText(value.availability) as CandidateAvailability;
  const experienceLevel = cleanText(value.experienceLevel) as CandidateExperienceLevel;
  const profileStatus = cleanText(value.profileStatus) as CandidateProfileStatus;
  const anonymousVisibilityConsent = value.anonymousVisibilityConsent === true;
  if (!AVAILABILITY_VALUES.includes(availability)) {
    throw new SevenoCandidateProfileError('invalid_availability', 400, 'La disponibilite selectionnee est invalide.');
  }
  if (!EXPERIENCE_VALUES.includes(experienceLevel)) {
    throw new SevenoCandidateProfileError('invalid_experience', 400, 'Le niveau d experience est invalide.');
  }
  if (!PROFILE_STATUS_VALUES.includes(profileStatus)) {
    throw new SevenoCandidateProfileError('invalid_profile_status', 400, 'Le statut du profil est invalide.');
  }
  if (profileStatus === 'active' && !anonymousVisibilityConsent) {
    throw new SevenoCandidateProfileError(
      'anonymous_visibility_consent_required',
      400,
      'Confirmez la visibilite anonyme avant d activer votre profil.',
    );
  }

  return {
    targetJobRoleIds,
    availability,
    availabilityAvailableFromAt: cleanText(value.availabilityAvailableFromAt) || null,
    locationArea: requireText(value.locationArea, 'zone geographique', 120),
    experienceLevel,
    profileStatus,
    anonymousVisibilityConsent,
  };
}

function buildTargetJobs(targetJobRoleIds: string[]): CandidateTargetJob[] {
  return targetJobRoleIds.map((jobRoleId) => {
    for (const sector of JOB_SECTORS) {
      for (const family of sector.families) {
        const role = family.roles.find((item) => item.code === jobRoleId);
        if (role) {
          return {
            sectorId: sector.code,
            jobFamilyId: family.code,
            jobRoleId: role.code,
            label: role.label,
          };
        }
      }
    }

    throw new SevenoCandidateProfileError('invalid_candidate_job', 400, 'Un metier selectionne est invalide.');
  });
}

function generatePublicCandidateId() {
  const bytes = randomBytes(6);
  const segment = Array.from(bytes, (value) => PUBLIC_CANDIDATE_ALPHABET[value % PUBLIC_CANDIDATE_ALPHABET.length]).join('');
  return `SEV-CAND-${segment}`;
}

function toTimestamp(value: unknown) {
  return value instanceof Timestamp ? value : null;
}

async function loadPreservedVerification(
  transaction: Transaction,
  uid: string,
  profile: FirestoreRecord,
  input: CandidateProfileUpsertData,
): Promise<VerificationFields | null> {
  const primaryJob = buildTargetJobs(input.targetJobRoleIds)[0];
  if (!primaryJob) {
    return null;
  }
  const resultId = cleanText(profile.verifiedTestResultId);
  const sessionId = cleanText(profile.verifiedTestSessionId);
  const verifiedJobRoleId = cleanText(profile.verifiedJobRoleId);
  const questionBankCode = cleanText(profile.verifiedQuestionBankCode);
  const questionBankVersion = cleanText(profile.verifiedQuestionBankVersion);
  const publicCandidateId = cleanText(profile.publicCandidateId);
  const score = typeof profile.verifiedScore === 'number' && Number.isFinite(profile.verifiedScore)
    ? profile.verifiedScore
    : null;
  const lastTestAt = toTimestamp(profile.lastTestAt);

  if (
    score === null
    || !lastTestAt
    || !resultId
    || !sessionId
    || verifiedJobRoleId !== primaryJob.jobRoleId
    || !questionBankCode
    || !questionBankVersion
  ) {
    return null;
  }

  const firestore = requireAdminDatabase();
  const resultSnapshot = await transaction.get(firestore.collection('test_results').doc(resultId));
  const sessionSnapshot = await transaction.get(firestore.collection('test_sessions').doc(sessionId));
  if (!resultSnapshot.exists || !sessionSnapshot.exists) {
    return null;
  }

  const result = resultSnapshot.data() as FirestoreRecord;
  const session = sessionSnapshot.data() as FirestoreRecord;
  const resultVerifiedAt = toTimestamp(result.verifiedAt);
  const resultMatches = result.uid === uid
    && result.candidateProfileId === uid
    && result.publicCandidateId === publicCandidateId
    && result.sessionId === sessionId
    && result.sectorId === primaryJob.sectorId
    && result.jobFamilyId === primaryJob.jobFamilyId
    && result.jobRoleId === primaryJob.jobRoleId
    && result.questionBankCode === questionBankCode
    && result.questionBankVersion === questionBankVersion
    && result.score === score
    && result.passed === (profile.testPassed === true)
    && resultVerifiedAt?.toMillis() === lastTestAt.toMillis();
  const sessionMatches = session.uid === uid
    && session.candidateProfileId === uid
    && session.publicCandidateId === publicCandidateId
    && session.sectorId === primaryJob.sectorId
    && session.jobFamilyId === primaryJob.jobFamilyId
    && session.jobRoleId === primaryJob.jobRoleId
    && session.questionBankCode === questionBankCode
    && session.questionBankVersion === questionBankVersion
    && session.status === 'submitted';

  if (!resultMatches || !sessionMatches) {
    return null;
  }

  return {
    verifiedScore: score,
    testPassed: profile.testPassed === true,
    lastTestAt,
    verifiedTestResultId: resultId,
    verifiedTestSessionId: sessionId,
    verifiedJobRoleId,
    verifiedQuestionBankCode: questionBankCode,
    verifiedQuestionBankVersion: questionBankVersion,
  };
}

function readAssessmentSummary(data: FirestoreRecord | undefined): SevenoAssessmentSummary | null {
  if (
    !data
    || data.assessmentType !== 'seveno_general'
    || data.status !== 'completed'
    || typeof data.overallScore !== 'number'
    || !Number.isFinite(data.overallScore)
    || !isPlainObject(data.scoresByDimension)
    || !cleanText(data.questionnaireVersion)
    || !cleanText(data.sessionId)
    || !cleanText(data.resultId)
    || !(data.completedAt instanceof Timestamp)
  ) {
    return null;
  }

  return data as unknown as SevenoAssessmentSummary;
}

export async function createOrUpdateCandidateProfileServer(
  uid: string,
  rawInput: unknown,
  emailVerified: boolean,
) {
  const firestore = requireAdminDatabase();
  const input = normalizeInput(rawInput);
  const userRef = firestore.collection('users').doc(uid);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const assessmentSummaryRef = firestore.collection('candidate_assessment_summaries').doc(uid);

  return firestore.runTransaction(async (transaction) => {
    const [userSnapshot, assessmentSummarySnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(assessmentSummaryRef),
    ]);
    if (!userSnapshot.exists || userSnapshot.get('role') !== 'candidate' || userSnapshot.get('uid') !== uid) {
      throw new SevenoCandidateProfileError('forbidden_role', 403, 'Seuls les candidats peuvent modifier ce profil.');
    }

    const identityMissingFields: CandidateIdentityRequiredField[] = [];
    if (!cleanText(userSnapshot.get('firstName'))) identityMissingFields.push('firstName');
    if (!cleanText(userSnapshot.get('lastName'))) identityMissingFields.push('lastName');
    if (!cleanText(userSnapshot.get('email'))) identityMissingFields.push('email');
    if (!cleanText(userSnapshot.get('phone'))) identityMissingFields.push('phone');

    const profileSnapshot = await transaction.get(profileRef);
    const existing = profileSnapshot.exists ? (profileSnapshot.data() as FirestoreRecord) : null;
    const targetJobs = buildTargetJobs(input.targetJobRoleIds);
    const primaryJob = targetJobs[0];
    if (!primaryJob) {
      throw new SevenoCandidateProfileError('invalid_candidate_job', 400, 'Selectionnez au moins un metier.');
    }
    const assessmentSummary = readAssessmentSummary(
      assessmentSummarySnapshot.exists ? assessmentSummarySnapshot.data() as FirestoreRecord : undefined,
    );
    const publicCandidateId = existing ? cleanText(existing.publicCandidateId) : generatePublicCandidateId();
    if (!publicCandidateId) {
      throw new SevenoCandidateProfileError('invalid_candidate_profile', 409, 'Le profil candidat existant est invalide.');
    }
    const now = Timestamp.now();
    const existingAvailabilityTimezone = normalizeAvailabilityTimezone(existing?.availabilityTimezone);
    const existingDailyAvailabilityEnabled = existing?.dailyAvailabilityConfirmationEnabled !== false;
    const existingAvailabilityAvailableFromAt = toAvailabilityDate(
      existing?.availabilityAvailableFromAt as Parameters<typeof toAvailabilityDate>[0],
    );
    const existingLastAvailabilityNotificationAt = toAvailabilityDate(
      existing?.lastAvailabilityNotificationAt as Parameters<typeof toAvailabilityDate>[0],
    );
    const existingAvailabilityPushPermission = existing?.availabilityPushPermission === 'default'
      || existing?.availabilityPushPermission === 'granted'
      || existing?.availabilityPushPermission === 'denied'
      ? existing.availabilityPushPermission
      : null;
    const existingHasActiveAvailabilityPushSubscription = existing?.hasActiveAvailabilityPushSubscription === true;
    const availabilityAvailableFromAt = input.availability === 'immediate'
      ? null
      : toAvailabilityDate(input.availabilityAvailableFromAt as Parameters<typeof toAvailabilityDate>[0])
        ?? existingAvailabilityAvailableFromAt
        ?? null;
    const availabilityConfirmedAt = input.availability === 'immediate' ? now : null;
    const availabilityValidUntil = input.availability === 'immediate'
      ? Timestamp.fromMillis(now.toMillis() + DAILY_AVAILABILITY_VALIDITY_HOURS * 60 * 60 * 1000)
      : null;
    const dailyAvailabilityConfirmationEnabled = input.availability === 'immediate' ? existingDailyAvailabilityEnabled : false;
    const nextAvailabilityReminderAt = input.availability === 'immediate' && dailyAvailabilityConfirmationEnabled
      ? Timestamp.fromDate(buildNextAvailabilityReminderAt(now.toDate(), existingAvailabilityTimezone))
      : null;

    const existingTargetJobRoleIds = Array.isArray(existing?.targetJobRoleIds)
      ? existing.targetJobRoleIds.map((item) => cleanText(item)).filter(Boolean)
      : cleanText(existing?.jobRoleId)
        ? [cleanText(existing?.jobRoleId)]
        : [];
    const jobChanged = Boolean(existing) && (
      existingTargetJobRoleIds.length !== input.targetJobRoleIds.length
      || existingTargetJobRoleIds.some((item, index) => item !== input.targetJobRoleIds[index])
    );
    const preservedVerification = existing && !jobChanged
      ? await loadPreservedVerification(transaction, uid, existing, input)
      : null;
    const verification = preservedVerification ?? EMPTY_VERIFICATION;
    const activationDowngraded = input.profileStatus === 'active'
      && (
        !emailVerified
        || identityMissingFields.length > 0
        || !assessmentSummary
      );
    const effectiveProfileStatus: CandidateProfileStatus = activationDowngraded ? 'draft' : input.profileStatus;

    const editableProfileFields = {
      targetJobRoleIds: input.targetJobRoleIds,
      targetJobs,
      sectorId: primaryJob.sectorId,
      jobFamilyId: primaryJob.jobFamilyId,
      jobRoleId: primaryJob.jobRoleId,
      availability: input.availability,
      ...(availabilityAvailableFromAt ? { availabilityAvailableFromAt: Timestamp.fromDate(availabilityAvailableFromAt) } : {}),
      ...(availabilityConfirmedAt ? { availabilityConfirmedAt } : {}),
      ...(availabilityValidUntil ? { availabilityValidUntil } : {}),
      locationArea: input.locationArea,
      experienceLevel: input.experienceLevel,
      ...verification,
      sevenoAssessmentStatus: assessmentSummary ? 'completed' : 'not_started',
      sevenoAssessmentOverallScore: assessmentSummary?.overallScore ?? null,
      sevenoAssessmentDimensions: assessmentSummary?.scoresByDimension ?? {},
      sevenoAssessmentVersion: assessmentSummary?.questionnaireVersion ?? null,
      sevenoAssessmentCompletedAt: assessmentSummary?.completedAt ?? null,
      sevenoAssessmentSessionId: assessmentSummary?.sessionId ?? null,
      sevenoAssessmentResultId: assessmentSummary?.resultId ?? null,
      profileStatus: effectiveProfileStatus,
      dailyAvailabilityConfirmationEnabled,
      ...(nextAvailabilityReminderAt ? { nextAvailabilityReminderAt } : {}),
      ...(existingLastAvailabilityNotificationAt
        ? { lastAvailabilityNotificationAt: Timestamp.fromDate(existingLastAvailabilityNotificationAt) }
        : {}),
      availabilityTimezone: existingAvailabilityTimezone,
      ...(existingAvailabilityPushPermission ? { availabilityPushPermission: existingAvailabilityPushPermission } : {}),
      hasActiveAvailabilityPushSubscription: existingHasActiveAvailabilityPushSubscription,
      updatedAt: now,
    };

    if (existing) {
      transaction.update(profileRef, editableProfileFields);
    } else {
      transaction.create(profileRef, {
        uid,
        publicCandidateId,
        role: 'candidate',
        ...editableProfileFields,
        createdAt: now,
      });
    }

    return {
      publicCandidateId,
      jobChanged,
      verificationReset: !preservedVerification,
      activationDowngraded,
      identityMissingFields,
      assessmentRequired: !assessmentSummary,
      profileStatus: effectiveProfileStatus,
    };
  });
}
