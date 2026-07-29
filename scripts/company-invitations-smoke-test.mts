import assert from 'node:assert/strict';
import net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { SevenoAdminSession } from '@/lib/seveno-admin-auth';

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
  process.env.NEXT_PUBLIC_SEVENO_USE_FIREBASE_EMULATORS = 'true';
  process.env.SEVENO_EMULATOR_APP_ORIGIN = process.env.SEVENO_EMULATOR_APP_ORIGIN ?? 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID = process.env.NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID ?? projectId;
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

function createAdminSession(): SevenoAdminSession {
  const now = new Date().toISOString();
  return {
    token: 'admin-invitation-smoke-token',
    decodedToken: { uid: 'admin-invitation-smoke-uid' } as SevenoAdminSession['decodedToken'],
    user: {
      uid: 'admin-invitation-smoke-uid',
      role: 'admin',
      authProvider: 'google',
      email: 'admin@seveno.local',
      displayName: 'SevenO Admin',
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    },
  } as SevenoAdminSession;
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  await assertEmulatorAvailable();

  const {
    COMPANY_INVITATIONS_COLLECTION,
    acceptCompanyInvitationForAuth,
    claimCompanyInvitationToken,
    createCompanyInvitation,
    getCompanyInvitationAppOrigin,
    listCompanyInvitations,
    normalizeCompanyInvitationEmail,
    isCompanyInvitationEmailValid,
    revokeCompanyInvitation,
  } = await import('@/lib/seveno-company-invitations');

  assert.equal(normalizeCompanyInvitationEmail('  RH@Example.com '), 'rh@example.com');
  assert.equal(isCompanyInvitationEmailValid('rh@example.com'), true);

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
    const adminSession = createAdminSession();
    const invitationEmail = `rh-${randomUUID().slice(0, 8)}@example.com`;
    assert.equal(getCompanyInvitationAppOrigin(), 'http://localhost:3000');

    const created = await createCompanyInvitation(adminSession, invitationEmail);
    assert.equal(created.status, 'pending');
    assert.match(created.invitationUrl, /^http:\/\/localhost:3000\/invitation-entreprise\//);

    const listPayload = await listCompanyInvitations(adminSession);
    assert.equal(listPayload.invitations.some((invitation) => invitation.invitationId === created.invitationId), true);

    const invitationSnapshot = await adminDb.collection(COMPANY_INVITATIONS_COLLECTION).doc(created.invitationId).get();
    assert.equal(invitationSnapshot.exists, true);
    assert.equal(typeof invitationSnapshot.get('tokenHash'), 'string');
    assert.equal(Boolean(invitationSnapshot.get('token')), false);

    const publicClaim = await claimCompanyInvitationToken(created.invitationUrl.split('/').pop() ?? '');
    assert.equal(publicClaim.invitationId, created.invitationId);
    assert.equal(publicClaim.emailNormalized, invitationEmail);
    assert.equal(publicClaim.status, 'pending');

    const companyUid = `company-invite-user-${randomUUID().slice(0, 8)}`;
    const candidateContext = rulesTestEnv.authenticatedContext(`candidate-${randomUUID().slice(0, 8)}`, {
      email: invitationEmail,
      email_verified: true,
    });
    await assertFails(candidateContext.firestore().collection(COMPANY_INVITATIONS_COLLECTION).doc(created.invitationId).get());
    await assertFails(candidateContext.firestore().collection(COMPANY_INVITATIONS_COLLECTION).doc(created.invitationId).set({ foo: 'bar' }));

    const accepted = await acceptCompanyInvitationForAuth(
      {
        uid: companyUid,
        email: invitationEmail,
        emailVerified: true,
        authProvider: 'password',
      },
      created.invitationUrl.split('/').pop() ?? '',
    );
    assert.equal(accepted.userRole, 'company');
    assert.equal(accepted.onboardingCompleted, false);

    const acceptedUserSnapshot = await adminDb.collection('users').doc(companyUid).get();
    assert.equal(acceptedUserSnapshot.exists, true);
    assert.equal(acceptedUserSnapshot.get('role'), 'company');
    assert.equal(acceptedUserSnapshot.get('onboardingCompleted'), false);

    const revokedInvitation = await createCompanyInvitation(adminSession, `revoked-${randomUUID().slice(0, 8)}@example.com`);
    const revoked = await revokeCompanyInvitation(adminSession, revokedInvitation.invitationId);
    assert.equal(revoked.status, 'revoked');

    console.log('Company invitations smoke test: OK', {
      projectId: process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local',
      invitationId: created.invitationId,
      revokedInvitationId: revokedInvitation.invitationId,
    });
  } finally {
    await rulesTestEnv.cleanup();
  }
}

void main();
