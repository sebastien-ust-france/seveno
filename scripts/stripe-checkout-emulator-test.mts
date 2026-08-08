import assert from 'node:assert/strict';

process.env.STRIPE_ENVIRONMENT = 'test';
delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type Stripe from 'stripe';

const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
await new Promise<void>((resolveConnection, reject) => { const socket = net.createConnection({ host, port: Number(port) }); socket.once('connect', () => { socket.end(); resolveConnection(); }); socket.once('error', reject); });
const { adminDb } = await import('@/lib/firebase-admin');
const { Timestamp } = await import('firebase-admin/firestore');
const { applyBillingEntitlement } = await import('@/lib/seveno-billing-server');
const { processStripeWebhookEvent } = await import('@/lib/seveno-stripe-server');
if (!adminDb) throw new Error('Firebase Admin indisponible.');

const companyId = 'stripe-company-test';
const accountRef = adminDb.collection('company_billing_accounts').doc(companyId);
await adminDb.recursiveDelete(accountRef).catch(() => undefined);
for (const collection of ['billing_orders', 'recruitment_campaigns', 'stripe_webhook_events']) {
  const snapshot = await adminDb.collection(collection).where('companyId', '==', companyId).get().catch(() => null);
  for (const document of snapshot?.docs ?? []) await adminDb.recursiveDelete(document.ref);
}
await accountRef.set({ companyId, availableCredits: 0, stripeCustomerIds: { test: 'cus_placeholder', live: null }, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
const campaignRef = adminDb.collection('recruitment_campaigns').doc('stripe-campaign-test');
const start = Timestamp.now();
await campaignRef.set({ companyId, campaignId: campaignRef.id, endsAt: Timestamp.fromMillis(start.toMillis() + 86400000), purchasedExtensionDays: 0, purchasedQualifiedCandidateCapacity: 0, effectiveQualifiedCandidateLimit: 20, createdAt: start, updatedAt: start });

for (const [id, productCode, expectedCredits] of [['pack1', 'campaign_credit_1_launch', 1], ['pack3', 'campaign_credit_3_launch', 4], ['pack10', 'campaign_credit_10_launch', 14]] as const) {
  const order = adminDb.collection('billing_orders').doc(`stripe-${id}`);
  await order.set({ orderId: order.id, companyId, provider: 'stripe', providerEnvironment: 'test', status: 'paid', productCode, entitlementApplied: false, createdAt: start });
  await Promise.all([applyBillingEntitlement({ orderId: order.id, companyId, actor: { uid: null, type: 'stripe_webhook' } }), applyBillingEntitlement({ orderId: order.id, companyId, actor: { uid: null, type: 'stripe_webhook' } })]);
  assert.equal((await accountRef.get()).get('availableCredits'), expectedCredits);
  assert.equal((await order.get()).get('entitlementApplied'), true);
}

const before = await campaignRef.get();
const beforeEnd = before.get('endsAt').toMillis();
const extension = adminDb.collection('billing_orders').doc('stripe-extension');
await extension.set({ orderId: extension.id, companyId, status: 'paid', productCode: 'campaign_extension_30d_launch', campaignId: campaignRef.id, entitlementApplied: false, createdAt: start });
await applyBillingEntitlement({ orderId: extension.id, companyId, actor: { uid: null, type: 'stripe_webhook' } });
let campaign = await campaignRef.get();
assert.equal(campaign.get('endsAt').toMillis(), beforeEnd + 30 * 86400000);
assert.equal(campaign.get('effectiveQualifiedCandidateLimit'), 20);
const capacity = adminDb.collection('billing_orders').doc('stripe-capacity');
await capacity.set({ orderId: capacity.id, companyId, status: 'paid', productCode: 'qualified_candidates_10_launch', campaignId: campaignRef.id, entitlementApplied: false, createdAt: start });
await applyBillingEntitlement({ orderId: capacity.id, companyId, actor: { uid: null, type: 'stripe_webhook' } });
campaign = await campaignRef.get();
assert.equal(campaign.get('endsAt').toMillis(), beforeEnd + 30 * 86400000);
assert.equal(campaign.get('effectiveQualifiedCandidateLimit'), 30);

const creditsBeforeIgnoredEvents = (await accountRef.get()).get('availableCredits');
const ignoredEvent = (id: string, session: Record<string, unknown>) => ({ id, object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: { id: `cs_${id}`, object: 'checkout.session', payment_status: 'paid', ...session } } }) as unknown as Stripe.Event;
await processStripeWebhookEvent(ignoredEvent('foreign-integration', { metadata: { integration: 'other' } }));
await processStripeWebhookEvent(ignoredEvent('missing-order-id', { metadata: { integration: 'seveno' } }));
await processStripeWebhookEvent(ignoredEvent('unknown-order', { client_reference_id: 'missing-order', metadata: { integration: 'seveno', orderId: 'missing-order' } }));
assert.equal((await accountRef.get()).get('availableCredits'), creditsBeforeIgnoredEvents);
for (const id of ['foreign-integration', 'missing-order-id', 'unknown-order']) assert.equal((await adminDb.collection('stripe_webhook_events').doc(id).get()).get('status'), 'ignored');

const temporaryOrder = adminDb.collection('billing_orders').doc('temporary-webhook-order');
await temporaryOrder.set({ orderId: temporaryOrder.id, companyId, provider: 'stripe', providerEnvironment: 'test', providerCheckoutSessionId: 'cs_temporary', productCode: 'campaign_credit_1_launch', status: 'pending', entitlementApplied: false, createdAt: start });
await assert.rejects(processStripeWebhookEvent(ignoredEvent('temporary-error', { id: 'cs_temporary', client_reference_id: temporaryOrder.id, metadata: { integration: 'seveno', environment: 'test', orderId: temporaryOrder.id, companyId, productCode: 'campaign_credit_1_launch' } })));
assert.equal((await temporaryOrder.get()).get('entitlementApplied'), false);
assert.equal((await adminDb.collection('stripe_webhook_events').doc('temporary-error').get()).get('status'), 'failed');

const testEnv = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8') } });
const browserDb = testEnv.authenticatedContext('billing-manager', { role: 'company' }).firestore();
for (const path of [`company_billing_accounts/${companyId}`, `billing_orders/${extension.id}`, 'stripe_webhook_events/event-placeholder']) {
  await assertFails(getDoc(doc(browserDb, path)));
  await assertFails(setDoc(doc(browserDb, path), { tampered: true }));
}
await testEnv.cleanup();
console.log('Stripe Checkout emulator test passed.');
