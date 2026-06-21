import 'server-only';

import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export type PublicStudyResponseCount = {
  totalResponses: number;
};

export async function getPublicStudyResponseCount(): Promise<PublicStudyResponseCount> {
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
