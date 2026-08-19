import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const dashboard = await read('app/entreprise/page.tsx');
const onboarding = await read('app/api/seveno/companies/onboarding/route.ts');
const context = await read('app/api/seveno/company-context/route.ts');
const membershipGate = await read('lib/seveno-company-memberships-server.ts');
const rules = await read('firestore.rules');

assert.match(dashboard, /profile\.verificationStatus !== 'verified'/);
assert.match(dashboard, /profile\.verificationStatus === 'rejected'/);
assert.match(dashboard, /La validation de votre entreprise n’a pas été acceptée/);
assert.match(dashboard, /Votre espace de recrutement reste désactivé/);
assert.match(dashboard, /Modifier mon profil entreprise/);
assert.match(context, /allowUnapproved: true/);
assert.match(onboarding, /profileStatus: profile\.get\('profileStatus'\) \?\? 'active'/);
assert.match(onboarding, /verificationStatus: profile\.get\('verificationStatus'\) \?\? 'pending'/);
assert.doesNotMatch(onboarding, /body\.(?:profileStatus|verificationStatus)/);
assert.match(membershipGate, /profile\.get\('profileStatus'\) === 'suspended'/);
assert.match(membershipGate, /!input\.allowUnapproved && profile\.get\('verificationStatus'\) !== 'verified'/);
const companyOwnerUpdateFields = rules.match(/affectedKeys\(\)\.hasOnly\(\[[\s\S]*?'companyName'[\s\S]*?'updatedAt'[\s\S]*?\]\)/)?.[0] ?? '';
assert.ok(companyOwnerUpdateFields);
assert.doesNotMatch(companyOwnerUpdateFields, /verificationStatus|profileStatus/);

const guardedRoutes = [
  ['app/api/seveno/offers/route.ts', 'createJobOffer'],
  ['app/api/seveno/company-member-invitations/route.ts', 'createMemberInvitation'],
  ['app/api/seveno/offers/[offerId]/questionnaire/route.ts', 'saveCompanyQuestionnaire'],
  ['app/api/seveno/applications/[applicationId]/company-decision/route.ts', 'reviewCompanyJobApplication'],
  ['app/api/seveno/applications/[applicationId]/conversation/route.ts', 'sendJobApplicationConversationMessage'],
  ['app/api/seveno/billing/checkout/route.ts', 'createStripeCheckout'],
] as const;

for (const [path, sensitiveCall] of guardedRoutes) {
  const source = await read(path);
  const gateIndex = source.indexOf('requireActiveCompanyMembership({');
  const operationIndex = source.indexOf(`${sensitiveCall}(`, gateIndex + 1);
  assert.ok(gateIndex >= 0, `${path}: verrou entreprise absent`);
  assert.ok(operationIndex > gateIndex, `${path}: ${sensitiveCall} doit suivre le verrou entreprise`);
}

const invitationRoute = await read('app/api/seveno/company-member-invitations/route.ts');
assert.ok(invitationRoute.indexOf('requireActiveCompanyMembership({') < invitationRoute.indexOf('createMemberInvitation('));

const checkoutRoute = await read('app/api/seveno/billing/checkout/route.ts');
assert.ok(checkoutRoute.indexOf('requireActiveCompanyMembership({') < checkoutRoute.indexOf('createStripeCheckout('));

console.log('Company validation smoke tests: OK');
