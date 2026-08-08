import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/cgv-entreprises/page.tsx', 'utf8');
const billingPage = readFileSync('app/entreprise/facturation/page.tsx', 'utf8');
const checkoutRoute = readFileSync('app/api/seveno/billing/checkout/route.ts', 'utf8');
const termsRoute = readFileSync('app/api/seveno/billing/terms/route.ts', 'utf8');
const stripeServer = readFileSync('lib/seveno-stripe-server.ts', 'utf8');
const billingServer = readFileSync('lib/seveno-billing-server.ts', 'utf8');
const footer = readFileSync('components/public/PublicSiteFooter.tsx', 'utf8');
const rules = readFileSync('firestore.rules', 'utf8');

assert.match(page, /Conditions générales de vente — Seven’O Entreprises/);
assert.match(page, /Version 1\.0 — Entrée en vigueur : 10 août 2026 — Éditeur : UST-WORKFLOW/);
for (let article = 1; article <= 15; article += 1) assert.match(page, new RegExp(`${article}\\.`));
assert.match(footer, /href: '\/cgv-entreprises'/);
assert.match(billingPage, /J’ai lu et j’accepte les Conditions générales de vente Seven’O Entreprises — version 1\.0/);
assert.match(billingPage, /Accepter et continuer vers le paiement/);
assert.match(billingPage, /useState\(false\)/);
assert.match(billingPage, /disabled=\{!salesTermsChecked/);

const acceptanceCheck = checkoutRoute.indexOf('requireCurrentCompanySalesTermsAcceptance');
const checkoutCall = checkoutRoute.indexOf('createStripeCheckout({');
assert.ok(acceptanceCheck >= 0 && checkoutCall > acceptanceCheck, 'Le contrôle CGV doit précéder la création Checkout.');
assert.match(termsRoute, /canPurchaseCompanyCredits\(membership\)/);
assert.match(termsRoute, /acceptCurrentCompanySalesTerms/);
assert.match(stripeServer, /salesTermsVersion: CURRENT_COMPANY_SALES_TERMS_VERSION/);
assert.match(stripeServer, /metadata = \{[^\n]*salesTermsVersion:/);
assert.match(billingServer, /addCalendarMonths\(acquiredAt, 24\)/);
assert.match(billingServer, /orderBy\('expiresAt', 'asc'\)/);
assert.match(billingServer, /purchase_expiration/);
assert.match(rules, /match \/company_sales_terms_acceptances\/\{acceptanceId\}/);
assert.match(rules, /match \/credit_lots\/\{lotId\}/);

console.log('Company sales terms smoke tests: OK');
