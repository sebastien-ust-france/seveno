import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';

const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SEVENO_USE_FIREBASE_EMULATORS = 'true';
process.env.SEVENO_EMULATOR_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID = projectId;
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'fake-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'localhost';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = `${projectId}.appspot.com`;
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:123456789:web:test';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`;
process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST = '127.0.0.1';
process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT = '8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

async function requirePort(address: string) {
  const [host, portText] = address.split(':');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host, port: Number(portText) });
    const timer = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Emulator inaccessible on ${address}`));
    }, 1500);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolvePromise();
    });
    socket.once('error', rejectPromise);
  });
}

await requirePort(process.env.FIREBASE_AUTH_EMULATOR_HOST);
await requirePort(process.env.FIRESTORE_EMULATOR_HOST);

const { adminDb } = await import('@/lib/firebase-admin');
const { Timestamp } = await import('firebase-admin/firestore');
if (!adminDb) throw new Error('Firebase Admin Firestore is not configured.');

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
  },
});

type Actor = { uid: string; role: 'candidate' | 'company' | 'admin'; token: string };
const applicationId = 'contact-sharing-integration';
const now = Timestamp.fromDate(new Date('2026-08-05T10:00:00.000Z'));

async function createActor(uid: string, role: Actor['role']): Promise<Actor> {
  const email = `${uid}@seveno.test`;
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'Valid-password-123!', returnSecureToken: true }),
    },
  );
  const payload = await response.json() as { localId?: string; idToken?: string; error?: unknown };
  assert.equal(response.ok, true, JSON.stringify(payload));
  assert.ok(payload.idToken);
  assert.ok(payload.localId);
  await adminDb.collection('users').doc(payload.localId).set({
    uid: payload.localId,
    role,
    authProvider: 'password',
    email,
    displayName: role === 'company' ? `Contact ${uid}` : `Display ${uid}`,
    emailVerified: true,
    onboardingCompleted: true,
    internalVerificationState: 'must-never-leak',
    createdAt: now,
    updatedAt: now,
  });
  return { uid: payload.localId, role, token: payload.idToken };
}

const serverPort = 3210;
const serverBaseUrl = `http://127.0.0.1:${serverPort}`;
let nextServer: ChildProcess | null = null;

async function startNextServer() {
  nextServer = spawn(process.execPath, [resolve(process.cwd(), 'node_modules/next/dist/bin/next'), 'dev', '-p', String(serverPort)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  nextServer.stdout?.on('data', (chunk) => { output += String(chunk); });
  nextServer.stderr?.on('data', (chunk) => { output += String(chunk); });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (nextServer.exitCode !== null) throw new Error(`Next server exited early (${nextServer.exitCode}).\n${output}`);
    try {
      const response = await fetch(serverBaseUrl);
      if (response.status > 0) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Next server did not become ready.\n${output}`);
}

function call(method: 'GET' | 'POST', id: string, token?: string, body: Record<string, unknown> = { action: 'share' }) {
  return fetch(`${serverBaseUrl}/api/seveno/applications/${id}/contact-sharing`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

function assertOnlyContactKeys(payload: unknown) {
  const forbidden = new Set([
    'address', 'postalAddress', 'birthDate', 'dateOfBirth', 'siret', 'verificationStatus',
    'role', 'billing', 'questionnaire', 'score', 'behavior', 'metadata', 'internalVerificationState',
  ]);
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      assert.equal(forbidden.has(key), false, `Forbidden response field: ${key}`);
      visit(nested);
    }
  };
  visit(payload);
}

try {
  await testEnv.clearFirestore();
  await startNextServer();
  const candidate = await createActor('candidate-participant', 'candidate');
  const company = await createActor('company-participant', 'company');
  const otherCandidate = await createActor('candidate-other', 'candidate');
  const otherCompany = await createActor('company-other', 'company');
  const admin = await createActor('admin-other', 'admin');

  await adminDb.collection('candidate_private_data').doc(candidate.uid).set({
    firstName: 'Camille',
    lastName: 'Martin',
    email: 'private-candidate@seveno.test',
    phone: '+33601020304',
    birthDate: '1990-01-01',
    address: 'Adresse interdite',
    questionnaireResults: { score: 99 },
  });
  await adminDb.collection('company_profiles').doc(company.uid).set({
    uid: company.uid,
    companyName: 'Entreprise Test',
    phone: '+33102030405',
    siret: '12345678901234',
    billing: { plan: 'secret' },
    profileStatus: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const baseApplication = {
    candidateUid: candidate.uid,
    companyUid: company.uid,
    offerId: 'contact-sharing-offer',
    companyNameSnapshot: 'Entreprise Snapshot',
    status: 'submitted',
    conversationStatus: null,
    candidateContactSharing: { shared: false, sharedAt: null, sharedByUid: null },
    companyContactSharing: { shared: false, sharedAt: null, sharedByUid: null },
    preservedField: 'must-survive',
    createdAt: now,
    updatedAt: now,
  };
  await adminDb.collection('job_applications').doc(applicationId).set(baseApplication);
  await adminDb.collection('job_offers').doc('contact-sharing-offer').set({ companyUid: company.uid, status: 'published' });

  assert.equal((await call('POST', applicationId)).status, 401);
  assert.equal((await call('POST', applicationId, 'invalid-token')).status, 401);
  assert.equal((await call('GET', applicationId)).status, 401);
  assert.equal((await call('GET', applicationId, 'invalid-token')).status, 401);
  assert.equal((await call('GET', 'missing', candidate.token)).status, 404);
  assert.equal((await call('POST', 'missing', candidate.token)).status, 404);

  for (const actor of [otherCandidate, otherCompany]) {
    assert.equal((await call('GET', applicationId, actor.token)).status, 403);
    assert.equal((await call('POST', applicationId, actor.token)).status, 403);
  }
  assert.equal((await call('GET', applicationId, admin.token)).status, 403);
  assert.equal((await call('POST', applicationId, admin.token)).status, 403);

  assert.equal((await call('GET', applicationId, candidate.token)).status, 409);
  assert.equal((await call('POST', applicationId, candidate.token)).status, 409);
  await adminDb.collection('job_applications').doc(applicationId).update({ status: 'questionnaire_pending', conversationStatus: 'closed' });
  assert.equal((await call('GET', applicationId, candidate.token)).status, 409);
  await adminDb.collection('job_applications').doc(applicationId).update({ status: 'contact_requested', conversationStatus: 'closed' });
  assert.equal((await call('GET', applicationId, candidate.token)).status, 409);
  assert.equal((await call('POST', applicationId, candidate.token)).status, 409);
  await adminDb.collection('job_applications').doc(applicationId).update({ status: 'conversation_open', conversationStatus: 'closed' });
  assert.equal((await call('GET', applicationId, candidate.token)).status, 409, 'Both canonical open markers are required.');
  await adminDb.collection('job_applications').doc(applicationId).update({ status: 'contact_requested', conversationStatus: 'open' });
  assert.equal((await call('GET', applicationId, candidate.token)).status, 409, 'Both canonical open markers are required.');
  await adminDb.collection('job_applications').doc(applicationId).update({ status: 'conversation_open', conversationStatus: 'open' });
  await adminDb.collection('job_offers').doc('contact-sharing-offer').update({ status: 'paused' });
  assert.equal((await call('GET', applicationId, candidate.token)).status, 200);
  await adminDb.collection('job_offers').doc('contact-sharing-offer').update({ status: 'closed' });
  assert.equal((await call('GET', applicationId, candidate.token)).status, 200);

  let response = await call('GET', applicationId, candidate.token);
  assert.equal(response.status, 200);
  let payload = await response.json();
  assert.equal(payload.candidate.contact, null);
  assert.equal(payload.company.contact, null);

  response = await call('POST', applicationId, candidate.token, {
    action: 'share', role: 'company', uid: company.uid, actorType: 'company', target: 'company',
  });
  assert.equal(response.status, 200);
  payload = await response.json();
  assert.equal(payload.candidate.shared, true);
  assert.equal(payload.company.shared, false);
  assert.deepEqual(payload.candidate.contact, {
    displayName: 'Camille Martin', email: 'candidate-participant@seveno.test', phone: '+33601020304',
  });
  assert.equal(payload.company.contact, null);
  assertOnlyContactKeys(payload);

  await adminDb.collection('job_applications').doc(applicationId).update({
    candidateContactSharing: { shared: false, sharedAt: null, sharedByUid: null },
  });
  response = await call('POST', applicationId, company.token, {
    action: 'share', role: 'candidate', uid: candidate.uid, actorType: 'candidate', target: 'candidate',
  });
  assert.equal(response.status, 200);
  payload = await response.json();
  assert.equal(payload.candidate.shared, false);
  assert.equal(payload.company.shared, true);
  assert.equal(payload.candidate.contact, null);
  assert.deepEqual(payload.company.contact, {
    companyName: 'Entreprise Test', contactName: 'Contact company-participant', email: 'company-participant@seveno.test', phone: '+33102030405',
  });
  assertOnlyContactKeys(payload);

  await adminDb.collection('job_applications').doc(applicationId).update({
    candidateContactSharing: { shared: false, sharedAt: null, sharedByUid: null },
    companyContactSharing: { shared: false, sharedAt: null, sharedByUid: null },
  });
  const quotaBefore = (await adminDb.collection('candidate_offer_quotas').get()).size;
  const outboxBefore = (await adminDb.collection('notification_outbox').get()).size;
  const fanoutBefore = (await adminDb.collection('offer_notification_fanouts').get()).size;

  const candidateConcurrent = await Promise.all([
    call('POST', applicationId, candidate.token),
    call('POST', applicationId, candidate.token),
  ]);
  assert.deepEqual(candidateConcurrent.map((item) => item.status), [200, 200]);
  let stored = (await adminDb.collection('job_applications').doc(applicationId).get()).data()!;
  const candidateSharedAt = stored.candidateContactSharing.sharedAt.toMillis();
  assert.equal(stored.candidateContactSharing.shared, true);
  assert.equal(stored.candidateContactSharing.sharedByUid, candidate.uid);
  assert.equal(stored.companyContactSharing.shared, false);
  assert.equal(stored.preservedField, 'must-survive');
  await call('POST', applicationId, candidate.token);
  stored = (await adminDb.collection('job_applications').doc(applicationId).get()).data()!;
  assert.equal(stored.candidateContactSharing.sharedAt.toMillis(), candidateSharedAt);

  const companyConcurrent = await Promise.all([
    call('POST', applicationId, company.token),
    call('POST', applicationId, company.token),
  ]);
  assert.deepEqual(companyConcurrent.map((item) => item.status), [200, 200]);
  stored = (await adminDb.collection('job_applications').doc(applicationId).get()).data()!;
  const companySharedAt = stored.companyContactSharing.sharedAt.toMillis();
  assert.equal(stored.companyContactSharing.shared, true);
  assert.equal(stored.companyContactSharing.sharedByUid, company.uid);
  assert.equal(stored.candidateContactSharing.sharedAt.toMillis(), candidateSharedAt);
  assert.equal(stored.preservedField, 'must-survive');
  await call('POST', applicationId, company.token);
  stored = (await adminDb.collection('job_applications').doc(applicationId).get()).data()!;
  assert.equal(stored.companyContactSharing.sharedAt.toMillis(), companySharedAt);

  response = await call('GET', applicationId, candidate.token);
  payload = await response.json();
  assert.ok(payload.candidate.contact);
  assert.ok(payload.company.contact);
  assertOnlyContactKeys(payload);
  assert.equal((await adminDb.collection('candidate_offer_quotas').get()).size, quotaBefore);
  assert.equal((await adminDb.collection('notification_outbox').get()).size, outboxBefore);
  assert.equal((await adminDb.collection('offer_notification_fanouts').get()).size, fanoutBefore);

  const directClient = testEnv.authenticatedContext(candidate.uid, { role: 'candidate' }).firestore();
  await assertFails(directClient.collection('candidate_private_data').doc(candidate.uid).get());
  await assertFails(directClient.collection('job_applications').doc(applicationId).get());
  await assertFails(directClient.collection('job_applications').doc(applicationId).update({
    candidateContactSharing: { shared: false },
  }));
  await assertFails(directClient.collection('job_applications').doc(applicationId).update({
    companyContactSharing: { shared: false },
  }));

  console.log(JSON.stringify({
    result: 'Contact sharing authenticated emulator tests: OK',
    candidateSharedAtBeforeRepeat: candidateSharedAt,
    candidateSharedAtAfterRepeat: stored.candidateContactSharing.sharedAt.toMillis(),
    companySharedAtBeforeRepeat: companySharedAt,
    companySharedAtAfterRepeat: stored.companyContactSharing.sharedAt.toMillis(),
  }));
} finally {
  nextServer?.kill();
  await testEnv.cleanup();
}
