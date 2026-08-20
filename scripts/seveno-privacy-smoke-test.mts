import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function assertMatches(relativePath: string, patterns: RegExp[]) {
  const source = readSource(relativePath);
  for (const pattern of patterns) {
    assert.match(source, pattern);
  }
}

assertMatches('app/confidentialite/page.tsx', [
  /Politique de confidentialit/i,
  /Protection des donn/i,
  /Version 1\.1/i,
  /en vigueur\s*:\s*20 août 2026/i,
  /Responsable du traitement\s*:\s*UST-WORKFLOW/i,
  /\/cookies/i,
  /CNIL/i,
  /ne prend aucune.*cision finale de recrutement exclusivement.*automat/i,
  /visibilit.*publique Web, moteurs de recherche et recherche IA/i,
  /consentement s.par., explicite, facultatif et non pr.coch./i,
  /caches ind.pendants/i,
  /Observatoire restent agr.g.es ou anonymis.es/i,
]);

assert.doesNotMatch(
  readSource('app/confidentialite/page.tsx'),
  /users\/\{uid\}|candidate_profiles\/\{uid\}|candidate_private_data\/\{uid\}|study_responses|company_profiles|job_offers|job_applications|match_requests|candidate_recommendation_requests|candidate_recommendations|candidate_push_subscriptions|availability_confirmation_requests|availability_confirmation_events|admin_logs|ProcessingTable|PROCESSING_ROWS|Synthese des traitements|Finalites des bases legales|Conformite confirmee|Action bloquante avant lancement|Regle relative aux mineurs a decider|seveno-privacy-launch-audit/i
);

assertMatches('app/politique-de-confidentialite/page.tsx', [
  /redirect\('\/confidentialite'\)/i,
]);

assertMatches('components/public/legal/PrivacyPolicyPrintButton.tsx', [
  /window\.print/i,
  /Imprimer ou enregistrer la Politique de confidentialit/i,
]);

assertMatches('app/sitemap.ts', [
  /'\/confidentialite'/i,
]);

assertMatches('components/public/PublicSiteFooter.tsx', [
  /'\/confidentialite'/i,
  /Politique de confidentialit/i,
]);

assertMatches('app/cgu/page.tsx', [
  /href="\/confidentialite"/i,
]);

assertMatches('docs/seveno-privacy-launch-audit.md', [
  /Conform/i,
  /Action bloquante avant lancement/i,
  /mineurs/i,
]);

assert.doesNotMatch(
  readSource('docs/seveno-privacy-launch-audit.md'),
  /app\/confidentialite\/page\.tsx|PublicSiteShell|PrivacyPolicyPrintButton|sitemap|PublicSiteFooter/i
);

console.log('SevenO privacy smoke test: OK');
