import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { SevenoBillingError } from '@/lib/seveno-billing-server';

export const CURRENT_COMPANY_SALES_TERMS_VERSION = '1.0' as const;
export const COMPANY_SALES_TERMS_TYPE = 'company_sales_terms' as const;
export const COMPANY_SALES_TERMS_EFFECTIVE_DATE = '2026-08-10' as const;
export const COMPANY_SALES_TERMS_COLLECTION = 'company_sales_terms_acceptances' as const;

function firestore() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoBillingError('firebase_admin_missing', 500, 'Firebase Admin est indisponible.');
  }
  return adminDb;
}

function acceptanceId(companyId: string, version = CURRENT_COMPANY_SALES_TERMS_VERSION) {
  return createHash('sha256').update(`${COMPANY_SALES_TERMS_TYPE}:${companyId}:${version}`).digest('hex');
}

export function isCompanySalesTermsAcceptanceCurrent(
  data: FirebaseFirestore.DocumentData | undefined,
  companyId: string,
  currentVersion: string = CURRENT_COMPANY_SALES_TERMS_VERSION,
) {
  return Boolean(data)
    && data?.companyId === companyId
    && data?.termsType === COMPANY_SALES_TERMS_TYPE
    && data?.version === currentVersion
    && typeof data?.acceptedByUid === 'string'
    && data.acceptedByUid.length > 0
    && data?.acceptedAt instanceof Timestamp;
}

export async function getCurrentCompanySalesTermsAcceptance(companyId: string) {
  const snapshot = await firestore()
    .collection(COMPANY_SALES_TERMS_COLLECTION)
    .doc(acceptanceId(companyId))
    .get();
  if (!snapshot.exists || !isCompanySalesTermsAcceptanceCurrent(snapshot.data(), companyId)) return null;
  return {
    companyId,
    acceptedByUid: String(snapshot.get('acceptedByUid')),
    termsType: COMPANY_SALES_TERMS_TYPE,
    version: CURRENT_COMPANY_SALES_TERMS_VERSION,
    acceptedAt: snapshot.get('acceptedAt') as Timestamp,
  };
}

export async function requireCurrentCompanySalesTermsAcceptance(companyId: string) {
  const acceptance = await getCurrentCompanySalesTermsAcceptance(companyId);
  if (!acceptance) {
    throw new SevenoBillingError(
      'company_sales_terms_required',
      409,
      'Vous devez accepter les Conditions générales de vente Seven’O Entreprises avant le paiement.',
    );
  }
  return acceptance;
}

export async function acceptCurrentCompanySalesTerms(input: { companyId: string; acceptedByUid: string }) {
  const ref = firestore().collection(COMPANY_SALES_TERMS_COLLECTION).doc(acceptanceId(input.companyId));
  const acceptedAt = Timestamp.now();
  try {
    await ref.create({
      companyId: input.companyId,
      acceptedByUid: input.acceptedByUid,
      termsType: COMPANY_SALES_TERMS_TYPE,
      version: CURRENT_COMPANY_SALES_TERMS_VERSION,
      acceptedAt,
    });
    return { companyId: input.companyId, acceptedByUid: input.acceptedByUid, termsType: COMPANY_SALES_TERMS_TYPE, version: CURRENT_COMPANY_SALES_TERMS_VERSION, acceptedAt };
  } catch (error) {
    if ((error as { code?: number | string }).code !== 6 && (error as { code?: number | string }).code !== '6') throw error;
    const existing = await getCurrentCompanySalesTermsAcceptance(input.companyId);
    if (!existing) throw new SevenoBillingError('company_sales_terms_conflict', 409, 'L’acceptation des CGV est incohérente.');
    return existing;
  }
}
