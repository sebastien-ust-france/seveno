import assert from 'node:assert/strict';
import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DocumentData, Firestore, Query } from 'firebase-admin/firestore';

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function configureEmulatorEnvironment() {
  const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
  process.env.NODE_ENV = 'test';
  process.env.SEVENO_EMULATOR_PROJECT_ID = projectId;
  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
}

async function assertEmulatorAvailable() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  const port = Number(portValue);

  if (!hostname || !Number.isFinite(port)) {
    throw new Error(`Firestore emulator host invalide: ${host}`);
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host: hostname, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}. Lancez l emulator local avant ce smoke test.`));
    }, 1000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });

    socket.once('error', () => {
      clearTimeout(timeout);
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}. Lancez l emulator local avant ce smoke test.`));
    });
  });
}

async function deleteQueryDocs(query: Query<DocumentData>) {
  const snapshot = await query.get();
  await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
}

async function resetAvailabilityData(adminDb: Firestore) {
  await deleteQueryDocs(adminDb.collection('candidate_profiles'));
  await deleteQueryDocs(adminDb.collection('availability_confirmation_requests'));
  await deleteQueryDocs(adminDb.collection('availability_confirmation_events'));
  await deleteQueryDocs(adminDb.collectionGroup('devices'));
}

async function seedCandidateProfile(
  adminDb: Firestore,
  input: {
    uid: string;
    publicCandidateId: string;
    availabilityReminderAt: Date;
    extra?: Record<string, unknown>;
  },
) {
  const now = new Date('2026-07-24T10:00:00.000Z');
  await adminDb.collection('candidate_profiles').doc(input.uid).set({
    uid: input.uid,
    publicCandidateId: input.publicCandidateId,
    role: 'candidate',
    targetJobRoleIds: ['job-role-1'],
    targetJobs: [
      {
        sectorId: 'sector-1',
        jobFamilyId: 'family-1',
        jobRoleId: 'job-role-1',
        label: 'Job role 1',
      },
    ],
    sectorId: 'sector-1',
    jobFamilyId: 'family-1',
    jobRoleId: 'job-role-1',
    availability: 'immediate',
    locationArea: 'Paris',
    experienceLevel: 'intermediate',
    verifiedScore: null,
    testPassed: false,
    lastTestAt: null,
    sevenoAssessmentStatus: 'not_started',
    sevenoAssessmentOverallScore: null,
    sevenoAssessmentDimensions: {},
    sevenoAssessmentVersion: null,
    sevenoAssessmentCompletedAt: null,
    profileStatus: 'active',
    dailyAvailabilityConfirmationEnabled: true,
    nextAvailabilityReminderAt: input.availabilityReminderAt,
    lastAvailabilityNotificationAt: null,
    availabilityTimezone: 'Europe/Paris',
    hasActiveAvailabilityPushSubscription: false,
    createdAt: now,
    updatedAt: now,
    ...input.extra,
  });
}

async function seedDevice(
  adminDb: Firestore,
  input: {
    uid: string;
    deviceId: string;
    ownerUid?: string;
    token: string;
    enabled?: boolean;
  },
) {
  const now = new Date('2026-07-24T10:00:00.000Z');
  await adminDb
    .collection('candidate_push_subscriptions')
    .doc(input.uid)
    .collection('devices')
    .doc(input.deviceId)
    .set({
      uid: input.ownerUid ?? input.uid,
      deviceId: input.deviceId,
      token: input.token,
      permission: 'granted',
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
}

async function getDocumentsByCandidateUid(
  adminDb: Firestore,
  collectionName: string,
  candidateUid: string,
) {
  return adminDb.collection(collectionName).where('candidateUid', '==', candidateUid).get();
}

function countSnapshotByFieldValue(
  snapshot: { docs: Array<{ get: (field: string) => unknown }> },
  field: string,
  value: unknown,
) {
  return snapshot.docs.filter((doc) => doc.get(field) === value).length;
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  await assertEmulatorAvailable();

  const { adminDb } = await import('@/lib/firebase-admin');
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const { processAvailabilityRemindersBatch } = await import('@/lib/seveno-candidate-availability-server');

  await resetAvailabilityData(adminDb);

  try {
    const dueAt = new Date(Date.now() - 60 * 60 * 1000);
    const ownerCandidateUid = `availability-owner-${randomUUID().slice(0, 8)}`;
    const isolatedCandidateUid = `availability-isolated-${randomUUID().slice(0, 8)}`;
    const noDeviceCandidateUid = `availability-no-device-${randomUUID().slice(0, 8)}`;
    const mixedCandidateUid = `availability-mixed-${randomUUID().slice(0, 8)}`;
    const singleInvalidCandidateUid = `availability-invalid-one-${randomUUID().slice(0, 8)}`;
    const doubleInvalidCandidateUid = `availability-invalid-two-${randomUUID().slice(0, 8)}`;

    await seedCandidateProfile(adminDb, {
      uid: ownerCandidateUid,
      publicCandidateId: `public-${randomUUID().slice(0, 8)}`,
      availabilityReminderAt: dueAt,
    });
    await seedDevice(adminDb, {
      uid: ownerCandidateUid,
      deviceId: 'device-owner-good',
      token: 'token-owner-good',
      enabled: true,
    });
    await seedDevice(adminDb, {
      uid: ownerCandidateUid,
      deviceId: 'device-owner-alien',
      ownerUid: `alien-${randomUUID().slice(0, 8)}`,
      token: 'token-owner-alien',
      enabled: true,
    });

    await seedCandidateProfile(adminDb, {
      uid: isolatedCandidateUid,
      publicCandidateId: `public-${randomUUID().slice(0, 8)}`,
      availabilityReminderAt: dueAt,
    });
    await seedDevice(adminDb, {
      uid: isolatedCandidateUid,
      deviceId: 'device-isolated-valid',
      token: 'token-isolated-valid',
      enabled: true,
    });

    await seedCandidateProfile(adminDb, {
      uid: noDeviceCandidateUid,
      publicCandidateId: `public-${randomUUID().slice(0, 8)}`,
      availabilityReminderAt: dueAt,
    });

    await seedCandidateProfile(adminDb, {
      uid: mixedCandidateUid,
      publicCandidateId: `public-${randomUUID().slice(0, 8)}`,
      availabilityReminderAt: dueAt,
    });
    await seedDevice(adminDb, {
      uid: mixedCandidateUid,
      deviceId: 'device-mixed-valid',
      token: 'token-mixed-valid',
      enabled: true,
    });
    await seedDevice(adminDb, {
      uid: mixedCandidateUid,
      deviceId: 'device-mixed-invalid',
      token: 'token-mixed-invalid',
      enabled: true,
    });

    await seedCandidateProfile(adminDb, {
      uid: singleInvalidCandidateUid,
      publicCandidateId: `public-${randomUUID().slice(0, 8)}`,
      availabilityReminderAt: dueAt,
    });
    await seedDevice(adminDb, {
      uid: singleInvalidCandidateUid,
      deviceId: 'device-invalid-one',
      token: 'token-invalid-one',
      enabled: true,
    });

    await seedCandidateProfile(adminDb, {
      uid: doubleInvalidCandidateUid,
      publicCandidateId: `public-${randomUUID().slice(0, 8)}`,
      availabilityReminderAt: dueAt,
    });
    await seedDevice(adminDb, {
      uid: doubleInvalidCandidateUid,
      deviceId: 'device-invalid-two-a',
      token: 'token-invalid-two-a',
      enabled: true,
    });
    await seedDevice(adminDb, {
      uid: doubleInvalidCandidateUid,
      deviceId: 'device-invalid-two-b',
      token: 'token-invalid-two-b',
      enabled: true,
    });

    const senderCalls: Array<{ uid: string; deviceIds: string[] }> = [];
    const fakeSender = async (
      profile: { uid: string },
      requestId: string,
      token: string,
      devices: Array<{ deviceId: string }>,
    ) => {
      senderCalls.push({ uid: profile.uid, deviceIds: devices.map((device) => device.deviceId) });
      void requestId;
      void token;

      if (profile.uid === ownerCandidateUid) {
        return { sent: 1, failed: 0, invalidDeviceIds: [] };
      }

      if (profile.uid === isolatedCandidateUid) {
        return { sent: 1, failed: 0, invalidDeviceIds: [] };
      }

      if (profile.uid === mixedCandidateUid) {
        return { sent: 1, failed: 1, invalidDeviceIds: ['device-mixed-invalid'] };
      }

      if (profile.uid === singleInvalidCandidateUid) {
        return { sent: 0, failed: 1, invalidDeviceIds: ['device-invalid-one'] };
      }

      if (profile.uid === doubleInvalidCandidateUid) {
        return { sent: 0, failed: 2, invalidDeviceIds: ['device-invalid-two-a', 'device-invalid-two-b'] };
      }

      return { sent: 0, failed: 0, invalidDeviceIds: [] };
    };

    const result = await processAvailabilityRemindersBatch(undefined, {
      sendAvailabilityNotificationToDevices: fakeSender as any,
    });

    assert.equal(result.scanned, 6);
    assert.equal(result.processed, 6);
    assert.equal(result.skippedNoActiveDevice, 1);
    assert.equal(result.sent, 3);
    assert.equal(result.failed, 4);

    const ownerCalls = senderCalls.filter((entry) => entry.uid === ownerCandidateUid);
    assert.equal(ownerCalls.length, 1);
    assert.deepEqual(ownerCalls[0]?.deviceIds, ['device-owner-good']);

    const isolatedCalls = senderCalls.filter((entry) => entry.uid === isolatedCandidateUid);
    assert.equal(isolatedCalls.length, 1);
    assert.deepEqual(isolatedCalls[0]?.deviceIds, ['device-isolated-valid']);

    const mixedCalls = senderCalls.filter((entry) => entry.uid === mixedCandidateUid);
    assert.equal(mixedCalls.length, 1);
    assert.deepEqual(mixedCalls[0]?.deviceIds.sort(), ['device-mixed-invalid', 'device-mixed-valid']);

    const singleInvalidCalls = senderCalls.filter((entry) => entry.uid === singleInvalidCandidateUid);
    assert.equal(singleInvalidCalls.length, 1);
    assert.deepEqual(singleInvalidCalls[0]?.deviceIds, ['device-invalid-one']);

    const doubleInvalidCalls = senderCalls.filter((entry) => entry.uid === doubleInvalidCandidateUid);
    assert.equal(doubleInvalidCalls.length, 1);
    assert.deepEqual(doubleInvalidCalls[0]?.deviceIds.sort(), ['device-invalid-two-a', 'device-invalid-two-b']);

    const noDeviceCalls = senderCalls.filter((entry) => entry.uid === noDeviceCandidateUid);
    assert.equal(noDeviceCalls.length, 0);

    const ownerProfile = await adminDb.collection('candidate_profiles').doc(ownerCandidateUid).get();
    const ownerRequestSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_requests', ownerCandidateUid);
    const ownerEventSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_events', ownerCandidateUid);
    const ownerAlienDeviceSnapshot = await adminDb
      .collection('candidate_push_subscriptions')
      .doc(ownerCandidateUid)
      .collection('devices')
      .doc('device-owner-alien')
      .get();

    assert.equal(ownerRequestSnapshot.size, 1);
    assert.equal(countSnapshotByFieldValue(ownerEventSnapshot, 'action', 'notification_sent'), 1);
    assert.equal(countSnapshotByFieldValue(ownerEventSnapshot, 'action', 'notification_failed'), 0);
    assert.notEqual(ownerProfile.get('lastAvailabilityNotificationAt'), null);
    assert.notEqual(ownerProfile.get('nextAvailabilityReminderAt'), null);
    assert.equal(ownerAlienDeviceSnapshot.get('enabled'), true);
    assert.equal(ownerAlienDeviceSnapshot.get('revokedAt') ?? null, null);

    const isolatedProfile = await adminDb.collection('candidate_profiles').doc(isolatedCandidateUid).get();
    const isolatedRequestSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_requests', isolatedCandidateUid);
    const isolatedEventSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_events', isolatedCandidateUid);
    const isolatedDeviceSnapshot = await adminDb
      .collection('candidate_push_subscriptions')
      .doc(isolatedCandidateUid)
      .collection('devices')
      .doc('device-isolated-valid')
      .get();
    assert.equal(isolatedRequestSnapshot.size, 1);
    assert.equal(countSnapshotByFieldValue(isolatedEventSnapshot, 'action', 'notification_sent'), 1);
    assert.equal(countSnapshotByFieldValue(isolatedEventSnapshot, 'action', 'notification_failed'), 0);
    assert.notEqual(isolatedProfile.get('lastAvailabilityNotificationAt'), null);
    assert.notEqual(isolatedProfile.get('nextAvailabilityReminderAt'), null);
    assert.equal(isolatedDeviceSnapshot.get('enabled'), true);

    const noDeviceProfile = await adminDb.collection('candidate_profiles').doc(noDeviceCandidateUid).get();
    const noDeviceRequestSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_requests', noDeviceCandidateUid);
    const noDeviceEventSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_events', noDeviceCandidateUid);
    assert.equal(noDeviceRequestSnapshot.size, 0);
    assert.equal(countSnapshotByFieldValue(noDeviceEventSnapshot, 'action', 'notification_sent'), 0);
    assert.equal(countSnapshotByFieldValue(noDeviceEventSnapshot, 'action', 'notification_failed'), 0);
    assert.equal(noDeviceProfile.get('lastAvailabilityNotificationAt') ?? null, null);
    const noDeviceReminderAt = noDeviceProfile.get('nextAvailabilityReminderAt') as { toDate?: () => Date } | null;
    assert.equal(noDeviceReminderAt?.toDate?.().toISOString(), dueAt.toISOString());

    const mixedProfile = await adminDb.collection('candidate_profiles').doc(mixedCandidateUid).get();
    const mixedRequestSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_requests', mixedCandidateUid);
    const mixedEventSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_events', mixedCandidateUid);
    const mixedValidDeviceSnapshot = await adminDb
      .collection('candidate_push_subscriptions')
      .doc(mixedCandidateUid)
      .collection('devices')
      .doc('device-mixed-valid')
      .get();
    const mixedInvalidDeviceSnapshot = await adminDb
      .collection('candidate_push_subscriptions')
      .doc(mixedCandidateUid)
      .collection('devices')
      .doc('device-mixed-invalid')
      .get();
    assert.equal(mixedRequestSnapshot.size, 1);
    assert.equal(countSnapshotByFieldValue(mixedEventSnapshot, 'action', 'notification_sent'), 1);
    assert.equal(countSnapshotByFieldValue(mixedEventSnapshot, 'action', 'notification_failed'), 1);
    assert.notEqual(mixedProfile.get('lastAvailabilityNotificationAt'), null);
    assert.notEqual(mixedProfile.get('nextAvailabilityReminderAt'), null);
    assert.equal(mixedValidDeviceSnapshot.get('enabled'), true);
    assert.equal(mixedInvalidDeviceSnapshot.get('enabled'), false);
    assert.notEqual(mixedInvalidDeviceSnapshot.get('revokedAt') ?? null, null);

    const singleInvalidProfile = await adminDb.collection('candidate_profiles').doc(singleInvalidCandidateUid).get();
    const singleInvalidRequestSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_requests', singleInvalidCandidateUid);
    const singleInvalidEventSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_events', singleInvalidCandidateUid);
    const singleInvalidDeviceSnapshot = await adminDb
      .collection('candidate_push_subscriptions')
      .doc(singleInvalidCandidateUid)
      .collection('devices')
      .doc('device-invalid-one')
      .get();
    assert.equal(singleInvalidRequestSnapshot.size, 0);
    assert.equal(countSnapshotByFieldValue(singleInvalidEventSnapshot, 'action', 'notification_sent'), 0);
    assert.equal(countSnapshotByFieldValue(singleInvalidEventSnapshot, 'action', 'notification_failed'), 1);
    assert.equal(singleInvalidProfile.get('lastAvailabilityNotificationAt') ?? null, null);
    const singleInvalidReminderAt = singleInvalidProfile.get('nextAvailabilityReminderAt') as { toDate?: () => Date } | null;
    assert.equal(singleInvalidReminderAt?.toDate?.().toISOString(), dueAt.toISOString());
    assert.equal(singleInvalidDeviceSnapshot.get('enabled'), false);
    assert.notEqual(singleInvalidDeviceSnapshot.get('revokedAt') ?? null, null);

    const doubleInvalidProfile = await adminDb.collection('candidate_profiles').doc(doubleInvalidCandidateUid).get();
    const doubleInvalidRequestSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_requests', doubleInvalidCandidateUid);
    const doubleInvalidEventSnapshot = await getDocumentsByCandidateUid(adminDb, 'availability_confirmation_events', doubleInvalidCandidateUid);
    const doubleInvalidDeviceSnapshotA = await adminDb
      .collection('candidate_push_subscriptions')
      .doc(doubleInvalidCandidateUid)
      .collection('devices')
      .doc('device-invalid-two-a')
      .get();
    const doubleInvalidDeviceSnapshotB = await adminDb
      .collection('candidate_push_subscriptions')
      .doc(doubleInvalidCandidateUid)
      .collection('devices')
      .doc('device-invalid-two-b')
      .get();
    assert.equal(doubleInvalidRequestSnapshot.size, 0);
    assert.equal(countSnapshotByFieldValue(doubleInvalidEventSnapshot, 'action', 'notification_sent'), 0);
    assert.equal(countSnapshotByFieldValue(doubleInvalidEventSnapshot, 'action', 'notification_failed'), 2);
    assert.equal(doubleInvalidProfile.get('lastAvailabilityNotificationAt') ?? null, null);
    const doubleInvalidReminderAt = doubleInvalidProfile.get('nextAvailabilityReminderAt') as { toDate?: () => Date } | null;
    assert.equal(doubleInvalidReminderAt?.toDate?.().toISOString(), dueAt.toISOString());
    assert.equal(doubleInvalidDeviceSnapshotA.get('enabled'), false);
    assert.equal(doubleInvalidDeviceSnapshotB.get('enabled'), false);
    assert.notEqual(doubleInvalidDeviceSnapshotA.get('revokedAt') ?? null, null);
    assert.notEqual(doubleInvalidDeviceSnapshotB.get('revokedAt') ?? null, null);

    console.log('SevenO availability reminders smoke test: OK', {
      ownerCandidateUid,
      isolatedCandidateUid,
      noDeviceCandidateUid,
      mixedCandidateUid,
      singleInvalidCandidateUid,
      doubleInvalidCandidateUid,
    });
  } finally {
    await resetAvailabilityData(adminDb);
  }
}

await main();
