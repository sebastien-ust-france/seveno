import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import {
  applyBillingEntitlement,
  LAUNCH_BILLING_PRODUCTS,
  LAUNCH_CATALOG_VERSION,
  SevenoBillingError,
} from '@/lib/seveno-billing-server';
import type { BillingProductCode, CompanyMembershipRole } from '@/types/seveno-billing';

const CHECKOUT_ROLES: readonly CompanyMembershipRole[] = ['owner', 'admin', 'billing_manager'];
export type StripeEnvironment = 'test' | 'live';
const PRODUCT_PRICE_ENV_BASE: Record<BillingProductCode, string> = {
  campaign_credit_1_launch: 'STRIPE_PRICE_CAMPAIGN_CREDIT_1',
  campaign_credit_3_launch: 'STRIPE_PRICE_CAMPAIGN_CREDIT_3',
  campaign_credit_10_launch: 'STRIPE_PRICE_CAMPAIGN_CREDIT_10',
  campaign_extension_30d_launch: 'STRIPE_PRICE_CAMPAIGN_EXTENSION_30D',
  qualified_candidates_10_launch: 'STRIPE_PRICE_QUALIFIED_CANDIDATES_10',
};

function priceEnvironmentName(code: BillingProductCode, environment: StripeEnvironment) {
  return `${PRODUCT_PRICE_ENV_BASE[code]}_${environment.toUpperCase()}`;
}

type StripeCatalogAuditConfig = { stripe: Stripe; priceIds: Record<BillingProductCode, string>; environment: StripeEnvironment; livemode: boolean };
type StripeCheckoutConfig = StripeCatalogAuditConfig & { publicOrigin: string };
type StripeWebhookConfig = StripeCatalogAuditConfig & { webhookSecret: string };
type CheckoutInput = { companyId: string; actorUid: string; actorEmail?: string; actorRole: CompanyMembershipRole; companyProfile: Record<string, unknown>; productCode: BillingProductCode; campaignId?: string; requestId: string };

export class SevenoStripeError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code = code; this.status = status; }
}

function firestore() {
  if (!isFirebaseAdminConfigured || !adminDb) throw new SevenoStripeError('firebase_admin_missing', 500, 'Firebase Admin est indisponible.');
  return adminDb;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new SevenoStripeError('stripe_configuration_missing', 503, `La configuration Stripe est incomplète (${name}).`);
  return value;
}

export function isStripeCheckoutEnabled() { return process.env.STRIPE_CHECKOUT_ENABLED === 'true'; }
export function getStripeEnvironment(): StripeEnvironment {
  const value = process.env.STRIPE_ENVIRONMENT?.trim();
  if (value !== 'test' && value !== 'live') throw new SevenoStripeError('stripe_environment_invalid', 503, 'STRIPE_ENVIRONMENT doit valoir test ou live.');
  return value;
}

function expectedLivemode(environment: StripeEnvironment) { return environment === 'live'; }

export function assertStripeObjectEnvironment(livemode: boolean, environment = getStripeEnvironment(), objectName = 'objet Stripe') {
  if (livemode !== expectedLivemode(environment)) {
    throw new SevenoStripeError('stripe_object_environment_mismatch', 409, `L’environnement de ${objectName} ne correspond pas à STRIPE_ENVIRONMENT.`);
  }
}

export function assertStripeProviderEnvironment(value: unknown, environment = getStripeEnvironment(), objectName = 'donnée Stripe') {
  if (value !== environment) {
    throw new SevenoStripeError('stripe_provider_environment_mismatch', 409, `L’environnement de ${objectName} ne correspond pas à STRIPE_ENVIRONMENT.`);
  }
}

export function isStripeCheckoutReady() {
  try {
    assertStripeConfiguration();
    return Boolean(process.env.SEVENO_PUBLIC_ORIGIN?.trim());
  } catch {
    return false;
  }
}

export function assertStripeConfiguration() {
  if (!isStripeCheckoutEnabled()) throw new SevenoStripeError('stripe_checkout_disabled', 503, 'Le paiement Stripe est désactivé.');
  const environment = getStripeEnvironment();
  const secretKey = requiredEnvironment('STRIPE_SECRET_KEY');
  const requiredPrefix = environment === 'live' ? 'sk_live_' : 'sk_test_';
  if (!secretKey.startsWith(requiredPrefix)) throw new SevenoStripeError('stripe_key_environment_mismatch', 503, 'La clé Stripe ne correspond pas à STRIPE_ENVIRONMENT.');
  const priceIds = Object.fromEntries((Object.keys(PRODUCT_PRICE_ENV_BASE) as BillingProductCode[]).map((code) => [code, requiredEnvironment(priceEnvironmentName(code, environment))])) as Record<BillingProductCode, string>;
  return { secretKey, priceIds, environment, livemode: expectedLivemode(environment) };
}

export function assertStripeTestConfiguration() {
  const config = assertStripeConfiguration();
  if (config.environment !== 'test') throw new SevenoStripeError('stripe_test_environment_required', 503, 'Cette opération de maintenance est réservée à Stripe test.');
  return config;
}

let cachedCatalogAuditConfig: StripeCatalogAuditConfig | null = null;
let cachedCatalogSignature = '';
export function getStripeCatalogAuditConfig(): StripeCatalogAuditConfig {
  const config = assertStripeConfiguration();
  const signature = `${config.environment}:${config.secretKey}:${Object.values(config.priceIds).join(':')}`;
  if (!cachedCatalogAuditConfig || cachedCatalogSignature !== signature) {
    cachedCatalogAuditConfig = { stripe: new Stripe(config.secretKey), priceIds: config.priceIds, environment: config.environment, livemode: config.livemode };
    cachedCatalogSignature = signature;
  }
  return cachedCatalogAuditConfig;
}

let cachedCheckoutConfig: StripeCheckoutConfig | null = null;
let cachedCheckoutSignature = '';
export function getStripeCheckoutConfig(): StripeCheckoutConfig {
  const catalog = getStripeCatalogAuditConfig();
  const publicOrigin = requiredEnvironment('SEVENO_PUBLIC_ORIGIN');
  if (!/^https?:\/\//.test(publicOrigin)) throw new SevenoStripeError('stripe_checkout_origin_invalid', 503, 'L’origine publique de Checkout est invalide.');
  const signature = `${catalog.environment}:${publicOrigin}`;
  if (!cachedCheckoutConfig || cachedCheckoutSignature !== signature) { cachedCheckoutConfig = { ...catalog, publicOrigin }; cachedCheckoutSignature = signature; }
  return cachedCheckoutConfig;
}

let cachedWebhookConfig: StripeWebhookConfig | null = null;
let cachedWebhookSignature = '';
export function getStripeWebhookConfig(): StripeWebhookConfig {
  const catalog = getStripeCatalogAuditConfig();
  const webhookSecret = requiredEnvironment('STRIPE_WEBHOOK_SECRET');
  const signature = `${catalog.environment}:${webhookSecret}`;
  if (!cachedWebhookConfig || cachedWebhookSignature !== signature) { cachedWebhookConfig = { ...catalog, webhookSecret }; cachedWebhookSignature = signature; }
  return cachedWebhookConfig;
}

export function validateCheckoutRequest(body: unknown) {
  if (!body || typeof body !== 'object') throw new SevenoStripeError('invalid_checkout_body', 422, 'Corps de requête invalide.');
  const value = body as Record<string, unknown>;
  const productCode = typeof value.productCode === 'string' ? value.productCode : '';
  if (!(productCode in LAUNCH_BILLING_PRODUCTS)) throw new SevenoStripeError('invalid_product', 422, 'Produit invalide.');
  const requestId = typeof value.requestId === 'string' ? value.requestId.trim() : '';
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(requestId)) throw new SevenoStripeError('invalid_request_id', 422, 'Identifiant de tentative invalide.');
  const campaignId = typeof value.campaignId === 'string' ? value.campaignId.trim() : undefined;
  if (campaignId && !/^[A-Za-z0-9_-]{1,128}$/.test(campaignId)) throw new SevenoStripeError('invalid_campaign_id', 422, 'Campagne invalide.');
  const product = LAUNCH_BILLING_PRODUCTS[productCode as BillingProductCode];
  if (product.type === 'credit_pack' && campaignId) throw new SevenoStripeError('campaign_not_allowed', 409, 'Ce produit ne peut pas être acheté pour cette campagne.');
  if (product.type !== 'credit_pack' && !campaignId) throw new SevenoStripeError('campaign_required', 409, 'Ce produit ne peut pas être acheté pour cette campagne.');
  return { productCode: productCode as BillingProductCode, requestId, campaignId };
}

export function assertCheckoutRole(role: CompanyMembershipRole) {
  if (!CHECKOUT_ROLES.includes(role)) throw new SevenoStripeError('checkout_forbidden', 403, 'Vous n’êtes pas autorisé à effectuer cet achat.');
}

export function buildCheckoutIdempotencyKey(input: { companyId: string; productCode: BillingProductCode; campaignId?: string; requestId: string }) {
  return `stripe_checkout:${getStripeEnvironment()}:${input.companyId}:${input.productCode}:${input.campaignId ?? 'none'}:${input.requestId}`;
}

function stableDocumentId(value: string) { return createHash('sha256').update(value).digest('hex').slice(0, 40); }
function stripeId(value: unknown) { return typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : null; }

export function getCatalogAmountExcludingTax(productCode: BillingProductCode) {
  const product = LAUNCH_BILLING_PRODUCTS[productCode] as { amountExcludingTax?: unknown; unitAmountExcludingTax?: unknown };
  const amount = typeof product.amountExcludingTax === 'number' ? product.amountExcludingTax : product.unitAmountExcludingTax;
  if (!Number.isSafeInteger(amount) || Number(amount) <= 0) throw new SevenoStripeError('invalid_catalog_amount', 500, `Le montant du catalogue associé à ${productCode} est invalide.`);
  return Number(amount);
}

function assertStripePriceGeneralProperties(price: Stripe.Price, expectedAmount: number, productCode: BillingProductCode, environment: StripeEnvironment, options: { allowInactive?: boolean } = {}) {
  assertStripeObjectEnvironment(price.livemode, environment, `tarif ${productCode}`);
  if (!price.active && !options.allowInactive) throw new SevenoStripeError('inactive_price', 503, `Le tarif Stripe associé à ${productCode} est inactif.`);
  if (price.currency !== 'eur') throw new SevenoStripeError('invalid_currency', 503, `La devise du tarif Stripe associé à ${productCode} est invalide.`);
  if (price.type !== 'one_time') throw new SevenoStripeError('invalid_price_type', 503, `Le type du tarif Stripe associé à ${productCode} est invalide.`);
  if (price.billing_scheme !== 'per_unit') throw new SevenoStripeError('invalid_billing_scheme', 503, `Le mode de facturation Stripe associé à ${productCode} est invalide.`);
  if (price.unit_amount !== expectedAmount) throw new SevenoStripeError('invalid_amount', 503, `Le montant du tarif Stripe associé à ${productCode} est invalide.`);
}

export function validateStripePriceForCatalogAudit(price: Stripe.Price, productCode: BillingProductCode) {
  assertStripePriceGeneralProperties(price, getCatalogAmountExcludingTax(productCode), productCode, getStripeEnvironment());
  return price;
}

export async function validateStripePrice(stripe: Stripe, productCode: BillingProductCode, priceId: string) {
  const environment = getStripeEnvironment();
  const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  assertStripePriceGeneralProperties(price, getCatalogAmountExcludingTax(productCode), productCode, environment);
  if (price.tax_behavior !== 'exclusive') throw new SevenoStripeError('invalid_tax_behavior', 503, `Le comportement fiscal du tarif Stripe associé à ${productCode} est invalide.`);
  const product = price.product;
  if (typeof product === 'string' || product.deleted || !product.active || product.livemode !== expectedLivemode(environment)) throw new SevenoStripeError('stripe_product_invalid', 503, `Le produit Stripe associé à ${productCode} est invalide.`);
  return price;
}

export async function validateAllStripePrices() {
  const config = getStripeCatalogAuditConfig();
  return Promise.all((Object.keys(PRODUCT_PRICE_ENV_BASE) as BillingProductCode[]).map((code) => validateStripePrice(config.stripe, code, config.priceIds[code])));
}

export async function reconcileStripeTestCatalog(options: { onPriceReplaced?: (result: { productCode: BillingProductCode; previousPriceId: string; effectivePriceId: string }) => void | Promise<void> } = {}) {
  assertStripeTestConfiguration();
  const config = getStripeCatalogAuditConfig();
  const results: Array<{ productCode: BillingProductCode; previousPriceId: string; effectivePriceId: string; priceReplaced: boolean; taxCodeApplied: boolean }> = [];
  for (const productCode of Object.keys(PRODUCT_PRICE_ENV_BASE) as BillingProductCode[]) {
    const expectedAmount = getCatalogAmountExcludingTax(productCode);
    const previousPriceId = config.priceIds[productCode];
    const price = await config.stripe.prices.retrieve(previousPriceId, { expand: ['product'] });
    assertStripePriceGeneralProperties(price, expectedAmount, productCode, config.environment, { allowInactive: true });
    const product = price.product;
    if (typeof product === 'string' || product.deleted || product.livemode !== config.livemode || !product.active) throw new SevenoStripeError('stripe_product_invalid', 503, `Le produit Stripe de test associé à ${productCode} est invalide.`);
    const currentTaxCode = typeof product.tax_code === 'string' ? product.tax_code : product.tax_code?.id ?? null;
    if (currentTaxCode && currentTaxCode !== 'txcd_10103001') throw new SevenoStripeError('stripe_tax_code_conflict', 409, `Le produit Stripe de test associé à ${productCode} possède déjà un autre code fiscal.`);
    let taxCodeApplied = false;
    if (!currentTaxCode) { await config.stripe.products.update(product.id, { tax_code: 'txcd_10103001' }); taxCodeApplied = true; }
    let effectivePriceId = previousPriceId;
    let priceReplaced = false;
    if (!price.active) {
      const defaultPriceId = stripeId(product.default_price);
      if (!defaultPriceId || defaultPriceId === previousPriceId) throw new SevenoStripeError('inactive_price', 503, `Le tarif Stripe associé à ${productCode} est inactif.`);
      const defaultPrice = await config.stripe.prices.retrieve(defaultPriceId);
      assertStripePriceGeneralProperties(defaultPrice, expectedAmount, productCode, config.environment);
      if (defaultPrice.tax_behavior !== 'exclusive') throw new SevenoStripeError('invalid_tax_behavior', 503, `Le comportement fiscal du tarif Stripe associé à ${productCode} est invalide.`);
      effectivePriceId = defaultPrice.id;
      priceReplaced = true;
      await options.onPriceReplaced?.({ productCode, previousPriceId, effectivePriceId });
      results.push({ productCode, previousPriceId, effectivePriceId, priceReplaced, taxCodeApplied });
      continue;
    }
    if (price.tax_behavior !== 'exclusive') {
      const replacement = await config.stripe.prices.create({ product: product.id, currency: 'eur', unit_amount: expectedAmount, tax_behavior: 'exclusive' }, { idempotencyKey: `stripe_${['price', 'exclusive'].join(':')}:test:${productCode}:${expectedAmount}` });
      assertStripeObjectEnvironment(replacement.livemode, config.environment, 'tarif de remplacement');
      await config.stripe.products.update(product.id, { default_price: replacement.id });
      await config.stripe.prices.update(previousPriceId, { active: false });
      effectivePriceId = replacement.id;
      priceReplaced = true;
      await options.onPriceReplaced?.({ productCode, previousPriceId, effectivePriceId });
    }
    results.push({ productCode, previousPriceId, effectivePriceId, priceReplaced, taxCodeApplied });
  }
  return results;
}

async function validateCampaign(companyId: string, campaignId: string | undefined) {
  if (!campaignId) return;
  const snapshot = await firestore().collection('recruitment_campaigns').doc(campaignId).get();
  if (!snapshot.exists) throw new SevenoStripeError('campaign_not_found', 404, 'Campagne introuvable.');
  if (snapshot.get('companyId') !== companyId) throw new SevenoStripeError('campaign_forbidden', 403, 'Vous n’êtes pas autorisé à effectuer cet achat.');
  if (snapshot.get('status') === 'closed') throw new SevenoStripeError('campaign_incompatible', 409, 'Ce produit ne peut pas être acheté pour cette campagne.');
}

export async function getOrCreateStripeCustomer(input: Pick<CheckoutInput, 'companyId' | 'actorUid' | 'actorEmail' | 'companyProfile'>, stripe = getStripeCheckoutConfig().stripe) {
  const db = firestore();
  const environment = getStripeEnvironment();
  const customerField = `stripeCustomerIds.${environment}`;
  const accountRef = db.collection('company_billing_accounts').doc(input.companyId);
  const existing = await accountRef.get();
  const existingId = existing.get(customerField);
  if (typeof existingId === 'string' && existingId) {
    const customer = await stripe.customers.retrieve(existingId);
    if (customer.deleted || customer.livemode !== expectedLivemode(environment) || customer.metadata.companyId !== input.companyId) throw new SevenoStripeError('stripe_customer_invalid', 409, 'Le client Stripe est incohérent avec l’environnement actif.');
    assertStripeProviderEnvironment(customer.metadata.environment, environment, 'client Stripe');
    return customer.id;
  }
  const companyName = String(input.companyProfile.companyName ?? input.companyProfile.legalName ?? '').trim();
  const billingEmail = String(input.companyProfile.billingEmail ?? '').trim() || input.actorEmail;
  const customer = await stripe.customers.create({
    ...(companyName ? { name: companyName } : {}), ...(billingEmail ? { email: billingEmail } : {}),
    metadata: { companyId: input.companyId, environment },
  }, { idempotencyKey: `stripe_customer:${environment}:${input.companyId}` });
  assertStripeObjectEnvironment(customer.livemode, environment, 'client Stripe');
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(accountRef);
    const concurrentId = current.get(customerField);
    transaction.set(accountRef, {
      companyId: input.companyId,
      stripeCustomerIds: { ...(current.get('stripeCustomerIds') ?? {}), [environment]: typeof concurrentId === 'string' && concurrentId ? concurrentId : customer.id },
      updatedAt: Timestamp.now(),
    }, { merge: true });
  });
  const saved = await accountRef.get();
  return String(saved.get(customerField));
}

export async function createStripeCheckout(input: CheckoutInput) {
  assertCheckoutRole(input.actorRole);
  const config = getStripeCheckoutConfig();
  const environment = config.environment;
  const product = LAUNCH_BILLING_PRODUCTS[input.productCode];
  await validateCampaign(input.companyId, input.campaignId);
  await validateStripePrice(config.stripe, input.productCode, config.priceIds[input.productCode]);
  const customerId = await getOrCreateStripeCustomer(input, config.stripe);
  const idempotencyKey = buildCheckoutIdempotencyKey(input);
  const orderId = stableDocumentId(idempotencyKey);
  const orderRef = firestore().collection('billing_orders').doc(orderId);
  const now = Timestamp.now();
  await orderRef.create({
    orderId, companyId: input.companyId, createdByUid: input.actorUid, productCode: input.productCode, catalogVersion: LAUNCH_CATALOG_VERSION,
    status: 'pending', provider: 'stripe', providerEnvironment: environment, unitAmountExcludingTax: product.unitAmountExcludingTax, currency: 'eur',
    ...(input.campaignId ? { campaignId: input.campaignId } : {}), providerCustomerId: customerId, providerCheckoutSessionId: null,
    providerPaymentIntentId: null, providerInvoiceId: null, entitlementApplied: false, entitlementAppliedAt: null,
    idempotencyKey, createdAt: now, updatedAt: now,
  }).catch(async (error: unknown) => { if ((error as { code?: number }).code !== 6) throw error; });
  const current = await orderRef.get();
  if (!current.exists || current.get('idempotencyKey') !== idempotencyKey || current.get('companyId') !== input.companyId) throw new SevenoStripeError('order_conflict', 409, 'La commande est en conflit.');
  assertStripeProviderEnvironment(current.get('providerEnvironment'), environment, 'commande Stripe');
  const existingSessionId = current.get('providerCheckoutSessionId');
  if (typeof existingSessionId === 'string' && existingSessionId) {
    const existingSession = await config.stripe.checkout.sessions.retrieve(existingSessionId);
    assertStripeObjectEnvironment(existingSession.livemode, environment, 'session Checkout existante');
    assertStripeProviderEnvironment(existingSession.metadata?.environment, environment, 'session Checkout existante');
    if (existingSession.url && existingSession.status === 'open') return { orderId, checkoutSessionId: existingSession.id, checkoutUrl: existingSession.url };
  }
  const origin = config.publicOrigin;
  const metadata = { integration: 'seveno', orderId, companyId: input.companyId, productCode: input.productCode, catalogVersion: LAUNCH_CATALOG_VERSION, environment };
  const session = await config.stripe.checkout.sessions.create({
    mode: 'payment', line_items: [{ price: config.priceIds[input.productCode], quantity: 1 }], customer: customerId,
    automatic_tax: { enabled: true }, tax_id_collection: { enabled: true }, billing_address_collection: 'required',
    name_collection: { business: { enabled: true } }, customer_update: { address: 'auto', name: 'auto' }, invoice_creation: { enabled: true, invoice_data: { metadata } },
    client_reference_id: orderId, metadata, payment_intent_data: { metadata },
    success_url: `${origin}/entreprise/facturation?checkout=success&orderId=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/entreprise/facturation?checkout=cancelled&orderId=${orderId}`,
  }, { idempotencyKey: `stripe_checkout_session:${environment}:${orderId}` });
  if (session.livemode !== config.livemode || !session.url) throw new SevenoStripeError('stripe_session_invalid', 503, 'La session Stripe est incohérente avec l’environnement actif.');
  await orderRef.update({ providerCheckoutSessionId: session.id, updatedAt: Timestamp.now() });
  return { orderId, checkoutSessionId: session.id, checkoutUrl: session.url };
}

async function recordWebhookEvent(event: Stripe.Event, status: 'processed' | 'ignored' | 'failed', orderId: string | null, sessionId: string | null, lastErrorCode: string | null = null) {
  const now = Timestamp.now();
  await firestore().collection('stripe_webhook_events').doc(event.id).set({ stripeEventId: event.id, type: event.type, livemode: event.livemode, providerEnvironment: getStripeEnvironment(), orderId, checkoutSessionId: sessionId, status, receivedAt: now, processedAt: status === 'failed' ? null : now, lastErrorCode }, { merge: true });
}

async function ignoreForeignWebhookEvent(event: Stripe.Event, sessionId: string | null) {
  try { await recordWebhookEvent(event, 'ignored', null, sessionId); }
  catch { /* An optional ignored-event projection must never make a foreign webhook retry. */ }
}

function getSevenoSessionOrderId(session: Stripe.Checkout.Session) {
  if (session.metadata?.integration !== 'seveno') return null;
  const metadataOrderId = session.metadata.orderId?.trim() ?? '';
  const referenceOrderId = session.client_reference_id?.trim() ?? '';
  if (!metadataOrderId || !referenceOrderId || metadataOrderId !== referenceOrderId) return null;
  return metadataOrderId;
}

async function processVerifiedStripePaymentEvent(sessionId: string, expectedOrderId: string) {
  const config = getStripeWebhookConfig();
  const environment = config.environment;
  const session = await config.stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
  if (session.livemode !== config.livemode || session.metadata?.integration !== 'seveno' || session.metadata.environment !== environment) throw new SevenoStripeError('stripe_session_environment_invalid', 409, 'Session Stripe incohérente.');
  const orderId = session.client_reference_id ?? session.metadata.orderId;
  if (!orderId) throw new SevenoStripeError('stripe_order_missing', 409, 'Commande Stripe absente.');
  if (session.status !== 'complete') throw new SevenoStripeError('stripe_session_incomplete', 409, 'La session Stripe nâ€™est pas terminÃ©e.');
  if (expectedOrderId !== orderId) throw new SevenoStripeError('stripe_order_reference_mismatch', 409, 'La rÃ©fÃ©rence de commande Stripe est incohÃ©rente.');
  const orderRef = firestore().collection('billing_orders').doc(orderId);
  const order = await orderRef.get();
  if (!order.exists || order.get('provider') !== 'stripe' || order.get('providerEnvironment') !== environment || order.get('providerCheckoutSessionId') !== session.id) throw new SevenoStripeError('stripe_order_invalid', 409, 'Commande Stripe incohérente.');
  const productCode = order.get('productCode') as BillingProductCode;
  if (!(productCode in LAUNCH_BILLING_PRODUCTS) || !(productCode in config.priceIds)) throw new SevenoStripeError('invalid_product', 409, 'Produit Stripe incompatible.');
  const line = session.line_items?.data[0];
  const customerId = stripeId(session.customer);
  const account = await firestore().collection('company_billing_accounts').doc(String(order.get('companyId'))).get();
  const amountTax = session.total_details?.amount_tax ?? 0;
  if (!line || session.line_items?.data.length !== 1 || line.quantity !== 1 || stripeId(line.price) !== config.priceIds[productCode]
    || session.currency !== 'eur' || session.amount_subtotal !== LAUNCH_BILLING_PRODUCTS[productCode].unitAmountExcludingTax
    || customerId !== order.get('providerCustomerId') || customerId !== account.get(`stripeCustomerIds.${environment}`) || session.payment_status !== 'paid'
    || session.metadata?.orderId !== orderId || session.metadata.companyId !== order.get('companyId') || session.metadata.productCode !== productCode
    || session.metadata.catalogVersion !== LAUNCH_CATALOG_VERSION || session.amount_total !== session.amount_subtotal + amountTax) {
    throw new SevenoStripeError('stripe_payment_mismatch', 409, 'Le paiement Stripe ne correspond pas à la commande.');
  }
  await orderRef.update({ status: 'paid', providerPaymentIntentId: stripeId(session.payment_intent), providerInvoiceId: stripeId(session.invoice), amountSubtotal: session.amount_subtotal, amountTax: session.total_details?.amount_tax ?? 0, amountTotal: session.amount_total, currency: session.currency, updatedAt: Timestamp.now() });
  await applyBillingEntitlement({ orderId, companyId: String(order.get('companyId')), actor: { uid: null, type: 'stripe_webhook' } });
  return { orderId, sessionId: session.id };
}

async function markIncompleteStripeOrder(session: Stripe.Checkout.Session, status: 'failed' | 'cancelled', errorCode: string) {
  const environment = getStripeEnvironment();
  if (session.livemode !== expectedLivemode(environment) || session.metadata?.integration !== 'seveno' || session.metadata.environment !== environment) return null;
  const orderId = session.client_reference_id ?? session.metadata.orderId;
  if (!orderId) return null;
  const orderRef = firestore().collection('billing_orders').doc(orderId);
  const order = await orderRef.get();
  if (!order.exists || order.get('provider') !== 'stripe' || order.get('providerEnvironment') !== environment
    || order.get('providerCheckoutSessionId') !== session.id || order.get('companyId') !== session.metadata.companyId
    || order.get('productCode') !== session.metadata.productCode) return null;
  if (order.get('status') === 'pending') await orderRef.update({ status, lastErrorCode: errorCode, updatedAt: Timestamp.now() });
  return orderId;
}

export async function processStripeWebhookEvent(event: Stripe.Event) {
  const environment = getStripeEnvironment();
  assertStripeObjectEnvironment(event.livemode, environment, 'événement webhook');
  const supported = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'];
  if (!supported.includes(event.type)) { await ignoreForeignWebhookEvent(event, null); return { status: 'ignored' as const, code: 'unsupported_event', orderId: null }; }
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = getSevenoSessionOrderId(session);
  if (!orderId) { await ignoreForeignWebhookEvent(event, session.id ?? null); return { status: 'ignored' as const, code: session.metadata?.integration === 'seveno' ? 'invalid_order_reference' : 'foreign_integration', orderId: null }; }
  const identifiedOrder = await firestore().collection('billing_orders').doc(orderId).get();
  if (!identifiedOrder.exists) { await ignoreForeignWebhookEvent(event, session.id ?? null); return { status: 'ignored' as const, code: 'order_not_found', orderId }; }
  const eventRef = firestore().collection('stripe_webhook_events').doc(event.id);
  if ((await eventRef.get()).get('status') === 'processed') return { status: 'processed' as const, code: 'already_processed', orderId };
  try {
    if (event.type === 'checkout.session.completed' && session.payment_status !== 'paid') { await recordWebhookEvent(event, 'processed', orderId, session.id); return { status: 'processed' as const, code: 'payment_pending', orderId }; }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const result = await processVerifiedStripePaymentEvent(session.id, orderId); await recordWebhookEvent(event, 'processed', result.orderId, result.sessionId); return { status: 'processed' as const, code: 'entitlement_checked', orderId: result.orderId };
    }
    const verifiedOrderId = await markIncompleteStripeOrder(session, event.type === 'checkout.session.expired' ? 'cancelled' : 'failed', event.type === 'checkout.session.expired' ? 'checkout_expired' : 'async_payment_failed');
    await recordWebhookEvent(event, verifiedOrderId ? 'processed' : 'ignored', verifiedOrderId, session.id);
    return { status: verifiedOrderId ? 'processed' as const : 'ignored' as const, code: verifiedOrderId ? 'terminal_status_recorded' : 'order_mismatch', orderId: verifiedOrderId };
  } catch (error) {
    await recordWebhookEvent(event, 'failed', orderId, session.id, error instanceof SevenoStripeError ? error.code : 'stripe_webhook_failed');
    throw error;
  }
}

export function constructStripeWebhookEvent(rawBody: string, signature: string) {
  const { stripe, webhookSecret } = getStripeWebhookConfig();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export async function getCompanyOrderStatus(companyId: string, orderId: string) {
  const order = await firestore().collection('billing_orders').doc(orderId).get();
  if (!order.exists || order.get('companyId') !== companyId) throw new SevenoStripeError('order_not_found', 404, 'Commande introuvable.');
  return { orderId, status: String(order.get('status')), entitlementApplied: order.get('entitlementApplied') === true, productCode: String(order.get('productCode')), campaignId: typeof order.get('campaignId') === 'string' ? String(order.get('campaignId')) : null };
}

export async function getStripeInvoiceLink(invoiceId: string) {
  const invoice = await getStripeCatalogAuditConfig().stripe.invoices.retrieve(invoiceId);
  assertStripeObjectEnvironment(invoice.livemode, getStripeEnvironment(), 'facture Stripe');
  return invoice.hosted_invoice_url;
}

export function toStripeErrorResponse(error: unknown) {
  if (error instanceof SevenoStripeError || error instanceof SevenoBillingError) return { status: error.status, body: { error: error.code, message: error.message } };
  return { status: 500, body: { error: 'stripe_unavailable', message: 'Le paiement n’a pas pu être préparé. Veuillez réessayer.' } };
}
