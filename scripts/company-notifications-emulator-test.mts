import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';

function configureEmulatorEnvironment() {
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
}

async function assertEmulatorAvailable() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host: hostname, port: Number(portValue) });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}.`));
    }, 1000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });
    socket.once('error', rejectPromise);
  });
}

configureEmulatorEnvironment();
await assertEmulatorAvailable();

const {
  buildApplicationSubmittedNotificationEvent,
  buildApplicationSubmittedNotificationEventId,
  dispatchCompanyNotificationEvent,
  getCompanyNotificationState,
  prepareApplicationSubmittedNotificationEvent,
  registerCompanyNotificationDevice,
  setCompanyNotificationPreference,
} = await import('@/lib/seveno-company-notifications-server');
const { Timestamp } = await import('firebase-admin/firestore');
const { adminDb } = await import('@/lib/firebase-admin');
const { buildCompanyMembershipId } = await import('@/lib/seveno-company-memberships-server');
if (!adminDb) {
  throw new Error('Firebase Admin Firestore is not configured.');
}

const rulesTestEnv = await initializeTestEnvironment({
  projectId: process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local',
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
  },
});

function now() {
  return Timestamp.fromDate(new Date('2026-08-03T12:00:00.000Z'));
}

async function seedCompany(companyUid: string, role: 'company' | 'candidate' = 'company') {
  const timestamp = now();
  await adminDb.collection('users').doc(companyUid).set({
    uid: companyUid,
    role,
    authProvider: 'password',
    email: `${companyUid}@seveno.local`,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  if (role === 'company') {
    await adminDb.collection('company_profiles').doc(companyUid).set({
      uid: companyUid,
      profileStatus: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const membershipId = buildCompanyMembershipId(companyUid, companyUid);
    await adminDb.collection('company_memberships').doc(membershipId).set({ membershipId, companyId: companyUid, userUid: companyUid, role: 'owner', status: 'active', createdAt: timestamp, updatedAt: timestamp });
  }
}

async function seedDeliveryCase(input: {
  suffix: string;
  preference?: boolean;
  tokens?: string[];
  applicationStatus?: string;
}) {
  const companyUid = `company-${input.suffix}`;
  const applicationId = `application-${input.suffix}`;
  const offerId = `offer-${input.suffix}`;
  await seedCompany(companyUid);
  await adminDb.collection('job_offers').doc(offerId).set({ companyId: companyUid, companyUid, assignedToUid: companyUid, title: 'Développeur', status: 'published' });
  await adminDb.collection('job_applications').doc(applicationId).set({
    companyUid,
    offerId,
    status: input.applicationStatus ?? 'submitted',
    offerSnapshot: { title: 'Développeur' },
  });
  await adminDb.collection('company_push_subscriptions').doc(companyUid).set({
    companyUid,
    preferences: { application_received: input.preference !== false, questionnaire_completed: false },
    createdAt: now(),
    updatedAt: now(),
  });
  for (const [index, token] of (input.tokens ?? []).entries()) {
    const deviceId = `device-${index}`;
    await adminDb.collection('company_push_subscriptions').doc(companyUid).collection('devices').doc(deviceId).set({
      companyUid,
      deviceId,
      token,
      permission: 'granted',
      enabled: true,
      createdAt: now(),
      updatedAt: now(),
      lastSeenAt: now(),
      lastNotificationAt: null,
      revokedAt: null,
    });
  }
  const eventId = buildApplicationSubmittedNotificationEventId(applicationId);
  await adminDb.collection('notification_outbox').doc(eventId).set(buildApplicationSubmittedNotificationEvent({
    applicationId,
    offerId,
    companyUid,
    now: now(),
  }));
  return { companyUid, applicationId, offerId, eventId };
}

try {
  await rulesTestEnv.clearFirestore();

  const companyUid = `company-subscription-${randomUUID().slice(0, 8)}`;
  await seedCompany(companyUid);
  const candidateUid = `candidate-subscription-${randomUUID().slice(0, 8)}`;
  await seedCompany(candidateUid, 'candidate');
  await assert.rejects(
    registerCompanyNotificationDevice(candidateUid, { deviceId: 'candidate-device', token: 'candidate-token', permission: 'granted' }),
    /entreprises/i,
  );

  let state = await getCompanyNotificationState(companyUid, 'device-a');
  assert.equal(state.currentDeviceRegistered, false);
  await assert.rejects(
    setCompanyNotificationPreference(companyUid, 'application_received', true),
    /appareil/i,
  );
  await registerCompanyNotificationDevice(companyUid, {
    deviceId: 'device-a',
    token: 'token-a',
    permission: 'granted',
    platform: 'test',
  });
  state = await setCompanyNotificationPreference(companyUid, 'application_received', true);
  assert.equal(state.applicationReceivedEnabled, true);
  assert.equal(state.hasActiveDevice, true);
  state = await getCompanyNotificationState(companyUid, 'device-a');
  assert.equal(state.currentDeviceRegistered, true);
  state = await setCompanyNotificationPreference(companyUid, 'application_received', false);
  assert.equal(state.applicationReceivedEnabled, false);

  const client = rulesTestEnv.authenticatedContext(companyUid, { role: 'company' }).firestore();
  await assertFails(client.collection('company_push_subscriptions').doc(companyUid).get());
  await assertFails(client.collection('company_push_subscriptions').doc(companyUid).collection('devices').doc('device-a').get());
  await assertFails(client.collection('notification_outbox').doc('event').get());

  const atomicApplicationId = 'application-atomic';
  const atomicCompanyUid = 'company-atomic';
  const atomicOfferId = 'offer-atomic';
  await seedCompany(atomicCompanyUid);
  await adminDb.collection('job_offers').doc(atomicOfferId).set({ companyId: atomicCompanyUid, companyUid: atomicCompanyUid, assignedToUid: atomicCompanyUid, status: 'published' });
  await adminDb.collection('job_applications').doc(atomicApplicationId).set({ status: 'draft' });
  const atomicEventId = buildApplicationSubmittedNotificationEventId(atomicApplicationId);
  await adminDb.runTransaction(async (transaction) => {
    await prepareApplicationSubmittedNotificationEvent(transaction, adminDb, {
      applicationId: atomicApplicationId,
      offerId: atomicOfferId,
      companyUid: atomicCompanyUid,
      now: now(),
    });
    transaction.update(adminDb.collection('job_applications').doc(atomicApplicationId), { status: 'submitted' });
  });
  assert.equal((await adminDb.collection('job_applications').doc(atomicApplicationId).get()).get('status'), 'submitted');
  assert.equal((await adminDb.collection('notification_outbox').doc(atomicEventId).get()).exists, true);
  await adminDb.runTransaction(async (transaction) => {
    const result = await prepareApplicationSubmittedNotificationEvent(transaction, adminDb, {
      applicationId: atomicApplicationId,
      offerId: atomicOfferId,
      companyUid: atomicCompanyUid,
      now: now(),
    });
    assert.equal(result.created, false);
  });
  assert.equal((await adminDb.collection('notification_outbox').where('applicationId', '==', atomicApplicationId).get()).size, 1);

  const failedAtomicApplicationId = 'application-atomic-failed';
  await seedCompany('company-atomic-failed');
  await adminDb.collection('job_offers').doc('offer-atomic-failed').set({ companyId: 'company-atomic-failed', companyUid: 'company-atomic-failed', assignedToUid: 'company-atomic-failed', status: 'published' });
  await adminDb.collection('job_applications').doc(failedAtomicApplicationId).set({ status: 'draft' });
  await assert.rejects(adminDb.runTransaction(async (transaction) => {
    await prepareApplicationSubmittedNotificationEvent(transaction, adminDb, {
      applicationId: failedAtomicApplicationId,
      offerId: 'offer-atomic-failed',
      companyUid: 'company-atomic-failed',
      now: now(),
    });
    transaction.update(adminDb.collection('job_applications').doc(failedAtomicApplicationId), { status: 'submitted' });
    throw new Error('forced_transaction_failure');
  }), /forced_transaction_failure/);
  assert.equal((await adminDb.collection('job_applications').doc(failedAtomicApplicationId).get()).get('status'), 'draft');
  assert.equal((await adminDb.collection('notification_outbox').doc(buildApplicationSubmittedNotificationEventId(failedAtomicApplicationId)).get()).exists, false);

  let sends = 0;
  const sentCase = await seedDeliveryCase({ suffix: 'sent', tokens: ['valid-token'] });
  await dispatchCompanyNotificationEvent(sentCase.eventId, {
    now: now(),
    sender: async (message) => {
      sends += 1;
      assert.deepEqual(message.tokens, ['valid-token']);
      assert.equal(message.notification?.title, 'Nouvelle candidature reçue');
      assert.equal(message.notification?.body, 'Un candidat vient de postuler à votre offre « Développeur ».');
      assert.deepEqual(message.data, {
        kind: 'company_application_submitted',
        applicationId: sentCase.applicationId,
        offerId: sentCase.offerId,
        clickUrl: `/entreprise/demandes/${sentCase.applicationId}`,
        payloadVersion: '1',
      });
      assert.equal(JSON.stringify(message).includes('@seveno.local'), false);
      return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
    },
  });
  assert.equal((await adminDb.collection('notification_outbox').doc(sentCase.eventId).get()).get('status'), 'sent');
  await dispatchCompanyNotificationEvent(sentCase.eventId, { now: now(), sender: async () => {
    sends += 1;
    return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
  } });
  assert.equal(sends, 1, 'Un événement sent ne doit jamais être renvoyé.');

  const disabledCase = await seedDeliveryCase({ suffix: 'disabled', preference: false, tokens: ['valid-token'] });
  await dispatchCompanyNotificationEvent(disabledCase.eventId, { now: now(), sender: async () => {
    throw new Error('sender_must_not_run');
  } });
  assert.equal((await adminDb.collection('notification_outbox').doc(disabledCase.eventId).get()).get('status'), 'skipped');

  const noDeviceCase = await seedDeliveryCase({ suffix: 'no-device', tokens: [] });
  await dispatchCompanyNotificationEvent(noDeviceCase.eventId, { now: now(), sender: async () => {
    throw new Error('sender_must_not_run');
  } });
  assert.equal((await adminDb.collection('notification_outbox').doc(noDeviceCase.eventId).get()).get('status'), 'skipped');
  assert.equal((await adminDb.collection('notification_outbox').doc(noDeviceCase.eventId).get()).get('lastErrorCode'), 'no_active_device');

  const duplicateCase = await seedDeliveryCase({ suffix: 'duplicate', tokens: ['same-token', 'same-token'] });
  await dispatchCompanyNotificationEvent(duplicateCase.eventId, { now: now(), sender: async (message) => {
    assert.deepEqual(message.tokens, ['same-token']);
    return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
  } });

  const multicastCase = await seedDeliveryCase({ suffix: 'multicast', tokens: ['token-one', 'token-two'] });
  await dispatchCompanyNotificationEvent(multicastCase.eventId, { now: now(), sender: async (message) => {
    assert.deepEqual(message.tokens, ['token-one', 'token-two']);
    return {
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    };
  } });
  assert.equal((await adminDb.collection('notification_outbox').doc(multicastCase.eventId).get()).get('status'), 'sent');

  const invalidCase = await seedDeliveryCase({ suffix: 'invalid', tokens: ['invalid-token'] });
  await dispatchCompanyNotificationEvent(invalidCase.eventId, { now: now(), sender: async () => ({
    successCount: 0,
    failureCount: 1,
    responses: [{ success: false, error: { code: 'messaging/registration-token-not-registered' } }],
  }) });
  assert.equal((await adminDb.collection('notification_outbox').doc(invalidCase.eventId).get()).get('status'), 'failed');
  assert.equal((await adminDb.collection('company_push_subscriptions').doc(invalidCase.companyUid).collection('devices').doc('device-0').get()).get('enabled'), false);

  const partialCase = await seedDeliveryCase({ suffix: 'partial', tokens: ['valid-token', 'temporary-token'] });
  await dispatchCompanyNotificationEvent(partialCase.eventId, { now: now(), sender: async () => ({
    successCount: 1,
    failureCount: 1,
    responses: [{ success: true }, { success: false, error: { code: 'messaging/internal-error' } }],
  }) });
  assert.equal((await adminDb.collection('notification_outbox').doc(partialCase.eventId).get()).get('status'), 'partial');

  const temporaryCase = await seedDeliveryCase({ suffix: 'temporary', tokens: ['temporary-token'] });
  let temporarySends = 0;
  await dispatchCompanyNotificationEvent(temporaryCase.eventId, { now: now(), sender: async () => {
    temporarySends += 1;
    throw Object.assign(new Error('temporary'), { code: 'messaging/internal-error' });
  } });
  const temporaryEvent = await adminDb.collection('notification_outbox').doc(temporaryCase.eventId).get();
  assert.equal(temporaryEvent.get('status'), 'failed');
  assert.equal(temporaryEvent.get('attempts'), 1);
  assert.equal(temporaryEvent.get('lastErrorCode'), 'messaging/internal-error');
  assert.equal(temporaryEvent.get('nextAttemptAt').toMillis() > now().toMillis(), true);
  await dispatchCompanyNotificationEvent(temporaryCase.eventId, { now: now(), sender: async () => {
    temporarySends += 1;
    return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
  } });
  assert.equal(temporarySends, 1, 'Le retry ne doit pas ignorer nextAttemptAt.');

  const wrongCompanyCase = await seedDeliveryCase({ suffix: 'wrong-company', tokens: ['valid-token'] });
  await adminDb.collection('job_offers').doc(wrongCompanyCase.offerId).update({ companyUid: 'another-company' });
  await dispatchCompanyNotificationEvent(wrongCompanyCase.eventId, { now: now(), sender: async () => {
    throw new Error('sender_must_not_run');
  } });
  assert.equal((await adminDb.collection('notification_outbox').doc(wrongCompanyCase.eventId).get()).get('lastErrorCode'), 'offer_unavailable');

  const obsoleteCase = await seedDeliveryCase({ suffix: 'obsolete', tokens: ['valid-token'], applicationStatus: 'draft' });
  await dispatchCompanyNotificationEvent(obsoleteCase.eventId, { now: now(), sender: async () => {
    throw new Error('sender_must_not_run');
  } });
  assert.equal((await adminDb.collection('notification_outbox').doc(obsoleteCase.eventId).get()).get('lastErrorCode'), 'application_unavailable');

  const concurrentCase = await seedDeliveryCase({ suffix: 'concurrent', tokens: ['valid-token'] });
  let concurrentSends = 0;
  const concurrentSender = async () => {
    concurrentSends += 1;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30));
    return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
  };
  await Promise.all([
    dispatchCompanyNotificationEvent(concurrentCase.eventId, { now: now(), sender: concurrentSender }),
    dispatchCompanyNotificationEvent(concurrentCase.eventId, { now: now(), sender: concurrentSender }),
  ]);
  assert.equal(concurrentSends, 1);

  console.log('Company notifications Phase 1 emulator test: OK');
} finally {
  await rulesTestEnv.cleanup();
}
