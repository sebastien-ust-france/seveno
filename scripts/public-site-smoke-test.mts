import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function assertPageContains(relativePath: string, expectedFragments: string[]) {
  const source = readSource(relativePath);
  for (const fragment of expectedFragments) {
    assert.match(source, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
}

assertPageContains('app/page.tsx', [
  'PublicSiteShell',
  'HomeFaqSection',
  'RECRUTEMENT ET OBSERVATOIRE DES TALENTS',
  'Le bon recrutement ne commence pas par une pile de CV. Il commence par une rencontre qui a du sens.',
  'Moins de tri. Moins de silence. Plus de rencontres au bon moment.',
  'Le recrutement ne manque pas de candidats. Il manque de clarté.',
  'PROFESSIONNEL',
  'Compétences',
  'LE RECRUTEMENT HABITUEL',
  'Compétences supposées',
  'Remettre le',
  'AVEC SEVEN’O',
  'Questionnaire métier',
  'Le parcours complète l’évaluation.',
  'moteur-seveno-home',
  'Un CV laisse supposer des compétences. Seven’O les confronte aux réalités du poste.',
  'DEUX PARCOURS, UNE RENCONTRE',
  'DISPONIBILITÉ RÉELLE',
  'Un profil disponible doit le rester dans les faits, pas seulement dans une base de données.',
  'Les identités viennent après l’intérêt, pas avant.',
  'progressivement',
  'REJOINDRE SEVEN’O',
  'Créer mon profil candidat',
  'Évaluer mieux. Échanger au bon moment. Décider avec des éléments concrets.',
  'publicStudyCount.totalResponses',
  'getPublicStudyResponseCount',
]);
assert.doesNotMatch(readSource('app/page.tsx'), /SEVAN['â€™]O/i);
assert.doesNotMatch(readSource('app/page.tsx'), /SEV-CAND-4821|Visible aux entreprises|MaÃ§on coffreur|Gironde et alentours|3 recommandations/);
assert.doesNotMatch(readSource('components/public/PublicSiteHeader.tsx'), /SEVAN['â€™]O/i);

assertPageContains('app/candidats/page.tsx', [
  'PublicSiteShell',
  'CandidatePublicHero',
  'CandidateAnonymityIntro',
  'CandidateJourney',
  'CandidateControlSection',
  'CandidateLaunchCta',
  'CandidateFaq',
  "canonical: '/candidats'",
]);

assertPageContains('app/entreprises/page.tsx', [
  'PublicSiteShell',
  'CompanyPublicHero',
  'CompanyQuestionnaireDifference',
  'CompanyQuestionnaireCreation',
  'CompanyValueConclusion',
  'CompanyFaq',
  "canonical: '/entreprises'",
]);
assert.doesNotMatch(
  readSource('app/entreprises/page.tsx'),
  /CompanyQuestionnaireControl|CompanyCandidateQuestionnaire|CompanyThresholdSection|CompanyRecruitmentJourney|CompanyLaunchCta/,
);
assert.doesNotMatch(readSource('components/public/companies/CompanyPublicHero.tsx'), /#parcours-entreprise/);

assertPageContains('app/comment-ca-marche/page.tsx', [
  "permanentRedirect('/observatoire')",
]);

assertPageContains('app/a-propos/page.tsx', [
  'PublicSiteShell',
  'AboutHero',
  'AboutOrigin',
  'AboutMission',
  'AboutPrinciples',
  'AboutObservatory',
  'AboutLaunch',
  'AboutUstWorkflow',
  'AboutFinalCta',
  "canonical: '/a-propos'",
]);

assertPageContains('app/contact/page.tsx', [
  'PublicSiteShell',
  'ContactHero',
  'ContactForm',
  'ContactInformation',
  'ContactFaq',
  'resolveContactReasonCode',
  "canonical: '/contact'",
]);

assertPageContains('app/mentions-legales/page.tsx', [
  'PublicSiteShell',
  'MentionsLegalesContent',
  "canonical: '/mentions-legales'",
]);

assertPageContains('app/cgu/page.tsx', [
  'PublicSiteShell',
  'CguAcceptancePanel',
  'ARTICLES',
  "canonical: '/cgu'",
]);

assertPageContains('app/confidentialite/page.tsx', [
  'PublicSiteShell',
  'PrivacyPolicyPrintButton',
  'RETENTION_ROWS',
  'POLICY_SECTIONS',
  'TOC',
  "canonical: '/confidentialite'",
]);

assertPageContains('app/cookies/page.tsx', [
  "Seven'O - Cookies",
  'PublicSiteShell',
  'Gestion des cookies',
  'sebastien@seveno.eu',
  "canonical: '/cookies'",
]);

assertPageContains('app/etude/page.tsx', [
  'StudyQuestionnaire',
  "canonical: '/etude'",
]);
assertPageContains('app/sitemap.ts', [
  "'/'",
  "'/candidats'",
  "'/entreprises'",
  "'/observatoire'",
  "'/etude'",
  "'/a-propos'",
  "'/contact'",
  "'/mentions-legales'",
  "'/cgu'",
  "'/confidentialite'",
  "'/cookies'",
  "'/offres'",
  "'/talents'",
  'listPublicOffersServer',
  'listPublicCandidatesServer',
]);
assertPageContains('app/offres/page.tsx', ['PublicSiteShell', 'listPublicOffersServer', "canonical: '/offres'"]);
assertPageContains('app/offres/[slug]/page.tsx', ['JobPosting', 'notFound', 'buildJobPostingJsonLd', 'Accéder aux offres et candidater']);
assertPageContains('app/talents/page.tsx', ['PublicSiteShell', 'listPublicCandidatesServer', "canonical: '/talents'"]);
assertPageContains('app/talents/[slug]/page.tsx', ['buildCandidateProfileJsonLd', 'notFound', 'Candidat anonyme', 'Se connecter ou créer un compte']);
assertPageContains('components/public/PublicSiteHeader.tsx', [
  'PublicAccountActions',
  'PublicMobileNavigation',
  '/images/icone-tdb-seveno.png',
  'Seven’O',
  'Recrutement et observatoire des talents',
  'Étude',
  'À propos',
  'aria-label="Navigation principale"',
]);
assert.doesNotMatch(
  readSource('components/public/PublicSiteHeader.tsx'),
  /SEVAN['â€™]O|Recrutement sans CV, profil anonyme et recommandations/i
);

assertPageContains('components/public/PublicSiteFooter.tsx', [
  'PublicSiteFooter',
  'Mentions légales',
  'Politique de confidentialité',
  'Cookies',
  'sebastien@seveno.eu',
  'SEVENO_LOGO_SRC',
  '/mentions-legales',
]);
console.log('Public site smoke test: OK');





