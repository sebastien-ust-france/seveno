import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { getApp, getApps } from 'firebase-admin/app';
import { FieldPath, Timestamp, type DocumentSnapshot, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { normalizeDesiredContractTypeCodes } from '@/lib/seveno-desired-contract-types';
import type { JobOfferContractType } from '@/types/seveno-job-offers';
import type { DesiredContractTypeCode } from '@/types/seveno';

export const OFFER_NOTIFICATION_FANOUTS_COLLECTION = 'offer_notification_fanouts';
export const CANDIDATE_MATCHING_OFFER_EVENT_TYPE = 'candidate_matching_offer_published';
export const CANDIDATE_OFFER_NOTIFICATION_PAYLOAD_VERSION = 1;

const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
const CANDIDATE_PUSH_SUBSCRIPTIONS_COLLECTION = 'candidate_push_subscriptions';
const CANDIDATE_PUSH_DEVICES_COLLECTION = 'devices';
const CANDIDATE_OFFER_ALERT_QUOTAS_COLLECTION = 'candidate_offer_alert_quotas';
const CANDIDATE_OFFER_ALERT_DELIVERIES_COLLECTION = 'deliveries';
const JOB_APPLICATION_GUARDS_COLLECTION = 'job_application_guards';
const JOB_OFFERS_COLLECTION = 'job_offers';
const NOTIFICATION_OUTBOX_COLLECTION = 'notification_outbox';
const USERS_COLLECTION = 'users';
const FANOUT_PAGE_SIZE = 25;
const FANOUT_LEASE_MINUTES = 5;
const OUTBOX_LEASE_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RETRY_MINUTES = 5;
const MAX_OFFER_ALERTS_PER_24_HOURS = 3;
const OFFER_ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

type FirestoreRecord = Record<string, unknown>;
type FanoutStatus = 'pending' | 'processing' | 'completed' | 'failed';
type OutboxStatus = 'pending' | 'processing' | 'sent' | 'partial' | 'failed' | 'skipped';

export interface CandidateOfferMulticastSenderResult {
  successCount: number;
  failureCount: number;
  responses: Array<{ success: boolean; error?: { code?: string } }>;
}

export type CandidateOfferMulticastSender = (
  message: MulticastMessage,
) => Promise<CandidateOfferMulticastSenderResult>;

interface CandidateOfferFanout {
  id: string;
  offerId: string;
  companyUid: string;
  jobRoleId: string;
  contractType: JobOfferContractType;
  status: FanoutStatus;
  cursor: string | null;
  processedCandidates: number;
  matchedCandidates: number;
  skippedCandidates: number;
  createdEvents: number;
  attempts: number;
  nextAttemptAt: Timestamp;
  processingLeaseExpiresAt: Timestamp | null;
}

interface CandidateOfferEvent {
  id: string;
  recipientUid: string;
  offerId: string;
  companyUid: string;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Timestamp;
  processingLeaseExpiresAt: Timestamp | null;
}

interface CandidatePushDevice {
  deviceId: string;
  token: string;
}

export class SevenoCandidateOfferNotificationError extends Error {
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
    throw new SevenoCandidateOfferNotificationError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n’est pas configuré pour gérer les alertes d’offres.',
    );
  }
  return adminDb;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toTimestamp(value: unknown) {
  if (value instanceof Timestamp) return value;
  if (value && typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }
  return null;
}

function isRecord(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function buildCandidateOfferFanoutId(offerId: string) {
  return `candidate_offer_fanout:${cleanText(offerId)}`;
}

export function buildCandidateMatchingOfferEventId(offerId: string, candidateUid: string) {
  return `${CANDIDATE_MATCHING_OFFER_EVENT_TYPE}:${cleanText(offerId)}:${cleanText(candidateUid)}`;
}

export function buildCandidateOfferApplicationGuardId(offerId: string, candidateUid: string) {
  return createHash('sha256').update(`${offerId}\0${candidateUid}`).digest('hex');
}

export function mapOfferContractTypeToCandidateCode(
  contractType: JobOfferContractType | string | null | undefined,
): DesiredContractTypeCode | null {
  const mapping: Partial<Record<JobOfferContractType, DesiredContractTypeCode>> = {
    permanent: 'CDI',
    fixed_term: 'CDD',
    temporary: 'INTERIM',
    freelance: 'FREELANCE',
    apprenticeship: 'ALTERNANCE',
    internship: 'STAGE',
    other: 'AUTRE',
  };
  return mapping[contractType as JobOfferContractType] ?? null;
}

export function isCandidateContractCompatible(
  desiredContractTypeCodes: unknown,
  offerContractType: JobOfferContractType | string | null | undefined,
) {
  const desired = normalizeDesiredContractTypeCodes(desiredContractTypeCodes);
  if (desired.length === 0) return true;
  const offerCode = mapOfferContractTypeToCandidateCode(offerContractType);
  return offerCode !== null && desired.includes(offerCode);
}

export async function prepareCandidateOfferFanout(
  transaction: Transaction,
  firestore: Firestore,
  input: {
    offerId: string;
    companyUid: string;
    jobRoleId: string;
    contractType: JobOfferContractType;
    now: Timestamp;
    existingSnapshot?: DocumentSnapshot;
  },
) {
  const fanoutId = buildCandidateOfferFanoutId(input.offerId);
  const ref = firestore.collection(OFFER_NOTIFICATION_FANOUTS_COLLECTION).doc(fanoutId);
  const existing = input.existingSnapshot ?? await transaction.get(ref);
  if (existing.exists) {
    if (
      existing.get('offerId') !== input.offerId
      || existing.get('companyUid') !== input.companyUid
      || existing.get('jobRoleId') !== input.jobRoleId
    ) {
      throw new SevenoCandidateOfferNotificationError(
        'offer_fanout_conflict',
        409,
        'Le travail de notification de cette offre est incohérent.',
      );
    }
    return { fanoutId, created: false };
  }

  transaction.create(ref, {
    offerId: input.offerId,
    companyUid: input.companyUid,
    jobRoleId: input.jobRoleId,
    contractType: input.contractType,
    eventType: CANDIDATE_MATCHING_OFFER_EVENT_TYPE,
    idempotencyKey: fanoutId,
    status: 'pending',
    cursor: null,
    processedCandidates: 0,
    matchedCandidates: 0,
    skippedCandidates: 0,
    createdEvents: 0,
    attempts: 0,
    createdAt: input.now,
    updatedAt: input.now,
    nextAttemptAt: input.now,
    processingToken: null,
    processingStartedAt: null,
    processingLeaseExpiresAt: null,
    completedAt: null,
    lastErrorCode: null,
    payloadVersion: CANDIDATE_OFFER_NOTIFICATION_PAYLOAD_VERSION,
  });
  return { fanoutId, created: true };
}

function normalizeFanout(id: string, data: unknown): CandidateOfferFanout | null {
  if (!isRecord(data) || cleanText(data.idempotencyKey) !== id) return null;
  const status = ['pending', 'processing', 'completed', 'failed'].includes(String(data.status))
    ? data.status as FanoutStatus
    : null;
  const nextAttemptAt = toTimestamp(data.nextAttemptAt);
  if (!status || !nextAttemptAt || data.eventType !== CANDIDATE_MATCHING_OFFER_EVENT_TYPE) return null;
  return {
    id,
    offerId: cleanText(data.offerId),
    companyUid: cleanText(data.companyUid),
    jobRoleId: cleanText(data.jobRoleId),
    contractType: cleanText(data.contractType) as JobOfferContractType,
    status,
    cursor: cleanText(data.cursor) || null,
    processedCandidates: Number(data.processedCandidates) || 0,
    matchedCandidates: Number(data.matchedCandidates) || 0,
    skippedCandidates: Number(data.skippedCandidates) || 0,
    createdEvents: Number(data.createdEvents) || 0,
    attempts: Number(data.attempts) || 0,
    nextAttemptAt,
    processingLeaseExpiresAt: toTimestamp(data.processingLeaseExpiresAt),
  };
}

async function claimFanout(fanoutId: string, now: Timestamp) {
  const firestore = requireDatabase();
  const ref = firestore.collection(OFFER_NOTIFICATION_FANOUTS_COLLECTION).doc(fanoutId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const fanout = snapshot.exists ? normalizeFanout(snapshot.id, snapshot.data()) : null;
    if (!fanout || fanout.status === 'completed' || fanout.nextAttemptAt.toMillis() > now.toMillis()) return null;
    if (
      fanout.status === 'processing'
      && fanout.processingLeaseExpiresAt
      && fanout.processingLeaseExpiresAt.toMillis() > now.toMillis()
    ) return null;
    const processingToken = randomUUID();
    transaction.update(ref, {
      status: 'processing',
      attempts: fanout.attempts + 1,
      processingToken,
      processingStartedAt: now,
      processingLeaseExpiresAt: Timestamp.fromMillis(now.toMillis() + FANOUT_LEASE_MINUTES * 60_000),
      updatedAt: now,
    });
    return { fanout: { ...fanout, attempts: fanout.attempts + 1 }, processingToken };
  });
}

async function hasActiveCandidateDevice(candidateUid: string) {
  const snapshot = await requireDatabase()
    .collection(CANDIDATE_PUSH_SUBSCRIPTIONS_COLLECTION)
    .doc(candidateUid)
    .collection(CANDIDATE_PUSH_DEVICES_COLLECTION)
    .where('enabled', '==', true)
    .limit(1)
    .get();
  return snapshot.docs.some((document) => (
    document.get('uid') === candidateUid
    && document.get('permission') === 'granted'
    && Boolean(cleanText(document.get('token')))
  ));
}

function buildCandidateOfferEvent(input: {
  offerId: string;
  companyUid: string;
  candidateUid: string;
  now: Timestamp;
}) {
  const id = buildCandidateMatchingOfferEventId(input.offerId, input.candidateUid);
  return {
    eventType: CANDIDATE_MATCHING_OFFER_EVENT_TYPE,
    idempotencyKey: id,
    recipientUid: input.candidateUid,
    recipientRole: 'candidate',
    offerId: input.offerId,
    companyUid: input.companyUid,
    status: 'pending',
    attempts: 0,
    createdAt: input.now,
    updatedAt: input.now,
    nextAttemptAt: input.now,
    sentAt: null,
    lastErrorCode: null,
    payloadVersion: CANDIDATE_OFFER_NOTIFICATION_PAYLOAD_VERSION,
    processingToken: null,
    processingStartedAt: null,
    processingLeaseExpiresAt: null,
    successCount: 0,
    failureCount: 0,
  };
}

async function createCandidateOfferEvents(
  fanout: CandidateOfferFanout,
  candidateUids: string[],
  now: Timestamp,
) {
  if (candidateUids.length === 0) return 0;
  const firestore = requireDatabase();
  return firestore.runTransaction(async (transaction) => {
    const refs = candidateUids.map((uid) => firestore.collection(NOTIFICATION_OUTBOX_COLLECTION)
      .doc(buildCandidateMatchingOfferEventId(fanout.offerId, uid)));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    let created = 0;
    refs.forEach((ref, index) => {
      if (!snapshots[index].exists) {
        transaction.create(ref, buildCandidateOfferEvent({
          offerId: fanout.offerId,
          companyUid: fanout.companyUid,
          candidateUid: candidateUids[index],
          now,
        }));
        created += 1;
      }
    });
    return created;
  });
}

async function processClaimedFanout(
  fanout: CandidateOfferFanout,
  processingToken: string,
  now: Timestamp,
) {
  const firestore = requireDatabase();
  let query = firestore.collection(CANDIDATE_PROFILES_COLLECTION)
    .where('targetJobRoleIds', 'array-contains', fanout.jobRoleId)
    .where('profileStatus', '==', 'active')
    .where('matchingOfferAlertsEnabled', '==', true)
    .orderBy(FieldPath.documentId())
    .limit(FANOUT_PAGE_SIZE);
  if (fanout.cursor) query = query.startAfter(fanout.cursor);
  const page = await query.get();
  const candidateUids = page.docs.map((document) => document.id);
  const userRefs = candidateUids.map((uid) => firestore.collection(USERS_COLLECTION).doc(uid));
  const guardRefs = candidateUids.map((uid) => firestore.collection(JOB_APPLICATION_GUARDS_COLLECTION)
    .doc(buildCandidateOfferApplicationGuardId(fanout.offerId, uid)));
  const [users, guards, devices] = await Promise.all([
    candidateUids.length ? firestore.getAll(...userRefs) : Promise.resolve([]),
    candidateUids.length ? firestore.getAll(...guardRefs) : Promise.resolve([]),
    Promise.all(candidateUids.map((uid) => hasActiveCandidateDevice(uid))),
  ]);
  const matched: string[] = [];
  page.docs.forEach((profile, index) => {
    const user = users[index];
    const eligible = profile.get('uid') === profile.id
      && profile.get('role') === 'candidate'
      && user?.exists
      && user.get('role') === 'candidate'
      && user.get('emailVerified') === true
      && isCandidateContractCompatible(profile.get('desiredContractTypeCodes'), fanout.contractType)
      && !guards[index]?.exists
      && devices[index] === true;
    if (eligible) matched.push(profile.id);
  });
  const createdEvents = await createCandidateOfferEvents(fanout, matched, now);
  const last = page.docs.at(-1)?.id ?? null;
  const completed = page.size < FANOUT_PAGE_SIZE;
  const ref = firestore.collection(OFFER_NOTIFICATION_FANOUTS_COLLECTION).doc(fanout.id);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('processingToken') !== processingToken) return;
    transaction.update(ref, {
      status: completed ? 'completed' : 'pending',
      cursor: last ?? fanout.cursor,
      processedCandidates: fanout.processedCandidates + page.size,
      matchedCandidates: fanout.matchedCandidates + matched.length,
      skippedCandidates: fanout.skippedCandidates + page.size - matched.length,
      createdEvents: fanout.createdEvents + createdEvents,
      completedAt: completed ? now : null,
      nextAttemptAt: now,
      processingToken: null,
      processingStartedAt: null,
      processingLeaseExpiresAt: null,
      lastErrorCode: null,
      updatedAt: now,
    });
  });
  return { completed, selected: page.size, matched: matched.length, createdEvents };
}

export async function processCandidateOfferFanout(
  fanoutId: string,
  options: { now?: Timestamp } = {},
) {
  const now = options.now ?? Timestamp.now();
  const claimed = await claimFanout(fanoutId, now);
  if (!claimed) return { processed: false };
  try {
    return { processed: true, ...await processClaimedFanout(claimed.fanout, claimed.processingToken, now) };
  } catch (error) {
    const ref = requireDatabase().collection(OFFER_NOTIFICATION_FANOUTS_COLLECTION).doc(fanoutId);
    await ref.set({
      status: 'failed',
      nextAttemptAt: Timestamp.fromMillis(now.toMillis() + RETRY_MINUTES * claimed.fanout.attempts * 60_000),
      processingToken: null,
      processingStartedAt: null,
      processingLeaseExpiresAt: null,
      lastErrorCode: cleanText((error as { code?: unknown })?.code) || 'fanout_processing_failed',
      updatedAt: now,
    }, { merge: true });
    return { processed: true, failed: true };
  }
}

export async function processCandidateOfferFanoutBatch(input: { limit?: number; now?: Timestamp } = {}) {
  const firestore = requireDatabase();
  const now = input.now ?? Timestamp.now();
  const limit = Math.min(10, Math.max(1, input.limit ?? 3));
  const due = await firestore.collection(OFFER_NOTIFICATION_FANOUTS_COLLECTION)
    .where('status', 'in', ['pending', 'failed'])
    .where('nextAttemptAt', '<=', now)
    .orderBy('nextAttemptAt', 'asc')
    .limit(limit)
    .get();
  const remaining = limit - due.size;
  const stale = remaining > 0
    ? await firestore.collection(OFFER_NOTIFICATION_FANOUTS_COLLECTION)
      .where('status', '==', 'processing')
      .where('processingLeaseExpiresAt', '<=', now)
      .orderBy('processingLeaseExpiresAt', 'asc')
      .limit(remaining)
      .get()
    : null;
  const ids = [...due.docs, ...(stale?.docs ?? [])].map((document) => document.id);
  for (const id of ids) await processCandidateOfferFanout(id, { now });
  return { selected: ids.length };
}

function normalizeCandidateEvent(id: string, data: unknown): CandidateOfferEvent | null {
  if (
    !isRecord(data)
    || data.eventType !== CANDIDATE_MATCHING_OFFER_EVENT_TYPE
    || data.recipientRole !== 'candidate'
    || cleanText(data.idempotencyKey) !== id
    || cleanText(data.recipientUid) === ''
  ) return null;
  const status = ['pending', 'processing', 'sent', 'partial', 'failed', 'skipped'].includes(String(data.status))
    ? data.status as OutboxStatus
    : null;
  const nextAttemptAt = toTimestamp(data.nextAttemptAt);
  if (!status || !nextAttemptAt) return null;
  return {
    id,
    recipientUid: cleanText(data.recipientUid),
    offerId: cleanText(data.offerId),
    companyUid: cleanText(data.companyUid),
    status,
    attempts: Number(data.attempts) || 0,
    nextAttemptAt,
    processingLeaseExpiresAt: toTimestamp(data.processingLeaseExpiresAt),
  };
}

async function claimCandidateEvent(eventId: string, now: Timestamp) {
  const firestore = requireDatabase();
  const ref = firestore.collection(NOTIFICATION_OUTBOX_COLLECTION).doc(eventId);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const event = snapshot.exists ? normalizeCandidateEvent(snapshot.id, snapshot.data()) : null;
    if (!event || ['sent', 'partial', 'skipped'].includes(event.status)) return null;
    if (event.nextAttemptAt.toMillis() > now.toMillis()) return null;
    if (event.status === 'processing' && event.processingLeaseExpiresAt && event.processingLeaseExpiresAt.toMillis() > now.toMillis()) return null;
    if (event.attempts >= MAX_ATTEMPTS) return null;
    const processingToken = randomUUID();
    transaction.update(ref, {
      status: 'processing',
      attempts: event.attempts + 1,
      processingToken,
      processingStartedAt: now,
      processingLeaseExpiresAt: Timestamp.fromMillis(now.toMillis() + OUTBOX_LEASE_MINUTES * 60_000),
      updatedAt: now,
    });
    return { event: { ...event, attempts: event.attempts + 1 }, processingToken };
  });
}

async function completeCandidateEvent(
  eventId: string,
  processingToken: string,
  patch: FirestoreRecord,
) {
  const firestore = requireDatabase();
  const ref = firestore.collection(NOTIFICATION_OUTBOX_COLLECTION).doc(eventId);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('processingToken') !== processingToken) return;
    transaction.update(ref, {
      ...patch,
      processingToken: null,
      processingStartedAt: null,
      processingLeaseExpiresAt: null,
      updatedAt: Timestamp.now(),
    });
  });
}

async function skipCandidateEvent(eventId: string, processingToken: string, code: string) {
  await completeCandidateEvent(eventId, processingToken, {
    status: 'skipped',
    sentAt: null,
    successCount: 0,
    failureCount: 0,
    lastErrorCode: code,
  });
}

async function loadCandidateDevices(candidateUid: string) {
  const snapshot = await requireDatabase()
    .collection(CANDIDATE_PUSH_SUBSCRIPTIONS_COLLECTION)
    .doc(candidateUid)
    .collection(CANDIDATE_PUSH_DEVICES_COLLECTION)
    .where('enabled', '==', true)
    .get();
  return snapshot.docs.flatMap((document): CandidatePushDevice[] => {
    const token = cleanText(document.get('token'));
    return document.get('uid') === candidateUid && document.get('permission') === 'granted' && token
      ? [{ deviceId: document.id, token }]
      : [];
  });
}

async function reserveCandidateQuota(event: CandidateOfferEvent, now: Timestamp) {
  const firestore = requireDatabase();
  const deliveries = firestore.collection(CANDIDATE_OFFER_ALERT_QUOTAS_COLLECTION)
    .doc(event.recipientUid)
    .collection(CANDIDATE_OFFER_ALERT_DELIVERIES_COLLECTION);
  const ref = deliveries.doc(event.id);
  return firestore.runTransaction(async (transaction) => {
    const recent = await transaction.get(deliveries
      .where('createdAt', '>=', Timestamp.fromMillis(now.toMillis() - OFFER_ALERT_WINDOW_MS))
      .orderBy('createdAt', 'asc'));
    const existing = recent.docs.find((document) => document.id === event.id);
    if (existing) return true;
    if (recent.size >= MAX_OFFER_ALERTS_PER_24_HOURS) return false;
    transaction.create(ref, {
      candidateUid: event.recipientUid,
      offerId: event.offerId,
      eventId: event.id,
      status: 'reserved',
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });
}

async function releaseCandidateQuota(event: CandidateOfferEvent) {
  const ref = requireDatabase().collection(CANDIDATE_OFFER_ALERT_QUOTAS_COLLECTION)
    .doc(event.recipientUid)
    .collection(CANDIDATE_OFFER_ALERT_DELIVERIES_COLLECTION)
    .doc(event.id);
  const snapshot = await ref.get();
  if (snapshot.get('status') === 'reserved') await ref.delete();
}

async function markCandidateQuotaSent(event: CandidateOfferEvent, now: Timestamp) {
  await requireDatabase().collection(CANDIDATE_OFFER_ALERT_QUOTAS_COLLECTION)
    .doc(event.recipientUid)
    .collection(CANDIDATE_OFFER_ALERT_DELIVERIES_COLLECTION)
    .doc(event.id)
    .set({ status: 'sent', sentAt: now, updatedAt: now }, { merge: true });
}

function defaultSender(message: MulticastMessage): Promise<CandidateOfferMulticastSenderResult> {
  if (getApps().length === 0) throw new Error('firebase_messaging_unavailable');
  return getMessaging(getApp()).sendEachForMulticast(message);
}

function isInvalidTokenError(code: string | undefined) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
}

async function deliverCandidateEvent(
  event: CandidateOfferEvent,
  processingToken: string,
  sender: CandidateOfferMulticastSender,
  now: Timestamp,
) {
  const firestore = requireDatabase();
  const [user, profile, offer, guard] = await Promise.all([
    firestore.collection(USERS_COLLECTION).doc(event.recipientUid).get(),
    firestore.collection(CANDIDATE_PROFILES_COLLECTION).doc(event.recipientUid).get(),
    firestore.collection(JOB_OFFERS_COLLECTION).doc(event.offerId).get(),
    firestore.collection(JOB_APPLICATION_GUARDS_COLLECTION)
      .doc(buildCandidateOfferApplicationGuardId(event.offerId, event.recipientUid)).get(),
  ]);
  if (!offer.exists || offer.get('status') !== 'published' || offer.get('companyUid') !== event.companyUid) {
    return skipCandidateEvent(event.id, processingToken, 'offer_unavailable');
  }
  if (!user.exists || user.get('role') !== 'candidate' || user.get('emailVerified') !== true) {
    return skipCandidateEvent(event.id, processingToken, 'candidate_unavailable');
  }
  const targetRoles = Array.isArray(profile.get('targetJobRoleIds')) ? profile.get('targetJobRoleIds') : [];
  if (
    !profile.exists
    || profile.get('uid') !== event.recipientUid
    || profile.get('profileStatus') !== 'active'
    || profile.get('matchingOfferAlertsEnabled') !== true
    || !targetRoles.includes(offer.get('jobRoleId'))
    || !isCandidateContractCompatible(profile.get('desiredContractTypeCodes'), offer.get('contractType'))
  ) return skipCandidateEvent(event.id, processingToken, 'candidate_not_matching');
  if (guard.exists) return skipCandidateEvent(event.id, processingToken, 'application_already_exists');
  const devices = await loadCandidateDevices(event.recipientUid);
  if (devices.length === 0) return skipCandidateEvent(event.id, processingToken, 'no_active_device');
  if (!await reserveCandidateQuota(event, now)) {
    return skipCandidateEvent(event.id, processingToken, 'daily_offer_alert_limit_reached');
  }

  const devicesByToken = new Map<string, CandidatePushDevice[]>();
  devices.forEach((device) => devicesByToken.set(device.token, [...(devicesByToken.get(device.token) ?? []), device]));
  const tokens = [...devicesByToken.keys()];
  const offerTitle = cleanText(offer.get('title'));
  const contractChecked = normalizeDesiredContractTypeCodes(profile.get('desiredContractTypeCodes')).length > 0;
  const clickUrl = `/candidat/offres/${encodeURIComponent(event.offerId)}`;
  const body = offerTitle
    ? contractChecked
      ? `Une nouvelle offre de « ${offerTitle} » correspond à vos critères de métier et de contrat.`
      : `Une nouvelle offre de « ${offerTitle} » correspond à l’un de vos métiers recherchés.`
    : 'Une nouvelle offre correspondant à l’un de vos métiers recherchés vient d’être publiée.';
  let response: CandidateOfferMulticastSenderResult;
  try {
    response = await sender({
      tokens,
      notification: { title: 'Nouvelle offre disponible', body },
      data: {
        kind: CANDIDATE_MATCHING_OFFER_EVENT_TYPE,
        offerId: event.offerId,
        clickUrl,
        payloadVersion: String(CANDIDATE_OFFER_NOTIFICATION_PAYLOAD_VERSION),
      },
      webpush: {
        notification: { icon: '/images/favicon-seveno.png', badge: '/images/favicon-seveno.png' },
        fcmOptions: { link: clickUrl },
      },
    });
  } catch (error) {
    await releaseCandidateQuota(event);
    throw error;
  }

  const batch = firestore.batch();
  response.responses.forEach((result, index) => {
    const token = tokens[index];
    for (const device of token ? devicesByToken.get(token) ?? [] : []) {
      const ref = firestore.collection(CANDIDATE_PUSH_SUBSCRIPTIONS_COLLECTION)
        .doc(event.recipientUid).collection(CANDIDATE_PUSH_DEVICES_COLLECTION).doc(device.deviceId);
      if (result.success) batch.set(ref, { lastNotificationAt: now, updatedAt: now }, { merge: true });
      else if (isInvalidTokenError(result.error?.code)) batch.set(ref, {
        enabled: false,
        revokedAt: now,
        updatedAt: now,
      }, { merge: true });
    }
  });
  await batch.commit();
  if (response.successCount > 0) {
    await markCandidateQuotaSent(event, now);
    return completeCandidateEvent(event.id, processingToken, {
      status: response.failureCount > 0 ? 'partial' : 'sent',
      sentAt: now,
      successCount: response.successCount,
      failureCount: response.failureCount,
      lastErrorCode: response.failureCount > 0 ? 'partial_delivery' : null,
    });
  }
  await releaseCandidateQuota(event);
  return completeCandidateEvent(event.id, processingToken, {
    status: 'failed',
    sentAt: null,
    successCount: 0,
    failureCount: response.failureCount,
    lastErrorCode: 'delivery_failed',
    nextAttemptAt: Timestamp.fromMillis(now.toMillis() + RETRY_MINUTES * event.attempts * 60_000),
  });
}

export async function dispatchCandidateOfferNotificationEvent(
  eventId: string,
  options: { sender?: CandidateOfferMulticastSender; now?: Timestamp } = {},
) {
  const now = options.now ?? Timestamp.now();
  const claimed = await claimCandidateEvent(eventId, now);
  if (!claimed) return { processed: false };
  try {
    await deliverCandidateEvent(claimed.event, claimed.processingToken, options.sender ?? defaultSender, now);
  } catch (error) {
    await completeCandidateEvent(eventId, claimed.processingToken, {
      status: 'failed',
      sentAt: null,
      lastErrorCode: cleanText((error as { code?: unknown })?.code) || 'unexpected_delivery_error',
      nextAttemptAt: Timestamp.fromMillis(now.toMillis() + RETRY_MINUTES * claimed.event.attempts * 60_000),
    });
  }
  return { processed: true };
}

export async function processCandidateOfferNotificationOutboxBatch(input: {
  limit?: number;
  sender?: CandidateOfferMulticastSender;
  now?: Timestamp;
} = {}) {
  const firestore = requireDatabase();
  const now = input.now ?? Timestamp.now();
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));
  const eventQuery = firestore.collection(NOTIFICATION_OUTBOX_COLLECTION)
    .where('eventType', '==', CANDIDATE_MATCHING_OFFER_EVENT_TYPE);
  const due = await eventQuery.where('status', 'in', ['pending', 'failed'])
    .where('nextAttemptAt', '<=', now).orderBy('nextAttemptAt', 'asc').limit(limit).get();
  const remaining = limit - due.size;
  const stale = remaining > 0
    ? await eventQuery.where('status', '==', 'processing')
      .where('processingLeaseExpiresAt', '<=', now)
      .orderBy('processingLeaseExpiresAt', 'asc').limit(remaining).get()
    : null;
  const ids = [...due.docs, ...(stale?.docs ?? [])].map((document) => document.id);
  let processed = 0;
  for (const id of ids) {
    if ((await dispatchCandidateOfferNotificationEvent(id, input)).processed) processed += 1;
  }
  return { selected: ids.length, processed };
}

export async function setCandidateMatchingOfferAlerts(candidateUid: string, enabled: boolean) {
  const firestore = requireDatabase();
  const [user, profile] = await Promise.all([
    firestore.collection(USERS_COLLECTION).doc(candidateUid).get(),
    firestore.collection(CANDIDATE_PROFILES_COLLECTION).doc(candidateUid).get(),
  ]);
  if (!user.exists || user.get('role') !== 'candidate' || !profile.exists || profile.get('uid') !== candidateUid) {
    throw new SevenoCandidateOfferNotificationError('candidate_profile_missing', 404, 'Profil candidat introuvable.');
  }
  if (profile.get('profileStatus') !== 'active') {
    throw new SevenoCandidateOfferNotificationError('candidate_profile_inactive', 409, 'Le profil candidat doit être actif.');
  }
  if (enabled && !await hasActiveCandidateDevice(candidateUid)) {
    throw new SevenoCandidateOfferNotificationError('active_device_required', 409, 'Enregistrez cet appareil avant d’activer les alertes.');
  }
  await profile.ref.set({ matchingOfferAlertsEnabled: enabled, updatedAt: Timestamp.now() }, { merge: true });
  return { matchingOfferAlertsEnabled: enabled };
}

export async function getCandidateMatchingOfferAlerts(candidateUid: string) {
  const profile = await requireDatabase().collection(CANDIDATE_PROFILES_COLLECTION).doc(candidateUid).get();
  if (!profile.exists || profile.get('uid') !== candidateUid) {
    throw new SevenoCandidateOfferNotificationError('candidate_profile_missing', 404, 'Profil candidat introuvable.');
  }
  return { matchingOfferAlertsEnabled: profile.get('matchingOfferAlertsEnabled') === true };
}
