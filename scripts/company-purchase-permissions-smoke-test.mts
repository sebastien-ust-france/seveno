import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canPurchaseCompanyCredits, permissionsForRole } from '@/lib/seveno-company-roles';
import { recruitmentCreditPresentation } from '@/lib/seveno-recruitment-credit-presentation';

assert.equal(canPurchaseCompanyCredits({ role: 'owner', permissions: { canPurchaseCredits: false } }), true);
assert.equal(canPurchaseCompanyCredits({ role: 'admin' }), true, 'Un ancien admin sans permission reste autorisé.');
assert.equal(canPurchaseCompanyCredits({ role: 'admin', permissions: { canPurchaseCredits: true } }), true);
assert.equal(canPurchaseCompanyCredits({ role: 'admin', permissions: { canPurchaseCredits: false } }), false);
assert.equal(canPurchaseCompanyCredits({ role: 'billing_manager', permissions: { canPurchaseCredits: false } }), true);
assert.equal(canPurchaseCompanyCredits({ role: 'recruiter', permissions: { canPurchaseCredits: true } }), false);
assert.equal(canPurchaseCompanyCredits({ role: 'viewer', permissions: { canPurchaseCredits: true } }), false);
assert.deepEqual(permissionsForRole('admin'), { canPurchaseCredits: true });
assert.deepEqual(permissionsForRole('admin', false), { canPurchaseCredits: false });
assert.deepEqual(recruitmentCreditPresentation(3, 'owner', true), { credits: 3, state: 'normal', label: null, message: '1 crédit permet d’activer une nouvelle campagne.', canBuy: true });
assert.equal(recruitmentCreditPresentation(3, 'admin', true).canBuy, true);
assert.equal(recruitmentCreditPresentation(3, 'admin', false).canBuy, false);
assert.equal(recruitmentCreditPresentation(3, 'recruiter', false).canBuy, false);
assert.equal(recruitmentCreditPresentation(2, 'recruiter', false).state, 'low');
assert.equal(recruitmentCreditPresentation(1, 'owner', true).label, 'Stock faible');
assert.equal(recruitmentCreditPresentation(0, 'admin', false).label, 'Aucun crédit disponible');

const checkoutRoute = await readFile(new URL('../app/api/seveno/billing/checkout/route.ts', import.meta.url), 'utf8');
assert.ok(checkoutRoute.indexOf('canPurchaseCompanyCredits(membership)') < checkoutRoute.indexOf('createStripeCheckout('), 'Le refus doit précéder tout appel Stripe.');
assert.match(checkoutRoute, /Le propriétaire de l’entreprise ne vous autorise pas à acheter des crédits\./);

const offerStatusRoute = await readFile(new URL('../app/api/seveno/offers/[offerId]/status/route.ts', import.meta.url), 'utf8');
assert.match(offerStatusRoute, /allowedRoles: \['owner', 'admin', 'recruiter'\]/, 'La permission d’achat ne doit pas bloquer la publication admin.');

const membershipsRoute = await readFile(new URL('../app/api/seveno/company-memberships/route.ts', import.meta.url), 'utf8');
assert.match(membershipsRoute, /allowedRoles: \['owner', 'admin'\]/);
assert.doesNotMatch(membershipsRoute, /body\.companyId|body\.actorUid|body\.status/, 'Le client ne doit pas piloter le tenant, l’acteur ou le statut.');
const membershipServer = await readFile(new URL('../lib/seveno-company-memberships-server.ts', import.meta.url), 'utf8');
assert.match(membershipServer, /input\.actorRole !== 'owner'/, 'La permission financière admin reste sous contrôle owner.');

console.log('Company purchase permissions smoke tests: OK');
