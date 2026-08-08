import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Stripe from 'stripe';

process.env.STRIPE_CHECKOUT_ENABLED = 'false';
process.env.STRIPE_ENVIRONMENT = 'test';
const stripeModule = await import('@/lib/seveno-stripe-server');
const { startStripeOrderStatusPolling } = await import('@/lib/seveno-stripe-order-polling');
const { campaignContext, campaignDateLabel, campaignStatusLabel, campaignTitle } = await import('@/lib/seveno-billing-campaign-presentation');
const { formatBillingMovementDate, formatBillingMovementVariation, getBillingMovementLabel } = await import('@/lib/seveno-billing-movement-presentation');
const { withoutStripeCheckoutReturnParameters } = await import('@/lib/seveno-checkout-return-url');
const { formatBillingPrice } = await import('@/lib/seveno-billing-price-presentation');
const { assertCheckoutRole, assertStripeConfiguration, assertStripeObjectEnvironment, assertStripeProviderEnvironment, assertStripeTestConfiguration, buildCheckoutIdempotencyKey, validateCheckoutRequest, validateStripePrice } = stripeModule;

function expectCode(action: () => unknown, code: string) {
  assert.throws(action, (error: unknown) => error instanceof stripeModule.SevenoStripeError && error.code === code);
}

expectCode(assertStripeTestConfiguration, 'stripe_checkout_disabled');
process.env.STRIPE_CHECKOUT_ENABLED = 'true';
delete process.env.STRIPE_SECRET_KEY;
expectCode(assertStripeTestConfiguration, 'stripe_configuration_missing');
process.env.STRIPE_ENVIRONMENT = 'live';
const fakePriceId = ['price', 'placeholder'].join('_');
const priceBases = ['STRIPE_PRICE_CAMPAIGN_CREDIT_1', 'STRIPE_PRICE_CAMPAIGN_CREDIT_3', 'STRIPE_PRICE_CAMPAIGN_CREDIT_10', 'STRIPE_PRICE_CAMPAIGN_EXTENSION_30D', 'STRIPE_PRICE_QUALIFIED_CANDIDATES_10'];
for (const suffix of ['TEST', 'LIVE']) for (const name of priceBases) process.env[`${name}_${suffix}`] = fakePriceId;
process.env.STRIPE_SECRET_KEY = `${['sk', 'test'].join('_')}_placeholder`;
expectCode(assertStripeConfiguration, 'stripe_key_environment_mismatch');
process.env.STRIPE_ENVIRONMENT = 'test';
process.env.STRIPE_SECRET_KEY = `${['sk', 'live'].join('_')}_placeholder`;
expectCode(assertStripeConfiguration, 'stripe_key_environment_mismatch');
process.env.STRIPE_ENVIRONMENT = 'staging';
expectCode(assertStripeConfiguration, 'stripe_environment_invalid');
process.env.STRIPE_ENVIRONMENT = 'test';
process.env.STRIPE_SECRET_KEY = `${['sk', 'test'].join('_')}_placeholder`;
assert.doesNotThrow(assertStripeTestConfiguration);
process.env.STRIPE_ENVIRONMENT = 'live';
process.env.STRIPE_SECRET_KEY = `${['sk', 'live'].join('_')}_placeholder`;
assert.doesNotThrow(assertStripeConfiguration);
expectCode(assertStripeTestConfiguration, 'stripe_test_environment_required');
process.env.STRIPE_ENVIRONMENT = 'test';
process.env.STRIPE_SECRET_KEY = `${['sk', 'test'].join('_')}_placeholder`;
expectCode(() => assertStripeObjectEnvironment(true), 'stripe_object_environment_mismatch');
expectCode(() => assertStripeProviderEnvironment('live', 'test', 'commande Stripe'), 'stripe_provider_environment_mismatch');
expectCode(() => assertStripeProviderEnvironment('test', 'live', 'commande Stripe'), 'stripe_provider_environment_mismatch');
expectCode(() => assertStripeProviderEnvironment('live', 'test', 'client Stripe'), 'stripe_provider_environment_mismatch');
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.SEVENO_PUBLIC_ORIGIN;
assert.doesNotThrow(() => stripeModule.getStripeCatalogAuditConfig());
expectCode(() => stripeModule.getStripeWebhookConfig(), 'stripe_configuration_missing');
expectCode(() => stripeModule.getStripeCheckoutConfig(), 'stripe_configuration_missing');
process.env.SEVENO_PUBLIC_ORIGIN = 'invalid-origin';
expectCode(() => stripeModule.getStripeCheckoutConfig(), 'stripe_checkout_origin_invalid');
process.env.SEVENO_PUBLIC_ORIGIN = 'http://localhost:3102';
assert.doesNotThrow(() => stripeModule.getStripeCheckoutConfig());
process.env.STRIPE_WEBHOOK_SECRET = 'local-placeholder-secret';
assert.doesNotThrow(() => stripeModule.getStripeWebhookConfig());
const webhookPayload = JSON.stringify({ id: 'evt_placeholder', object: 'event', type: 'unhandled.test', livemode: false, data: { object: {} } });
const webhookHeader = Stripe.webhooks.generateTestHeaderString({ payload: webhookPayload, secret: process.env.STRIPE_WEBHOOK_SECRET });
assert.equal(stripeModule.constructStripeWebhookEvent(webhookPayload, webhookHeader).id, 'evt_placeholder');
assert.throws(() => stripeModule.constructStripeWebhookEvent(webhookPayload, 'invalid-signature'));

async function flushPolling() { await Promise.resolve(); await Promise.resolve(); }
function pendingOrder() { return { orderId: 'masked-order', status: 'pending', entitlementApplied: false, productCode: 'campaign_credit_1_launch', campaignId: null }; }
const queuedTimers: Array<() => void> = [];
let pollingReads = 0;
let activeReads = 0;
let maximumActiveReads = 0;
startStripeOrderStatusPolling({
  readStatus: async () => { pollingReads += 1; activeReads += 1; maximumActiveReads = Math.max(maximumActiveReads, activeReads); await Promise.resolve(); activeReads -= 1; return pendingOrder(); },
  onConfirmed: () => undefined,
  onPending: () => undefined,
  onTerminal: () => undefined,
  maxAttempts: 5,
  delayMs: 2000,
  setTimer: (callback) => { queuedTimers.push(callback); return {} as ReturnType<typeof setTimeout>; },
  clearTimer: () => undefined,
});
await flushPolling();
while (queuedTimers.length > 0) { queuedTimers.shift()?.(); await flushPolling(); }
assert.equal(pollingReads, 5);
assert.equal(maximumActiveReads, 1);

let confirmedCalls = 0;
startStripeOrderStatusPolling({ readStatus: async () => ({ ...pendingOrder(), status: 'paid', entitlementApplied: true }), onConfirmed: () => { confirmedCalls += 1; }, onPending: () => undefined, onTerminal: () => undefined, setTimer: () => ({} as ReturnType<typeof setTimeout>), clearTimer: () => undefined });
await flushPolling();
assert.equal(confirmedCalls, 1);

let terminalCalls = 0;
startStripeOrderStatusPolling({ readStatus: async () => ({ ...pendingOrder(), status: 'failed' }), onConfirmed: () => undefined, onPending: () => undefined, onTerminal: () => { terminalCalls += 1; }, setTimer: () => ({} as ReturnType<typeof setTimeout>), clearTimer: () => undefined });
await flushPolling();
assert.equal(terminalCalls, 1);

let oldRequestAborted = false;
const oldPolling = startStripeOrderStatusPolling({
  readStatus: (signal) => new Promise((_, reject) => signal.addEventListener('abort', () => { oldRequestAborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true })),
  onConfirmed: () => undefined, onPending: () => undefined, onTerminal: () => undefined,
});
oldPolling.stop();
await flushPolling();
assert.equal(oldRequestAborted, true);
let replacementReads = 0;
startStripeOrderStatusPolling({ readStatus: async () => { replacementReads += 1; return { ...pendingOrder(), status: 'cancelled' }; }, onConfirmed: () => undefined, onPending: () => undefined, onTerminal: () => undefined });
await flushPolling();
assert.equal(replacementReads, 1);
const syntheticSession = (metadata: Record<string, string> | null = null) => ({
  id: 'cs_placeholder', object: 'checkout.session', client_reference_id: null, metadata, payment_status: 'paid',
});
for (const [id, session] of [
  ['evt_synthetic', syntheticSession()],
  ['evt_foreign', syntheticSession({ integration: 'another_integration' })],
  ['evt_missing_order', syntheticSession({ integration: 'seveno' })],
] as const) {
  await assert.doesNotReject(stripeModule.processStripeWebhookEvent({ id, object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: session } } as unknown as Stripe.Event));
}
await assert.rejects(
  stripeModule.processStripeWebhookEvent({ id: 'evt_live_for_test_order', object: 'event', type: 'unhandled.test', livemode: true, data: { object: {} } } as unknown as Stripe.Event),
  (error: unknown) => error instanceof stripeModule.SevenoStripeError && error.code === 'stripe_object_environment_mismatch',
);
process.env.STRIPE_ENVIRONMENT = 'live';
await assert.rejects(
  stripeModule.processStripeWebhookEvent({ id: 'evt_test_for_live_order', object: 'event', type: 'unhandled.test', livemode: false, data: { object: {} } } as unknown as Stripe.Event),
  (error: unknown) => error instanceof stripeModule.SevenoStripeError && error.code === 'stripe_object_environment_mismatch',
);
process.env.STRIPE_ENVIRONMENT = 'test';
const signedSyntheticPayload = JSON.stringify({ id: 'evt_signed_synthetic', object: 'event', type: 'checkout.session.completed', livemode: false, data: { object: syntheticSession() } });
const signedSyntheticHeader = Stripe.webhooks.generateTestHeaderString({ payload: signedSyntheticPayload, secret: process.env.STRIPE_WEBHOOK_SECRET });
const signedSyntheticEvent = stripeModule.constructStripeWebhookEvent(signedSyntheticPayload, signedSyntheticHeader);
await assert.doesNotReject(stripeModule.processStripeWebhookEvent(signedSyntheticEvent));

for (const role of ['owner', 'admin', 'billing_manager'] as const) assert.doesNotThrow(() => assertCheckoutRole(role));
for (const role of ['recruiter', 'viewer'] as const) expectCode(() => assertCheckoutRole(role), 'checkout_forbidden');

const requestId = 'request_1234567890abcdef';
assert.deepEqual(validateCheckoutRequest({ productCode: 'campaign_credit_1_launch', requestId }), { productCode: 'campaign_credit_1_launch', requestId, campaignId: undefined });
expectCode(() => validateCheckoutRequest({ productCode: 'campaign_credit_1_launch', campaignId: 'campaign', requestId }), 'campaign_not_allowed');
expectCode(() => validateCheckoutRequest({ productCode: 'campaign_extension_30d_launch', requestId }), 'campaign_required');
expectCode(() => validateCheckoutRequest({ productCode: 'qualified_candidates_10_launch', requestId }), 'campaign_required');
expectCode(() => validateCheckoutRequest({ productCode: 'campaign_credit_1_launch', requestId: 'short' }), 'invalid_request_id');
assert.equal(
  buildCheckoutIdempotencyKey({ companyId: 'company', productCode: 'campaign_credit_1_launch', requestId }),
  buildCheckoutIdempotencyKey({ companyId: 'company', productCode: 'campaign_credit_1_launch', requestId }),
);

function fakeStripe(price: Partial<Stripe.Price>) {
  return { prices: { retrieve: async () => price } } as unknown as Stripe;
}
const product = { id: 'prod_placeholder', object: 'product', active: true, deleted: false, livemode: false } as unknown as Stripe.Product;
const validPrice = { id: fakePriceId, active: true, livemode: false, currency: 'eur', type: 'one_time', billing_scheme: 'per_unit', unit_amount: 39000, tax_behavior: 'exclusive', product } as unknown as Stripe.Price;
await assert.doesNotReject(validateStripePrice(fakeStripe(validPrice), 'campaign_credit_1_launch', fakePriceId));
assert.doesNotThrow(() => stripeModule.validateStripePriceForCatalogAudit({ ...validPrice, tax_behavior: 'unspecified' }, 'campaign_credit_1_launch'));
assert.deepEqual(Object.fromEntries((['campaign_credit_1_launch', 'campaign_credit_3_launch', 'campaign_credit_10_launch', 'campaign_extension_30d_launch', 'qualified_candidates_10_launch'] as const).map((code) => [code, stripeModule.getCatalogAmountExcludingTax(code)])), {
  campaign_credit_1_launch: 39000,
  campaign_credit_3_launch: 99000,
  campaign_credit_10_launch: 299000,
  campaign_extension_30d_launch: 9000,
  qualified_candidates_10_launch: 19000,
});
for (const invalid of [
  { ...validPrice, livemode: true }, { ...validPrice, unit_amount: 1 }, { ...validPrice, currency: 'usd' },
  { ...validPrice, type: 'recurring' }, { ...validPrice, billing_scheme: 'tiered' }, { ...validPrice, tax_behavior: 'inclusive' }, { ...validPrice, tax_behavior: 'unspecified' },
] as Stripe.Price[]) await assert.rejects(validateStripePrice(fakeStripe(invalid), 'campaign_credit_1_launch', fakePriceId));
process.env.STRIPE_ENVIRONMENT = 'live';
await assert.rejects(validateStripePrice(fakeStripe(validPrice), 'campaign_credit_1_launch', fakePriceId));
process.env.STRIPE_ENVIRONMENT = 'test';

const offerPresentation = { title: 'Responsable logistique', jobRoleLabel: 'Responsable supply chain', location: 'Bordeaux', workMode: 'onsite', contractType: 'permanent' } as const;
assert.equal(campaignTitle(offerPresentation), 'Responsable logistique');
assert.equal(campaignTitle({ ...offerPresentation, title: '' }), 'Responsable supply chain');
assert.equal(campaignTitle({ ...offerPresentation, title: '', jobRoleLabel: '' }), 'Campagne de recrutement');
assert.equal(campaignContext(offerPresentation), 'Bordeaux \u00b7 Sur site \u00b7 CDI');
assert.equal(campaignStatusLabel('draft'), 'Brouillon');
assert.equal(campaignStatusLabel('published'), 'Active');
assert.equal(campaignStatusLabel('paused'), 'En pause');
assert.equal(campaignStatusLabel('closed'), 'Cl\u00f4tur\u00e9e');
assert.equal(campaignStatusLabel('archived'), 'Archiv\u00e9e');
assert.equal(campaignDateLabel('paused', '2026-11-03T12:00:00.000Z'), 'Campagne en pause \u00b7 fin pr\u00e9vue le 3 novembre 2026');
assert.equal(campaignDateLabel('active', '2026-11-03T12:00:00.000Z'), 'Campagne active jusqu\u2019au 3 novembre 2026');
assert.equal(campaignDateLabel('closed', '2026-11-03T12:00:00.000Z'), 'Campagne cl\u00f4tur\u00e9e le 3 novembre 2026');
assert.deepEqual(Object.fromEntries(['purchase', 'campaign_activation', 'admin_grant', 'admin_correction', 'admin_restoration'].map((code) => [code, getBillingMovementLabel(code)])), {
  purchase: 'Achat d\u2019un cr\u00e9dit', campaign_activation: 'Activation d\u2019une campagne',
  admin_grant: 'Attribution administrative', admin_correction: 'Correction administrative',
  admin_restoration: 'R\u00e9tablissement administratif',
});
assert.equal(getBillingMovementLabel('unknown_internal_code'), 'Ajustement du compte');
assert.equal(formatBillingMovementVariation(3), '+3');
assert.equal(formatBillingMovementVariation(-1), '\u22121');
assert.equal(formatBillingMovementVariation(0), '0');
assert.equal(formatBillingMovementDate('2026-08-06T15:31:00.000Z'), '6 ao\u00fbt 2026');
assert.equal(withoutStripeCheckoutReturnParameters('/entreprise/facturation', '?checkout=success&orderId=order&session_id=session'), '/entreprise/facturation');
assert.equal(withoutStripeCheckoutReturnParameters('/entreprise/facturation', '?tab=history&checkout=success&orderId=order&session_id=session'), '/entreprise/facturation?tab=history');
assert.equal(formatBillingPrice(39000), '390\u00a0\u20ac');
assert.equal(formatBillingPrice(99000), '990\u00a0\u20ac');
assert.equal(formatBillingPrice(299000), '2\u202f990\u00a0\u20ac');
const orderedEntries = [{ id: 'newest', balance: 3 }, { id: 'oldest', balance: 2 }];
assert.deepEqual(orderedEntries.map((entry) => ({ ...entry, label: getBillingMovementLabel('purchase') })).map((entry) => [entry.id, entry.balance]), [['newest', 3], ['oldest', 2]]);

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const checkoutRoute = read('app/api/seveno/billing/checkout/route.ts');
const webhookRoute = read('app/api/seveno/billing/stripe/webhook/route.ts');
const statusRoute = read('app/api/seveno/billing/orders/[orderId]/route.ts');
const stripeServer = read('lib/seveno-stripe-server.ts');
const billingUi = read('app/entreprise/facturation/page.tsx');
assert.match(checkoutRoute, /allowedRoles: \['owner', 'admin', 'billing_manager'\]/);
assert.match(webhookRoute, /request\.text\(\)/);
assert.match(webhookRoute, /stripe-signature/);
assert.match(webhookRoute, /console\.error\('\[seveno-stripe-webhook\]'/);
assert.match(statusRoute, /getCompanyOrderStatus/);
assert.match(billingUi, /md:hidden/);
assert.match(billingUi, /overflow-x-auto md:block/);
assert.match(billingUi, /aria-label=\{`Variation de/);
assert.match(billingUi, /Solde apr\\u00e8s mouvement/);
assert.match(billingUi, /router\.replace\(withoutStripeCheckoutReturnParameters/);
assert.match(billingUi, /setTimeout\(\(\) => setCheckoutMessage\(null\), 6000\)/);
assert.match(billingUi, />Fermer<\/button>/);
assert.match(billingUi, /polledCheckoutOrderRef\.current === orderId/);
assert.match(billingUi, /G&eacute;rez vos cr&eacute;dits de recrutement/);
assert.match(stripeServer, /automatic_tax: \{ enabled: true \}/);
assert.match(stripeServer, /tax_id_collection: \{ enabled: true \}/);
assert.match(stripeServer, /invoice_creation: \{ enabled: true/);
assert.match(stripeServer, /applyBillingEntitlement/);
assert.match(stripeServer, /stripe_checkout_session:\$\{environment\}:/);
assert.doesNotMatch(stripeServer, /console\.(?:log|info|warn|error)/);
assert.match(billingUi, /Paiement sécurisé par Stripe/);
assert.match(billingUi, /Achat réservé aux responsables de l’entreprise et de la facturation\./);

console.log('Stripe Checkout smoke test passed.');
