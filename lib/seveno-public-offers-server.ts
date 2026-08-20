import 'server-only';

import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import {
  isPublicOfferPublicationActive,
  projectPublicOffer,
  type PublicOfferProjection,
} from '@/lib/seveno-public-discovery';

const COLLECTION = 'job_offers';

export async function listPublicOffersServer(): Promise<PublicOfferProjection[]> {
  if (!isFirebaseAdminConfigured || !adminDb) return [];
  const snapshot = await adminDb.collection(COLLECTION).where('status', '==', 'published').get();
  const campaignIds = [...new Set(snapshot.docs
    .map((document) => document.get('activeCampaignId'))
    .filter((value): value is string => typeof value === 'string' && Boolean(value)))];
  const campaignSnapshots = campaignIds.length > 0
    ? await adminDb.getAll(...campaignIds.map((id) => adminDb!.collection('recruitment_campaigns').doc(id)))
    : [];
  const campaigns = new Map(campaignSnapshots.map((campaign) => [campaign.id, campaign.exists ? campaign.data() ?? null : null]));

  return snapshot.docs
    .map((document) => {
      const data = document.data();
      const campaignId = typeof data.activeCampaignId === 'string' ? data.activeCampaignId : '';
      const campaignData = campaignId ? campaigns.get(campaignId) ?? null : null;
      if (!isPublicOfferPublicationActive(data, campaignData)) return null;
      return projectPublicOffer(document.id, data, campaignData);
    })
    .filter((offer): offer is PublicOfferProjection => Boolean(offer))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export async function getPublicOfferBySlugServer(slug: string): Promise<PublicOfferProjection | null> {
  if (!isFirebaseAdminConfigured || !adminDb) return null;
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{8,120}$/.test(normalizedSlug)) return null;

  const direct = await adminDb.collection(COLLECTION).where('publicSlug', '==', normalizedSlug).limit(1).get();
  if (!direct.empty) {
    const document = direct.docs[0];
    const data = document.data();
    const campaignId = typeof data.activeCampaignId === 'string' ? data.activeCampaignId : '';
    const campaign = campaignId
      ? await adminDb.collection('recruitment_campaigns').doc(campaignId).get()
      : null;
    const campaignData = campaign?.exists ? campaign.data() ?? null : null;
    if (!isPublicOfferPublicationActive(data, campaignData)) return null;
    return projectPublicOffer(document.id, data, campaignData);
  }

  const legacyOffers = await listPublicOffersServer();
  return legacyOffers.find((offer) => offer.slug === normalizedSlug) ?? null;
}

export async function resolvePublicOfferIdBySlugServer(slug: string): Promise<string | null> {
  if (!isFirebaseAdminConfigured || !adminDb) return null;
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{8,120}$/.test(normalizedSlug)) return null;

  const direct = await adminDb.collection(COLLECTION).where('publicSlug', '==', normalizedSlug).limit(1).get();
  if (!direct.empty) {
    const document = direct.docs[0];
    const data = document.data();
    const campaignId = typeof data.activeCampaignId === 'string' ? data.activeCampaignId : '';
    const campaign = campaignId
      ? await adminDb.collection('recruitment_campaigns').doc(campaignId).get()
      : null;
    const campaignData = campaign?.exists ? campaign.data() ?? null : null;
    if (!isPublicOfferPublicationActive(data, campaignData)) return null;
    return projectPublicOffer(document.id, data, campaignData)?.slug === normalizedSlug ? document.id : null;
  }

  const snapshot = await adminDb.collection(COLLECTION).where('status', '==', 'published').get();
  const campaignIds = [...new Set(snapshot.docs
    .map((document) => document.get('activeCampaignId'))
    .filter((value): value is string => typeof value === 'string' && Boolean(value)))];
  const campaignSnapshots = campaignIds.length > 0
    ? await adminDb.getAll(...campaignIds.map((id) => adminDb!.collection('recruitment_campaigns').doc(id)))
    : [];
  const campaigns = new Map(campaignSnapshots.map((campaign) => [campaign.id, campaign.exists ? campaign.data() ?? null : null]));

  for (const document of snapshot.docs) {
    const data = document.data();
    const campaignId = typeof data.activeCampaignId === 'string' ? data.activeCampaignId : '';
    const campaignData = campaignId ? campaigns.get(campaignId) ?? null : null;
    if (!isPublicOfferPublicationActive(data, campaignData)) continue;
    if (projectPublicOffer(document.id, data, campaignData)?.slug === normalizedSlug) return document.id;
  }

  return null;
}
