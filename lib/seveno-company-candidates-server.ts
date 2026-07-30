import 'server-only';

import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import {
  isCandidateCurrentlyImmediatelyAvailable,
  toAvailabilityDate,
} from '@/lib/seveno-candidate-availability';
import { normalizeDesiredContractTypeCodes } from '@/lib/seveno-desired-contract-types';
import type {
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidateProfile,
  CandidateSearchFilters,
  CandidateTargetJob,
} from '@/types/seveno';

const CANDIDATE_PROFILES_COLLECTION = 'candidate_profiles';
const CANDIDATE_SEARCH_PAGE_SIZE = 20;
const CANDIDATE_SEARCH_SCAN_BATCH_SIZE = 60;
const CANDIDATE_SEARCH_MAX_SCANNED = 300;
const PUBLIC_CANDIDATE_ID_PATTERN = /^SEV-CAND-[A-Z2-9]{6}$/;
const AVAILABILITY_VALUES: CandidateAvailability[] = [
  'immediate',
  'less_than_1_month',
  'one_to_three_months',
  'listening',
  'not_available',
];
const EXPERIENCE_VALUES: CandidateExperienceLevel[] = [
  'beginner',
  'intermediate',
  'confirmed',
  'senior',
  'expert',
];

type FirestoreRecord = Record<string, unknown>;

type CandidateSearchCursor = {
  updatedAtMillis: number;
  publicCandidateId: string;
};

export interface SerializedVisibleCandidateProfile {
  publicCandidateId: string;
  targetJobs: CandidateTargetJob[];
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  availability: CandidateAvailability;
  availabilityAvailableFromAt: string | null;
  availabilityConfirmedAt: string | null;
  availabilityValidUntil: string | null;
  locationArea: string;
  experienceLevel: CandidateExperienceLevel;
  desiredContractTypeCodes: CandidateProfile['desiredContractTypeCodes'];
  professionalSelfDescription: string | null;
  professionalReputationDescription: string | null;
  recommendationVisibleCount: number;
  profileStatus: 'active';
}

function requireAdminDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoMatchRequestError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour lire les profils anonymes.',
    );
  }

  return adminDb;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }

  return null;
}

function toAnonymousProjection(
  data: FirestoreRecord,
  requestedJobRoleId?: string,
): SerializedVisibleCandidateProfile | null {
  const publicCandidateId = cleanText(data.publicCandidateId);
  const targetJobs = Array.isArray(data.targetJobs)
    ? data.targetJobs.map((value): CandidateTargetJob | null => {
        if (!value || typeof value !== 'object') return null;
        const record = value as FirestoreRecord;
        const sectorId = cleanText(record.sectorId);
        const jobFamilyId = cleanText(record.jobFamilyId);
        const jobRoleId = cleanText(record.jobRoleId);
        const label = cleanText(record.label);
        return sectorId && jobFamilyId && jobRoleId && label
          ? { sectorId, jobFamilyId, jobRoleId, label }
          : null;
      }).filter((job): job is CandidateTargetJob => Boolean(job))
    : [];
  const selectedJob = requestedJobRoleId
    ? targetJobs.find((job) => job.jobRoleId === requestedJobRoleId)
    : targetJobs[0];
  const locationArea = cleanText(data.locationArea);
  const availability = data.availability as CandidateAvailability;
  const experienceLevel = data.experienceLevel as CandidateExperienceLevel;
  const desiredContractTypeCodes = normalizeDesiredContractTypeCodes(data.desiredContractTypeCodes);
  const availabilityAvailableFromAt = toTimestamp(data.availabilityAvailableFromAt);
  const availabilityConfirmedAt = toTimestamp(data.availabilityConfirmedAt);
  const availabilityValidUntil = toTimestamp(data.availabilityValidUntil);
  const updatedAt = toTimestamp(data.updatedAt);
  const professionalSelfDescription = cleanText(data.professionalSelfDescription);
  const professionalReputationDescription = cleanText(data.professionalReputationDescription);
  const recommendationVisibleCount = typeof data.recommendationVisibleCount === 'number'
    && Number.isFinite(data.recommendationVisibleCount)
    && data.recommendationVisibleCount >= 0
    ? data.recommendationVisibleCount
    : 0;

  if (
    data.role !== 'candidate'
    || data.profileStatus !== 'active'
    || !PUBLIC_CANDIDATE_ID_PATTERN.test(publicCandidateId)
    || targetJobs.length < 1
    || targetJobs.length > 3
    || !selectedJob
    || !updatedAt
    || !locationArea
    || !AVAILABILITY_VALUES.includes(availability)
    || !EXPERIENCE_VALUES.includes(experienceLevel)
  ) {
    return null;
  }

  return {
    publicCandidateId,
    targetJobs,
    sectorId: selectedJob.sectorId,
    jobFamilyId: selectedJob.jobFamilyId,
    jobRoleId: selectedJob.jobRoleId,
    availability,
    availabilityAvailableFromAt: availabilityAvailableFromAt?.toDate().toISOString() ?? null,
    availabilityConfirmedAt: availabilityConfirmedAt?.toDate().toISOString() ?? null,
    availabilityValidUntil: availabilityValidUntil?.toDate().toISOString() ?? null,
    locationArea,
    experienceLevel,
    desiredContractTypeCodes,
    professionalSelfDescription: professionalSelfDescription || null,
    professionalReputationDescription: professionalReputationDescription || null,
    recommendationVisibleCount,
    profileStatus: 'active',
  };
}

function encodeCursor(cursor: CandidateSearchCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null | undefined): CandidateSearchCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<CandidateSearchCursor>;
    if (
      typeof parsed.updatedAtMillis !== 'number'
      || !Number.isFinite(parsed.updatedAtMillis)
      || parsed.updatedAtMillis < 0
      || !Number.isSafeInteger(parsed.updatedAtMillis)
      || typeof parsed.publicCandidateId !== 'string'
      || !PUBLIC_CANDIDATE_ID_PATTERN.test(parsed.publicCandidateId)
    ) {
      throw new Error('invalid_cursor');
    }

    return {
      updatedAtMillis: parsed.updatedAtMillis,
      publicCandidateId: parsed.publicCandidateId,
    };
  } catch {
    throw new SevenoMatchRequestError('invalid_cursor', 400, 'Le curseur de recherche est invalide.');
  }
}

export async function searchVisibleCandidateProfiles(
  filters: CandidateSearchFilters,
  cursorValue?: string | null,
) {
  const firestore = requireAdminDatabase();
  const query: Query = firestore
    .collection(CANDIDATE_PROFILES_COLLECTION)
    .where('profileStatus', '==', 'active')
    .where('targetJobRoleIds', 'array-contains', filters.jobRoleId)
    .orderBy('updatedAt', 'desc')
    .orderBy('publicCandidateId', 'asc');

  const candidates: SerializedVisibleCandidateProfile[] = [];
  let scanCursor = decodeCursor(cursorValue);
  let lastProcessedCursor: CandidateSearchCursor | null = null;
  let scanned = 0;
  let hasMore = false;

  while (candidates.length < CANDIDATE_SEARCH_PAGE_SIZE && scanned < CANDIDATE_SEARCH_MAX_SCANNED) {
    let pageQuery = query;
    if (scanCursor) {
      pageQuery = pageQuery.startAfter(
        Timestamp.fromMillis(scanCursor.updatedAtMillis),
        scanCursor.publicCandidateId,
      );
    }

    const snapshot = await pageQuery.limit(CANDIDATE_SEARCH_SCAN_BATCH_SIZE + 1).get();
    const documents = snapshot.docs.slice(0, CANDIDATE_SEARCH_SCAN_BATCH_SIZE);
    if (documents.length === 0) {
      hasMore = false;
      break;
    }

    hasMore = snapshot.docs.length > CANDIDATE_SEARCH_SCAN_BATCH_SIZE;
    for (const document of documents) {
      const publicCandidateId = cleanText(document.get('publicCandidateId'));
      const updatedAt = toTimestamp(document.get('updatedAt'));
      scanned += 1;
      if (!updatedAt) {
        continue;
      }

      scanCursor = { updatedAtMillis: updatedAt.toMillis(), publicCandidateId };
      if (!PUBLIC_CANDIDATE_ID_PATTERN.test(publicCandidateId)) continue;
      lastProcessedCursor = scanCursor;
      const profile = toAnonymousProjection(document.data(), filters.jobRoleId);
      if (!profile) continue;
      const availabilityValidUntil = toAvailabilityDate(document.get('availabilityValidUntil'));
      if (filters.availability === 'immediate' && !isCandidateCurrentlyImmediatelyAvailable({
        profileStatus: document.get('profileStatus') as 'active',
        availability: document.get('availability') as CandidateAvailability,
        availabilityValidUntil,
      })) {
        continue;
      }
      if (filters.locationArea && profile.locationArea !== filters.locationArea) continue;
      if (filters.availability && filters.availability !== 'immediate' && profile.availability !== filters.availability) continue;
      if (filters.experienceLevel && profile.experienceLevel !== filters.experienceLevel) continue;

      candidates.push(profile);
      if (candidates.length >= CANDIDATE_SEARCH_PAGE_SIZE) {
        hasMore = true;
        break;
      }
    }

    if (candidates.length >= CANDIDATE_SEARCH_PAGE_SIZE || !hasMore) {
      break;
    }
  }

  if (scanned >= CANDIDATE_SEARCH_MAX_SCANNED && lastProcessedCursor) {
    hasMore = true;
  }

  const nextCursor = hasMore && lastProcessedCursor ? encodeCursor(lastProcessedCursor) : null;

  return {
    candidates,
    nextCursor,
  };
}

export async function loadVisibleCandidateProfileByPublicId(publicCandidateId: string) {
  const normalizedPublicCandidateId = publicCandidateId.trim();
  if (!PUBLIC_CANDIDATE_ID_PATTERN.test(normalizedPublicCandidateId)) {
    return null;
  }

  const snapshot = await requireAdminDatabase()
    .collection(CANDIDATE_PROFILES_COLLECTION)
    .where('publicCandidateId', '==', normalizedPublicCandidateId)
    .where('profileStatus', '==', 'active')
    .limit(2)
    .get();
  const profiles = snapshot.docs
    .map((document) => toAnonymousProjection(document.data()))
    .filter((profile): profile is SerializedVisibleCandidateProfile => Boolean(profile));

  if (profiles.length > 1) {
    throw new SevenoMatchRequestError(
      'duplicate_public_candidate_id',
      409,
      'Plusieurs profils utilisent le meme identifiant public.',
    );
  }

  return profiles[0] ?? null;
}
