import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';

function configureEmulatorEnvironment() {
  const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
  if (projectId !== 'demo-seveno-local') {
    throw new Error(`Projet émulateur interdit: ${projectId}`);
  }
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

async function assertFirestoreEmulatorAvailable() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host: hostname, port: Number(portValue) });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore Emulator inaccessible sur ${host}.`));
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
await assertFirestoreEmulatorAvailable();

const {
  buildApplicationQuestionnaireCompletedNotificationEvent,
  buildApplicationQuestionnaireCompletedNotificationEventId,
  dispatchCompanyNotificationEvent,
  prepareApplicationQuestionnaireCompletedNotificationEvent,
  registerCompanyNotificationDevice,
  setCompanyNotificationPreference,
} = await import('@/lib/seveno-company-notifications-server');
const { Timestamp } = await import('firebase-admin/firestore');
const { adminDb } = await import('@/lib/firebase-admin');
if (!adminDb) {
  throw new Error('Firebase Admin Firestore is not configured.');
}

const runId = randomUUID().slice(0, 8);

function now() {
  return Timestamp.fromDate(new Date('2026-08-04T10:00:00.000Z'));
}

async function seedCompany(companyUid: string) {
  await adminDb.collection('users').doc(companyUid).set({
    uid: companyUid,
    role: 'company',
    authProvider: 'password',
    email: `${companyUid}@seveno.local`,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now(),
    updatedAt: now(),
  });
  await adminDb.collection('company_profiles').doc(companyUid).set({
    uid: companyUid,
    profileStatus: 'active',
    createdAt: now(),
    updatedAt: now(),
  });
}

async function seedQuestionnaireDeliveryCase(input: {
  suffix: string;
  questionnairePreference?: boolean;
  applicationPreference?: boolean;
  tokens?: string[];
  createResult?: boolean;
  resultStatus?: string;
  applicationStatus?: string;
  resultCompanyUid?: string;
}) {
  const companyUid = `company-questionnaire-${input.suffix}-${runId}`;
  const applicationId = `application-questionnaire-${input.suffix}-${runId}`;
  const offerId = `offer-questionnaire-${input.suffix}-${runId}`;
  const resultId = `session-questionnaire-${input.suffix}-${runId}`;
  await seedCompany(companyUid);
  await adminDb.collection('job_offers').doc(offerId).set({
    companyUid,
    title: 'Développeur full stack',
    status: 'published',
  });
  await adminDb.collection('job_applications').doc(applicationId).set({
    companyUid,
    offerId,
    status: input.applicationStatus ?? 'questionnaire_completed',
    offerSnapshot: { title: 'Développeur full stack' },
    companyAssessment: { sessionId: resultId, resultId, status: 'completed' },
  });
  if (input.createResult !== false) {
    await adminDb.collection('test_results').doc(resultId).set({
      assessmentType: 'company_application',
      status: input.resultStatus ?? 'completed',
      applicationId,
      offerId,
      companyUid: input.resultCompanyUid ?? companyUid,
      sessionId: resultId,
    });
  }
  await adminDb.collection('company_push_subscriptions').doc(companyUid).set({
    companyUid,
    preferences: {
      application_received: input.applicationPreference === true,
      questionnaire_completed: input.questionnairePreference !== false,
    },
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
  const eventId = buildApplicationQuestionnaireCompletedNotificationEventId(applicationId, resultId);
  await adminDb.collection('notification_outbox').doc(eventId).set(
    buildApplicationQuestionnaireCompletedNotificationEvent({
      applicationId,
      offerId,
      companyUid,
      resultId,
      now: now(),
    }),
  );
  return { companyUid, applicationId, offerId, resultId, eventId };
}

try {
  const questionnaireSource = readFileSync(
    resolve(process.cwd(), 'lib/seveno-application-questionnaires-server.ts'),
    'utf8',
  );
  const generalAssessmentSource = readFileSync(resolve(process.cwd(), 'lib/seveno-tests.ts'), 'utf8');
  assert.equal(
    [...questionnaireSource.matchAll(/prepareApplicationQuestionnaireCompletedNotificationEvent\(/g)].length,
    2,
    'Les deux chemins de soumission finale doivent créer le même événement.',
  );
  assert.equal(
    [...questionnaireSource.matchAll(/dispatchQuestionnaireCompletedNotification\(transactionResult\.notificationEventId\)/g)].length,
    2,
    'Le dispatch doit suivre chacune des deux transactions finales.',
  );
  assert.equal(generalAssessmentSource.includes('prepareApplicationQuestionnaireCompletedNotificationEvent'), false);

  const atomicCompanyUid = `company-questionnaire-atomic-${runId}`;
  const atomicApplicationId = `application-questionnaire-atomic-${runId}`;
  const atomicOfferId = `offer-questionnaire-atomic-${runId}`;
  const atomicResultId = `session-questionnaire-atomic-${runId}`;
  await adminDb.collection('job_applications').doc(atomicApplicationId).set({
    companyUid: atomicCompanyUid,
    offerId: atomicOfferId,
    status: 'questionnaire_pending',
  });
  const atomicEventId = buildApplicationQuestionnaireCompletedNotificationEventId(
    atomicApplicationId,
    atomicResultId,
  );
  await adminDb.runTransaction(async (transaction) => {
    await prepareApplicationQuestionnaireCompletedNotificationEvent(transaction, adminDb, {
      applicationId: atomicApplicationId,
      offerId: atomicOfferId,
      companyUid: atomicCompanyUid,
      resultId: atomicResultId,
      now: now(),
    });
    transaction.create(adminDb.collection('test_results').doc(atomicResultId), {
      assessmentType: 'company_application',
      status: 'completed',
      applicationId: atomicApplicationId,
      offerId: atomicOfferId,
      companyUid: atomicCompanyUid,
    });
    transaction.update(adminDb.collection('job_applications').doc(atomicApplicationId), {
      status: 'questionnaire_completed',
      companyAssessment: { resultId: atomicResultId },
    });
  });
  assert.equal((await adminDb.collection('test_results').doc(atomicResultId).get()).exists, true);
  assert.equal((await adminDb.collection('job_applications').doc(atomicApplicationId).get()).get('status'), 'questionnaire_completed');
  assert.equal((await adminDb.collection('notification_outbox').doc(atomicEventId).get()).exists, true);

  await adminDb.runTransaction(async (transaction) => {
    const prepared = await prepareApplicationQuestionnaireCompletedNotificationEvent(transaction, adminDb, {
      applicationId: atomicApplicationId,
      offerId: atomicOfferId,
      companyUid: atomicCompanyUid,
      resultId: atomicResultId,
      now: now(),
    });
    assert.equal(prepared.created, false);
  });
  assert.equal(
    (await adminDb.collection('notification_outbox').where('applicationId', '==', atomicApplicationId).get()).size,
    1,
  );

  const failedApplicationId = `application-questionnaire-atomic-failed-${runId}`;
  const failedResultId = `session-questionnaire-atomic-failed-${runId}`;
  await adminDb.collection('job_applications').doc(failedApplicationId).set({ status: 'questionnaire_pending' });
  await assert.rejects(adminDb.runTransaction(async (transaction) => {
    await prepareApplicationQuestionnaireCompletedNotificationEvent(transaction, adminDb, {
      applicationId: failedApplicationId,
      offerId: `offer-questionnaire-atomic-failed-${runId}`,
      companyUid: `company-questionnaire-atomic-failed-${runId}`,
      resultId: failedResultId,
      now: now(),
    });
    transaction.create(adminDb.collection('test_results').doc(failedResultId), { status: 'completed' });
    transaction.update(adminDb.collection('job_applications').doc(failedApplicationId), { status: 'questionnaire_completed' });
    throw new Error('forced_transaction_failure');
  }), /forced_transaction_failure/);
  assert.equal((await adminDb.collection('test_results').doc(failedResultId).get()).exists, false);
  assert.equal(
    (await adminDb.collection('notification_outbox').doc(
      buildApplicationQuestionnaireCompletedNotificationEventId(failedApplicationId, failedResultId),
    ).get()).exists,
    false,
  );

  const preferenceCompanyUid = `company-questionnaire-preferences-${runId}`;
  await seedCompany(preferenceCompanyUid);
  await registerCompanyNotificationDevice(preferenceCompanyUid, {
    deviceId: 'preference-device',
    token: 'preference-token',
    permission: 'granted',
  });
  let preferenceState = await setCompanyNotificationPreference(
    preferenceCompanyUid,
    'questionnaire_completed',
    true,
  );
  assert.equal(preferenceState.questionnaireCompletedEnabled, true);
  assert.equal(preferenceState.applicationReceivedEnabled, false);
  preferenceState = await setCompanyNotificationPreference(preferenceCompanyUid, 'application_received', true);
  preferenceState = await setCompanyNotificationPreference(preferenceCompanyUid, 'questionnaire_completed', false);
  assert.equal(preferenceState.applicationReceivedEnabled, true);
  assert.equal(preferenceState.questionnaireCompletedEnabled, false);

  let sends = 0;
  const sentCase = await seedQuestionnaireDeliveryCase({
    suffix: 'sent',
    tokens: ['valid-token'],
    questionnairePreference: true,
    applicationPreference: false,
  });
  await dispatchCompanyNotificationEvent(sentCase.eventId, {
    now: now(),
    sender: async (message) => {
      sends += 1;
      assert.deepEqual(message.tokens, ['valid-token']);
      assert.equal(message.notification?.title, 'Questionnaire candidat terminé');
      assert.equal(
        message.notification?.body,
        'Un candidat a terminé le questionnaire lié à votre offre « Développeur full stack ».',
      );
      assert.deepEqual(message.data, {
        kind: 'company_questionnaire_completed',
        applicationId: sentCase.applicationId,
        offerId: sentCase.offerId,
        clickUrl: `/entreprise/demandes/${sentCase.applicationId}`,
        payloadVersion: '1',
      });
      const serialized = JSON.stringify(message);
      for (const forbidden of ['candidateName', 'candidateEmail', 'answer', 'score', 'valid-token']) {
        if (forbidden === 'valid-token') {
          continue;
        }
        assert.equal(serialized.includes(forbidden), false, `Donnée interdite dans le payload: ${forbidden}`);
      }
      return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
    },
  });
  assert.equal((await adminDb.collection('notification_outbox').doc(sentCase.eventId).get()).get('status'), 'sent');
  await dispatchCompanyNotificationEvent(sentCase.eventId, {
    now: now(),
    sender: async () => {
      sends += 1;
      return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
    },
  });
  assert.equal(sends, 1, 'Un événement sent ne doit jamais repartir.');

  const disabledCase = await seedQuestionnaireDeliveryCase({
    suffix: 'disabled',
    tokens: ['valid-token'],
    questionnairePreference: false,
    applicationPreference: true,
  });
  await dispatchCompanyNotificationEvent(disabledCase.eventId, {
    now: now(),
    sender: async () => {
      throw new Error('sender_must_not_run');
    },
  });
  assert.equal((await adminDb.collection('notification_outbox').doc(disabledCase.eventId).get()).get('lastErrorCode'), 'preference_disabled');

  const noDeviceCase = await seedQuestionnaireDeliveryCase({ suffix: 'no-device', tokens: [] });
  await dispatchCompanyNotificationEvent(noDeviceCase.eventId, {
    now: now(),
    sender: async () => {
      throw new Error('sender_must_not_run');
    },
  });
  assert.equal((await adminDb.collection('notification_outbox').doc(noDeviceCase.eventId).get()).get('lastErrorCode'), 'no_active_device');

  const missingResultCase = await seedQuestionnaireDeliveryCase({
    suffix: 'missing-result',
    tokens: ['valid-token'],
    createResult: false,
  });
  await dispatchCompanyNotificationEvent(missingResultCase.eventId, {
    now: now(),
    sender: async () => {
      throw new Error('sender_must_not_run');
    },
  });
  assert.equal(
    (await adminDb.collection('notification_outbox').doc(missingResultCase.eventId).get()).get('lastErrorCode'),
    'questionnaire_result_unavailable',
  );

  const nonFinalResultCase = await seedQuestionnaireDeliveryCase({
    suffix: 'non-final-result',
    tokens: ['valid-token'],
    resultStatus: 'in_progress',
  });
  await dispatchCompanyNotificationEvent(nonFinalResultCase.eventId, {
    now: now(),
    sender: async () => {
      throw new Error('sender_must_not_run');
    },
  });
  assert.equal(
    (await adminDb.collection('notification_outbox').doc(nonFinalResultCase.eventId).get()).get('lastErrorCode'),
    'questionnaire_result_unavailable',
  );

  const wrongCompanyCase = await seedQuestionnaireDeliveryCase({
    suffix: 'wrong-company',
    tokens: ['valid-token'],
    resultCompanyUid: 'another-company',
  });
  await dispatchCompanyNotificationEvent(wrongCompanyCase.eventId, {
    now: now(),
    sender: async () => {
      throw new Error('sender_must_not_run');
    },
  });
  assert.equal(
    (await adminDb.collection('notification_outbox').doc(wrongCompanyCase.eventId).get()).get('lastErrorCode'),
    'questionnaire_result_unavailable',
  );

  const tokensCase = await seedQuestionnaireDeliveryCase({
    suffix: 'tokens',
    tokens: ['same-token', 'same-token', 'invalid-token'],
  });
  await dispatchCompanyNotificationEvent(tokensCase.eventId, {
    now: now(),
    sender: async (message) => {
      assert.deepEqual(message.tokens, ['same-token', 'invalid-token']);
      return {
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        ],
      };
    },
  });
  assert.equal((await adminDb.collection('notification_outbox').doc(tokensCase.eventId).get()).get('status'), 'partial');
  assert.equal(
    (await adminDb.collection('company_push_subscriptions').doc(tokensCase.companyUid).collection('devices').doc('device-2').get()).get('enabled'),
    false,
  );
  assert.equal(
    (await adminDb.collection('company_push_subscriptions').doc(tokensCase.companyUid).collection('devices').doc('device-0').get()).get('enabled'),
    true,
  );

  const concurrentCase = await seedQuestionnaireDeliveryCase({ suffix: 'concurrent', tokens: ['valid-token'] });
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

  console.log('Company questionnaire completed notifications Phase 2 emulator test: OK');
} finally {
  // Les identifiants uniques isolent chaque exécution dans l’émulateur local.
}
