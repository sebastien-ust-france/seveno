'use client';

import type { User } from 'firebase/auth';
import { deleteField, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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


export async function getSevenoUser(uid: string): Promise<SevenoUser | null> {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const snapshot = await getDoc(userRef(uid));
  return snapshot.exists() ? (snapshot.data() as SevenoUser) : null;
}


export async function ensureSevenoUser(
  authUser: User,
  initialRole: PublicUserRole | null = null,
): Promise<SevenoUser> {
  try {
    await fetchSevenoMatchApi(authUser, '/api/seveno/users/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        initialRole,
      }),
    });
  } catch (error) {
    throw new Error(describeFirestoreError('Synchronisation du document utilisateur', error));
  }

  const refreshed = await getSevenoUser(authUser.uid);
  if (!refreshed) {
    throw new Error("Le document users n a pas pu etre lu apres synchronisation.");
  }

  return refreshed;
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
