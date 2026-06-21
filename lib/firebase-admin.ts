import 'server-only';

import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getPrivateKey() {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    return '';
  }

  return privateKey.replace(/\\n/g, '\n');
}

function hasAdminCredentials() {
  return Boolean(
    (process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}

export const isFirebaseAdminConfigured = hasAdminCredentials();

function getAdminApp() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '';
  const privateKey = getPrivateKey();

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export const adminDb = isFirebaseAdminConfigured
  ? getFirestore(getAdminApp())
  : null;
