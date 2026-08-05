import 'server-only';

import type { DocumentReference, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

type FirestoreRecord = Record<string, unknown>;

export type CompanyQuestionnaireResolutionSource =
  | 'explicit_reference'
  | 'offer_id'
  | 'offer_id_fallback';

export type ResolvedCompanyQuestionnaire = {
  questionnaireId: string;
  source: CompanyQuestionnaireResolutionSource;
  conflictDetected: boolean;
  explicitReferenceMissing: boolean;
  ref: DocumentReference;
  snapshot: DocumentSnapshot;
  data: FirestoreRecord;
};

export class SevenoCompanyQuestionnaireResolutionError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function cleanId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (id.length > 100) {
    throw new SevenoCompanyQuestionnaireResolutionError(
      'questionnaire_reference_invalid',
      409,
      'La reference du questionnaire est invalide.',
    );
  }
  return id;
}

function assertQuestionnaireOwnership(
  snapshot: DocumentSnapshot,
  offerId: string,
  companyUid: string,
) {
  const data = snapshot.data() as FirestoreRecord;
  if (data.companyUid !== companyUid) {
    throw new SevenoCompanyQuestionnaireResolutionError(
      'questionnaire_company_mismatch',
      403,
      'Ce questionnaire ne correspond pas a cette entreprise.',
    );
  }
  if (data.offerId !== offerId) {
    throw new SevenoCompanyQuestionnaireResolutionError(
      'questionnaire_offer_mismatch',
      409,
      'Ce questionnaire ne correspond pas a cette offre.',
    );
  }
  return data;
}

export async function resolveCompanyQuestionnaireForOffer(input: {
  firestore: Firestore;
  offerId: string;
  companyUid: string;
  offer: {
    id?: unknown;
    companyUid?: unknown;
    questionnaireId?: unknown;
  };
}): Promise<ResolvedCompanyQuestionnaire | null> {
  const offerId = cleanId(input.offerId);
  const companyUid = cleanId(input.companyUid);
  if (!offerId || !companyUid || cleanId(input.offer.id) !== offerId || cleanId(input.offer.companyUid) !== companyUid) {
    throw new SevenoCompanyQuestionnaireResolutionError(
      'questionnaire_offer_context_mismatch',
      403,
      'Le contexte de resolution du questionnaire est invalide.',
    );
  }

  const collection = input.firestore.collection('company_questionnaires');
  const explicitQuestionnaireId = cleanId(input.offer.questionnaireId);
  if (explicitQuestionnaireId) {
    const explicitRef = collection.doc(explicitQuestionnaireId);
    const fallbackRef = collection.doc(offerId);
    const [explicitSnapshot, fallbackSnapshot] = explicitQuestionnaireId === offerId
      ? await explicitRef.get().then((snapshot) => [snapshot, snapshot] as const)
      : await Promise.all([explicitRef.get(), fallbackRef.get()]);

    if (explicitSnapshot.exists) {
      const data = assertQuestionnaireOwnership(explicitSnapshot, offerId, companyUid);
      const conflictDetected = explicitQuestionnaireId !== offerId && fallbackSnapshot.exists;
      if (conflictDetected) {
        console.warn('[SevenO questionnaire resolution]', {
          code: 'questionnaire_reference_conflict_explicit_wins',
          offerId,
          explicitQuestionnaireId,
          fallbackQuestionnaireId: offerId,
        });
      }
      return {
        questionnaireId: explicitQuestionnaireId,
        source: 'explicit_reference',
        conflictDetected,
        explicitReferenceMissing: false,
        ref: explicitRef,
        snapshot: explicitSnapshot,
        data,
      };
    }

    if (fallbackSnapshot.exists) {
      const data = assertQuestionnaireOwnership(fallbackSnapshot, offerId, companyUid);
      console.warn('[SevenO questionnaire resolution]', {
        code: 'questionnaire_explicit_reference_missing_fallback_used',
        offerId,
        explicitQuestionnaireId,
        fallbackQuestionnaireId: offerId,
      });
      return {
        questionnaireId: offerId,
        source: 'offer_id_fallback',
        conflictDetected: false,
        explicitReferenceMissing: true,
        ref: fallbackRef,
        snapshot: fallbackSnapshot,
        data,
      };
    }

    return null;
  }

  const fallbackRef = collection.doc(offerId);
  const fallbackSnapshot = await fallbackRef.get();
  if (!fallbackSnapshot.exists) {
    return null;
  }
  const data = assertQuestionnaireOwnership(fallbackSnapshot, offerId, companyUid);
  return {
    questionnaireId: offerId,
    source: 'offer_id',
    conflictDetected: false,
    explicitReferenceMissing: false,
    ref: fallbackRef,
    snapshot: fallbackSnapshot,
    data,
  };
}
