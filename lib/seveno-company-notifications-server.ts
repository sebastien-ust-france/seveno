import 'server-only';

import { randomUUID } from 'node:crypto';
import { getApp, getApps } from 'firebase-admin/app';
import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import { buildCompanyMembershipId } from '@/lib/seveno-company-memberships-server';
import { buildCompanyApplicationClickUrl } from '@/lib/seveno-company-notification-foreground';
import type { CompanyNotificationServerState } from '@/lib/seveno-company-notification-readiness';

export const COMPANY_PUSH_SUBSCRIPTIONS_COLLECTION = 'company_push_subscriptions';
export const NOTIFICATION_OUTBOX_COLLECTION = 'notification_outbox';
export const COMPANY_NOTIFICATION_PAYLOAD_VERSION = 1;
export const COMPANY_APPLICATION_EVENT_TYPE = 'application_submitted';
export const COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE = 'application_questionnaire_completed';

const COMPANY_PUSH_DEVICES_COLLECTION = 'devices';
const COMPANY_PROFILES_COLLECTION = 'company_profiles';
const APPLICATIONS_COLLECTION = 'job_applications';
const OFFERS_COLLECTION = 'job_offers';
const RESULTS_COLLECTION = 'test_results';
const USERS_COLLECTION = 'users';
const MAX_DELIVERY_ATTEMPTS = 5;
const PROCESSING_LEASE_MINUTES = 5;
const BASE_RETRY_MINUTES = 5;

type FirestoreRecord = Record<string, unknown>;
type CompanyNotificationPreferenceCode = 'application_received' | 'questionnaire_completed';
type NotificationOutboxStatus = 'pending' | 'processing' | 'sent' | 'partial' | 'failed' | 'skipped';

export interface CompanyPushDevice {
  companyUid: string;
  deviceId: string;
  token: string;
  permission: NotificationPermission;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSeenAt: Timestamp;
  lastNotificationAt: Timestamp | null;
  revokedAt: Timestamp | null;
  platform?: string;
  userAgent?: string;
}

interface CompanyNotificationEventBase {
  idempotencyKey: string;
  recipientUid: string;
  recipientRole: 'company';
  applicationId: string;
  offerId: string;
  companyUid: string;
  status: NotificationOutboxStatus;
  attempts: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  nextAttemptAt: Timestamp;
  sentAt: Timestamp | null;
  lastErrorCode: string | null;
  payloadVersion: number;
  processingToken: string | null;
  processingStartedAt: Timestamp | null;
  processingLeaseExpiresAt: Timestamp | null;
  successCount: number;
  failureCount: number;
}

export interface ApplicationSubmittedNotificationEvent extends CompanyNotificationEventBase {
  eventType: typeof COMPANY_APPLICATION_EVENT_TYPE;
}

export interface ApplicationQuestionnaireCompletedNotificationEvent extends CompanyNotificationEventBase {
  eventType: typeof COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE;
  resultId: string;
}

type CompanyNotificationEvent =
  | ApplicationSubmittedNotificationEvent
  | ApplicationQuestionnaireCompletedNotificationEvent;

export interface CompanyMulticastSenderResult {
  successCount: number;
  failureCount: number;
  responses: Array<{
    success: boolean;
    error?: { code?: string };
  }>;
}

export type CompanyMulticastSender = (message: MulticastMessage) => Promise<CompanyMulticastSenderResult>;

export class SevenoCompanyNotificationError extends Error {
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
    throw new SevenoCompanyNotificationError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n’est pas configuré pour gérer les notifications entreprise.',
    );
  }

  return adminDb;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toTimestamp(value: unknown) {
  if (value instanceof Timestamp) {
    return value;
  }
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }
  return null;
}

function isPermission(value: unknown): value is NotificationPermission {
  return value === 'default' || value === 'granted' || value === 'denied';
}

function getCompanySubscriptionRef(companyUid: string) {
  return requireDatabase().collection(COMPANY_PUSH_SUBSCRIPTIONS_COLLECTION).doc(companyUid);
}

function getCompanyDeviceCollection(companyUid: string) {
  return getCompanySubscriptionRef(companyUid).collection(COMPANY_PUSH_DEVICES_COLLECTION);
}

export function buildApplicationSubmittedNotificationEventId(applicationId: string) {
  return `${COMPANY_APPLICATION_EVENT_TYPE}:${cleanText(applicationId)}`;
}

export function buildApplicationSubmittedNotificationEvent(input: {
  applicationId: string;
  offerId: string;
  companyUid: string;
  recipientUid: string;
  now: Timestamp;
}): ApplicationSubmittedNotificationEvent {
  const idempotencyKey = buildApplicationSubmittedNotificationEventId(input.applicationId);
  return {
    eventType: COMPANY_APPLICATION_EVENT_TYPE,
    idempotencyKey,
    recipientUid: input.recipientUid || input.companyUid,
    recipientRole: 'company',
    applicationId: input.applicationId,
    offerId: input.offerId,
    companyUid: input.companyUid,
    status: 'pending',
    attempts: 0,
    createdAt: input.now,
    updatedAt: input.now,
    nextAttemptAt: input.now,
    sentAt: null,
    lastErrorCode: null,
    payloadVersion: COMPANY_NOTIFICATION_PAYLOAD_VERSION,
    processingToken: null,
    processingStartedAt: null,
    processingLeaseExpiresAt: null,
    successCount: 0,
    failureCount: 0,
  };
}

export function buildApplicationQuestionnaireCompletedNotificationEventId(
  applicationId: string,
  sessionId: string,
) {
  return `${COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE}:${cleanText(applicationId)}:${cleanText(sessionId)}`;
}

export function buildApplicationQuestionnaireCompletedNotificationEvent(input: {
  applicationId: string;
  offerId: string;
  companyUid: string;
  recipientUid: string;
  resultId: string;
  now: Timestamp;
}): ApplicationQuestionnaireCompletedNotificationEvent {
  const idempotencyKey = buildApplicationQuestionnaireCompletedNotificationEventId(
    input.applicationId,
    input.resultId,
  );
  return {
    eventType: COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE,
    idempotencyKey,
    recipientUid: input.recipientUid || input.companyUid,
    recipientRole: 'company',
    applicationId: input.applicationId,
    offerId: input.offerId,
    companyUid: input.companyUid,
    resultId: input.resultId,
    status: 'pending',
    attempts: 0,
    createdAt: input.now,
    updatedAt: input.now,
    nextAttemptAt: input.now,
    sentAt: null,
    lastErrorCode: null,
    payloadVersion: COMPANY_NOTIFICATION_PAYLOAD_VERSION,
    processingToken: null,
    processingStartedAt: null,
    processingLeaseExpiresAt: null,
    successCount: 0,
    failureCount: 0,
  };
}

export async function prepareApplicationSubmittedNotificationEvent(
  transaction: Transaction,
  firestore: Firestore,
  input: {
    applicationId: string;
    offerId: string;
    companyUid: string;
    now: Timestamp;
  },
) {
  const eventId = buildApplicationSubmittedNotificationEventId(input.applicationId);
  const eventRef = firestore.collection(NOTIFICATION_OUTBOX_COLLECTION).doc(eventId);
  const offerRef = firestore.collection('job_offers').doc(input.offerId);
  const offer = await transaction.get(offerRef);
  const recipientUid = cleanText(offer.get('assignedToUid'));
  if (!offer.exists || offer.get('companyUid') !== input.companyUid || !recipientUid) throw new SevenoCompanyNotificationError('notification_assignee_missing', 409, 'Responsable du recrutement introuvable.');
  const recipient = await transaction.get(firestore.collection('company_memberships').doc(buildCompanyMembershipId(input.companyUid, recipientUid)));
  if (!recipient.exists || recipient.get('status') !== 'active' || !['owner', 'admin', 'recruiter'].includes(String(recipient.get('role')))) throw new SevenoCompanyNotificationError('notification_assignee_inactive', 409, 'Le responsable du recrutement n’est pas actif.');
  const snapshot = await transaction.get(eventRef);
  if (snapshot.exists) {
    const existing = snapshot.data();
    if (
      existing?.eventType !== COMPANY_APPLICATION_EVENT_TYPE
      || existing?.applicationId !== input.applicationId
      || existing?.offerId !== input.offerId
      || existing?.companyUid !== input.companyUid
      || existing?.recipientUid !== recipientUid
    ) {
      throw new SevenoCompanyNotificationError('notification_event_conflict', 409, 'L’événement de notification est incohérent.');
    }
    return { eventId, created: false };
  }

  transaction.create(eventRef, buildApplicationSubmittedNotificationEvent({ ...input, recipientUid }));
  return { eventId, created: true };
}

export async function prepareApplicationQuestionnaireCompletedNotificationEvent(
  transaction: Transaction,
  firestore: Firestore,
  input: {
    applicationId: string;
    offerId: string;
    companyUid: string;
    resultId: string;
    now: Timestamp;
  },
) {
  const eventId = buildApplicationQuestionnaireCompletedNotificationEventId(
    input.applicationId,
    input.resultId,
  );
  const eventRef = firestore.collection(NOTIFICATION_OUTBOX_COLLECTION).doc(eventId);
  const offer = await transaction.get(firestore.collection('job_offers').doc(input.offerId));
  const recipientUid = cleanText(offer.get('assignedToUid'));
  if (!offer.exists || offer.get('companyUid') !== input.companyUid || !recipientUid) throw new SevenoCompanyNotificationError('notification_assignee_missing', 409, 'Responsable du recrutement introuvable.');
  const recipient = await transaction.get(firestore.collection('company_memberships').doc(buildCompanyMembershipId(input.companyUid, recipientUid)));
  if (!recipient.exists || recipient.get('status') !== 'active' || !['owner', 'admin', 'recruiter'].includes(String(recipient.get('role')))) throw new SevenoCompanyNotificationError('notification_assignee_inactive', 409, 'Le responsable du recrutement n’est pas actif.');
  const snapshot = await transaction.get(eventRef);
  if (snapshot.exists) {
    const existing = snapshot.data();
    if (
      existing?.eventType !== COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE
      || existing?.applicationId !== input.applicationId
      || existing?.offerId !== input.offerId
      || existing?.companyUid !== input.companyUid
      || existing?.recipientUid !== recipientUid
      || existing?.resultId !== input.resultId
    ) {
      throw new SevenoCompanyNotificationError('notification_event_conflict', 409, 'L’événement de notification est incohérent.');
    }
    return { eventId, created: false };
  }

  transaction.create(eventRef, buildApplicationQuestionnaireCompletedNotificationEvent({ ...input, recipientUid }));
  return { eventId, created: true };
}

async function ensureCompanyContext(companyUid: string) {
  const actor = await getSevenoUserByUid(companyUid);
  if (!actor || actor.role !== 'company') {
    throw new SevenoCompanyNotificationError('forbidden_role', 403, 'Seules les entreprises peuvent gérer ces notifications.');
  }
}

function normalizeDevice(documentId: string, data: unknown, companyUid: string): CompanyPushDevice | null {
  if (!isPlainObject(data) || cleanText(data.companyUid) !== companyUid) {
    return null;
  }

  const deviceId = cleanText(data.deviceId);
  const token = cleanText(data.token);
  const permission = isPermission(data.permission) ? data.permission : null;
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);
  const lastSeenAt = toTimestamp(data.lastSeenAt);
  if (!deviceId || deviceId !== documentId || !token || !permission || !createdAt || !updatedAt || !lastSeenAt) {
    return null;
  }

  return {
    companyUid,
    deviceId,
    token,
    permission,
    enabled: data.enabled === true,
    createdAt,
    updatedAt,
    lastSeenAt,
    lastNotificationAt: toTimestamp(data.lastNotificationAt),
    revokedAt: toTimestamp(data.revokedAt),
    ...(cleanText(data.platform) ? { platform: cleanText(data.platform) } : {}),
    ...(cleanText(data.userAgent) ? { userAgent: cleanText(data.userAgent) } : {}),
  };
}

async function loadActiveCompanyDevices(companyUid: string) {
  const snapshot = await getCompanyDeviceCollection(companyUid).where('enabled', '==', true).get();
  return snapshot.docs
    .map((document) => normalizeDevice(document.id, document.data(), companyUid))
    .filter((device): device is CompanyPushDevice => Boolean(device && device.permission === 'granted'));
}

function normalizePreferences(data: unknown) {
  const preferences = isPlainObject(data) ? data : {};
  return {
    application_received: preferences.application_received === true,
    questionnaire_completed: preferences.questionnaire_completed === true,
  };
}

export async function getCompanyNotificationState(
  companyUid: string,
  deviceId?: string | null,
): Promise<CompanyNotificationServerState> {
  await ensureCompanyContext(companyUid);
  const normalizedDeviceId = cleanText(deviceId);
  const [subscription, activeDevices, currentDevice] = await Promise.all([
    getCompanySubscriptionRef(companyUid).get(),
    loadActiveCompanyDevices(companyUid),
    normalizedDeviceId ? getCompanyDeviceCollection(companyUid).doc(normalizedDeviceId).get() : Promise.resolve(null),
  ]);
  const preferences = normalizePreferences(subscription.get('preferences'));
  const normalizedCurrentDevice = currentDevice?.exists
    ? normalizeDevice(currentDevice.id, currentDevice.data(), companyUid)
    : null;

  return {
    applicationReceivedEnabled: preferences.application_received,
    questionnaireCompletedEnabled: preferences.questionnaire_completed,
    currentDeviceRegistered: Boolean(normalizedCurrentDevice?.enabled && normalizedCurrentDevice.permission === 'granted'),
    hasActiveDevice: activeDevices.length > 0,
  };
}

export async function registerCompanyNotificationDevice(companyUid: string, input: {
  deviceId: string;
  token: string;
  permission: NotificationPermission;
  platform?: string | null;
  userAgent?: string | null;
}) {
  await ensureCompanyContext(companyUid);
  const deviceId = cleanText(input.deviceId);
  const token = cleanText(input.token);
  if (!deviceId || !token || !isPermission(input.permission) || input.permission !== 'granted') {
    throw new SevenoCompanyNotificationError('invalid_device', 400, 'L’appareil de notification est invalide.');
  }

  const firestore = requireDatabase();
  const subscriptionRef = firestore.collection(COMPANY_PUSH_SUBSCRIPTIONS_COLLECTION).doc(companyUid);
  const deviceRef = subscriptionRef.collection(COMPANY_PUSH_DEVICES_COLLECTION).doc(deviceId);
  const now = Timestamp.now();
  await firestore.runTransaction(async (transaction) => {
    const [subscription, existingDevice] = await Promise.all([
      transaction.get(subscriptionRef),
      transaction.get(deviceRef),
    ]);
    const preferences = normalizePreferences(subscription.get('preferences'));
    const createdAt = toTimestamp(existingDevice.get('createdAt')) ?? now;
    transaction.set(subscriptionRef, {
      companyUid,
      preferences,
      createdAt: toTimestamp(subscription.get('createdAt')) ?? now,
      updatedAt: now,
    }, { merge: true });
    transaction.set(deviceRef, {
      companyUid,
      deviceId,
      token,
      permission: input.permission,
      enabled: true,
      createdAt,
      updatedAt: now,
      lastSeenAt: now,
      lastNotificationAt: toTimestamp(existingDevice.get('lastNotificationAt')),
      revokedAt: null,
      ...(cleanText(input.platform) ? { platform: cleanText(input.platform) } : {}),
      ...(cleanText(input.userAgent) ? { userAgent: cleanText(input.userAgent) } : {}),
    }, { merge: true });
  });

  return getCompanyNotificationState(companyUid, deviceId);
}

export async function setCompanyNotificationPreference(
  companyUid: string,
  notificationType: CompanyNotificationPreferenceCode,
  enabled: boolean,
) {
  await ensureCompanyContext(companyUid);
  if (notificationType !== 'application_received' && notificationType !== 'questionnaire_completed') {
    throw new SevenoCompanyNotificationError('notification_type_not_available', 400, 'Ce type de notification n’est pas disponible.');
  }
  if (enabled && (await loadActiveCompanyDevices(companyUid)).length === 0) {
    throw new SevenoCompanyNotificationError('active_device_required', 409, 'Enregistrez cet appareil avant d’activer les notifications.');
  }

  const ref = getCompanySubscriptionRef(companyUid);
  const snapshot = await ref.get();
  const preferences = normalizePreferences(snapshot.get('preferences'));
  await ref.set({
    companyUid,
    preferences: {
      ...preferences,
      [notificationType]: enabled,
    },
    createdAt: toTimestamp(snapshot.get('createdAt')) ?? Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  return getCompanyNotificationState(companyUid);
}

export async function disableCompanyNotificationDevice(companyUid: string, deviceId: string) {
  await ensureCompanyContext(companyUid);
  const normalizedDeviceId = cleanText(deviceId);
  if (!normalizedDeviceId) {
    throw new SevenoCompanyNotificationError('invalid_device', 400, 'L’appareil de notification est invalide.');
  }
  const ref = getCompanyDeviceCollection(companyUid).doc(normalizedDeviceId);
  const snapshot = await ref.get();
  const device = snapshot.exists ? normalizeDevice(snapshot.id, snapshot.data(), companyUid) : null;
  if (device) {
    await ref.set({ enabled: false, revokedAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
  }
  return getCompanyNotificationState(companyUid, normalizedDeviceId);
}

function normalizeEvent(id: string, data: unknown): CompanyNotificationEvent | null {
  if (
    !isPlainObject(data)
    || (data.eventType !== COMPANY_APPLICATION_EVENT_TYPE
      && data.eventType !== COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE)
  ) {
    return null;
  }
  const status = ['pending', 'processing', 'sent', 'partial', 'failed', 'skipped'].includes(String(data.status))
    ? data.status as NotificationOutboxStatus
    : null;
  const createdAt = toTimestamp(data.createdAt);
  const updatedAt = toTimestamp(data.updatedAt);
  const nextAttemptAt = toTimestamp(data.nextAttemptAt);
  if (
    !status || !createdAt || !updatedAt || !nextAttemptAt
    || cleanText(data.idempotencyKey) !== id
    || !cleanText(data.recipientUid)
    || data.recipientRole !== 'company'
  ) {
    return null;
  }

  const common: CompanyNotificationEventBase = {
    idempotencyKey: id,
    recipientUid: cleanText(data.recipientUid),
    recipientRole: 'company',
    applicationId: cleanText(data.applicationId),
    offerId: cleanText(data.offerId),
    companyUid: cleanText(data.companyUid),
    status,
    attempts: typeof data.attempts === 'number' ? data.attempts : 0,
    createdAt,
    updatedAt,
    nextAttemptAt,
    sentAt: toTimestamp(data.sentAt),
    lastErrorCode: cleanText(data.lastErrorCode) || null,
    payloadVersion: typeof data.payloadVersion === 'number' ? data.payloadVersion : 0,
    processingToken: cleanText(data.processingToken) || null,
    processingStartedAt: toTimestamp(data.processingStartedAt),
    processingLeaseExpiresAt: toTimestamp(data.processingLeaseExpiresAt),
    successCount: typeof data.successCount === 'number' ? data.successCount : 0,
    failureCount: typeof data.failureCount === 'number' ? data.failureCount : 0,
  };

  if (data.eventType === COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE) {
    const resultId = cleanText(data.resultId);
    if (!resultId) {
      return null;
    }
    return {
      ...common,
      eventType: COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE,
      resultId,
    };
  }

  return {
    ...common,
    eventType: COMPANY_APPLICATION_EVENT_TYPE,
  };
}

async function claimNotificationEvent(eventId: string, now: Timestamp) {
  const firestore = requireDatabase();
  const ref = firestore.collection(NOTIFICATION_OUTBOX_COLLECTION).doc(eventId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const event = snapshot.exists ? normalizeEvent(snapshot.id, snapshot.data()) : null;
    if (!event || event.status === 'sent' || event.status === 'partial' || event.status === 'skipped') {
      return null;
    }
    if (event.status === 'processing' && event.processingLeaseExpiresAt && event.processingLeaseExpiresAt.toMillis() > now.toMillis()) {
      return null;
    }
    if (event.nextAttemptAt.toMillis() > now.toMillis()) {
      return null;
    }
    if (event.attempts >= MAX_DELIVERY_ATTEMPTS) {
      transaction.update(ref, {
        status: 'failed',
        lastErrorCode: 'max_attempts_reached',
        updatedAt: now,
        processingToken: null,
        processingStartedAt: null,
        processingLeaseExpiresAt: null,
      });
      return null;
    }

    const processingToken = randomUUID();
    transaction.update(ref, {
      status: 'processing',
      attempts: event.attempts + 1,
      processingToken,
      processingStartedAt: now,
      processingLeaseExpiresAt: Timestamp.fromMillis(now.toMillis() + PROCESSING_LEASE_MINUTES * 60_000),
      updatedAt: now,
    });
    return { event: { ...event, status: 'processing' as const, attempts: event.attempts + 1 }, processingToken };
  });
}

async function completeClaimedEvent(
  eventId: string,
  processingToken: string,
  patch: Partial<CompanyNotificationEventBase>,
) {
  const firestore = requireDatabase();
  const ref = firestore.collection(NOTIFICATION_OUTBOX_COLLECTION).doc(eventId);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('status') !== 'processing' || snapshot.get('processingToken') !== processingToken) {
      return;
    }
    transaction.update(ref, {
      ...patch,
      processingToken: null,
      processingStartedAt: null,
      processingLeaseExpiresAt: null,
      updatedAt: Timestamp.now(),
    });
  });
}

function isInvalidTokenError(code: string | undefined) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}

function defaultSender(message: MulticastMessage): Promise<CompanyMulticastSenderResult> {
  if (getApps().length === 0) {
    throw new Error('firebase_messaging_unavailable');
  }
  return getMessaging(getApp()).sendEachForMulticast(message);
}

function buildApplicationNotificationBody(title: string) {
  const normalizedTitle = cleanText(title);
  return normalizedTitle
    ? `Un candidat vient de postuler à votre offre « ${normalizedTitle} ».`
    : 'Un candidat vient de postuler à l’une de vos offres.';
}

function buildQuestionnaireCompletedNotificationBody(title: string) {
  const normalizedTitle = cleanText(title);
  return normalizedTitle
    ? `Un candidat a terminé le questionnaire lié à votre offre « ${normalizedTitle} ».`
    : 'Un candidat a terminé le questionnaire lié à l’une de vos offres.';
}

async function skipEvent(eventId: string, processingToken: string, code: string) {
  await completeClaimedEvent(eventId, processingToken, {
    status: 'skipped',
    lastErrorCode: code,
    sentAt: null,
    successCount: 0,
    failureCount: 0,
  });
}

async function deliverClaimedEvent(
  eventId: string,
  event: CompanyNotificationEvent,
  processingToken: string,
  sender: CompanyMulticastSender,
) {
  const firestore = requireDatabase();
  const [user, companyProfile, application, offer, subscription, result] = await Promise.all([
    firestore.collection(USERS_COLLECTION).doc(event.recipientUid).get(),
    firestore.collection(COMPANY_PROFILES_COLLECTION).doc(event.companyUid).get(),
    firestore.collection(APPLICATIONS_COLLECTION).doc(event.applicationId).get(),
    firestore.collection(OFFERS_COLLECTION).doc(event.offerId).get(),
    firestore.collection(COMPANY_PUSH_SUBSCRIPTIONS_COLLECTION).doc(event.recipientUid).get(),
    event.eventType === COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE
      ? firestore.collection(RESULTS_COLLECTION).doc(event.resultId).get()
      : Promise.resolve(null),
  ]);
  if (!user.exists || user.get('role') !== 'company' || !companyProfile.exists) {
    return skipEvent(eventId, processingToken, 'company_unavailable');
  }
  const applicationStatus = String(application.get('status') ?? '');
  const applicationAvailable = application.exists
    && application.get('companyUid') === event.companyUid
    && application.get('offerId') === event.offerId
    && (event.eventType === COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE
      ? applicationStatus === 'questionnaire_completed'
      : ['submitted', 'viewed', 'questionnaire_pending', 'questionnaire_completed', 'shortlisted'].includes(applicationStatus));
  if (!applicationAvailable) {
    return skipEvent(eventId, processingToken, 'application_unavailable');
  }
  if (!offer.exists || offer.get('companyUid') !== event.companyUid) {
    return skipEvent(eventId, processingToken, 'offer_unavailable');
  }
  if (event.eventType === COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE) {
    const assessment = application.get('companyAssessment');
    if (
      !result?.exists
      || result.get('assessmentType') !== 'company_application'
      || result.get('status') !== 'completed'
      || result.get('applicationId') !== event.applicationId
      || result.get('offerId') !== event.offerId
      || result.get('companyUid') !== event.companyUid
      || !isPlainObject(assessment)
      || cleanText(assessment.resultId) !== event.resultId
    ) {
      return skipEvent(eventId, processingToken, 'questionnaire_result_unavailable');
    }
  }

  const preferences = normalizePreferences(subscription.get('preferences'));
  const preferenceEnabled = event.eventType === COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE
    ? preferences.questionnaire_completed
    : preferences.application_received;
  if (!preferenceEnabled) {
    return skipEvent(eventId, processingToken, 'preference_disabled');
  }

  const devices = await loadActiveCompanyDevices(event.recipientUid);
  if (devices.length === 0) {
    return skipEvent(eventId, processingToken, 'no_active_device');
  }

  const devicesByToken = new Map<string, CompanyPushDevice[]>();
  for (const device of devices) {
    devicesByToken.set(device.token, [...(devicesByToken.get(device.token) ?? []), device]);
  }
  const tokens = [...devicesByToken.keys()];
  const offerSnapshot = application.get('offerSnapshot');
  const offerTitle = isPlainObject(offerSnapshot) ? cleanText(offerSnapshot.title) : cleanText(offer.get('title'));
  const clickUrl = buildCompanyApplicationClickUrl(event.applicationId);
  const questionnaireCompleted = event.eventType === COMPANY_QUESTIONNAIRE_COMPLETED_EVENT_TYPE;
  const message: MulticastMessage = {
    tokens,
    notification: {
      title: questionnaireCompleted ? 'Questionnaire candidat terminé' : 'Nouvelle candidature reçue',
      body: questionnaireCompleted
        ? buildQuestionnaireCompletedNotificationBody(offerTitle)
        : buildApplicationNotificationBody(offerTitle),
    },
    data: {
      kind: questionnaireCompleted ? 'company_questionnaire_completed' : 'company_application_submitted',
      applicationId: event.applicationId,
      offerId: event.offerId,
      clickUrl,
      payloadVersion: String(COMPANY_NOTIFICATION_PAYLOAD_VERSION),
    },
    webpush: {
      notification: {
        icon: '/images/favicon-seveno.png',
        badge: '/images/favicon-seveno.png',
      },
      fcmOptions: { link: clickUrl },
    },
  };

  const response = await sender(message);
  const batch = firestore.batch();
  response.responses.forEach((result, index) => {
    const token = tokens[index];
    const matchingDevices = token ? devicesByToken.get(token) ?? [] : [];
    if (result.success) {
      for (const device of matchingDevices) {
        batch.set(getCompanyDeviceCollection(event.recipientUid).doc(device.deviceId), {
          lastNotificationAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }
      return;
    }
    if (isInvalidTokenError(result.error?.code)) {
      for (const device of matchingDevices) {
        batch.set(getCompanyDeviceCollection(event.recipientUid).doc(device.deviceId), {
          enabled: false,
          revokedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }
    }
  });
  await batch.commit();

  const successCount = response.successCount;
  const failureCount = response.failureCount;
  if (successCount > 0) {
    await completeClaimedEvent(eventId, processingToken, {
      status: failureCount > 0 ? 'partial' : 'sent',
      sentAt: Timestamp.now(),
      lastErrorCode: failureCount > 0 ? 'partial_delivery' : null,
      successCount,
      failureCount,
    });
    return;
  }

  await completeClaimedEvent(eventId, processingToken, {
    status: 'failed',
    sentAt: null,
    lastErrorCode: 'delivery_failed',
    successCount: 0,
    failureCount,
    nextAttemptAt: Timestamp.fromMillis(
      Timestamp.now().toMillis() + BASE_RETRY_MINUTES * Math.max(1, event.attempts) * 60_000,
    ),
  });
}

export async function dispatchCompanyNotificationEvent(
  eventId: string,
  options: { sender?: CompanyMulticastSender; now?: Timestamp } = {},
) {
  const now = options.now ?? Timestamp.now();
  const claimed = await claimNotificationEvent(eventId, now);
  if (!claimed) {
    return { processed: false };
  }

  try {
    await deliverClaimedEvent(eventId, claimed.event, claimed.processingToken, options.sender ?? defaultSender);
  } catch (error) {
    await completeClaimedEvent(eventId, claimed.processingToken, {
      status: 'failed',
      sentAt: null,
      lastErrorCode: error instanceof Error && cleanText((error as { code?: unknown }).code)
        ? cleanText((error as { code?: unknown }).code).slice(0, 120)
        : 'unexpected_delivery_error',
      nextAttemptAt: Timestamp.fromMillis(
        Timestamp.now().toMillis() + BASE_RETRY_MINUTES * Math.max(1, claimed.event.attempts) * 60_000,
      ),
    });
  }
  return { processed: true };
}

export async function processCompanyNotificationOutboxBatch(input: {
  limit?: number;
  sender?: CompanyMulticastSender;
  now?: Timestamp;
} = {}) {
  const firestore = requireDatabase();
  const now = input.now ?? Timestamp.now();
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const due = await firestore.collection(NOTIFICATION_OUTBOX_COLLECTION)
    .where('status', 'in', ['pending', 'failed'])
    .where('nextAttemptAt', '<=', now)
    .orderBy('nextAttemptAt', 'asc')
    .limit(limit)
    .get();
  const remaining = Math.max(0, limit - due.size);
  const stale = remaining > 0
    ? await firestore.collection(NOTIFICATION_OUTBOX_COLLECTION)
      .where('status', '==', 'processing')
      .where('processingLeaseExpiresAt', '<=', now)
      .orderBy('processingLeaseExpiresAt', 'asc')
      .limit(remaining)
      .get()
    : null;
  const eventIds = [...due.docs, ...(stale?.docs ?? [])].map((document) => document.id);
  let processed = 0;
  for (const eventId of eventIds) {
    const result = await dispatchCompanyNotificationEvent(eventId, { sender: input.sender, now });
    if (result.processed) {
      processed += 1;
    }
  }
  return { selected: eventIds.length, processed };
}
