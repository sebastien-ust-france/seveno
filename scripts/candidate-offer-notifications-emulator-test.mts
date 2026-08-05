import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SEVENO_USE_FIREBASE_EMULATORS = 'true';
process.env.SEVENO_EMULATOR_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID = projectId;
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

async function assertEmulator() {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host, port: Number(port) });
    const timeout = setTimeout(() => rejectPromise(new Error('Firestore Emulator inaccessible.')), 1500);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });
    socket.once('error', rejectPromise);
  });
}

await assertEmulator();

const { Timestamp } = await import('firebase-admin/firestore');
const { adminDb } = await import('@/lib/firebase-admin');
const {
  CANDIDATE_MATCHING_OFFER_EVENT_TYPE,
  buildCandidateMatchingOfferEventId,
  buildCandidateOfferApplicationGuardId,
  buildCandidateOfferFanoutId,
  prepareCandidateOfferFanout,
  processCandidateOfferFanout,
  dispatchCandidateOfferNotificationEvent,
} = await import('@/lib/seveno-candidate-offer-notifications-server');
if (!adminDb) throw new Error('Firebase Admin Firestore indisponible.');

const rulesTestEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
  },
});
const now = Timestamp.fromDate(new Date('2026-08-05T12:00:00.000Z'));

async function seedOffer(offerId: string, status = 'published') {
  await adminDb.collection('job_offers').doc(offerId).set({
    id: offerId,
    companyUid: 'company-phase3',
    title: `Développeur ${offerId}`,
    jobRoleId: 'developer',
    contractType: 'permanent',
    status,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

async function seedCandidate(uid: string, input: {
  roleId?: string;
  contractCodes?: string[];
  active?: boolean;
  verified?: boolean;
  preference?: boolean;
  device?: boolean;
} = {}) {
  await adminDb.collection('users').doc(uid).set({
    uid,
    role: 'candidate',
    emailVerified: input.verified !== false,
    createdAt: now,
    updatedAt: now,
  });
  await adminDb.collection('candidate_profiles').doc(uid).set({
    uid,
    role: 'candidate',
    targetJobRoleIds: [input.roleId ?? 'developer'],
    desiredContractTypeCodes: input.contractCodes ?? ['CDI'],
    profileStatus: input.active === false ? 'paused' : 'active',
    matchingOfferAlertsEnabled: input.preference !== false,
    createdAt: now,
    updatedAt: now,
  });
  if (input.device !== false) {
    await adminDb.collection('candidate_push_subscriptions').doc(uid).collection('devices').doc('device-1').set({
      uid,
      deviceId: 'device-1',
      token: `token-${uid}`,
      permission: 'granted',
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function createFanout(offerId: string, jobRoleId = 'developer') {
  return adminDb.runTransaction((transaction) => prepareCandidateOfferFanout(transaction, adminDb, {
    offerId,
    companyUid: 'company-phase3',
    jobRoleId,
    contractType: 'permanent',
    now,
  }));
}

async function seedEvent(offerId: string, uid: string) {
  const eventId = buildCandidateMatchingOfferEventId(offerId, uid);
  await adminDb.collection('notification_outbox').doc(eventId).set({
    eventType: CANDIDATE_MATCHING_OFFER_EVENT_TYPE,
    idempotencyKey: eventId,
    recipientUid: uid,
    recipientRole: 'candidate',
    offerId,
    companyUid: 'company-phase3',
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    nextAttemptAt: now,
    sentAt: null,
    lastErrorCode: null,
    payloadVersion: 1,
    processingToken: null,
    processingStartedAt: null,
    processingLeaseExpiresAt: null,
    successCount: 0,
    failureCount: 0,
  });
  return eventId;
}

try {
  await rulesTestEnv.clearFirestore();
  await seedOffer('offer-match');
  await Promise.all([
    seedCandidate('candidate-match'),
    seedCandidate('candidate-empty-contract', { contractCodes: [] }),
    seedCandidate('candidate-wrong-role', { roleId: 'designer' }),
    seedCandidate('candidate-wrong-contract', { contractCodes: ['CDD'] }),
    seedCandidate('candidate-inactive', { active: false }),
    seedCandidate('candidate-unverified', { verified: false }),
    seedCandidate('candidate-disabled', { preference: false }),
    seedCandidate('candidate-no-device', { device: false }),
    seedCandidate('candidate-applied'),
  ]);
  await adminDb.collection('job_application_guards')
    .doc(buildCandidateOfferApplicationGuardId('offer-match', 'candidate-applied'))
    .set({ offerId: 'offer-match', candidateUid: 'candidate-applied' });

  const firstFanout = await createFanout('offer-match');
  const duplicateFanout = await createFanout('offer-match');
  assert.equal(firstFanout.created, true);
  assert.equal(duplicateFanout.created, false);
  await assert.rejects(adminDb.runTransaction(async (transaction) => {
    await prepareCandidateOfferFanout(transaction, adminDb, {
      offerId: 'offer-rolled-back',
      companyUid: 'company-phase3',
      jobRoleId: 'developer',
      contractType: 'permanent',
      now,
    });
    throw new Error('rollback_expected');
  }), /rollback_expected/);
  assert.equal((await adminDb.collection('offer_notification_fanouts')
    .doc(buildCandidateOfferFanoutId('offer-rolled-back')).get()).exists, false);
  const fanoutResult = await processCandidateOfferFanout(firstFanout.fanoutId, { now });
  assert.equal(fanoutResult.processed, true);
  const matchingEvent = buildCandidateMatchingOfferEventId('offer-match', 'candidate-match');
  const emptyContractEvent = buildCandidateMatchingOfferEventId('offer-match', 'candidate-empty-contract');
  assert.equal((await adminDb.collection('notification_outbox').doc(matchingEvent).get()).exists, true);
  assert.equal((await adminDb.collection('notification_outbox').doc(emptyContractEvent).get()).exists, true);
  for (const uid of [
    'candidate-wrong-role', 'candidate-wrong-contract', 'candidate-inactive', 'candidate-unverified',
    'candidate-disabled', 'candidate-no-device', 'candidate-applied',
  ]) assert.equal((await adminDb.collection('notification_outbox')
    .doc(buildCandidateMatchingOfferEventId('offer-match', uid)).get()).exists, false);

  await seedOffer('offer-pagination');
  await Promise.all(Array.from({ length: 26 }, (_, index) => seedCandidate(
    `candidate-page-${String(index).padStart(2, '0')}`,
    { roleId: 'pagination-role' },
  )));
  const paginatedFanout = await createFanout('offer-pagination', 'pagination-role');
  const concurrentFanoutResults = await Promise.all([
    processCandidateOfferFanout(paginatedFanout.fanoutId, { now }),
    processCandidateOfferFanout(paginatedFanout.fanoutId, { now }),
  ]);
  assert.equal(concurrentFanoutResults.filter((result) => result.processed).length >= 1, true);
  let paginatedSnapshot = await adminDb.collection('offer_notification_fanouts').doc(paginatedFanout.fanoutId).get();
  assert.equal(typeof paginatedSnapshot.get('cursor'), 'string');
  if (paginatedSnapshot.get('status') !== 'completed') {
    await processCandidateOfferFanout(paginatedFanout.fanoutId, { now });
  }
  paginatedSnapshot = await adminDb.collection('offer_notification_fanouts').doc(paginatedFanout.fanoutId).get();
  assert.equal(paginatedSnapshot.get('status'), 'completed');
  assert.equal(paginatedSnapshot.get('processedCandidates'), 26);
  assert.equal(paginatedSnapshot.get('createdEvents'), 26);

  await seedOffer('offer-stale-lease');
  const staleFanout = await createFanout('offer-stale-lease', 'unused-role');
  await adminDb.collection('offer_notification_fanouts').doc(staleFanout.fanoutId).update({
    status: 'processing',
    processingToken: 'expired-worker',
    processingLeaseExpiresAt: Timestamp.fromMillis(now.toMillis() - 1),
  });
  assert.equal((await processCandidateOfferFanout(staleFanout.fanoutId, { now })).processed, true);
  assert.equal((await adminDb.collection('offer_notification_fanouts').doc(staleFanout.fanoutId).get()).get('status'), 'completed');

  let sends = 0;
  await dispatchCandidateOfferNotificationEvent(matchingEvent, { now, sender: async (message) => {
    sends += 1;
    assert.deepEqual(message.tokens, ['token-candidate-match']);
    assert.equal(message.data?.clickUrl, '/candidat/offres/offer-match');
    return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
  } });
  await dispatchCandidateOfferNotificationEvent(matchingEvent, { now, sender: async () => {
    sends += 1;
    return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
  } });
  assert.equal(sends, 1);
  assert.equal((await adminDb.collection('notification_outbox').doc(matchingEvent).get()).get('status'), 'sent');

  await seedCandidate('candidate-quota');
  for (let index = 1; index <= 4; index += 1) {
    const offerId = `offer-quota-${index}`;
    await seedOffer(offerId);
    const eventId = await seedEvent(offerId, 'candidate-quota');
    await dispatchCandidateOfferNotificationEvent(eventId, { now, sender: async () => ({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    }) });
  }
  assert.equal((await adminDb.collection('notification_outbox')
    .doc(buildCandidateMatchingOfferEventId('offer-quota-4', 'candidate-quota')).get()).get('lastErrorCode'),
  'daily_offer_alert_limit_reached');

  await seedCandidate('candidate-invalid');
  await seedOffer('offer-invalid');
  const invalidEvent = await seedEvent('offer-invalid', 'candidate-invalid');
  await dispatchCandidateOfferNotificationEvent(invalidEvent, { now, sender: async () => ({
    successCount: 0,
    failureCount: 1,
    responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }],
  }) });
  assert.equal((await adminDb.collection('candidate_push_subscriptions').doc('candidate-invalid')
    .collection('devices').doc('device-1').get()).get('enabled'), false);
  assert.equal((await adminDb.collection('notification_outbox').doc(invalidEvent).get()).get('status'), 'failed');

  await seedCandidate('candidate-concurrent');
  await seedOffer('offer-concurrent');
  const concurrentEvent = await seedEvent('offer-concurrent', 'candidate-concurrent');
  let concurrentSends = 0;
  const concurrentSender = async () => {
    concurrentSends += 1;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
    return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
  };
  await Promise.all([
    dispatchCandidateOfferNotificationEvent(concurrentEvent, { now, sender: concurrentSender }),
    dispatchCandidateOfferNotificationEvent(concurrentEvent, { now, sender: concurrentSender }),
  ]);
  assert.equal(concurrentSends, 1);

  const unauthenticated = rulesTestEnv.unauthenticatedContext().firestore();
  await assertFails(unauthenticated.collection('offer_notification_fanouts').doc('forbidden').get());
  await assertFails(unauthenticated.collection('candidate_offer_alert_quotas').doc('candidate-match')
    .collection('deliveries').doc('forbidden').set({ status: 'sent' }));

  console.log('Candidate matching offer notification emulator test: OK');
} finally {
  await rulesTestEnv.cleanup();
}
