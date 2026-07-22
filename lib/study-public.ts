import 'server-only';

import { unstable_cache } from 'next/cache';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export type PublicStudyResponseCount = {
  totalResponses: number;
};

async function readPublicStudyResponseCount(): Promise<PublicStudyResponseCount> {
  if (!isFirebaseAdminConfigured || !adminDb) {
    return { totalResponses: 0 };
  }

  try {
    const snapshot = await adminDb.collection('study_responses').count().get();
    const totalResponses = snapshot.data().count;

    return {
      totalResponses: Number.isFinite(totalResponses) ? totalResponses : 0,
    };
  } catch {
    return { totalResponses: 0 };
  }
}

const cachedReadPublicStudyResponseCount = unstable_cache(
  readPublicStudyResponseCount,
  ['public-study-response-count'],
  {
    revalidate: 900,
  },
);

export async function getPublicStudyResponseCount(): Promise<PublicStudyResponseCount> {
  return cachedReadPublicStudyResponseCount();
}
