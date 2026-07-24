import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  buildSevenoTermsAcceptanceMigrationPlan,
  buildSevenoTermsAcceptancePatch,
  getLegacySevenoTermsAcceptanceFieldPath,
} from '@/lib/seveno-terms-acceptance';
import { hasSevenoTermsAcceptance } from '@/lib/seveno-users';

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

async function seedBaseUser(
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
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
    ...extraData,
  });
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

  try {
    const candidateUid = `candidate-terms-${randomUUID().slice(0, 8)}`;
    const companyUid = `company-terms-${randomUUID().slice(0, 8)}`;
    const migrationUid = `migration-terms-${randomUUID().slice(0, 8)}`;
    const preservedUid = `preserved-terms-${randomUUID().slice(0, 8)}`;

    const candidateAcceptance = {
      cguVersion: '1.0',
      context: 'candidate_account' as const,
      acceptedAt: new Date('2026-07-24T10:01:00.000Z'),
    };
    const companyAcceptance = {
      cguVersion: '1.0',
      context: 'company_first_access' as const,
      acceptedAt: new Date('2026-07-24T10:02:00.000Z'),
    };
    const legacyAcceptance = {
      cguVersion: '1.0',
      context: 'candidate_account' as const,
      acceptedAt: new Date('2026-07-24T10:03:00.000Z'),
    };
    const preservedNestedAcceptance = {
      cguVersion: '1.0',
      context: 'candidate_account' as const,
      acceptedAt: new Date('2026-07-24T10:04:00.000Z'),
    };
    const legacyDifferentAcceptance = {
      cguVersion: '1.0',
      context: 'candidate_account' as const,
      acceptedAt: new Date('2026-07-24T10:05:00.000Z'),
    };

    const candidateContext = rulesTestEnv.authenticatedContext(candidateUid, {
      email: `${candidateUid}@seveno.local`,
      email_verified: true,
      name: 'Candidate CGU',
    });

    await seedBaseUser(adminDb, candidateUid);
    await assertFails(
      candidateContext.firestore().collection('users').doc(candidateUid).update({
        termsAcceptance: {
          candidate_account: candidateAcceptance,
        },
        updatedAt: new Date('2026-07-24T10:01:30.000Z'),
      }),
    );

    await adminDb.collection('users').doc(candidateUid).set(
      buildSevenoTermsAcceptancePatch('candidate_account', candidateAcceptance),
      { merge: true },
    );
    await adminDb.collection('users').doc(candidateUid).set(
      buildSevenoTermsAcceptancePatch('company_first_access', companyAcceptance),
      { merge: true },
    );

    const candidateSnapshot = await adminDb.collection('users').doc(candidateUid).get();
    const candidateData = candidateSnapshot.data() as Record<string, unknown> | undefined;
    assert.equal(candidateSnapshot.get('termsAcceptance.candidate_account.cguVersion'), '1.0');
    assert.equal(candidateSnapshot.get('termsAcceptance.company_first_access.cguVersion'), '1.0');
    assert.equal(candidateSnapshot.get('termsAcceptance.candidate_account.context'), 'candidate_account');
    assert.equal(candidateSnapshot.get('termsAcceptance.company_first_access.context'), 'company_first_access');
    assert.equal(hasSevenoTermsAcceptance(candidateSnapshot.data() as any, 'candidate_account'), true);
    assert.equal(Boolean(candidateData?.['termsAcceptance.candidate_account']), false);

    await seedBaseUser(adminDb, companyUid);
    await adminDb.collection('users').doc(companyUid).set(
      buildSevenoTermsAcceptancePatch('candidate_account', candidateAcceptance),
      { merge: true },
    );
    await adminDb.collection('users').doc(companyUid).set(
      buildSevenoTermsAcceptancePatch('company_first_access', companyAcceptance),
      { merge: true },
    );

    const companySnapshot = await adminDb.collection('users').doc(companyUid).get();
    assert.equal(companySnapshot.get('termsAcceptance.candidate_account.cguVersion'), '1.0');
    assert.equal(companySnapshot.get('termsAcceptance.company_first_access.cguVersion'), '1.0');
    assert.equal(companySnapshot.get('termsAcceptance.candidate_account.context'), 'candidate_account');
    assert.equal(companySnapshot.get('termsAcceptance.company_first_access.context'), 'company_first_access');

    await seedBaseUser(adminDb, migrationUid, {
      termsAcceptance: {
        company_first_access: companyAcceptance,
      },
      'termsAcceptance.candidate_account': legacyAcceptance,
    });

    const migrationRef = adminDb.collection('users').doc(migrationUid);
    const migrationSourceSnapshot = await migrationRef.get();
    const migrationPlan = buildSevenoTermsAcceptanceMigrationPlan(migrationSourceSnapshot.data() as Record<string, unknown>);
    assert.deepEqual(migrationPlan.contexts, ['candidate_account']);
    const migrationNestedAcceptance = migrationPlan.nestedWrite.candidate_account as
      | {
          cguVersion?: unknown;
          context?: unknown;
          acceptedAt?: { toDate?: () => Date };
        }
      | undefined;
    assert.ok(migrationNestedAcceptance);
    assert.equal(migrationNestedAcceptance?.cguVersion, '1.0');
    assert.equal(migrationNestedAcceptance?.context, 'candidate_account');
    if (!migrationNestedAcceptance?.acceptedAt || typeof migrationNestedAcceptance.acceptedAt.toDate !== 'function') {
      throw new Error('Le contexte candidat migre doit conserver un horodatage Firestore.');
    }
    assert.equal(
      migrationNestedAcceptance.acceptedAt.toDate().toISOString(),
      legacyAcceptance.acceptedAt.toISOString(),
    );

    if (Object.keys(migrationPlan.nestedWrite).length > 0) {
      await migrationRef.set({
        termsAcceptance: migrationPlan.nestedWrite,
      }, { merge: true });
    }
    await migrationRef.update(
      getLegacySevenoTermsAcceptanceFieldPath('candidate_account'),
      FieldValue.delete(),
    );

    const migratedSnapshot = await migrationRef.get();
    const migratedData = migratedSnapshot.data() as Record<string, unknown> | undefined;
    assert.equal(migratedSnapshot.get('termsAcceptance.candidate_account.cguVersion'), '1.0');
    assert.equal(migratedSnapshot.get('termsAcceptance.company_first_access.cguVersion'), '1.0');
    assert.equal(migratedSnapshot.get('termsAcceptance.candidate_account.context'), 'candidate_account');
    assert.equal(Boolean(migratedData?.['termsAcceptance.candidate_account']), false);
    assert.equal(Boolean(migratedData?.termsAcceptance && typeof migratedData.termsAcceptance === 'object'), true);

    const migratedPlan = buildSevenoTermsAcceptanceMigrationPlan(migratedData);
    assert.deepEqual(migratedPlan.contexts, []);
    assert.deepEqual(migratedPlan.nestedWrite, {});

    await seedBaseUser(adminDb, preservedUid, {
      termsAcceptance: {
        candidate_account: preservedNestedAcceptance,
      },
      'termsAcceptance.candidate_account': legacyDifferentAcceptance,
    });

    const preservedRef = adminDb.collection('users').doc(preservedUid);
    const preservedSourceSnapshot = await preservedRef.get();
    const preservedPlan = buildSevenoTermsAcceptanceMigrationPlan(preservedSourceSnapshot.data() as Record<string, unknown>);
    assert.deepEqual(preservedPlan.contexts, ['candidate_account']);
    assert.deepEqual(preservedPlan.nestedWrite, {});

    if (Object.keys(preservedPlan.nestedWrite).length > 0) {
      await preservedRef.set({
        termsAcceptance: preservedPlan.nestedWrite,
      }, { merge: true });
    }
    await preservedRef.update(
      getLegacySevenoTermsAcceptanceFieldPath('candidate_account'),
      FieldValue.delete(),
    );

    const preservedSnapshot = await preservedRef.get();
    assert.equal(preservedSnapshot.get('termsAcceptance.candidate_account.cguVersion'), '1.0');
    const preservedAcceptedAt = preservedSnapshot.get('termsAcceptance.candidate_account.acceptedAt') as { toDate?: () => Date } | null;
    if (!preservedAcceptedAt || typeof preservedAcceptedAt.toDate !== 'function') {
      throw new Error('L horodatage du contexte candidat imbrique doit rester present apres migration.');
    }
    assert.equal(preservedAcceptedAt.toDate().toISOString(), preservedNestedAcceptance.acceptedAt.toISOString());

    console.log('SevenO terms acceptance emulator test: OK', {
      candidateUid,
      companyUid,
      migrationUid,
      preservedUid,
      projectId: process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'seveno-emulator',
    });
  } finally {
    await rulesTestEnv.cleanup();
  }
}

await main();
