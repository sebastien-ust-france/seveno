import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

await new Promise<void>((resolveConnection, reject) => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  const socket = net.createConnection({ host, port: Number(port) });
  socket.once('connect', () => { socket.end(); resolveConnection(); });
  socket.once('error', reject);
});

const { adminDb } = await import('@/lib/firebase-admin');
const { Timestamp } = await import('firebase-admin/firestore');
const { buildCompanyMembershipId, requireActiveCompanyMembership } = await import('@/lib/seveno-company-memberships-server');
if (!adminDb) throw new Error('Firebase Admin indisponible.');

const ownerUid = 'company-validation-test-owner';
const companyId = ownerUid;
const membershipId = buildCompanyMembershipId(companyId, ownerUid);
const now = Timestamp.now();
const profileRef = adminDb.collection('company_profiles').doc(companyId);
const membershipRef = adminDb.collection('company_memberships').doc(membershipId);
const accountRef = adminDb.collection('company_billing_accounts').doc(companyId);
const ledgerRef = accountRef.collection('credit_ledger').doc('company-validation-ledger');
const offerRef = adminDb.collection('job_offers').doc('company-validation-offer');
const campaignRef = adminDb.collection('recruitment_campaigns').doc('company-validation-campaign');
const orderRef = adminDb.collection('billing_orders').doc('company-validation-order');

for (const reference of [profileRef, membershipRef, accountRef, offerRef, campaignRef, orderRef]) {
  await adminDb.recursiveDelete(reference).catch(() => undefined);
}
await adminDb.collection('users').doc(ownerUid).set({
  uid: ownerUid, role: 'company', authProvider: 'password', email: 'company-validation@example.test', emailVerified: true,
  onboardingCompleted: true, activeCompanyId: companyId, createdAt: now, updatedAt: now,
});
await profileRef.set({
  uid: companyId, companyId, ownerUid, companyName: 'Entreprise validation', companyType: 'SAS',
  businessSector: 'services', companySize: '10_49', headquartersArea: 'Gironde',
  recruitmentAreas: ['Gironde'], contactRole: 'Direction', profileStatus: 'active',
  verificationStatus: 'pending', createdAt: now, updatedAt: now,
});
await membershipRef.set({
  membershipId, companyId, userUid: ownerUid, role: 'owner', status: 'active',
  permissions: { canPurchaseCredits: true }, createdAt: now, updatedAt: now,
});

await assert.rejects(requireActiveCompanyMembership({ userUid: ownerUid, companyId }), /validée par Seven’O/);
assert.equal((await requireActiveCompanyMembership({ userUid: ownerUid, companyId, allowUnapproved: true })).companyId, companyId);

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') },
});
const ownerDb = testEnv.authenticatedContext(ownerUid, { role: 'company' }).firestore();
const browserProfileRef = doc(ownerDb, 'company_profiles', companyId);
await assertSucceeds(getDoc(browserProfileRef));
await assertSucceeds(updateDoc(browserProfileRef, { companyName: 'Entreprise validation modifiée', updatedAt: new Date() }));
await assertFails(updateDoc(browserProfileRef, { profileStatus: 'suspended', updatedAt: new Date() }));
await assertFails(updateDoc(browserProfileRef, { verificationStatus: 'verified', updatedAt: new Date() }));

await profileRef.update({ verificationStatus: 'rejected', updatedAt: Timestamp.now() });
assert.equal((await requireActiveCompanyMembership({ userUid: ownerUid, companyId, allowUnapproved: true })).companyId, companyId);
await assert.rejects(requireActiveCompanyMembership({ userUid: ownerUid, companyId }), /validée par Seven’O/);
await profileRef.update({ verificationStatus: 'verified', updatedAt: Timestamp.now() });
assert.equal((await requireActiveCompanyMembership({ userUid: ownerUid, companyId })).companyId, companyId);

await accountRef.set({ companyId, availableCredits: 7, createdAt: now, updatedAt: now });
await ledgerRef.set({ entryId: ledgerRef.id, companyId, delta: 7, balanceAfter: 7, createdAt: now });
await offerRef.set({ id: offerRef.id, companyId, title: 'Offre conservée', status: 'draft', createdAt: now, updatedAt: now });
await campaignRef.set({ campaignId: campaignRef.id, companyId, status: 'active', createdAt: now, updatedAt: now });
await orderRef.set({ orderId: orderRef.id, companyId, status: 'paid', createdAt: now, updatedAt: now });
const before = {
  credits: (await accountRef.get()).get('availableCredits'),
  ledger: (await ledgerRef.get()).data(),
  offer: (await offerRef.get()).data(),
  campaign: (await campaignRef.get()).data(),
  order: (await orderRef.get()).data(),
  membership: (await membershipRef.get()).data(),
};

await profileRef.update({ profileStatus: 'suspended', updatedAt: Timestamp.now() });
await assert.rejects(requireActiveCompanyMembership({ userUid: ownerUid, companyId }), /indisponible/);
assert.equal((await accountRef.get()).get('availableCredits'), before.credits);
assert.deepEqual((await ledgerRef.get()).data(), before.ledger);
assert.deepEqual((await offerRef.get()).data(), before.offer);
assert.deepEqual((await campaignRef.get()).data(), before.campaign);
assert.deepEqual((await orderRef.get()).data(), before.order);
assert.deepEqual((await membershipRef.get()).data(), before.membership);

await testEnv.cleanup();
console.log('Company validation emulator tests: OK');
