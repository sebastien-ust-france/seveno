import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp, type Transaction, type Firestore } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import type { BillingActorType, BillingProductCode, CompanyMembershipRole, CreditLedgerType } from '@/types/seveno-billing';

export const LAUNCH_CATALOG_VERSION = 'launch_v1' as const;
export const LAUNCH_BILLING_PRODUCTS = {
  campaign_credit_1_launch: { type: 'credit_pack', displayName: '1 crédit recrutement', unitAmountExcludingTax: 39000, creditQuantity: 1, active: true },
  campaign_credit_3_launch: { type: 'credit_pack', displayName: 'Pack 3 crédits', unitAmountExcludingTax: 99000, creditQuantity: 3, active: true },
  campaign_credit_10_launch: { type: 'credit_pack', displayName: 'Pack 10 crédits', unitAmountExcludingTax: 299000, creditQuantity: 10, active: true },
  campaign_extension_30d_launch: { type: 'campaign_extension', displayName: 'Prolongation de 30 jours', unitAmountExcludingTax: 9000, extensionDays: 30, active: true },
  qualified_candidates_10_launch: { type: 'candidate_capacity', displayName: '10 candidatures qualifiées supplémentaires', unitAmountExcludingTax: 19000, candidateCapacityIncrement: 10, active: true },
} as const;

type Actor = { uid: string | null; type: BillingActorType; membershipRole?: CompanyMembershipRole };
type RecordValue = Record<string, unknown>;

export class SevenoBillingError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code = code; this.status = status; }
}

function db() {
  if (!isFirebaseAdminConfigured || !adminDb) throw new SevenoBillingError('firebase_admin_missing', 500, 'Firebase Admin est indisponible.');
  return adminDb;
}

function keyId(value: string) { return createHash('sha256').update(value).digest('hex'); }
function accountDefaults(companyId: string, now: Timestamp) {
  return { companyId, availableCredits: 0, lifetimeGrantedCredits: 0, lifetimePurchasedCredits: 0, lifetimeConsumedCredits: 0, lifetimeRestoredCredits: 0, activeCampaignCount: 0, createdAt: now, updatedAt: now };
}

export async function ensureLaunchBillingCatalog() {
  const now = Timestamp.now();
  await db().collection('billing_catalogs').doc(LAUNCH_CATALOG_VERSION).set({
    version: LAUNCH_CATALOG_VERSION, status: 'active', currency: 'eur', taxBehavior: 'exclusive',
    products: LAUNCH_BILLING_PRODUCTS, createdAt: now, updatedAt: now,
  }, { merge: true });
}

function ledgerRef(firestore: Firestore, companyId: string, idempotencyKey: string) {
  return firestore.collection('company_billing_accounts').doc(companyId).collection('credit_ledger').doc(keyId(idempotencyKey));
}

async function applyCreditMovementInTransaction(transaction: Transaction, firestore: Firestore, input: {
  companyId: string; quantity: number; type: CreditLedgerType; idempotencyKey: string; actor: Actor; reason?: string;
  offerId?: string; campaignId?: string; orderId?: string; productCode?: BillingProductCode; unitAmountExcludingTax?: number;
  activeCampaignDelta?: number;
}) {
  if (!Number.isInteger(input.quantity) || input.quantity === 0) throw new SevenoBillingError('invalid_credit_quantity', 400, 'Mouvement de crédit invalide.');
  const accountRef = firestore.collection('company_billing_accounts').doc(input.companyId);
  const entryRef = ledgerRef(firestore, input.companyId, input.idempotencyKey);
  const [accountSnapshot, existingEntry] = await Promise.all([transaction.get(accountRef), transaction.get(entryRef)]);
  if (existingEntry.exists) return { entryId: entryRef.id, balanceAfter: Number(existingEntry.get('balanceAfter')), applied: false };
  const now = Timestamp.now();
  const current = accountSnapshot.exists ? accountSnapshot.data() as RecordValue : accountDefaults(input.companyId, now);
  const before = Number(current.availableCredits ?? 0);
  const after = before + input.quantity;
  if (!Number.isSafeInteger(after) || after < 0) throw new SevenoBillingError('insufficient_credits', 409, 'Crédit de recrutement insuffisant.');
  const update: RecordValue = { ...current, companyId: input.companyId, availableCredits: after, updatedAt: now };
  if (input.type === 'admin_grant') update.lifetimeGrantedCredits = Number(current.lifetimeGrantedCredits ?? 0) + Math.max(0, input.quantity);
  if (input.type === 'purchase') update.lifetimePurchasedCredits = Number(current.lifetimePurchasedCredits ?? 0) + Math.max(0, input.quantity);
  if (input.type === 'campaign_activation') update.lifetimeConsumedCredits = Number(current.lifetimeConsumedCredits ?? 0) + Math.abs(input.quantity);
  if (input.type === 'admin_restoration') update.lifetimeRestoredCredits = Number(current.lifetimeRestoredCredits ?? 0) + Math.max(0, input.quantity);
  if (input.activeCampaignDelta) update.activeCampaignCount = Number(current.activeCampaignCount ?? 0) + input.activeCampaignDelta;
  transaction.set(accountRef, update);
  transaction.create(entryRef, {
    entryId: entryRef.id, companyId: input.companyId, type: input.type, quantity: input.quantity,
    balanceBefore: before, balanceAfter: after, actorUid: input.actor.uid, actorType: input.actor.type,
    ...(input.actor.membershipRole ? { actorMembershipRole: input.actor.membershipRole } : {}),
    ...(input.offerId ? { offerId: input.offerId } : {}), ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    ...(input.orderId ? { orderId: input.orderId } : {}), ...(input.productCode ? { productCode: input.productCode } : {}),
    catalogVersion: LAUNCH_CATALOG_VERSION, ...(input.unitAmountExcludingTax !== undefined ? { unitAmountExcludingTax: input.unitAmountExcludingTax } : {}),
    currency: 'eur', ...(input.reason ? { reason: input.reason } : {}), idempotencyKey: input.idempotencyKey, createdAt: now,
  });
  return { entryId: entryRef.id, balanceAfter: after, applied: true };
}

export async function applyCreditMovement(input: Parameters<typeof applyCreditMovementInTransaction>[2]) {
  const firestore = db();
  return firestore.runTransaction((transaction) => applyCreditMovementInTransaction(transaction, firestore, input));
}

export async function applyAdministrativeCreditAdjustment(input: {
  companyId: string; quantity: number; kind: 'restoration' | 'correction'; actorUid: string; reason: string; idempotencyKey: string;
}) {
  if (!input.reason.trim()) throw new SevenoBillingError('reason_required', 400, 'Un motif est obligatoire.');
  if (!Number.isInteger(input.quantity) || input.quantity === 0) throw new SevenoBillingError('invalid_credit_quantity', 400, 'Quantité invalide.');
  if (input.kind === 'restoration' && input.quantity < 1) throw new SevenoBillingError('invalid_restoration', 400, 'Une restitution doit être positive.');
  return applyCreditMovement({
    companyId: input.companyId,
    quantity: input.quantity,
    type: input.kind === 'restoration' ? 'admin_restoration' : 'admin_correction',
    idempotencyKey: input.idempotencyKey,
    actor: { uid: input.actorUid, type: 'seveno_admin' },
    reason: input.reason.trim(),
  });
}

export async function activateCampaignInTransaction(transaction: Transaction, firestore: Firestore, input: {
  companyId: string; offerId: string; actorUid: string; actorMembershipRole: CompanyMembershipRole; now: Timestamp;
}) {
  const campaignId = keyId(`campaign:${input.companyId}:${input.offerId}`).slice(0, 32);
  const campaignRef = firestore.collection('recruitment_campaigns').doc(campaignId);
  const campaign = await transaction.get(campaignRef);
  if (campaign.exists && ['active', 'paused', 'candidate_limit_reached'].includes(String(campaign.get('status')))
    && campaign.get('endsAt') instanceof Timestamp && campaign.get('endsAt').toMillis() > input.now.toMillis()) {
    return { campaignId, ledgerEntryId: String(campaign.get('creditLedgerEntryId')), created: false };
  }
  const idempotencyKey = `campaign_activation:${input.companyId}:${input.offerId}`;
  const movement = await applyCreditMovementInTransaction(transaction, firestore, {
    companyId: input.companyId, quantity: -1, type: 'campaign_activation', idempotencyKey,
    actor: { uid: input.actorUid, type: 'company_member', membershipRole: input.actorMembershipRole }, offerId: input.offerId, campaignId,
    activeCampaignDelta: 1,
  });
  const endsAt = Timestamp.fromMillis(input.now.toMillis() + 60 * 24 * 60 * 60 * 1000);
  transaction.set(campaignRef, {
    campaignId, companyId: input.companyId, offerId: input.offerId, status: 'active', startedAt: input.now, endsAt,
    baseDurationDays: 60, purchasedExtensionDays: 0, simultaneousCandidateLimit: 5,
    baseQualifiedCandidateLimit: 20, purchasedQualifiedCandidateCapacity: 0, effectiveQualifiedCandidateLimit: 20,
    activeCandidateCount: 0, deliveredCandidateCount: 0, queuedCandidateCount: 0,
    creditLedgerEntryId: movement.entryId, catalogVersion: LAUNCH_CATALOG_VERSION,
    createdByUid: input.actorUid, lastUpdatedByUid: input.actorUid,
    createdAt: campaign.get('createdAt') ?? input.now, updatedAt: input.now,
  }, { merge: true });
  return { campaignId, ledgerEntryId: movement.entryId, created: movement.applied };
}

export async function createManualBillingOrder(input: {
  companyId: string; productCode: BillingProductCode; campaignId?: string; actorUid: string; reason: string; idempotencyKey: string;
}) {
  if (!input.reason.trim()) throw new SevenoBillingError('reason_required', 400, 'Un motif est obligatoire.');
  const product = LAUNCH_BILLING_PRODUCTS[input.productCode];
  if (!product?.active) throw new SevenoBillingError('product_unavailable', 409, 'Produit indisponible.');
  const firestore = db();
  const orderId = keyId(input.idempotencyKey).slice(0, 32);
  const ref = firestore.collection('billing_orders').doc(orderId);
  const now = Timestamp.now();
  await ref.create({
    orderId, companyId: input.companyId, createdByUid: input.actorUid, productCode: input.productCode,
    catalogVersion: LAUNCH_CATALOG_VERSION, status: 'paid', provider: 'manual',
    unitAmountExcludingTax: product.unitAmountExcludingTax, currency: 'eur', ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    entitlementApplied: false, entitlementAppliedAt: null, idempotencyKey: input.idempotencyKey, reason: input.reason.trim(), createdAt: now, updatedAt: now,
  }).catch(async (error: unknown) => { if ((error as { code?: number }).code !== 6) throw error; });
  return applyBillingEntitlement({ orderId, companyId: input.companyId, actor: { uid: input.actorUid, type: 'seveno_admin' } });
}

export async function applyBillingEntitlement(input: { orderId: string; companyId: string; actor: Actor }) {
  const firestore = db();
  return firestore.runTransaction(async (transaction) => {
    const orderRef = firestore.collection('billing_orders').doc(input.orderId);
    const order = await transaction.get(orderRef);
    if (!order.exists || order.get('companyId') !== input.companyId) throw new SevenoBillingError('order_not_found', 404, 'Commande introuvable.');
    if (order.get('status') !== 'paid') throw new SevenoBillingError('order_not_paid', 409, 'La commande n’est pas payée.');
    if (order.get('entitlementApplied') === true) return { orderId: input.orderId, applied: false };
    const productCode = order.get('productCode') as BillingProductCode;
    const product = LAUNCH_BILLING_PRODUCTS[productCode];
    if (!product) throw new SevenoBillingError('invalid_product', 409, 'Produit inconnu.');
    const now = Timestamp.now();
    if (product.type === 'credit_pack') {
      await applyCreditMovementInTransaction(transaction, firestore, {
        companyId: input.companyId, quantity: product.creditQuantity, type: input.actor.type === 'seveno_admin' ? 'admin_grant' : 'purchase',
        idempotencyKey: `order_entitlement:${input.companyId}:${input.orderId}`, actor: input.actor, orderId: input.orderId,
        productCode, unitAmountExcludingTax: product.unitAmountExcludingTax, reason: String(order.get('reason') ?? ''),
      });
    } else {
      const campaignId = String(order.get('campaignId') ?? '');
      const campaignRef = firestore.collection('recruitment_campaigns').doc(campaignId);
      const campaign = await transaction.get(campaignRef);
      if (!campaign.exists || campaign.get('companyId') !== input.companyId) throw new SevenoBillingError('campaign_not_found', 404, 'Campagne introuvable.');
      if (product.type === 'campaign_extension') {
        const currentEnds = campaign.get('endsAt') as Timestamp;
        const base = Math.max(currentEnds.toMillis(), now.toMillis());
        transaction.update(campaignRef, { endsAt: Timestamp.fromMillis(base + product.extensionDays * 86400000), purchasedExtensionDays: Number(campaign.get('purchasedExtensionDays') ?? 0) + product.extensionDays, status: 'active', lastUpdatedByUid: input.actor.uid, updatedAt: now });
      } else {
        const purchased = Number(campaign.get('purchasedQualifiedCandidateCapacity') ?? 0) + product.candidateCapacityIncrement;
        transaction.update(campaignRef, { purchasedQualifiedCandidateCapacity: purchased, effectiveQualifiedCandidateLimit: 20 + purchased, lastUpdatedByUid: input.actor.uid, updatedAt: now });
      }
    }
    transaction.update(orderRef, { entitlementApplied: true, entitlementAppliedAt: now, updatedAt: now });
    return { orderId: input.orderId, applied: true };
  });
}

export async function getCompanyBillingView(companyId: string) {
  await ensureLaunchBillingCatalog();
  const firestore = db();
  const [account, ledger, campaigns] = await Promise.all([
    firestore.collection('company_billing_accounts').doc(companyId).get(),
    firestore.collection('company_billing_accounts').doc(companyId).collection('credit_ledger').orderBy('createdAt', 'desc').limit(100).get(),
    firestore.collection('recruitment_campaigns').where('companyId', '==', companyId).get(),
  ]);
  const current = account.exists ? account.data() as RecordValue : accountDefaults(companyId, Timestamp.now());
  return {
    ...current, companyId, catalogVersion: LAUNCH_CATALOG_VERSION, products: LAUNCH_BILLING_PRODUCTS,
    ledger: ledger.docs.map((doc) => ({ ...doc.data(), createdAt: (doc.get('createdAt') as Timestamp).toDate().toISOString() })),
    campaigns: campaigns.docs.map((doc) => ({
      ...doc.data(), campaignId: doc.id,
      startedAt: (doc.get('startedAt') as Timestamp).toDate().toISOString(),
      endsAt: (doc.get('endsAt') as Timestamp).toDate().toISOString(),
    })),
  };
}
