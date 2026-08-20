import 'server-only';

import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { projectPublicCandidate, type PublicCandidateProjection } from '@/lib/seveno-public-discovery';

const COLLECTION = 'candidate_profiles';

export async function listPublicCandidatesServer(): Promise<PublicCandidateProjection[]> {
  if (!isFirebaseAdminConfigured || !adminDb) return [];
  const snapshot = await adminDb.collection(COLLECTION)
    .where('publicSearchVisibilityEnabled', '==', true)
    .get();
  return snapshot.docs
    .map((document) => projectPublicCandidate(document.data()))
    .filter((candidate): candidate is PublicCandidateProjection => Boolean(candidate))
    .sort((left, right) => left.targetJobs[0]!.label.localeCompare(right.targetJobs[0]!.label, 'fr'));
}

export async function getPublicCandidateBySlugServer(slug: string): Promise<PublicCandidateProjection | null> {
  if (!isFirebaseAdminConfigured || !adminDb) return null;
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{8,120}$/.test(normalizedSlug)) return null;
  const snapshot = await adminDb.collection(COLLECTION)
    .where('publicSearchSlug', '==', normalizedSlug)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return projectPublicCandidate(snapshot.docs[0].data());
}
