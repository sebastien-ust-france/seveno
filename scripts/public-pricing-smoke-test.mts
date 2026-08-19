import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');

function readSource(relativePath: string) {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

function assertContains(source: string, fragments: readonly string[]) {
  for (const fragment of fragments) assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

const pricingPage = readSource('app/entreprises/tarifs/page.tsx');
const companiesPage = readSource('app/entreprises/page.tsx');
const pricingPreview = readSource('components/public/companies/CompanyPricingPreview.tsx');
const homePage = readSource('app/page.tsx');
const candidatesPage = readSource('app/candidats/page.tsx');
const candidateFreeService = readSource('components/public/candidates/CandidateFreeService.tsx');

assertContains(pricingPage, [
  '1 crédit recrutement', '390 € HT', 'Pack 3 crédits', '990 € HT', 'Pack 10 crédits', '2 990 € HT',
  'Prolongation de 30 jours', '90 € HT', 'Extension de capacité de campagne', '190 € HT',
  'Aucun abonnement. Aucune commission sur l’embauche. Aucun renouvellement automatique.',
  'Seven’O reste gratuit pour les candidats',
  'Chaque candidat reste libre de partager ou non ses propres coordonnées après l’ouverture de la mise en relation.',
]);
assert.doesNotMatch(pricingPage, /Acheter 10 candidats/i);
assert.doesNotMatch(pricingPage, />\s*(Acheter|Commander|Payer)\s*</i);
assert.doesNotMatch(pricingPage, /stripe|\/api\//i);
assertContains(companiesPage + pricingPreview, ['/entreprises/tarifs', 'Découvrir les tarifs']);
assertContains(homePage, ['/entreprises/tarifs', 'Voir les tarifs entreprises', 'Candidats : Seven’O est entièrement gratuit pour vous.']);
assertContains(candidatesPage + candidateFreeService, ['Un service gratuit pour les candidats', 'Seven’O est gratuit pour les candidats.']);

assert.doesNotMatch(pricingPage, /stripe|\/api\/seveno\/billing/i);

console.log('Public pricing smoke test passed.');
