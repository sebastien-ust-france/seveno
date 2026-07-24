import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function assertContains(relativePath: string, fragments: string[]) {
  const source = readSource(relativePath);
  for (const fragment of fragments) {
    assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

function assertNotContains(relativePath: string, fragments: string[]) {
  const source = readSource(relativePath);
  for (const fragment of fragments) {
    assert.ok(!source.includes(fragment), `${relativePath} should not contain ${fragment}`);
  }
}

assertContains('app/cgu/page.tsx', [
  'Conditions générales d’utilisation — Seven’O',
  'CguAcceptancePanel',
  'Version 1.0',
  '21 juillet 2026',
  'article-15',
]);

assertContains('components/legal/CguAcceptancePanel.tsx', [
  'acceptSevenoTerms',
  'ensureSevenoUser',
  'J’ai lu et j’accepte les Conditions générales d’utilisation de Seven’O.',
  'Je confirme être habilité à représenter l’entreprise et j’accepte les Conditions générales d’utilisation de Seven’O.',
  'Relire l’article sur les recommandations',
]);

assertContains('app/candidat/onboarding/page.tsx', [
  'acceptSevenoTerms',
  'hasSevenoTermsAcceptance',
  'completeCandidateOnboarding',
  'J’ai lu et j’accepte les Conditions générales d’utilisation de Seven’O.',
  'La version 1.0 des CGU est enregistrée avec un horodatage serveur avant la validation du profil.',
]);

assertContains('app/api/seveno/candidates/onboarding/complete/route.ts', [
  'onboardingCompleted: true',
  "role !== 'candidate'",
]);

assertContains('app/entreprise/onboarding/page.tsx', [
  'acceptSevenoTerms',
  'hasSevenoTermsAcceptance',
  'Je confirme être habilité à représenter l’entreprise et j’accepte les Conditions générales d’utilisation de Seven’O.',
  'La version 1.0 des CGU est enregistrée avec un horodatage serveur avant la validation du profil entreprise.',
]);

assertContains('app/candidat/page.tsx', [
  'hasSevenoTermsAcceptance',
  "/cgu",
]);

assertContains('app/entreprise/page.tsx', [
  'hasSevenoTermsAcceptance',
  "/cgu",
]);

assertContains('app/recommandation/[token]/page.tsx', [
  'Je certifie avoir eu une relation professionnelle réelle avec cette personne, répondre personnellement et de bonne foi, et accepter les règles applicables aux recommandations Seven’O.',
  '/cgu#article-15',
]);

assertContains('lib/seveno-terms-version.ts', [
  'SEVENO_TERMS_VERSION',
]);

assertContains('lib/seveno-terms-acceptance.ts', [
  'buildSevenoTermsAcceptancePatch',
  'buildSevenoTermsAcceptanceMigrationPlan',
  'getLegacySevenoTermsAcceptanceFieldPath',
  'updatedAt: acceptance.acceptedAt',
]);

assertNotContains('lib/seveno-users.ts', [
  'SevenoCandidateDebugContext',
  'summarizeUid',
  'logSevenoCandidateDebug',
  'SEVENO_TERMS_VERSION',
]);

assertContains('lib/seveno-users.ts', [
  'termsAcceptance',
  'candidate_account',
  'company_first_access',
  'resolveSevenoRedirect',
]);

assertContains('lib/seveno-recommendations-server.ts', [
  'termsAcceptanceVersion',
  'termsAcceptanceAcceptedAt',
  'termsAcceptanceContext',
  'professional_recommendation',
  '@/lib/seveno-terms-version',
]);

assertContains('app/api/seveno/terms/acceptance/route.ts', [
  '@/lib/seveno-terms-version',
  'buildSevenoTermsAcceptancePatch',
]);

assertContains('firestore.rules', [
  'termsAcceptance',
]);

assertNotContains('app/candidat/page.tsx', [
  'SevenO candidate diagnostics',
  'diagnosticId',
  'summarizeCandidateUid',
  'createCandidateDiagnosticId',
  'seveno_candidate_diagnostic_id',
]);

assertNotContains('components/legal/CguAcceptancePanel.tsx', [
  'const refreshed = await ensureSevenoUser(authUser);',
  'router.replace(resolveSevenoRedirect(refreshed));',
  'SevenO candidate diagnostics',
  'createCandidateDiagnosticId',
  'diagnosticId',
]);

console.log('SevenO terms smoke test: OK');
