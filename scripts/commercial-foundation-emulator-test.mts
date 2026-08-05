import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

async function requirePort(address: string) {
  const [host, port] = address.split(':');
  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) });
    socket.once('connect', () => { socket.end(); resolve(); });
    socket.once('error', reject);
  });
}
await requirePort(process.env.FIRESTORE_EMULATOR_HOST);

const { adminDb } = await import('@/lib/firebase-admin');
const { Timestamp } = await import('firebase-admin/firestore');
const { applyCreditMovement, applyAdministrativeCreditAdjustment, activateCampaignInTransaction, applyBillingEntitlement } = await import('@/lib/seveno-billing-server');
const { migrateHistoricalCompany, buildCompanyMembershipId } = await import('@/lib/seveno-company-memberships-server');
const { admitQualifiedApplication, releaseCampaignCandidateSlot, isApplicationQualifiedForCampaign } = await import('@/lib/seveno-recruitment-campaigns-server');
if (!adminDb) throw new Error('Firebase Admin indisponible.');

const companyId = 'historical-owner';
for (const collection of ['company_memberships', 'recruitment_campaigns', 'billing_orders']) {
  const snapshot = await adminDb.collection(collection).where('companyId', '==', companyId).get();
  for (const document of snapshot.docs) await adminDb.recursiveDelete(document.ref);
}
await adminDb.recursiveDelete(adminDb.collection('company_billing_accounts').doc(companyId)).catch(() => undefined);
for (const id of [...Array.from({ length: 21 }, (_, index) => `application-${index + 1}`), 'offer-a']) {
  const collection = id.startsWith('offer') ? 'job_offers' : 'job_applications';
  await adminDb.recursiveDelete(adminDb.collection(collection).doc(id)).catch(() => undefined);
}
await adminDb.recursiveDelete(adminDb.collection('company_profiles').doc(companyId)).catch(() => undefined);
await adminDb.collection('company_profiles').doc(companyId).set({ companyName: 'Entreprise test', profileStatus: 'active', createdAt: Timestamp.now() });
await Promise.all([migrateHistoricalCompany(companyId), migrateHistoricalCompany(companyId)]);
assert.equal((await adminDb.collection('company_profiles').doc(companyId).get()).get('ownerUid'), companyId);
assert.equal((await adminDb.collection('company_memberships').where('companyId', '==', companyId).get()).size, 1);
assert.equal((await adminDb.collection('company_memberships').doc(buildCompanyMembershipId(companyId, companyId)).get()).get('role'), 'owner');

const grant = { companyId, quantity: 3, type: 'admin_grant' as const, idempotencyKey: 'grant-3', actor: { uid: 'admin', type: 'seveno_admin' as const }, reason: 'test' };
await Promise.all([applyCreditMovement(grant), applyCreditMovement(grant)]);
let account = await adminDb.collection('company_billing_accounts').doc(companyId).get();
assert.equal(account.get('availableCredits'), 3);
assert.equal((await account.ref.collection('credit_ledger').get()).size, 1);

const now = Timestamp.now();
const activate = (offerId: string) => adminDb.runTransaction((transaction) => activateCampaignInTransaction(transaction, adminDb, {
  companyId, offerId, actorUid: companyId, actorMembershipRole: 'owner', now,
}));
const [sameA, sameB] = await Promise.all([activate('offer-a'), activate('offer-a')]);
assert.equal(sameA.campaignId, sameB.campaignId);
account = await adminDb.collection('company_billing_accounts').doc(companyId).get();
assert.equal(account.get('availableCredits'), 2);
assert.equal((await account.ref.collection('credit_ledger').where('type', '==', 'campaign_activation').get()).size, 1);

const campaignId = sameA.campaignId;
await adminDb.collection('job_offers').doc('offer-a').set({ companyId, companyUid: companyId, activeCampaignId: campaignId });
const qualified = (candidateUid: string) => ({
  companyId, companyUid: companyId, offerId: 'offer-a', candidateUid, status: 'submitted',
  requiredResult: { allSatisfied: true }, sevenoAssessmentSnapshot: { status: 'completed' },
  offerSnapshot: { questionnaireRequired: false }, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
});
assert.equal(isApplicationQualifiedForCampaign(qualified('candidate')), true);
assert.equal(isApplicationQualifiedForCampaign({ ...qualified('candidate'), sevenoAssessmentSnapshot: { status: 'in_progress' } }), false);
for (let index = 1; index <= 6; index += 1) await adminDb.collection('job_applications').doc(`application-${index}`).set(qualified(`candidate-${index}`));
await Promise.all(Array.from({ length: 6 }, (_, index) => admitQualifiedApplication(`application-${index + 1}`)));
let campaign = await adminDb.collection('recruitment_campaigns').doc(campaignId).get();
assert.equal(campaign.get('activeCandidateCount'), 5);
assert.equal(campaign.get('deliveredCandidateCount'), 5);
assert.equal(campaign.get('queuedCandidateCount'), 1);
assert.equal((await campaign.ref.collection('candidate_deliveries').where('status', '==', 'queued').get()).size, 1);

const released = await releaseCampaignCandidateSlot({ applicationId: 'application-1', actorUid: companyId, reason: 'company_declined' });
assert.equal(released.released, true);
assert.ok(released.promotedApplicationId);
assert.equal((await releaseCampaignCandidateSlot({ applicationId: 'application-1', actorUid: companyId, reason: 'duplicate' })).released, false);
campaign = await adminDb.collection('recruitment_campaigns').doc(campaignId).get();
assert.equal(campaign.get('activeCandidateCount'), 5);
assert.equal(campaign.get('queuedCandidateCount'), 0);
assert.equal(campaign.get('deliveredCandidateCount'), 6);

const orderRef = adminDb.collection('billing_orders').doc('pack-order');
await orderRef.set({ orderId: orderRef.id, companyId, status: 'paid', productCode: 'campaign_credit_10_launch', reason: 'test', entitlementApplied: false, createdAt: now });
await Promise.all([
  applyBillingEntitlement({ orderId: orderRef.id, companyId, actor: { uid: 'admin', type: 'seveno_admin' } }),
  applyBillingEntitlement({ orderId: orderRef.id, companyId, actor: { uid: 'admin', type: 'seveno_admin' } }),
]);
account = await adminDb.collection('company_billing_accounts').doc(companyId).get();
assert.equal(account.get('availableCredits'), 12);
assert.equal((await orderRef.get()).get('entitlementApplied'), true);

await Promise.all([
  applyAdministrativeCreditAdjustment({ companyId, quantity: -1, kind: 'correction', actorUid: 'admin', reason: 'test correction', idempotencyKey: 'correction-1' }),
  applyAdministrativeCreditAdjustment({ companyId, quantity: -1, kind: 'correction', actorUid: 'admin', reason: 'test correction', idempotencyKey: 'correction-1' }),
]);
await applyAdministrativeCreditAdjustment({ companyId, quantity: 1, kind: 'restoration', actorUid: 'admin', reason: 'test restoration', idempotencyKey: 'restoration-1' });
assert.equal((await account.ref.get()).get('availableCredits'), 12);

await campaign.ref.update({ deliveredCandidateCount: 20, activeCandidateCount: 5, queuedCandidateCount: 0 });
await adminDb.collection('job_applications').doc('application-21').set(qualified('candidate-21'));
assert.equal((await admitQualifiedApplication('application-21')).reason, 'capacity_reached');
const capacityOrder = adminDb.collection('billing_orders').doc('capacity-order');
await capacityOrder.set({ orderId: capacityOrder.id, companyId, status: 'paid', productCode: 'qualified_candidates_10_launch', campaignId, reason: 'capacity test', entitlementApplied: false, createdAt: now });
await Promise.all([
  applyBillingEntitlement({ orderId: capacityOrder.id, companyId, actor: { uid: 'admin', type: 'seveno_admin' } }),
  applyBillingEntitlement({ orderId: capacityOrder.id, companyId, actor: { uid: 'admin', type: 'seveno_admin' } }),
]);
campaign = await campaign.ref.get();
assert.equal(campaign.get('effectiveQualifiedCandidateLimit'), 30);
assert.equal((await admitQualifiedApplication('application-21')).status, 'queued');
const endBefore = campaign.get('endsAt').toMillis();
const extensionOrder = adminDb.collection('billing_orders').doc('extension-order');
await extensionOrder.set({ orderId: extensionOrder.id, companyId, status: 'paid', productCode: 'campaign_extension_30d_launch', campaignId, reason: 'extension test', entitlementApplied: false, createdAt: now });
await Promise.all([
  applyBillingEntitlement({ orderId: extensionOrder.id, companyId, actor: { uid: 'admin', type: 'seveno_admin' } }),
  applyBillingEntitlement({ orderId: extensionOrder.id, companyId, actor: { uid: 'admin', type: 'seveno_admin' } }),
]);
campaign = await campaign.ref.get();
assert.equal(campaign.get('endsAt').toMillis(), endBefore + 30 * 86400000);
assert.equal(campaign.get('effectiveQualifiedCandidateLimit'), 30);

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
});
const browserDb = testEnv.authenticatedContext(companyId, { role: 'company' }).firestore();
for (const path of [
  `company_memberships/${buildCompanyMembershipId(companyId, companyId)}`,
  `company_billing_accounts/${companyId}`,
  `company_billing_accounts/${companyId}/credit_ledger/forbidden`,
  `billing_orders/${orderRef.id}`,
  `recruitment_campaigns/${campaignId}`,
  `recruitment_campaigns/${campaignId}/candidate_deliveries/application-2`,
]) {
  await assertFails(getDoc(doc(browserDb, path)));
  await assertFails(setDoc(doc(browserDb, path), { tampered: true }));
}
await testEnv.cleanup();

console.log('Commercial foundation emulator test passed.');
