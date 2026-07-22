import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import type { JobApplicationStatus } from '@/types/seveno-job-applications';

const ACTIVE_CANDIDATE_FILE_STATUSES: ReadonlySet<JobApplicationStatus> = new Set([
  'submitted',
  'viewed',
  'questionnaire_pending',
  'questionnaire_completed',
  'shortlisted',
]);

const JOB_APPLICATIONS_COLLECTION = 'job_applications';

function requireDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new Error('Firebase Admin n est pas configure pour les files candidates actives.');
  }

  return adminDb;
}

function cleanText(value: string, maxLength: number) {
  const text = value.trim();
  if (!text || text.length > maxLength) {
    throw new Error('Un identifiant utilise pour la file active est invalide.');
  }

  return text;
}

export function isActiveCandidateFileStatus(status: string): status is JobApplicationStatus {
  return ACTIVE_CANDIDATE_FILE_STATUSES.has(status as JobApplicationStatus);
}

export function buildOfferActiveCandidateFilesLockId(companyUid: string, offerId: string) {
  return createHash('sha256').update(`${cleanText(companyUid, 120)}\0${cleanText(offerId, 120)}`).digest('hex');
}

export async function countActiveCandidateFilesForOffer(companyUid: string, offerId: string) {
  const snapshot = await requireDatabase()
    .collection(JOB_APPLICATIONS_COLLECTION)
    .where('companyUid', '==', cleanText(companyUid, 120))
    .where('offerId', '==', cleanText(offerId, 120))
    .orderBy('updatedAt', 'desc')
    .orderBy('id', 'asc')
    .get();

  return snapshot.docs.reduce((count, document) => {
    const status = String(document.get('status') ?? '');
    return isActiveCandidateFileStatus(status) ? count + 1 : count;
  }, 0);
}

export function touchOfferCapacityLockPayload(companyUid: string, offerId: string) {
  return {
    companyUid: cleanText(companyUid, 120),
    offerId: cleanText(offerId, 120),
    updatedAt: Timestamp.now(),
  };
}
