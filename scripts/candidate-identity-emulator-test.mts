import assert from 'node:assert/strict';
import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { validateCandidateIdentity } from '@/lib/seveno-candidate-identity';

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

function readTextFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

async function seedCandidateUser(
  adminDb: any,
  uid: string,
  extraData: Record<string, unknown> = {},
) {
  const now = new Date('2026-07-24T10:00:00.000Z');
  await adminDb.collection('users').doc(uid).set({
    uid,
    role: 'candidate',
    authProvider: 'password',
    email: `${uid}@seveno.local`,
    emailVerified: true,
    firstName: 'Alice',
    lastName: 'Durand',
    phone: '+33612345678',
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
    ...extraData,
  });
}

async function seedCandidateProfile(adminDb: any, uid: string, profileStatus: 'draft' | 'active' | null) {
  const ref = adminDb.collection('candidate_profiles').doc(uid);
  if (!profileStatus) {
    await ref.delete();
    return;
  }

  const now = new Date('2026-07-24T10:00:00.000Z');
  await ref.set({
    uid,
    role: 'candidate',
    profileStatus,
    publicCandidateId: `SEV-CAND-${randomUUID().slice(0, 6).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
  });
}

async function assertCandidateIdentityUpdateSucceeds(
  candidateContext: any,
  adminDb: any,
  uid: string,
  patch: Record<string, unknown>,
) {
  await assertSucceeds(
    candidateContext.firestore().collection('users').doc(uid).update({
      ...patch,
      updatedAt: new Date('2026-07-24T10:10:00.000Z'),
    }),
  );

  const snapshot = await adminDb.collection('users').doc(uid).get();
  const data = snapshot.data() as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    assert.deepEqual(data[key], value, `La mise à jour du champ ${key} doit etre conservee.`);
  }
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  await assertEmulatorAvailable();

  const frenchNational = validateCandidateIdentity({
    firstName: 'Alice',
    lastName: 'Durand',
    phone: '06 12 34 56 78',
    addressLine1: '',
    addressLine2: '',
    postalCode: '75001',
    city: 'Paris',
    country: 'France',
  });
  assert.equal(frenchNational.errors.phone, undefined);
  assert.equal(frenchNational.data?.phone, '+33612345678');
  assert.equal(frenchNational.data?.country, 'France');

  const frenchInternational = validateCandidateIdentity({
    firstName: 'Alice',
    lastName: 'Durand',
    phone: '+33 6 12 34 56 78',
    addressLine1: '',
    addressLine2: '',
    postalCode: '75001',
    city: 'Paris',
    country: 'France',
  });
  assert.equal(frenchInternational.errors.phone, undefined);
  assert.equal(frenchInternational.data?.phone, '+33612345678');

  const belgianNational = validateCandidateIdentity({
    firstName: 'Alice',
    lastName: 'Durand',
    phone: '0470 12 34 56',
    addressLine1: '',
    addressLine2: '',
    postalCode: '1000',
    city: 'Bruxelles',
    country: 'Belgique',
  });
  assert.equal(belgianNational.errors.phone, undefined);
  assert.equal(belgianNational.data?.phone, '+32470123456');
  assert.equal(belgianNational.data?.country, 'Belgique');

  const belgianInternational = validateCandidateIdentity({
    firstName: 'Alice',
    lastName: 'Durand',
    phone: '+32 470 12 34 56',
    addressLine1: '',
    addressLine2: '',
    postalCode: '1000',
    city: 'Bruxelles',
    country: 'BE',
  });
  assert.equal(belgianInternational.errors.phone, undefined);
  assert.equal(belgianInternational.data?.phone, '+32470123456');
  assert.equal(belgianInternational.data?.country, 'Belgique');

  const belgianInvalid = validateCandidateIdentity({
    firstName: 'Alice',
    lastName: 'Durand',
    phone: '12345',
    addressLine1: '',
    addressLine2: '',
    postalCode: '1000',
    city: 'Bruxelles',
    country: 'Belgique',
  });
  assert.equal(belgianInvalid.data, null);
  assert.equal(
    belgianInvalid.errors.phone,
    'Le numéro de téléphone n’est pas valide pour le pays sélectionné.',
  );

  const { adminDb } = await import('@/lib/firebase-admin');
  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const rulesTestEnv = await initializeTestEnvironment({
    projectId: process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readTextFile('firestore.rules'),
    },
  });

  try {
    const draftFranceUid = `candidate-identity-draft-fr-${randomUUID().slice(0, 8)}`;
    const draftBelgiumUid = `candidate-identity-draft-be-${randomUUID().slice(0, 8)}`;
    const activeFranceUid = `candidate-identity-active-fr-${randomUUID().slice(0, 8)}`;
    const activeBelgiumUid = `candidate-identity-active-be-${randomUUID().slice(0, 8)}`;

    await seedCandidateUser(adminDb, draftFranceUid);
    await seedCandidateProfile(adminDb, draftFranceUid, null);
    await seedCandidateUser(adminDb, draftBelgiumUid, {
      phone: '+32470123456',
      postalCode: '1000',
      city: 'Bruxelles',
      country: 'Belgique',
    });
    await seedCandidateProfile(adminDb, draftBelgiumUid, null);
    await seedCandidateUser(adminDb, activeFranceUid);
    await seedCandidateProfile(adminDb, activeFranceUid, 'active');
    await seedCandidateUser(adminDb, activeBelgiumUid, {
      phone: '+32470123456',
      postalCode: '1000',
      city: 'Bruxelles',
      country: 'Belgique',
    });
    await seedCandidateProfile(adminDb, activeBelgiumUid, 'active');

    const draftFranceContext = rulesTestEnv.authenticatedContext(draftFranceUid, {
      email: `${draftFranceUid}@seveno.local`,
      email_verified: true,
      name: 'Alice Durand',
    });
    const draftBelgiumContext = rulesTestEnv.authenticatedContext(draftBelgiumUid, {
      email: `${draftBelgiumUid}@seveno.local`,
      email_verified: true,
      name: 'Alice Durand',
    });
    const activeFranceContext = rulesTestEnv.authenticatedContext(activeFranceUid, {
      email: `${activeFranceUid}@seveno.local`,
      email_verified: true,
      name: 'Alice Durand',
    });
    const activeBelgiumContext = rulesTestEnv.authenticatedContext(activeBelgiumUid, {
      email: `${activeBelgiumUid}@seveno.local`,
      email_verified: true,
      name: 'Alice Durand',
    });

    await assertCandidateIdentityUpdateSucceeds(
      draftFranceContext,
      adminDb,
      draftFranceUid,
      {
        firstName: 'Alice',
        lastName: 'Durand',
        phone: '+33612345679',
        addressLine1: '2 rue du Test',
        postalCode: '75002',
        city: 'Lyon',
        country: 'France',
      },
    );

    await assertCandidateIdentityUpdateSucceeds(
      draftBelgiumContext,
      adminDb,
      draftBelgiumUid,
      {
        firstName: 'Alice',
        lastName: 'Durand',
        phone: '+32470123457',
        addressLine1: 'Rue du Test 2',
        postalCode: '1000',
        city: 'Bruxelles',
        country: 'Belgique',
      },
    );

    await assertCandidateIdentityUpdateSucceeds(
      activeFranceContext,
      adminDb,
      activeFranceUid,
      {
        firstName: 'Alice',
        lastName: 'Durand',
        phone: '+33612345679',
        addressLine1: '2 rue du Test',
        postalCode: '75002',
        city: 'Lyon',
        country: 'France',
      },
    );

    await assertCandidateIdentityUpdateSucceeds(
      activeBelgiumContext,
      adminDb,
      activeBelgiumUid,
      {
        firstName: 'Alice',
        lastName: 'Durand',
        phone: '+32470123457',
        addressLine1: 'Rue du Test 2',
        postalCode: '1000',
        city: 'Bruxelles',
        country: 'Belgique',
      },
    );

    await assertFails(
      activeBelgiumContext.firestore().collection('users').doc(activeBelgiumUid).update({
        role: 'admin',
        updatedAt: new Date('2026-07-24T10:11:00.000Z'),
      }),
    );

    await assertFails(
      activeBelgiumContext.firestore().collection('users').doc(activeBelgiumUid).update({
        termsAcceptance: {
          candidate_account: {
            cguVersion: '1.0',
            acceptedAt: new Date('2026-07-24T10:11:00.000Z'),
            context: 'candidate_account',
          },
        },
        updatedAt: new Date('2026-07-24T10:11:00.000Z'),
      }),
    );

    console.log('Candidate identity emulator test: OK', {
      projectId: process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local',
      draftFranceUid,
      draftBelgiumUid,
      activeFranceUid,
      activeBelgiumUid,
    });
  } finally {
    await rulesTestEnv.cleanup();
  }
}

void main();
