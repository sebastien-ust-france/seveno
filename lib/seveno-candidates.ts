'use client';

import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import { normalizeDesiredContractTypeCodes } from '@/lib/seveno-desired-contract-types';
import type {
  CandidateIdentityRequiredField,
  CandidateProfile,
  CandidateProfileUpsertData,
} from '@/types/seveno';

const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';

function requireFirestoreClient() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore n est pas configure.');
  }

  return db;
}

function candidateProfileRef(uid: string) {
  return doc(requireFirestoreClient(), CANDIDATE_PROFILES_COLLECTION, uid);
}

export async function getCandidateProfile(uid: string): Promise<CandidateProfile | null> {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const snapshot = await getDoc(candidateProfileRef(uid));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as CandidateProfile & { desiredContractTypeCodes?: unknown };
  return {
    ...data,
    desiredContractTypeCodes: normalizeDesiredContractTypeCodes(data.desiredContractTypeCodes),
    matchingOfferAlertsEnabled: data.matchingOfferAlertsEnabled === true,
  };
}

export async function hasCandidateProfile(uid: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) {
    return false;
  }

  const snapshot = await getDoc(candidateProfileRef(uid));
  return snapshot.exists();
}

export async function createOrUpdateCandidateProfile(
  authUser: User,
  data: CandidateProfileUpsertData,
): Promise<{
  profile: CandidateProfile;
  jobChanged: boolean;
  verificationReset: boolean;
  activationDowngraded: boolean;
  identityMissingFields: CandidateIdentityRequiredField[];
}> {
  const result = await fetchSevenoMatchApi<{
    jobChanged: boolean;
    verificationReset: boolean;
    activationDowngraded: boolean;
    identityMissingFields: CandidateIdentityRequiredField[];
  }>(
    authUser,
    '/api/seveno/candidates/profile',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );

  const updated = await getCandidateProfile(authUser.uid);
  if (!updated) {
    throw new Error("Le document candidate_profiles n a pas pu etre lu apres enregistrement.");
  }

  return {
    profile: updated,
    jobChanged: result.jobChanged,
    verificationReset: result.verificationReset,
    activationDowngraded: result.activationDowngraded,
    identityMissingFields: result.identityMissingFields ?? [],
  };
}
