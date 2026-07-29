'use client';

import {
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { getSevenoClientAuthEmulatorUrl, isSevenoFirebaseEmulatorModeEnabled } from '@/lib/firebase-emulators';

let authInstance: Auth | null = null;

type EmulatorConnectionState = {
  authConnected?: boolean;
};

const globalForAuth = globalThis as typeof globalThis & {
  __sevenoFirebaseClientEmulatorState?: EmulatorConnectionState;
};

const authEmulatorState = globalForAuth.__sevenoFirebaseClientEmulatorState ?? {};
globalForAuth.__sevenoFirebaseClientEmulatorState = authEmulatorState;

function getFirebaseAuth() {
  if (!firebaseApp) {
    throw new Error('Firebase Authentication n est pas configure.');
  }

  if (!authInstance) {
    authInstance = getAuth(firebaseApp);
  }

  if (isSevenoFirebaseEmulatorModeEnabled() && !authEmulatorState.authConnected) {
    connectAuthEmulator(authInstance, getSevenoClientAuthEmulatorUrl(), { disableWarnings: true });
    authEmulatorState.authConnected = true;
  }

  return authInstance;
}

export function getAuthInstance() {
  return getFirebaseAuth();
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);

  return result.user;
}

export async function createEmailPasswordUser(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  await result.user.getIdToken();
  return result.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  await result.user.getIdToken();
  return result.user;
}

export async function getEmailSignInMethods(email: string): Promise<string[]> {
  return fetchSignInMethodsForEmail(getFirebaseAuth(), email);
}

export async function sendVerificationEmail(authUser: User): Promise<void> {
  await sendEmailVerification(authUser);
}

export async function refreshAuthUser(authUser: User): Promise<User> {
  await reload(authUser);
  await authUser.getIdToken(true);
  return authUser;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function deleteAuthUser(authUser: User): Promise<void> {
  await deleteUser(authUser);
}

export function isPasswordAuthUser(authUser: User): boolean {
  return authUser.providerData.some((provider) => provider.providerId === 'password');
}

export async function signOutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export async function getCurrentAuthUser(): Promise<User | null> {
  const auth = getFirebaseAuth();

  await auth.authStateReady();

  if (auth.currentUser) {
    await auth.currentUser.getIdToken();
    return auth.currentUser;
  }

  return null;
}
