'use client';

import type { User } from 'firebase/auth';
import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import { validateCandidateIdentity } from '@/lib/seveno-candidate-identity';
import type {
  CandidatePrivateIdentityInput,
  PublicUserRole,
  TermsAcceptance,
  TermsAcceptanceContext,
  SevenoUser,
  UserRoleOrNull,
} from '@/types/seveno';

const USERS_COLLECTION = 'users';
export const COMPANY_INVITE_ONLY_MESSAGE = "L'accès entreprise est actuellement ouvert sur invitation.";

export interface SevenoTermsAcceptanceResponse {
  acceptance: TermsAcceptance;
}

function requireFirestoreClient() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore n’est pas configuré.');
  }

  return db;
}

function describeFirestoreError(operation: string, error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code ?? 'unknown');
    const message = error instanceof Error ? error.message : '';
    return `${operation} a echoue (${code})${message ? `: ${message}` : ''}`;
  }

  return error instanceof Error ? `${operation} a echoue: ${error.message}` : `${operation} a echoue.`;
}

function userRef(uid: string) {
  return doc(requireFirestoreClient(), USERS_COLLECTION, uid);
}

function cleanOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getSevenoTermsAcceptance(
  user: SevenoUser | null,
  context: TermsAcceptanceContext,
): TermsAcceptance | null {
  return user?.termsAcceptance?.[context] ?? null;
}

export function hasSevenoTermsAcceptance(
  user: SevenoUser | null,
  context: TermsAcceptanceContext,
): boolean {
  return Boolean(getSevenoTermsAcceptance(user, context));
}

export function canAssignPublicRole(existingRole: UserRoleOrNull, requestedRole: PublicUserRole) {
  if (requestedRole !== 'company') {
    return true;
  }

  return existingRole === 'company';
}

function resolveAuthProvider(authUser: User) {
  if (authUser.providerData.some((provider) => provider.providerId === 'google.com')) {
    return 'google' as const;
  }

  if (authUser.providerData.some((provider) => provider.providerId === 'password')) {
    return 'password' as const;
  }

    throw new Error('Le fournisseur de connexion Firebase n’est pas pris en charge.');
}

function buildSevenoUserPayload(authUser: User, existing?: Partial<SevenoUser>) {
  const email = cleanOptionalText(authUser.email) ?? cleanOptionalText(existing?.email);
  if (!email) {
    throw new Error('Impossible de créer le document utilisateur sans adresse email.');
  }

  return {
    uid: authUser.uid,
    role: existing?.role ?? null,
    authProvider: existing?.authProvider ?? resolveAuthProvider(authUser),
    email,
    emailVerified: authUser.emailVerified,
    ...(cleanOptionalText(authUser.displayName) ? { displayName: cleanOptionalText(authUser.displayName) } : {}),
    ...(cleanOptionalText(authUser.photoURL) ? { photoURL: cleanOptionalText(authUser.photoURL) } : {}),
    onboardingCompleted: existing?.onboardingCompleted ?? false,
    createdAt: existing?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function getSevenoUser(uid: string): Promise<SevenoUser | null> {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const snapshot = await getDoc(userRef(uid));
  return snapshot.exists() ? (snapshot.data() as SevenoUser) : null;
}

async function createSevenoUser(authUser: User, initialRole: PublicUserRole | null): Promise<SevenoUser> {
  const firestore = requireFirestoreClient();
  const ref = doc(firestore, USERS_COLLECTION, authUser.uid);
  let existing;

  try {
    existing = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture du document utilisateur', error));
  }

  if (existing.exists()) {
    return existing.data() as SevenoUser;
  }

  const email = cleanOptionalText(authUser.email);
  if (!email) {
    throw new Error('Impossible de créer le document utilisateur sans adresse email.');
  }

  if (initialRole === 'company') {
    throw new Error(COMPANY_INVITE_ONLY_MESSAGE);
  }

  try {
    await setDoc(ref, {
      uid: authUser.uid,
      role: initialRole,
      authProvider: resolveAuthProvider(authUser),
      email,
      emailVerified: authUser.emailVerified,
      ...(cleanOptionalText(authUser.displayName) ? { displayName: cleanOptionalText(authUser.displayName) } : {}),
      ...(cleanOptionalText(authUser.photoURL) ? { photoURL: cleanOptionalText(authUser.photoURL) } : {}),
      onboardingCompleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(describeFirestoreError('Creation du document utilisateur', error));
  }

  let created;

  try {
    created = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture apres creation du document utilisateur', error));
  }

  if (!created.exists()) {
    throw new Error("Le document users n a pas pu etre cree.");
  }

  return created.data() as SevenoUser;
}

export async function createSevenoUserFromGoogle(authUser: User): Promise<SevenoUser> {
  return createSevenoUser(authUser, null);
}

export async function ensureSevenoUser(
  authUser: User,
  initialRole: PublicUserRole | null = null,
): Promise<SevenoUser> {
  const firestore = requireFirestoreClient();
  const ref = doc(firestore, USERS_COLLECTION, authUser.uid);
  let snapshot;

  try {
    snapshot = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture du document utilisateur', error));
  }

  if (!snapshot.exists()) {
    return createSevenoUser(authUser, initialRole);
  }

  const existing = snapshot.data() as SevenoUser;
  if (existing.role === 'admin') {
    return existing;
  }

  const patch = buildSevenoUserPayload(authUser, existing);
  const updatePayload: Record<string, unknown> = {
    email: patch.email,
    emailVerified: authUser.emailVerified,
    updatedAt: serverTimestamp(),
  };

  const displayName = patch.displayName ?? existing.displayName;
  if (displayName) {
    updatePayload.displayName = displayName;
  }

  const photoURL = patch.photoURL ?? existing.photoURL;
  if (photoURL) {
    updatePayload.photoURL = photoURL;
  }

  try {
    await updateDoc(ref, {
      ...updatePayload,
    });
  } catch (error) {
    throw new Error(describeFirestoreError('Mise à jour du document utilisateur', error));
  }

  let updated;

  try {
    updated = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture apres mise a jour du document utilisateur', error));
  }

  if (!updated.exists()) {
    throw new Error("Le document users n a pas pu etre lu apres mise a jour.");
  }

  return updated.data() as SevenoUser;
}

export async function updateSevenoUserRole(uid: string, role: PublicUserRole): Promise<SevenoUser> {
  const ref = userRef(uid);

  let snapshot;
  try {
    snapshot = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture du document utilisateur', error));
  }

  if (!snapshot.exists()) {
    throw new Error("Le document users n a pas pu etre lu avant mise a jour du role.");
  }

  const existing = snapshot.data() as SevenoUser;
  if (!canAssignPublicRole(existing.role, role)) {
    throw new Error(COMPANY_INVITE_ONLY_MESSAGE);
  }

  try {
    await updateDoc(ref, {
      role,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(describeFirestoreError('Mise à jour du rôle utilisateur', error));
  }

  let updated;

  try {
    updated = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture apres mise a jour du role utilisateur', error));
  }

  if (!updated.exists()) {
    throw new Error("Le document users n a pas pu etre lu apres mise a jour du role.");
  }

  return updated.data() as SevenoUser;
}

export async function markUserOnboardingCompleted(uid: string): Promise<SevenoUser> {
  const ref = userRef(uid);
  try {
    await updateDoc(ref, {
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(describeFirestoreError('Validation de l onboarding utilisateur', error));
  }

  let updated;

  try {
    updated = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture apres validation de l onboarding utilisateur', error));
  }

  if (!updated.exists()) {
    throw new Error("Le document users n a pas pu etre lu apres completion de l onboarding.");
  }

  return updated.data() as SevenoUser;
}

export async function updateCandidatePrivateIdentity(
  uid: string,
  input: CandidatePrivateIdentityInput,
): Promise<SevenoUser> {
  const validation = validateCandidateIdentity({
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    addressLine1: input.addressLine1 ?? '',
    addressLine2: input.addressLine2 ?? '',
    postalCode: input.postalCode ?? '',
    city: input.city ?? '',
    country: input.country,
  });
  if (!validation.data) {
    throw new Error('Les informations d identité privée sont invalides.');
  }

  const ref = userRef(uid);
  const data = validation.data;
  try {
    await updateDoc(ref, {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      addressLine1: data.addressLine1 ?? deleteField(),
      addressLine2: data.addressLine2 ?? deleteField(),
      postalCode: data.postalCode ?? deleteField(),
      city: data.city ?? deleteField(),
      country: data.country,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(describeFirestoreError('Mise à jour de l’identité privée', error));
  }

  const updated = await getDoc(ref);
  if (!updated.exists()) {
    throw new Error('Le document utilisateur est introuvable après la mise à jour.');
  }

  return updated.data() as SevenoUser;
}

export async function acceptSevenoTerms(authUser: User): Promise<SevenoTermsAcceptanceResponse> {
  return fetchSevenoMatchApi<SevenoTermsAcceptanceResponse>(authUser, '/api/seveno/terms/acceptance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function resolveSevenoRedirect(user: SevenoUser | null) {
  if (!user) {
    return '/connexion';
  }

  if (user.role === null) {
    return '/onboarding';
  }

  if (user.role === 'candidate') {
    if (user.onboardingCompleted && !hasSevenoTermsAcceptance(user, 'candidate_account')) {
      return '/cgu';
    }

    return user.onboardingCompleted ? '/candidat' : '/candidat/onboarding';
  }

  if (user.role === 'company') {
    if (user.onboardingCompleted && !hasSevenoTermsAcceptance(user, 'company_first_access')) {
      return '/cgu';
    }

    return user.onboardingCompleted ? '/entreprise' : '/entreprise/onboarding';
  }

  return '/admin';
}
