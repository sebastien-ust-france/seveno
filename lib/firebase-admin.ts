import 'server-only';

import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { assertSevenoServerFirebaseEmulatorConfiguration, getSevenoFirebaseServerEmulatorProjectId, isSevenoFirebaseEmulatorModeEnabled } from '@/lib/firebase-emulators';
import { resolveFirebaseAdminInitialization } from '@/lib/firebase-admin-config';

function getPrivateKey() {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    return '';
  }

  return privateKey.replace(/\\n/g, '\n');
}

assertSevenoServerFirebaseEmulatorConfiguration();

let adminDbInitError: unknown = null;

function getAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const initialization = resolveFirebaseAdminInitialization();
  const projectId = isSevenoFirebaseEmulatorModeEnabled()
    ? getSevenoFirebaseServerEmulatorProjectId()
    : initialization.projectId;
  if (initialization.mode === 'emulator') {
    return initializeApp({
      ...(projectId ? { projectId } : {}),
    });
  }

  if (initialization.mode === 'application_default') {
    return initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '',
      privateKey: getPrivateKey(),
    }),
  });
}

const adminApp: App | null = (() => {
  try {
    return getAdminApp();
  } catch (error) {
    adminDbInitError = error;
    return null;
  }
})();

export function getFirebaseAdminDebugStatus() {
  return {
    configured: Boolean(adminApp),
    getAppsLength: getApps().length,
    hasProjectId: Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    hasClientEmail: Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL),
    hasPrivateKey: Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    initError: adminDbInitError ? true : false,
  };
}

export function getFirebaseAdminInitError() {
  return adminDbInitError;
}

export const adminDb = (() => {
  if (!adminApp) {
    return null;
  }

  try {
    return getFirestore(adminApp);
  } catch (error) {
    adminDbInitError = error;
    return null;
  }
})();

export const adminAuth = (() => {
  if (!adminApp) {
    return null;
  }

  try {
    return getAuth(adminApp);
  } catch (error) {
    adminDbInitError = error;
    return null;
  }
})();

export const isFirebaseAdminConfigured = Boolean(adminApp && adminDb && adminAuth);
