'use client';

import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import type {
  CompanyProfile,
  CompanyProfileStatus,
  CompanyProfileUpsertData,
  CompanySize,
  CompanyVerificationStatus,
} from '@/types/seveno';

const COMPANY_PROFILES_COLLECTION = 'company_profiles';

export const COMPANY_PROFILE_STATUS_VALUES: CompanyProfileStatus[] = ['draft', 'active', 'suspended'];
export const COMPANY_VERIFICATION_STATUS_VALUES: CompanyVerificationStatus[] = [
  'unverified',
  'pending',
  'verified',
  'rejected',
];
export const COMPANY_SIZE_VALUES: CompanySize[] = ['solo', '1_9', '10_49', '50_249', '250_plus'];
export const COMPANY_PROFILE_LIMITS = {
  companyName: 200,
  companyType: 120,
  legalName: 200,
  siret: 14,
  website: 200,
  businessSector: 160,
  headquartersArea: 120,
  recruitmentAreas: 12,
  contactRole: 120,
} as const;

function requireFirestoreClient() {
  if (!isFirebaseConfigured || !db) {
    throw new Error('Firestore n est pas configure.');
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

function companyProfileRef(uid: string) {
  return doc(requireFirestoreClient(), COMPANY_PROFILES_COLLECTION, uid);
}

function cleanOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRequiredText(value: string, label: string, maxLength: number) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) {
    throw new Error(`Le champ ${label} est obligatoire.`);
  }

  if (cleaned.length > maxLength) {
    throw new Error(`Le champ ${label} doit contenir au maximum ${maxLength} caracteres.`);
  }

  return cleaned;
}

function normalizeOptionalText(value: string | null | undefined, label: string, maxLength: number) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) {
    return undefined;
  }

  if (cleaned.length > maxLength) {
    throw new Error(`Le champ ${label} doit contenir au maximum ${maxLength} caracteres.`);
  }

  return cleaned;
}

function normalizeCompanySize(value: string): CompanySize {
  if (!COMPANY_SIZE_VALUES.includes(value as CompanySize)) {
    throw new Error("La taille d entreprise selectionnee est invalide.");
  }

  return value as CompanySize;
}

function normalizeRecruitmentAreas(values: string[]) {
  const areas = values
    .map((value) => cleanOptionalText(value))
    .filter((value): value is string => Boolean(value));
  const uniqueAreas = Array.from(new Set(areas));

  if (uniqueAreas.length === 0) {
    throw new Error('Ajoutez au moins une zone de recrutement.');
  }

  if (uniqueAreas.length > COMPANY_PROFILE_LIMITS.recruitmentAreas) {
    throw new Error(`Ajoutez au maximum ${COMPANY_PROFILE_LIMITS.recruitmentAreas} zones de recrutement.`);
  }

  return uniqueAreas;
}

function normalizeSiret(value: string | null | undefined) {
  const cleaned = value ? value.replace(/\D+/g, '') : '';
  if (!cleaned) {
    return undefined;
  }

  if (!/^\d{14}$/.test(cleaned)) {
    throw new Error('Le SIRET doit contenir exactement 14 chiffres.');
  }

  return cleaned;
}

function resolveProfileStatus(existing?: Partial<CompanyProfile> | null): CompanyProfileStatus {
  if (existing?.profileStatus === 'draft' || existing?.profileStatus === 'active' || existing?.profileStatus === 'suspended') {
    return existing.profileStatus;
  }

  return 'active';
}

function resolveVerificationStatus(
  existing: Partial<CompanyProfile> | null | undefined,
  hasSiret: boolean,
): CompanyVerificationStatus {
  if (existing?.verificationStatus === 'verified' || existing?.verificationStatus === 'rejected') {
    return existing.verificationStatus;
  }

  if (hasSiret) {
    return 'pending';
  }

  if (existing?.verificationStatus === 'pending' || existing?.verificationStatus === 'unverified') {
    return existing.verificationStatus;
  }

  return 'unverified';
}

function buildCompanyProfilePayload(
  uid: string,
  data: CompanyProfileUpsertData,
  existing?: Partial<CompanyProfile> | null,
): CompanyProfile {
  const legalName = normalizeOptionalText(data.legalName, 'raison sociale', COMPANY_PROFILE_LIMITS.legalName);
  const siret = normalizeSiret(data.siret);
  const website = normalizeOptionalText(data.website, 'site web', COMPANY_PROFILE_LIMITS.website);

  return {
    uid,
    companyName: normalizeRequiredText(data.companyName, 'nom commercial', COMPANY_PROFILE_LIMITS.companyName),
    ...(legalName ? { legalName } : {}),
    companyType: normalizeRequiredText(data.companyType, 'type d entreprise', COMPANY_PROFILE_LIMITS.companyType),
    ...(siret ? { siret } : {}),
    ...(website ? { website } : {}),
    businessSector: normalizeRequiredText(data.businessSector, 'secteur d activite', COMPANY_PROFILE_LIMITS.businessSector),
    companySize: normalizeCompanySize(data.companySize),
    headquartersArea: normalizeRequiredText(data.headquartersArea, 'zone du siege', COMPANY_PROFILE_LIMITS.headquartersArea),
    recruitmentAreas: normalizeRecruitmentAreas(data.recruitmentAreas),
    contactRole: normalizeRequiredText(data.contactRole, 'fonction', COMPANY_PROFILE_LIMITS.contactRole),
    profileStatus: resolveProfileStatus(existing),
    verificationStatus: resolveVerificationStatus(existing, Boolean(siret)),
    createdAt: existing?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function getCompanyProfile(uid: string): Promise<CompanyProfile | null> {
  if (!isFirebaseConfigured || !db) {
    return null;
  }

  const snapshot = await getDoc(companyProfileRef(uid));
  return snapshot.exists() ? (snapshot.data() as CompanyProfile) : null;
}

export async function hasCompanyProfile(uid: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) {
    return false;
  }

  const snapshot = await getDoc(companyProfileRef(uid));
  return snapshot.exists();
}

export async function createOrUpdateCompanyProfile(
  uid: string,
  data: CompanyProfileUpsertData,
): Promise<CompanyProfile> {
  const ref = companyProfileRef(uid);
  let snapshot;

  try {
    snapshot = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture du profil entreprise', error));
  }

  const existing = snapshot.exists() ? (snapshot.data() as Partial<CompanyProfile>) : null;
  const payload = buildCompanyProfilePayload(uid, data, existing);

  try {
    if (existing) {
      await updateDoc(ref, {
        companyName: payload.companyName,
        legalName: payload.legalName ?? deleteField(),
        companyType: payload.companyType,
        siret: payload.siret ?? deleteField(),
        website: payload.website ?? deleteField(),
        businessSector: payload.businessSector,
        companySize: payload.companySize,
        headquartersArea: payload.headquartersArea,
        recruitmentAreas: payload.recruitmentAreas,
        contactRole: payload.contactRole,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (error) {
    throw new Error(describeFirestoreError('Ecriture du profil entreprise', error));
  }

  let updated;

  try {
    updated = await getDoc(ref);
  } catch (error) {
    throw new Error(describeFirestoreError('Lecture apres ecriture du profil entreprise', error));
  }

  if (!updated.exists()) {
    throw new Error("Le document company_profiles n a pas pu etre lu apres enregistrement.");
  }

  return updated.data() as CompanyProfile;
}

export function isCompanyProfileIncomplete(profile: CompanyProfile) {
  return (
    profile.companyName.trim().length === 0
    || profile.companyType.trim().length === 0
    || profile.businessSector.trim().length === 0
    || profile.headquartersArea.trim().length === 0
    || profile.contactRole.trim().length === 0
    || profile.recruitmentAreas.length === 0
  );
}
