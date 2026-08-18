import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { assertSevenoClientFirebaseEmulatorConfiguration, getSevenoFirebaseClientEmulatorProjectId, getSevenoClientFirestoreEmulatorConfig, isSevenoFirebaseEmulatorModeEnabled } from '@/lib/firebase-emulators';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: isSevenoFirebaseEmulatorModeEnabled()
    ? getSevenoFirebaseClientEmulatorProjectId()
    : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

if (isSevenoFirebaseEmulatorModeEnabled()) {
  assertSevenoClientFirebaseEmulatorConfiguration();
}

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => value.trim().length > 0);

const app = hasFirebaseConfig
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseApp = app;
export const db = app ? getFirestore(app) : null;
export const isFirebaseConfigured = Boolean(db);

type EmulatorConnectionState = {
  firestoreConnected?: boolean;
};

const globalForFirebase = globalThis as typeof globalThis & {
  __sevenoFirebaseClientEmulatorState?: EmulatorConnectionState;
};

const firebaseEmulatorState = globalForFirebase.__sevenoFirebaseClientEmulatorState ?? {};
globalForFirebase.__sevenoFirebaseClientEmulatorState = firebaseEmulatorState;

if (db && isSevenoFirebaseEmulatorModeEnabled() && !firebaseEmulatorState.firestoreConnected) {
  const { host, port } = getSevenoClientFirestoreEmulatorConfig();
  connectFirestoreEmulator(db, host, port);
  firebaseEmulatorState.firestoreConnected = true;
}
