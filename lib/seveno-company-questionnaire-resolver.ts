import 'server-only';

import type { DocumentReference, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

type FirestoreRecord = Record<string, unknown>;

export type CompanyQuestionnaireResolutionSource =
  | 'explicit_reference'
  | 'explicit_legacy_reference'
  | 'offer_id'
  | 'offer_id_fallback';

export type ResolvedCompanyQuestionnaire = {
  questionnaireId: string;
  source: CompanyQuestionnaireResolutionSource;
  conflictDetected: boolean;
  explicitReferenceMissing: boolean;
  legacySourceOfferId: string | null;
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

async function resolveQuestionnaireOwnership(
  firestore: Firestore,
  snapshot: DocumentSnapshot,
  offerId: string,
  companyUid: string,
  allowLegacyExplicitReference: boolean,
) {
  const data = snapshot.data() as FirestoreRecord;
  if (data.companyUid !== companyUid) {
    throw new SevenoCompanyQuestionnaireResolutionError(
      'questionnaire_company_mismatch',
      403,
      'Ce questionnaire ne correspond pas a cette entreprise.',
    );
  }
  if (data.offerId === offerId) {
    return { data, legacySourceOfferId: null };
  }

  const legacySourceOfferId = cleanId(data.offerId);
  if (allowLegacyExplicitReference && legacySourceOfferId === snapshot.id) {
    const sourceOfferSnapshot = await firestore.collection('job_offers').doc(legacySourceOfferId).get();
    const sourceOffer = sourceOfferSnapshot.data() as FirestoreRecord | undefined;
    if (
      sourceOfferSnapshot.exists
      && sourceOffer?.companyUid === companyUid
      && cleanId(sourceOffer.questionnaireId) === snapshot.id
    ) {
      console.warn('[SevenO questionnaire resolution]', {
        code: 'questionnaire_legacy_source_offer_reference_used',
        offerId,
        questionnaireId: snapshot.id,
        legacySourceOfferId,
      });
      return { data, legacySourceOfferId };
    }
  }

  throw new SevenoCompanyQuestionnaireResolutionError(
    'questionnaire_offer_mismatch',
    409,
    'Ce questionnaire ne correspond pas a cette offre.',
  );
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
      const ownership = await resolveQuestionnaireOwnership(
        input.firestore,
        explicitSnapshot,
        offerId,
        companyUid,
        true,
      );
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
        source: ownership.legacySourceOfferId ? 'explicit_legacy_reference' : 'explicit_reference',
        conflictDetected,
        explicitReferenceMissing: false,
        legacySourceOfferId: ownership.legacySourceOfferId,
        ref: explicitRef,
        snapshot: explicitSnapshot,
        data: ownership.data,
      };
    }

    if (fallbackSnapshot.exists) {
      const ownership = await resolveQuestionnaireOwnership(
        input.firestore,
        fallbackSnapshot,
        offerId,
        companyUid,
        false,
      );
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
        legacySourceOfferId: null,
        ref: fallbackRef,
        snapshot: fallbackSnapshot,
        data: ownership.data,
      };
    }

    return null;
  }

  const fallbackRef = collection.doc(offerId);
  const fallbackSnapshot = await fallbackRef.get();
  if (!fallbackSnapshot.exists) {
    return null;
  }
  const ownership = await resolveQuestionnaireOwnership(
    input.firestore,
    fallbackSnapshot,
    offerId,
    companyUid,
    false,
  );
  return {
    questionnaireId: offerId,
    source: 'offer_id',
    conflictDetected: false,
    explicitReferenceMissing: false,
    legacySourceOfferId: null,
    ref: fallbackRef,
    snapshot: fallbackSnapshot,
    data: ownership.data,
  };
}
