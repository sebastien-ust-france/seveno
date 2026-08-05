import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { SevenoBillingError } from '@/lib/seveno-billing-server';

type RecordValue = Record<string, unknown>;

function db() {
  if (!isFirebaseAdminConfigured || !adminDb) throw new SevenoBillingError('firebase_admin_missing', 500, 'Firebase Admin est indisponible.');
  return adminDb;
}

export function isApplicationQualifiedForCampaign(application: RecordValue) {
  const status = String(application.status ?? '');
  const required = application.requiredResult as { allSatisfied?: unknown } | undefined;
  const assessment = application.sevenoAssessmentSnapshot as { status?: unknown } | undefined;
  const offer = application.offerSnapshot as { questionnaireRequired?: unknown } | undefined;
  const companyAssessment = application.companyAssessment as {
    status?: unknown; finalScore?: unknown; automaticScorePercent?: unknown; minimumPassingScorePercent?: unknown;
  } | undefined;
  const questionnaireScore = typeof companyAssessment?.finalScore === 'number'
    ? companyAssessment.finalScore
    : companyAssessment?.automaticScorePercent;
  const questionnaireThreshold = companyAssessment?.minimumPassingScorePercent;
  const questionnairePassed = typeof questionnaireThreshold !== 'number'
    || (typeof questionnaireScore === 'number' && questionnaireScore >= questionnaireThreshold);
  return required?.allSatisfied === true
    && assessment?.status === 'completed'
    && (!offer?.questionnaireRequired || (companyAssessment?.status === 'completed' && questionnairePassed))
    && ['submitted', 'questionnaire_completed'].includes(status);
}

export async function admitQualifiedApplication(applicationId: string) {
  const firestore = db();
  const applicationRef = firestore.collection('job_applications').doc(applicationId);
  return firestore.runTransaction(async (transaction) => {
    const application = await transaction.get(applicationRef);
    if (!application.exists) throw new SevenoBillingError('application_not_found', 404, 'Candidature introuvable.');
    const data = application.data() as RecordValue;
    if (!isApplicationQualifiedForCampaign(data)) return { admitted: false, reason: 'not_qualified' as const };
    const offerRef = firestore.collection('job_offers').doc(String(data.offerId ?? ''));
    const offer = await transaction.get(offerRef);
    const campaignId = String(offer.get('activeCampaignId') ?? '');
    if (!campaignId) return { admitted: false, reason: 'no_campaign' as const };
    const campaignRef = firestore.collection('recruitment_campaigns').doc(campaignId);
    const campaign = await transaction.get(campaignRef);
    if (!campaign.exists || campaign.get('companyId') !== (offer.get('companyId') ?? offer.get('companyUid'))) {
      throw new SevenoBillingError('campaign_mismatch', 409, 'Campagne incohérente.');
    }
    const deliveryRef = campaignRef.collection('candidate_deliveries').doc(applicationId);
    const existing = await transaction.get(deliveryRef);
    if (existing.exists) return { admitted: false, reason: 'already_counted' as const, status: existing.get('status') };
    const now = Timestamp.now();
    if ((campaign.get('endsAt') as Timestamp).toMillis() <= now.toMillis()) {
      transaction.update(campaignRef, { status: 'expired', updatedAt: now });
      return { admitted: false, reason: 'expired' as const };
    }
    const delivered = Number(campaign.get('deliveredCandidateCount') ?? 0);
    const queued = Number(campaign.get('queuedCandidateCount') ?? 0);
    const active = Number(campaign.get('activeCandidateCount') ?? 0);
    const limit = Number(campaign.get('effectiveQualifiedCandidateLimit') ?? 20);
    if (delivered + queued >= limit) {
      transaction.update(campaignRef, { status: 'candidate_limit_reached', updatedAt: now });
      return { admitted: false, reason: 'capacity_reached' as const };
    }
    const status = active < Number(campaign.get('simultaneousCandidateLimit') ?? 5) ? 'delivered' : 'queued';
    transaction.create(deliveryRef, {
      applicationId, campaignId, companyId: String(campaign.get('companyId')), candidateUid: String(data.candidateUid ?? ''), status,
      qualifiedAt: now, deliveredAt: status === 'delivered' ? now : null, slotReleasedAt: null, slotReleaseReason: null,
      slotReleasedByUid: null, countedInTotalCapacity: true, countedInActiveCapacity: status === 'delivered',
      idempotencyKey: `candidate_qualification:${campaignId}:${applicationId}`, createdAt: now, updatedAt: now,
    });
    transaction.update(campaignRef, {
      activeCandidateCount: active + (status === 'delivered' ? 1 : 0),
      deliveredCandidateCount: delivered + (status === 'delivered' ? 1 : 0),
      queuedCandidateCount: queued + (status === 'queued' ? 1 : 0), updatedAt: now,
    });
    transaction.update(applicationRef, { campaignId, campaignDeliveryStatus: status, campaignQualifiedAt: now, updatedAt: now });
    return { admitted: true, status, campaignId };
  });
}

export async function releaseCampaignCandidateSlot(input: { applicationId: string; actorUid: string; reason: string }) {
  const firestore = db();
    const applicationRef = firestore.collection('job_applications').doc(input.applicationId);
  return firestore.runTransaction(async (transaction) => {
    const application = await transaction.get(applicationRef);
    if (!application.exists) return { released: false };
    const campaignId = String(application.get('campaignId') ?? '');
    if (!campaignId) return { released: false };
    const campaignRef = firestore.collection('recruitment_campaigns').doc(campaignId);
    const deliveryRef = campaignRef.collection('candidate_deliveries').doc(input.applicationId);
    const [campaign, delivery] = await Promise.all([transaction.get(campaignRef), transaction.get(deliveryRef)]);
    if (!campaign.exists || !delivery.exists || delivery.get('status') !== 'delivered' || delivery.get('countedInActiveCapacity') !== true) return { released: false };
    const queuedSnapshot = await transaction.get(campaignRef.collection('candidate_deliveries').where('status', '==', 'queued').orderBy('qualifiedAt', 'asc').orderBy('applicationId', 'asc').limit(1));
    const now = Timestamp.now();
    transaction.update(deliveryRef, { status: 'slot_released', countedInActiveCapacity: false, slotReleasedAt: now, slotReleaseReason: input.reason, slotReleasedByUid: input.actorUid, updatedAt: now });
    const active = Math.max(0, Number(campaign.get('activeCandidateCount') ?? 0) - 1);
    const queued = Number(campaign.get('queuedCandidateCount') ?? 0);
    const delivered = Number(campaign.get('deliveredCandidateCount') ?? 0);
    const next = queuedSnapshot.docs[0];
    if (next) {
      transaction.update(next.ref, { status: 'delivered', deliveredAt: now, countedInActiveCapacity: true, updatedAt: now });
      transaction.update(firestore.collection('job_applications').doc(next.id), { campaignDeliveryStatus: 'delivered', updatedAt: now });
    }
    transaction.update(campaignRef, {
      activeCandidateCount: active + (next ? 1 : 0), deliveredCandidateCount: delivered + (next ? 1 : 0),
      queuedCandidateCount: Math.max(0, queued - (next ? 1 : 0)), updatedAt: now,
    });
    return { released: true, promotedApplicationId: next?.id ?? null };
  });
}
