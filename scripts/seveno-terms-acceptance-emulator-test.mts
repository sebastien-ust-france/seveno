import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';

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
  const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'seveno-emulator';
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

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  await assertEmulatorAvailable();

  assert.ok(
    readTextFile('components/legal/CguAcceptancePanel.tsx').includes('acceptSevenoTerms'),
    'Le composant CGU doit conserver le flux d acceptation.',
  );
  assert.ok(
    !readTextFile('components/legal/CguAcceptancePanel.tsx').includes('const refreshed = await ensureSevenoUser(authUser);'),
    'Le composant CGU ne doit plus effectuer de refresh client apres le POST.',
  );

  const { adminDb } = await import('@/lib/firebase-admin');

  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const rulesTestEnv = await initializeTestEnvironment({
    projectId: process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'seveno-emulator',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readTextFile('firestore.rules'),
    },
  });

  const uid = `candidate-terms-${randomUUID().slice(0, 8)}`;
  const email = `${uid}@seveno.local`;
  const now = new Date();
  const acceptance = {
    cguVersion: '1.0',
    context: 'candidate_account' as const,
    acceptedAt: now,
  };

  try {
    await adminDb.collection('users').doc(uid).set({
      uid,
      role: 'candidate',
      authProvider: 'password',
      email,
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    });

    const candidate = rulesTestEnv.authenticatedContext(uid, {
      email,
      email_verified: true,
      name: 'Candidate CGU',
    });

    await assertFails(
      candidate.firestore().collection('users').doc(uid).update({
        termsAcceptance: {
          candidate_account: acceptance,
        },
        updatedAt: now,
      }),
    );

    await adminDb.collection('users').doc(uid).set({
      termsAcceptance: {
        candidate_account: acceptance,
      },
      updatedAt: now,
    }, { merge: true });

    const serverSnapshot = await candidate.firestore().collection('users').doc(uid).get();
    assert.equal(serverSnapshot.exists, true);
    assert.equal(serverSnapshot.get('termsAcceptance.candidate_account.cguVersion'), '1.0');
    assert.equal(serverSnapshot.get('termsAcceptance.candidate_account.context'), 'candidate_account');
    assert.ok(serverSnapshot.get('termsAcceptance.candidate_account.acceptedAt'));

    console.log('SevenO terms acceptance emulator test: OK', {
      uid,
      projectId: process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'seveno-emulator',
    });
  } finally {
    await rulesTestEnv.cleanup();
  }
}

await main();
