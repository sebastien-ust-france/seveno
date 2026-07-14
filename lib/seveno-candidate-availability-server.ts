import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { getApp, getApps } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import {
  AVAILABILITY_CONFIRMATION_SCHEMA_VERSION,
  DAILY_AVAILABILITY_VALIDITY_HOURS,
  buildAvailabilityReminderPeriodKey,
  buildNextAvailabilityReminderAt,
  getCandidateAvailabilityView,
  isCandidateAvailabilityReminderDue,
  normalizeAvailabilityTimezone,
  toAvailabilityDate,
} from '@/lib/seveno-candidate-availability';
import type {
  AvailabilityConfirmationEvent,
  AvailabilityConfirmationRequest,
  AvailabilityNotificationSource,
  CandidateAvailabilityConfirmationAction,
  CandidateProfile,
  CandidateProfileStatus,
  CandidatePushSubscriptionDevice,
} from '@/types/seveno';

const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
const AVAILABILITY_REQUESTS_COLLECTION = 'availability_confirmation_requests';
const AVAILABILITY_EVENTS_COLLECTION = 'availability_confirmation_events';
const AVAILABILITY_PUSH_COLLECTION = 'candidate_push_subscriptions';
const AVAILABILITY_PUSH_DEVICES_COLLECTION = 'devices';
const AVAILABILITY_REQUEST_TOKEN_BYTES = 24;
const AVAILABILITY_REQUEST_EXPIRY_HOURS = 36;
const AVAILABILITY_BATCH_SIZE = 40;
const AVAILABILITY_NOTIFICATION_TITLE = "Seven'O - Disponibilite";
const AVAILABILITY_NOTIFICATION_BODY = "Etes-vous toujours disponible immediatement ?";
const AVAILABILITY_NOTIFICATION_CLICK_PATH = '/candidat/disponibilite';

type FirestoreRecord = Record<string, unknown>;

export class SevenoAvailabilityError extends Error {
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
    throw new SevenoAvailabilityError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour gerer la disponibilite.',
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

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }

  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }

  return null;
}

function hashToken(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function buildRequestId(candidateUid: string, periodKey: string) {
  return createHash('sha256').update(`${candidateUid}\0${periodKey}`, 'utf8').digest('hex');
}

function buildRequestToken() {
  return randomBytes(AVAILABILITY_REQUEST_TOKEN_BYTES).toString('base64url');
}

function getCandidateProfileRef(uid: string) {
  return requireAdminDatabase().collection(CANDIDATE_PROFILES_COLLECTION).doc(uid);
}

function getAvailabilityRequestRef(requestId: string) {
  return requireAdminDatabase().collection(AVAILABILITY_REQUESTS_COLLECTION).doc(requestId);
}

function getAvailabilityEventRef() {
  return requireAdminDatabase().collection(AVAILABILITY_EVENTS_COLLECTION).doc();
}

function getAvailabilityPushDeviceCollection(uid: string) {
  return requireAdminDatabase()
    .collection(AVAILABILITY_PUSH_COLLECTION)
    .doc(uid)
    .collection(AVAILABILITY_PUSH_DEVICES_COLLECTION);
}

function normalizeCandidateProfile(data: unknown): CandidateProfile | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const uid = cleanText(data.uid);
  const publicCandidateId = cleanText(data.publicCandidateId);
  const role = data.role === 'candidate' ? 'candidate' : null;
  const targetJobRoleIds = Array.isArray(data.targetJobRoleIds)
    ? data.targetJobRoleIds.map((item) => cleanText(item)).filter(Boolean)
    : [];
  const targetJobs = Array.isArray(data.targetJobs)
    ? data.targetJobs
        .map((item) => {
          if (!isPlainObject(item)) {
            return null;
          }

          const sectorId = cleanText(item.sectorId);
          const jobFamilyId = cleanText(item.jobFamilyId);
          const jobRoleId = cleanText(item.jobRoleId);
          const label = cleanText(item.label);
          return sectorId && jobFamilyId && jobRoleId && label
            ? { sectorId, jobFamilyId, jobRoleId, label }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  const sectorId = cleanText(data.sectorId);
  const jobFamilyId = cleanText(data.jobFamilyId);
  const jobRoleId = cleanText(data.jobRoleId);
  const availability = typeof data.availability === 'string' ? data.availability : null;
  const locationArea = cleanText(data.locationArea);
  const experienceLevel = typeof data.experienceLevel === 'string' ? data.experienceLevel : null;
  const verifiedScore = typeof data.verifiedScore === 'number' && Number.isFinite(data.verifiedScore) ? data.verifiedScore : null;
  const testPassed = data.testPassed === true;
  const lastTestAt = data.lastTestAt == null ? null : toTimestamp(data.lastTestAt);
  const verifiedTestResultId = cleanText(data.verifiedTestResultId) || null;
  const verifiedTestSessionId = cleanText(data.verifiedTestSessionId) || null;
  const verifiedJobRoleId = cleanText(data.verifiedJobRoleId) || null;
  const verifiedQuestionBankCode = cleanText(data.verifiedQuestionBankCode) || null;
  const verifiedQuestionBankVersion = cleanText(data.verifiedQuestionBankVersion) || null;
  const sevenoAssessmentStatus = typeof data.sevenoAssessmentStatus === 'string' ? data.sevenoAssessmentStatus : null;
  const sevenoAssessmentOverallScore = typeof data.sevenoAssessmentOverallScore === 'number'
    && Number.isFinite(data.sevenoAssessmentOverallScore)
    ? data.sevenoAssessmentOverallScore
    : null;
  const sevenoAssessmentDimensions = isPlainObject(data.sevenoAssessmentDimensions) ? data.sevenoAssessmentDimensions : {};
  const sevenoAssessmentVersion = cleanText(data.sevenoAssessmentVersion) || null;
  const sevenoAssessmentCompletedAt = data.sevenoAssessmentCompletedAt == null ? null : toTimestamp(data.sevenoAssessmentCompletedAt);
  const sevenoAssessmentSessionId = cleanText(data.sevenoAssessmentSessionId) || null;
  const sevenoAssessmentResultId = cleanText(data.sevenoAssessmentResultId) || null;
  const profileStatus = typeof data.profileStatus === 'string' ? data.profileStatus : null;
  const availabilityAvailableFromAt = data.availabilityAvailableFromAt == null ? null : toTimestamp(data.availabilityAvailableFromAt);
  const availabilityConfirmedAt = data.availabilityConfirmedAt == null ? null : toTimestamp(data.availabilityConfirmedAt);
  const availabilityValidUntil = data.availabilityValidUntil == null ? null : toTimestamp(data.availabilityValidUntil);
  const dailyAvailabilityConfirmationEnabled = data.dailyAvailabilityConfirmationEnabled === true;
  const nextAvailabilityReminderAt = data.nextAvailabilityReminderAt == null ? null : toTimestamp(data.nextAvailabilityReminderAt);
  const lastAvailabilityNotificationAt = data.lastAvailabilityNotificationAt == null ? null : toTimestamp(data.lastAvailabilityNotificationAt);
  const availabilityTimezone = cleanText(data.availabilityTimezone) || null;
  const availabilityPushPermission = data.availabilityPushPermission === 'default'
    || data.availabilityPushPermission === 'granted'
    || data.availabilityPushPermission === 'denied'
    ? data.availabilityPushPermission
    : null;
  const hasActiveAvailabilityPushSubscription = data.hasActiveAvailabilityPushSubscription === true;
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);

  if (
    !uid
    || !publicCandidateId
    || !role
    || targetJobRoleIds.length === 0
    || !sectorId
    || !jobFamilyId
    || !jobRoleId
    || !availability
    || !locationArea
    || !experienceLevel
    || !profileStatus
    || !createdAt
    || !updatedAt
  ) {
    return null;
  }

  return {
    uid,
    publicCandidateId,
    role,
    targetJobRoleIds,
    targetJobs,
    sectorId,
    jobFamilyId,
    jobRoleId,
    availability: availability as CandidateProfile['availability'],
    ...(availabilityAvailableFromAt ? { availabilityAvailableFromAt } : {}),
    ...(availabilityConfirmedAt ? { availabilityConfirmedAt } : {}),
    ...(availabilityValidUntil ? { availabilityValidUntil } : {}),
    locationArea,
    experienceLevel: experienceLevel as CandidateProfile['experienceLevel'],
    verifiedScore,
    testPassed,
    lastTestAt,
    ...(verifiedTestResultId ? { verifiedTestResultId } : {}),
    ...(verifiedTestSessionId ? { verifiedTestSessionId } : {}),
    ...(verifiedJobRoleId ? { verifiedJobRoleId } : {}),
    ...(verifiedQuestionBankCode ? { verifiedQuestionBankCode } : {}),
    ...(verifiedQuestionBankVersion ? { verifiedQuestionBankVersion } : {}),
    sevenoAssessmentStatus: (sevenoAssessmentStatus as CandidateProfile['sevenoAssessmentStatus']) ?? 'not_started',
    sevenoAssessmentOverallScore,
    sevenoAssessmentDimensions: sevenoAssessmentDimensions as CandidateProfile['sevenoAssessmentDimensions'],
    sevenoAssessmentVersion,
    sevenoAssessmentCompletedAt,
    ...(sevenoAssessmentSessionId ? { sevenoAssessmentSessionId } : {}),
    ...(sevenoAssessmentResultId ? { sevenoAssessmentResultId } : {}),
    profileStatus: profileStatus as CandidateProfileStatus,
    dailyAvailabilityConfirmationEnabled,
    ...(nextAvailabilityReminderAt ? { nextAvailabilityReminderAt } : {}),
    ...(lastAvailabilityNotificationAt ? { lastAvailabilityNotificationAt } : {}),
    ...(availabilityTimezone ? { availabilityTimezone } : {}),
    ...(availabilityPushPermission ? { availabilityPushPermission } : {}),
    hasActiveAvailabilityPushSubscription,
    createdAt,
    updatedAt,
  };
}

function normalizeDevice(data: unknown, uid: string, deviceId: string): CandidatePushSubscriptionDevice | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const token = cleanText(data.token);
  const permission = data.permission === 'default' || data.permission === 'granted' || data.permission === 'denied'
    ? data.permission
    : null;
  const enabled = data.enabled === true;
  const platform = cleanText(data.platform);
  const userAgent = cleanText(data.userAgent);
  const timezone = cleanText(data.timezone);
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);
  const lastSeenAt = data.lastSeenAt == null ? null : toTimestamp(data.lastSeenAt);
  const lastNotificationAt = data.lastNotificationAt == null ? null : toTimestamp(data.lastNotificationAt);
  const revokedAt = data.revokedAt == null ? null : toTimestamp(data.revokedAt);

  if (!token || !permission || !createdAt || !updatedAt) {
    return null;
  }

  return {
    uid,
    deviceId,
    token,
    permission,
    enabled,
    ...(platform ? { platform } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(timezone ? { timezone } : {}),
    createdAt,
    updatedAt,
    ...(lastSeenAt ? { lastSeenAt } : {}),
    ...(lastNotificationAt ? { lastNotificationAt } : {}),
    ...(revokedAt ? { revokedAt } : {}),
  };
}

function toPublicAvailabilityLabel(profile: CandidateProfile, reference: Date) {
  return getCandidateAvailabilityView(profile, reference);
}

async function loadCandidateProfile(uid: string) {
  const snapshot = await getCandidateProfileRef(uid).get();
  return snapshot.exists ? normalizeCandidateProfile(snapshot.data()) : null;
}

async function loadActiveDevices(uid: string) {
  const snapshot = await getAvailabilityPushDeviceCollection(uid)
    .where('enabled', '==', true)
    .get();

  return snapshot.docs
    .map((document) => normalizeDevice(document.data(), uid, document.id))
    .filter((item): item is CandidatePushSubscriptionDevice => Boolean(item));
}

async function loadDevices(uid: string) {
  const snapshot = await getAvailabilityPushDeviceCollection(uid).get();
  return snapshot.docs
    .map((document) => normalizeDevice(document.data(), uid, document.id))
    .filter((item): item is CandidatePushSubscriptionDevice => Boolean(item));
}

function getAvailabilityEventPayload(
  candidateUid: string,
  action: AvailabilityConfirmationEvent['action'],
  source: AvailabilityNotificationSource,
  requestId?: string | null,
): AvailabilityConfirmationEvent {
  return {
    candidateUid,
    ...(requestId ? { requestId } : {}),
    action,
    source,
    createdAt: Timestamp.now(),
    schemaVersion: AVAILABILITY_CONFIRMATION_SCHEMA_VERSION,
  };
}

async function writeAvailabilityEvent(
  candidateUid: string,
  action: AvailabilityConfirmationEvent['action'],
  source: AvailabilityNotificationSource,
  requestId?: string | null,
) {
  await getAvailabilityEventRef().set(getAvailabilityEventPayload(candidateUid, action, source, requestId));
}

function buildAvailabilityNotificationUrl(requestId: string, token: string, decision?: CandidateAvailabilityConfirmationAction) {
  const params = new URLSearchParams({
    requestId,
    token,
  });

  if (decision) {
    params.set('decision', decision);
  }

  return `${AVAILABILITY_NOTIFICATION_CLICK_PATH}?${params.toString()}`;
}

async function updateCandidateAvailabilityProfile(
  uid: string,
  patch: Partial<CandidateProfile>,
) {
  const ref = getCandidateProfileRef(uid);
  await ref.update({
    ...patch,
    updatedAt: Timestamp.now(),
  });
}

async function ensureCandidateProfileExists(uid: string) {
  const profile = await loadCandidateProfile(uid);
  if (!profile) {
    throw new SevenoAvailabilityError('candidate_profile_missing', 404, 'Profil candidat introuvable.');
  }

  if (profile.role !== 'candidate') {
    throw new SevenoAvailabilityError('forbidden_role', 403, 'Seuls les candidats peuvent utiliser cette fonctionnalite.');
  }

  if (profile.profileStatus !== 'active') {
    throw new SevenoAvailabilityError('candidate_profile_inactive', 409, 'Le profil candidat doit etre actif.');
  }

  return profile;
}

function assertAllowedPushPermission(value: unknown) {
  if (value === 'default' || value === 'granted' || value === 'denied') {
    return value;
  }

  return null;
}

export async function confirmCandidateAvailabilityFromDashboard(
  uid: string,
  input: {
    action: CandidateAvailabilityConfirmationAction | 'immediate';
    source: AvailabilityNotificationSource;
  },
) {
  const profile = await ensureCandidateProfileExists(uid);
  const timezone = normalizeAvailabilityTimezone(profile.availabilityTimezone);
  const now = Timestamp.now();

  if (input.action === 'no') {
    await updateCandidateAvailabilityProfile(uid, {
      availability: 'not_available',
      availabilityAvailableFromAt: null,
      availabilityConfirmedAt: null,
      availabilityValidUntil: null,
      dailyAvailabilityConfirmationEnabled: false,
      nextAvailabilityReminderAt: null,
      availabilityTimezone: timezone,
      hasActiveAvailabilityPushSubscription: profile.hasActiveAvailabilityPushSubscription ?? false,
    });
    await writeAvailabilityEvent(uid, 'unavailable', input.source);
    return {
      profile: await loadCandidateProfile(uid),
      availability: profile.availability,
    };
  }

  const shouldEnableNotifications = input.action === 'immediate'
    ? true
    : profile.dailyAvailabilityConfirmationEnabled !== false;
  const nextReminderAt = shouldEnableNotifications
    ? Timestamp.fromDate(buildNextAvailabilityReminderAt(now.toDate(), timezone))
    : toTimestamp(profile.nextAvailabilityReminderAt);
  const availabilityAvailableFromAt = input.action === 'immediate'
    ? null
    : toTimestamp(profile.availabilityAvailableFromAt);

  await updateCandidateAvailabilityProfile(uid, {
    availability: 'immediate',
    availabilityAvailableFromAt,
    availabilityConfirmedAt: now,
    availabilityValidUntil: Timestamp.fromMillis(now.toMillis() + DAILY_AVAILABILITY_VALIDITY_HOURS * 60 * 60 * 1000),
    dailyAvailabilityConfirmationEnabled: shouldEnableNotifications,
    nextAvailabilityReminderAt: shouldEnableNotifications ? nextReminderAt : null,
    availabilityTimezone: timezone,
    hasActiveAvailabilityPushSubscription: profile.hasActiveAvailabilityPushSubscription ?? false,
  });
  await writeAvailabilityEvent(uid, 'confirmed', input.source);

  return {
    profile: await loadCandidateProfile(uid),
    availability: profile.availability,
  };
}

export async function setCandidateAvailabilityNotifications(
  uid: string,
  input: {
    enabled: boolean;
    source: AvailabilityNotificationSource;
    permission?: 'default' | 'granted' | 'denied' | null;
  },
) {
  const profile = await ensureCandidateProfileExists(uid);
  const timezone = normalizeAvailabilityTimezone(profile.availabilityTimezone);
  const now = Timestamp.now();
  const nextReminderAt = input.enabled && profile.availability === 'immediate'
    ? Timestamp.fromDate(buildNextAvailabilityReminderAt(now.toDate(), timezone))
    : null;

  await updateCandidateAvailabilityProfile(uid, {
    dailyAvailabilityConfirmationEnabled: input.enabled,
    nextAvailabilityReminderAt: nextReminderAt,
    availabilityTimezone: timezone,
    hasActiveAvailabilityPushSubscription: input.enabled
      ? profile.hasActiveAvailabilityPushSubscription ?? false
      : false,
    ...(input.permission ? { availabilityPushPermission: input.permission } : {}),
  });

  await writeAvailabilityEvent(uid, input.enabled ? 'confirmed' : 'unavailable', input.source);
  return loadCandidateProfile(uid);
}

export async function registerCandidateAvailabilityDevice(
  uid: string,
  input: {
    deviceId: string;
    token: string;
    permission: 'default' | 'granted' | 'denied';
    timezone?: string | null;
    platform?: string | null;
    userAgent?: string | null;
    source: AvailabilityNotificationSource;
  },
) {
  const profile = await ensureCandidateProfileExists(uid);
  const deviceId = cleanText(input.deviceId);
  const token = cleanText(input.token);
  if (!deviceId || !token) {
    throw new SevenoAvailabilityError('invalid_payload', 400, 'Les donnees de notification sont invalides.');
  }

  const permission = assertAllowedPushPermission(input.permission);
  if (!permission) {
    throw new SevenoAvailabilityError('invalid_payload', 400, 'La permission de notification est invalide.');
  }

  const deviceRef = getAvailabilityPushDeviceCollection(uid).doc(deviceId);
  const now = Timestamp.now();
  const payload: CandidatePushSubscriptionDevice = {
    uid,
    deviceId,
    token,
    permission,
    enabled: permission === 'granted',
    ...(cleanText(input.platform) ? { platform: cleanText(input.platform) } : {}),
    ...(cleanText(input.userAgent) ? { userAgent: cleanText(input.userAgent) } : {}),
    ...(normalizeAvailabilityTimezone(input.timezone) ? { timezone: normalizeAvailabilityTimezone(input.timezone) } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await deviceRef.set(payload, { merge: true });

  const devices = await loadDevices(uid);
  const hasActiveDevice = devices.some((device) => device.enabled && device.permission === 'granted');
  await updateCandidateAvailabilityProfile(uid, {
    dailyAvailabilityConfirmationEnabled: profile.dailyAvailabilityConfirmationEnabled ?? true,
    availabilityTimezone: payload.timezone ?? normalizeAvailabilityTimezone(profile.availabilityTimezone),
    hasActiveAvailabilityPushSubscription: hasActiveDevice,
    availabilityPushPermission: permission,
  });

  await writeAvailabilityEvent(uid, 'notification_sent', input.source);

  return {
    device: payload,
    hasActiveDevice,
  };
}

export async function disableCandidateAvailabilityDevice(
  uid: string,
  input: {
    deviceId: string;
    source: AvailabilityNotificationSource;
  },
) {
  const deviceId = cleanText(input.deviceId);
  if (!deviceId) {
    throw new SevenoAvailabilityError('invalid_payload', 400, 'Le deviceId est invalide.');
  }

  const deviceRef = getAvailabilityPushDeviceCollection(uid).doc(deviceId);
  const snapshot = await deviceRef.get();
  if (!snapshot.exists) {
    return null;
  }

  const existing = normalizeDevice(snapshot.data(), uid, deviceId);
  if (!existing) {
    return null;
  }

  await deviceRef.set({
    ...existing,
    enabled: false,
    revokedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });

  const devices = await loadDevices(uid);
  const hasActiveDevice = devices.some((device) => device.enabled && device.permission === 'granted');
  const profile = await ensureCandidateProfileExists(uid);
  await updateCandidateAvailabilityProfile(uid, {
    hasActiveAvailabilityPushSubscription: hasActiveDevice,
    availabilityPushPermission: hasActiveDevice ? profile.availabilityPushPermission ?? 'default' : profile.availabilityPushPermission ?? 'default',
  });

  await writeAvailabilityEvent(uid, 'notification_failed', input.source);
  return hasActiveDevice;
}

async function sendAvailabilityNotificationToDevices(
  profile: CandidateProfile,
  requestId: string,
  token: string,
  devices: CandidatePushSubscriptionDevice[],
) {
  if (getApps().length === 0) {
    return { sent: 0, failed: devices.length, invalidDeviceIds: devices.map((device) => device.deviceId) };
  }

  const messaging = getMessaging(getApp());
  const tokens = devices.map((device) => device.token);
  const message: MulticastMessage = {
    tokens,
    notification: {
      title: AVAILABILITY_NOTIFICATION_TITLE,
      body: AVAILABILITY_NOTIFICATION_BODY,
    },
    data: {
      requestId,
      token,
      candidateUid: profile.uid,
      publicCandidateId: profile.publicCandidateId,
      actionUrl: buildAvailabilityNotificationUrl(requestId, token),
      yesUrl: buildAvailabilityNotificationUrl(requestId, token, 'yes'),
      noUrl: buildAvailabilityNotificationUrl(requestId, token, 'no'),
    },
    webpush: {
      notification: {
        title: AVAILABILITY_NOTIFICATION_TITLE,
        body: AVAILABILITY_NOTIFICATION_BODY,
        requireInteraction: true,
        actions: [
          { action: 'availability_yes', title: 'Oui' },
          { action: 'availability_no', title: 'Non' },
        ],
      },
    },
  };

  const response = await messaging.sendEachForMulticast(message);
  const invalidDeviceIds: string[] = [];
  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = (result.error as { code?: unknown } | undefined)?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalidDeviceIds.push(devices[index].deviceId);
      }
    }
  });

  return {
    sent: response.successCount,
    failed: response.failureCount,
    invalidDeviceIds,
  };
}

async function updateAvailabilityRequestStatus(
  requestId: string,
  patch: Partial<AvailabilityConfirmationRequest>,
) {
  const requestRef = getAvailabilityRequestRef(requestId);
  await requestRef.update({
    ...patch,
    updatedAt: Timestamp.now(),
  });
}

export async function respondToAvailabilityConfirmationRequest(input: {
  requestId: string;
  token: string;
  action: CandidateAvailabilityConfirmationAction;
  source: AvailabilityNotificationSource;
}) {
  const requestId = cleanText(input.requestId);
  const token = cleanText(input.token);
  if (!requestId || !token) {
    throw new SevenoAvailabilityError('invalid_payload', 400, 'La demande de confirmation est invalide.');
  }

  const requestRef = getAvailabilityRequestRef(requestId);
  const snapshot = await requestRef.get();
  if (!snapshot.exists) {
    throw new SevenoAvailabilityError('request_not_found', 404, 'La demande de confirmation est introuvable.');
  }

  const request = snapshot.data() as FirestoreRecord;
  const requestStatus = cleanText(request.status);
  const requestTokenHash = cleanText(request.tokenHash);
  const expiresAt = toTimestamp(request.expiresAt);
  const answeredAt = request.answeredAt == null ? null : toTimestamp(request.answeredAt);
  const storedCandidateUid = cleanText(request.candidateUid);
  if (!storedCandidateUid || !requestStatus) {
    throw new SevenoAvailabilityError('request_invalid', 409, 'La demande de confirmation est invalide.');
  }

  if (requestStatus !== 'pending') {
    if (answeredAt && cleanText(request.answer) === input.action) {
      return {
        requestId,
        candidateUid: storedCandidateUid,
        status: requestStatus,
      };
    }

    throw new SevenoAvailabilityError(
      'request_already_processed',
      409,
      'Cette demande a deja ete traitee.',
    );
  }

  if (expiresAt && expiresAt.toMillis() <= Timestamp.now().toMillis()) {
    await requestRef.update({
      status: 'expired',
      source: 'scheduler',
      updatedAt: Timestamp.now(),
    });
    await writeAvailabilityEvent(storedCandidateUid, 'expired', input.source, requestId);
    throw new SevenoAvailabilityError('request_expired', 410, 'La demande de confirmation a expire.');
  }

  if (!requestTokenHash || hashToken(token) !== requestTokenHash) {
    throw new SevenoAvailabilityError('invalid_token', 403, 'Le jeton de confirmation est invalide.');
  }

  const profile = await ensureCandidateProfileExists(storedCandidateUid);
  const now = Timestamp.now();
  const timezone = normalizeAvailabilityTimezone(profile.availabilityTimezone);

  if (input.action === 'no') {
    await updateCandidateAvailabilityProfile(storedCandidateUid, {
      availability: 'not_available',
      availabilityAvailableFromAt: null,
      availabilityConfirmedAt: null,
      availabilityValidUntil: null,
      dailyAvailabilityConfirmationEnabled: false,
      nextAvailabilityReminderAt: null,
      availabilityTimezone: timezone,
      hasActiveAvailabilityPushSubscription: profile.hasActiveAvailabilityPushSubscription ?? false,
    });
    await updateAvailabilityRequestStatus(requestId, {
      status: 'unavailable',
      answeredAt: now,
      answer: 'no',
      source: input.source,
      notificationSentAt: request.notificationSentAt == null ? now : toTimestamp(request.notificationSentAt),
      tokenHash: requestTokenHash,
      expiresAt: expiresAt ?? Timestamp.fromMillis(now.toMillis() + AVAILABILITY_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000),
    });
    await writeAvailabilityEvent(storedCandidateUid, 'unavailable', input.source, requestId);
    return {
      requestId,
      candidateUid: storedCandidateUid,
      status: 'unavailable',
      availability: 'not_available' as const,
    };
  }

  const availabilityConfirmedAt = now;
  const availabilityValidUntil = Timestamp.fromMillis(now.toMillis() + DAILY_AVAILABILITY_VALIDITY_HOURS * 60 * 60 * 1000);
  const nextReminderAt = profile.dailyAvailabilityConfirmationEnabled === false
    ? null
    : Timestamp.fromDate(buildNextAvailabilityReminderAt(now.toDate(), timezone));

  await updateCandidateAvailabilityProfile(storedCandidateUid, {
    availability: 'immediate',
    availabilityAvailableFromAt: null,
    availabilityConfirmedAt,
    availabilityValidUntil,
    dailyAvailabilityConfirmationEnabled: profile.dailyAvailabilityConfirmationEnabled !== false,
    nextAvailabilityReminderAt: nextReminderAt,
    availabilityTimezone: timezone,
    hasActiveAvailabilityPushSubscription: profile.hasActiveAvailabilityPushSubscription ?? false,
  });

  await updateAvailabilityRequestStatus(requestId, {
    status: 'confirmed',
    answeredAt: now,
    answer: 'yes',
    source: input.source,
    notificationSentAt: request.notificationSentAt == null ? now : toTimestamp(request.notificationSentAt),
    tokenHash: requestTokenHash,
    expiresAt: expiresAt ?? Timestamp.fromMillis(now.toMillis() + AVAILABILITY_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000),
  });
  await writeAvailabilityEvent(storedCandidateUid, 'confirmed', input.source, requestId);

  return {
    requestId,
    candidateUid: storedCandidateUid,
    status: 'confirmed',
    availability: 'immediate' as const,
    availabilityView: toPublicAvailabilityLabel({
      ...profile,
      availability: 'immediate',
      availabilityConfirmedAt,
      availabilityValidUntil,
      nextAvailabilityReminderAt: nextReminderAt,
      availabilityTimezone: timezone,
    }, now.toDate()),
  };
}

export async function updateCandidateAvailabilityPreferences(input: {
  uid: string;
  action: 'enable' | 'disable';
  source: AvailabilityNotificationSource;
  permission?: 'default' | 'granted' | 'denied' | null;
}) {
  const profile = await ensureCandidateProfileExists(input.uid);
  const enabled = input.action === 'enable';
  const timezone = normalizeAvailabilityTimezone(profile.availabilityTimezone);
  const now = Timestamp.now();
  const nextReminderAt = enabled && profile.availability === 'immediate'
    ? Timestamp.fromDate(buildNextAvailabilityReminderAt(now.toDate(), timezone))
    : null;

  await updateCandidateAvailabilityProfile(input.uid, {
    dailyAvailabilityConfirmationEnabled: enabled,
    nextAvailabilityReminderAt: nextReminderAt,
    availabilityTimezone: timezone,
    hasActiveAvailabilityPushSubscription: enabled
      ? profile.hasActiveAvailabilityPushSubscription ?? false
      : false,
    ...(input.permission ? { availabilityPushPermission: input.permission } : {}),
  });

  await writeAvailabilityEvent(input.uid, enabled ? 'confirmed' : 'unavailable', input.source);

  return {
    profile: await loadCandidateProfile(input.uid),
    availabilityView: getCandidateAvailabilityView({
      ...profile,
      dailyAvailabilityConfirmationEnabled: enabled,
      nextAvailabilityReminderAt: nextReminderAt,
      availabilityTimezone: timezone,
      hasActiveAvailabilityPushSubscription: enabled
        ? profile.hasActiveAvailabilityPushSubscription ?? false
        : false,
      ...(input.permission ? { availabilityPushPermission: input.permission } : {}),
    }, now.toDate()),
  };
}

export async function processAvailabilityRemindersBatch(cursorValue?: string | null) {
  const firestore = requireAdminDatabase();
  let query = firestore
    .collection(CANDIDATE_PROFILES_COLLECTION)
    .where('profileStatus', '==', 'active')
    .where('availability', '==', 'immediate')
    .where('dailyAvailabilityConfirmationEnabled', '==', true)
    .where('nextAvailabilityReminderAt', '<=', Timestamp.now())
    .orderBy('nextAvailabilityReminderAt', 'asc')
    .orderBy('publicCandidateId', 'asc');

  if (cursorValue) {
    try {
      const parsed = JSON.parse(Buffer.from(cursorValue, 'base64url').toString('utf8')) as { nextAvailabilityReminderAt?: unknown; publicCandidateId?: unknown };
      const cursorDate = toAvailabilityDate(parsed.nextAvailabilityReminderAt as string | Date | number | null | undefined);
      const cursorPublicCandidateId = cleanText(parsed.publicCandidateId);
      if (cursorDate && cursorPublicCandidateId) {
        query = query.startAfter(cursorDate, cursorPublicCandidateId);
      }
    } catch {
      // Ignore malformed cursors and restart from the beginning.
    }
  }

  const snapshot = await query.limit(AVAILABILITY_BATCH_SIZE + 1).get();
  const documents = snapshot.docs.slice(0, AVAILABILITY_BATCH_SIZE);
  const candidates = documents
    .map((document) => normalizeCandidateProfile(document.data()))
    .filter((item): item is CandidateProfile => Boolean(item));
  const hasMore = snapshot.docs.length > AVAILABILITY_BATCH_SIZE;
  let nextCursor: string | null = null;
  if (hasMore && documents.length > 0) {
    const lastDocument = documents[documents.length - 1];
    nextCursor = Buffer.from(JSON.stringify({
      nextAvailabilityReminderAt: toTimestamp(lastDocument.get('nextAvailabilityReminderAt'))?.toDate().toISOString() ?? null,
      publicCandidateId: lastDocument.get('publicCandidateId') ?? null,
    }), 'utf8').toString('base64url');
  }

  const summary = {
    scanned: candidates.length,
    sent: 0,
    failed: 0,
    invalidDeviceIds: [] as Array<{ uid: string; deviceId: string }>,
    processed: 0,
  };

  for (const candidate of candidates) {
    summary.processed += 1;
    if (!isCandidateAvailabilityReminderDue(candidate)) {
      continue;
    }

    const periodKey = buildAvailabilityReminderPeriodKey(Timestamp.now().toDate(), normalizeAvailabilityTimezone(candidate.availabilityTimezone));
    const requestId = buildRequestId(candidate.uid, periodKey);
    const requestRef = getAvailabilityRequestRef(requestId);
    const requestSnapshot = await requestRef.get();
    const activeDevices = await loadActiveDevices(candidate.uid);
    const requestTime = Timestamp.now();
    const existingRequestStatus = requestSnapshot.exists ? cleanText(requestSnapshot.get('status')) : null;
    const existingNotificationSentAt = requestSnapshot.exists ? toTimestamp(requestSnapshot.get('notificationSentAt')) : null;

    if (existingRequestStatus && existingRequestStatus !== 'pending') {
      continue;
    }

    if (!requestSnapshot.exists) {
      await requestRef.create({
        id: requestId,
        candidateUid: candidate.uid,
        publicCandidateId: candidate.publicCandidateId,
        periodKey,
        status: 'pending',
        tokenHash: null,
        expiresAt: Timestamp.fromMillis(requestTime.toMillis() + AVAILABILITY_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000),
        notificationSentAt: null,
        answeredAt: null,
        answer: null,
        source: 'scheduler',
        createdAt: requestTime,
        updatedAt: requestTime,
        schemaVersion: AVAILABILITY_CONFIRMATION_SCHEMA_VERSION,
      } satisfies AvailabilityConfirmationRequest);
    } else if (existingNotificationSentAt) {
      await updateCandidateAvailabilityProfile(candidate.uid, {
        nextAvailabilityReminderAt: Timestamp.fromDate(buildNextAvailabilityReminderAt(requestTime.toDate(), normalizeAvailabilityTimezone(candidate.availabilityTimezone))),
      });
      continue;
    }

    if (activeDevices.length === 0) {
      await updateCandidateAvailabilityProfile(candidate.uid, {
        lastAvailabilityNotificationAt: requestTime,
        nextAvailabilityReminderAt: Timestamp.fromDate(buildNextAvailabilityReminderAt(requestTime.toDate(), normalizeAvailabilityTimezone(candidate.availabilityTimezone))),
      });
      summary.failed += 1;
      continue;
    }

    const token = buildRequestToken();
    const tokenHash = hashToken(token);
    await requestRef.set({
      id: requestId,
      candidateUid: candidate.uid,
      publicCandidateId: candidate.publicCandidateId,
      periodKey,
      status: 'pending',
      tokenHash,
      expiresAt: Timestamp.fromMillis(requestTime.toMillis() + AVAILABILITY_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000),
      notificationSentAt: requestTime,
      answeredAt: null,
      answer: null,
      source: 'scheduler',
      createdAt: requestSnapshot.exists && requestSnapshot.get('createdAt') instanceof Timestamp
        ? requestSnapshot.get('createdAt')
        : requestTime,
      updatedAt: requestTime,
      schemaVersion: AVAILABILITY_CONFIRMATION_SCHEMA_VERSION,
    } satisfies AvailabilityConfirmationRequest, { merge: true });

    try {
      const result = await sendAvailabilityNotificationToDevices(candidate, requestId, token, activeDevices);
      summary.sent += result.sent;
      summary.failed += result.failed;
      summary.invalidDeviceIds.push(...result.invalidDeviceIds.map((deviceId) => ({ uid: candidate.uid, deviceId })));

      await updateCandidateAvailabilityProfile(candidate.uid, {
        lastAvailabilityNotificationAt: requestTime,
        nextAvailabilityReminderAt: Timestamp.fromDate(buildNextAvailabilityReminderAt(requestTime.toDate(), normalizeAvailabilityTimezone(candidate.availabilityTimezone))),
        hasActiveAvailabilityPushSubscription: activeDevices.length > result.invalidDeviceIds.length,
      });

      for (const deviceId of result.invalidDeviceIds) {
        await disableCandidateAvailabilityDevice(candidate.uid, {
          deviceId,
          source: 'scheduler',
        });
      }
    } catch (error) {
      await updateCandidateAvailabilityProfile(candidate.uid, {
        lastAvailabilityNotificationAt: requestTime,
        nextAvailabilityReminderAt: Timestamp.fromDate(buildNextAvailabilityReminderAt(requestTime.toDate(), normalizeAvailabilityTimezone(candidate.availabilityTimezone))),
      });
      summary.failed += 1;
      await writeAvailabilityEvent(candidate.uid, 'notification_failed', 'scheduler', requestId);
      console.error('[availability scheduler] push failure', error);
    }
  }

  return {
    nextCursor,
    hasMore,
    ...summary,
  };
}

export async function getAvailabilityRequestById(requestId: string) {
  const snapshot = await getAvailabilityRequestRef(requestId).get();
  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() as AvailabilityConfirmationRequest;
}

export function buildAvailabilityFallbackUrl(requestId: string, token: string) {
  return buildAvailabilityNotificationUrl(requestId, token);
}
