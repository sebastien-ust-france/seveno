import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  buildCandidateProfileJsonLd,
  buildJobPostingJsonLd,
  buildPublicCandidateSlug,
  buildPublicOfferSlug,
  isPublicOfferPublicationActive,
  projectPublicCandidate,
  projectPublicOffer,
  serializeJsonLd,
} from '@/lib/seveno-public-discovery';
import {
  applyPublicSearchConsentDecision,
  decidePublicSearchConsentTransition,
  PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
} from '@/lib/seveno-public-search-consent';
import {
  buildPublicOfferCandidateReturnTo,
  buildPublicOfferLoginHref,
  normalizePublicOfferReturnTo,
} from '@/lib/seveno-public-offer-return';

const privateOffer = {
  status: 'published',
  title: 'Aide à domicile',
  jobRoleLabel: 'Aide à domicile',
  location: 'Verdun, Meuse, France',
  countryCode: 'FR',
  countryName: 'France',
  administrativeAreaName: 'Meuse',
  cityName: 'Verdun',
  workMode: 'onsite',
  contractType: 'permanent',
  workingTime: 'full_time',
  description: 'Accompagner les bénéficiaires dans leur quotidien.',
  missions: 'Soutenir les gestes de la vie quotidienne.',
  profileSummary: 'Sens du service et autonomie.',
  requiredPrerequisites: [{ companyLabel: 'Permis B', prerequisiteId: 'private-prerequisite-id', expectedCriterion: true }],
  preferredPrerequisites: [{ companyLabel: 'Premiers secours', ownerCompanyId: 'private-company-id' }],
  publishedAt: new Date('2026-08-01T10:00:00.000Z'),
  updatedAt: new Date('2026-08-02T10:00:00.000Z'),
  companyUid: 'private-company-uid',
  companyId: 'private-company-id',
  createdByUid: 'private-creator-uid',
  assignedToUid: 'private-assignee-uid',
  questionnaireId: 'private-questionnaire-id',
  activeCampaignId: 'campaign-id',
};

const activeCampaign = {
  status: 'active',
  endsAt: new Date('2026-08-21T10:00:00.000Z'),
};

const offer = projectPublicOffer('private-firestore-id', privateOffer, activeCampaign);
assert.ok(offer);
assert.equal(offer.validThrough, '2026-08-21T10:00:00.000Z');
assert.deepEqual(offer.requiredPrerequisites, ['Permis B']);
assert.deepEqual(offer.preferredPrerequisites, ['Premiers secours']);
const offerJson = JSON.stringify(offer);
for (const forbidden of ['companyUid', 'companyId', 'createdByUid', 'assignedToUid', 'questionnaireId', 'private-firestore-id', 'prerequisiteId', 'expectedCriterion']) {
  assert.equal(offerJson.includes(forbidden), false, `Forbidden offer field leaked: ${forbidden}`);
}
for (const status of ['draft', 'paused', 'closed', 'archived']) {
  assert.equal(projectPublicOffer('offer-id', { ...privateOffer, status }, activeCampaign), null);
}
assert.equal(projectPublicOffer('offer-id', privateOffer, null), null);
assert.equal(projectPublicOffer('offer-id', privateOffer, { status: 'active', endsAt: null }), null);
assert.equal(isPublicOfferPublicationActive(privateOffer, null), false);
assert.equal(isPublicOfferPublicationActive(
  { ...privateOffer, activeCampaignId: 'campaign-id' },
  activeCampaign,
  new Date('2026-08-20T10:00:00.000Z'),
), true);
assert.equal(isPublicOfferPublicationActive(
  { ...privateOffer, activeCampaignId: 'campaign-id' },
  { status: 'active', endsAt: new Date('2026-08-19T10:00:00.000Z') },
  new Date('2026-08-20T10:00:00.000Z'),
), false);
for (const status of ['paused', 'expired', 'candidate_limit_reached', 'closed']) {
  assert.equal(isPublicOfferPublicationActive(
    { ...privateOffer, activeCampaignId: 'campaign-id' },
    { status, endsAt: new Date('2026-08-21T10:00:00.000Z') },
    new Date('2026-08-20T10:00:00.000Z'),
  ), false);
}
assert.equal(isPublicOfferPublicationActive(
  { ...privateOffer, activeCampaignId: 'campaign-id' },
  { status: 'closed', endsAt: new Date('2026-08-21T10:00:00.000Z') },
  new Date('2026-08-20T10:00:00.000Z'),
), false);
assert.equal(buildPublicOfferSlug('stable-id', 'Titre initial', 'Paris'), buildPublicOfferSlug('stable-id', 'Titre initial', 'Paris'));
assert.equal(buildPublicOfferSlug('stable-id', 'Titre initial', 'Paris').includes('stable-id'), false);

const jobPosting = buildJobPostingJsonLd(offer);
assert.equal(jobPosting['@type'], 'JobPosting');
assert.equal(jobPosting.hiringOrganization.name, 'confidential');
assert.equal('directApply' in jobPosting, false);
assert.equal('baseSalary' in jobPosting, false);
assert.equal(jobPosting.validThrough, activeCampaign.endsAt.toISOString());
assert.equal('jobLocation' in jobPosting, true);
assert.equal(jobPosting.employmentType, 'FULL_TIME');

const prolongedCampaign = { status: 'active', endsAt: new Date('2026-09-20T10:00:00.000Z') };
const prolongedOffer = projectPublicOffer('private-firestore-id', privateOffer, prolongedCampaign);
assert.ok(prolongedOffer);
assert.equal(prolongedOffer.validThrough, prolongedCampaign.endsAt.toISOString());
assert.equal(buildJobPostingJsonLd(prolongedOffer).validThrough, prolongedCampaign.endsAt.toISOString());
assert.notEqual(prolongedOffer.validThrough, offer.validThrough);
assert.equal(isPublicOfferPublicationActive(
  privateOffer,
  { status: 'active', endsAt: new Date('2026-08-19T10:00:00.000Z') },
  new Date('2026-08-20T10:00:00.000Z'),
), false);

const partTimePermanent = projectPublicOffer('part-time-id', { ...privateOffer, contractType: 'permanent', workingTime: 'part_time' }, activeCampaign);
assert.ok(partTimePermanent);
assert.equal(buildJobPostingJsonLd(partTimePermanent).employmentType, 'PART_TIME');
const fixedTermFullTime = projectPublicOffer('fixed-term-id', { ...privateOffer, contractType: 'fixed_term', workingTime: 'full_time' }, activeCampaign);
assert.ok(fixedTermFullTime);
assert.equal(buildJobPostingJsonLd(fixedTermFullTime).employmentType, 'FULL_TIME');
const temporaryFullTime = projectPublicOffer('temporary-id', { ...privateOffer, contractType: 'temporary', workingTime: 'full_time' }, activeCampaign);
assert.ok(temporaryFullTime);
assert.deepEqual(buildJobPostingJsonLd(temporaryFullTime).employmentType, ['TEMPORARY', 'FULL_TIME']);
const freelance = projectPublicOffer('freelance-id', { ...privateOffer, contractType: 'freelance', workingTime: 'flexible' }, activeCampaign);
assert.ok(freelance);
assert.equal(buildJobPostingJsonLd(freelance).employmentType, 'CONTRACTOR');
const internshipPartTime = projectPublicOffer('internship-id', { ...privateOffer, contractType: 'internship', workingTime: 'part_time' }, activeCampaign);
assert.ok(internshipPartTime);
assert.deepEqual(buildJobPostingJsonLd(internshipPartTime).employmentType, ['INTERN', 'PART_TIME']);
const apprenticeship = projectPublicOffer('apprenticeship-id', { ...privateOffer, contractType: 'apprenticeship', workingTime: 'full_time' }, activeCampaign);
assert.ok(apprenticeship);
assert.deepEqual(buildJobPostingJsonLd(apprenticeship).employmentType, ['OTHER', 'FULL_TIME']);

const remoteOffer = projectPublicOffer('remote-id', { ...privateOffer, workMode: 'remote', cityName: '', location: 'France' }, activeCampaign);
assert.ok(remoteOffer);
const remoteJobPosting = buildJobPostingJsonLd(remoteOffer);
assert.equal(remoteJobPosting.jobLocationType, 'TELECOMMUTE');
assert.equal('jobLocation' in remoteJobPosting, false);
assert.equal(remoteJobPosting.applicantLocationRequirements.name, 'FR');

const publicCandidateId = 'SEV-CAND-ABC234';
const publicSearchToken = 'd8a7f1c4e9b2067351a8efcb9012d3e4f5a6b7c8';
const publicSearchSlug = buildPublicCandidateSlug(publicSearchToken, 'Responsable magasin', 'Gironde, France');
assert.equal(publicSearchSlug.includes(publicCandidateId.toLowerCase()), false);
assert.equal(publicSearchSlug.endsWith(publicSearchToken), true);
assert.throws(() => buildPublicCandidateSlug('SEV-CAND-ABC234', 'Responsable magasin', 'Gironde, France'));
const candidateSource = {
  profileStatus: 'active',
  publicSearchVisibilityEnabled: true,
  publicSearchToken,
  publicSearchVisibilityAcceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
  publicSearchVisibilityAcceptedAt: new Date('2026-08-03T09:00:00.000Z'),
  publicSearchVisibilityRevokedAt: null,
  publicSearchSlug,
  targetJobs: [{ label: 'Responsable magasin', jobRoleId: 'private-role-id' }],
  desiredContractTypeCodes: ['CDI', 'FREELANCE'],
  availability: 'immediate',
  experienceLevel: 'confirmed',
  administrativeAreaName: 'Gironde',
  countryName: 'France',
  countryCode: 'FR',
  cityName: 'Bordeaux',
  locationArea: '12 rue privée, Bordeaux',
  recommendationVisibleCount: 2,
  updatedAt: new Date('2026-08-03T10:00:00.000Z'),
  uid: 'private-uid',
  candidateUid: 'private-candidate-uid',
  publicCandidateId,
  email: 'candidate@example.com',
  phone: '0612345678',
  firstName: 'Alice',
  lastName: 'Martin',
  professionalSelfDescription: 'Employée chez Société Identifiable depuis 2019.',
  verifiedScore: 98,
  questionnaireAnswers: ['private-answer'],
};

assert.equal(projectPublicCandidate({ ...candidateSource, publicSearchVisibilityEnabled: false }), null);
assert.equal(projectPublicCandidate({ ...candidateSource, publicSearchVisibilityAcceptedVersion: null }), null);
assert.equal(projectPublicCandidate({ ...candidateSource, publicSearchVisibilityAcceptedAt: null }), null);
assert.equal(projectPublicCandidate({ ...candidateSource, publicSearchVisibilityRevokedAt: new Date() }), null);
assert.equal(projectPublicCandidate({ ...candidateSource, publicSearchToken: 'a'.repeat(40) }), null);
assert.equal(projectPublicCandidate({ ...candidateSource, profileStatus: 'paused' }), null);
const candidate = projectPublicCandidate(candidateSource);
assert.ok(candidate);
assert.equal(candidate.broadLocation, 'Gironde, France');
const candidateJson = JSON.stringify(candidate);
for (const forbidden of ['private-uid', 'private-candidate-uid', publicCandidateId, 'candidate@example.com', '0612345678', 'Alice', 'Martin', 'Bordeaux', 'Société Identifiable', '2019', '98', 'private-answer', 'jobRoleId']) {
  assert.equal(candidateJson.includes(forbidden), false, `Forbidden candidate data leaked: ${forbidden}`);
}
const profilePage = buildCandidateProfileJsonLd(candidate);
assert.equal(profilePage['@type'], 'ProfilePage');
assert.equal(profilePage.mainEntity.name, 'Candidat anonyme');
assert.equal(JSON.stringify(profilePage).includes(publicCandidateId), false);

assert.equal(decidePublicSearchConsentTransition({
  existingEnabled: false,
  existingAcceptedVersion: null,
  requestedEnabled: true,
  explicitlyAcceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
}), 'accepted');
assert.equal(decidePublicSearchConsentTransition({
  existingEnabled: true,
  existingAcceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
  requestedEnabled: true,
  explicitlyAcceptedVersion: null,
}), 'unchanged');
assert.equal(decidePublicSearchConsentTransition({
  existingEnabled: true,
  existingAcceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
  requestedEnabled: false,
  explicitlyAcceptedVersion: null,
}), 'revoked');
assert.equal(decidePublicSearchConsentTransition({
  existingEnabled: false,
  existingAcceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
  requestedEnabled: true,
  explicitlyAcceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
}), 'accepted');
assert.equal(decidePublicSearchConsentTransition({
  existingEnabled: true,
  existingAcceptedVersion: '0.9',
  requestedEnabled: true,
  explicitlyAcceptedVersion: null,
}), 'explicit_acceptance_required');
const firstAcceptedAt = '2026-08-20T10:00:00.000Z';
const unchangedAt = '2026-08-20T11:00:00.000Z';
const acceptedState = applyPublicSearchConsentDecision({
  decision: 'accepted',
  existing: { enabled: false, acceptedVersion: null, acceptedAt: null, revokedAt: null, updatedAt: firstAcceptedAt },
  now: firstAcceptedAt,
});
assert.deepEqual(acceptedState, {
  enabled: true,
  acceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
  acceptedAt: firstAcceptedAt,
  revokedAt: null,
  updatedAt: firstAcceptedAt,
});
assert.equal(applyPublicSearchConsentDecision({ decision: 'unchanged', existing: acceptedState, now: unchangedAt }), acceptedState);
const revokedState = applyPublicSearchConsentDecision({ decision: 'revoked', existing: acceptedState, now: unchangedAt });
assert.equal(revokedState.acceptedVersion, PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION);
assert.equal(revokedState.acceptedAt, firstAcceptedAt);
assert.equal(revokedState.revokedAt, unchangedAt);
const reacceptedAt = '2026-08-20T12:00:00.000Z';
const reacceptedState = applyPublicSearchConsentDecision({ decision: 'accepted', existing: revokedState, now: reacceptedAt });
assert.equal(reacceptedState.acceptedAt, reacceptedAt);
assert.equal(reacceptedState.revokedAt, null);

const candidateReturnTo = buildPublicOfferCandidateReturnTo(offer.slug);
assert.equal(normalizePublicOfferReturnTo(candidateReturnTo), candidateReturnTo);
assert.equal(buildPublicOfferLoginHref(offer.slug), `/connexion?returnTo=${encodeURIComponent(candidateReturnTo)}`);
for (const unsafeReturnTo of [
  'https://evil.example/candidat/offres/public/offre-12345678',
  '//evil.example/candidat/offres/public/offre-12345678',
  '/candidat/offres/public/offre-12345678?next=https://evil.example',
  '/candidat/offres/private-id',
  '/candidat/offres/public/../../admin',
]) {
  assert.equal(normalizePublicOfferReturnTo(unsafeReturnTo), null);
}

assert.equal(serializeJsonLd({ value: '</script><script>alert(1)</script>' }).includes('</script>'), false);

const sitemapSource = readFileSync(resolve(process.cwd(), 'app/sitemap.ts'), 'utf8');
assert.match(sitemapSource, /listPublicOffersServer/);
assert.match(sitemapSource, /listPublicCandidatesServer/);
const robotsSource = readFileSync(resolve(process.cwd(), 'app/robots.ts'), 'utf8');
assert.match(robotsSource, /OAI-SearchBot/);
for (const privateRoute of ['/admin/', '/api/', '/candidat/', '/entreprise/', '/connexion', '/onboarding', '/recommandation/', '/invitation-entreprise/']) {
  assert.match(robotsSource, new RegExp(privateRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.doesNotMatch(robotsSource, /GPTBot/);

const firestoreRulesSource = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
assert.match(firestoreRulesSource, /match \/candidate_profiles\/\{uid\}[\s\S]*?allow read: if isAdmin\(\) \|\| isOwner\(uid\);/);
assert.match(firestoreRulesSource, /match \/job_offers\/\{offerId\}[\s\S]*?allow read: if isAdmin\(\);/);
assert.doesNotMatch(firestoreRulesSource, /match \/candidate_profiles\/\{uid\}[\s\S]{0,120}allow read: if true/);
assert.doesNotMatch(firestoreRulesSource, /match \/job_offers\/\{offerId\}[\s\S]{0,120}allow read: if true/);
assert.match(firestoreRulesSource, /match \/candidate_public_visibility_consents\/\{consentId\}[\s\S]*?allow read, write: if false;/);

const publicOfferPageSource = readFileSync(resolve(process.cwd(), 'app/offres/[slug]/page.tsx'), 'utf8');
assert.match(publicOfferPageSource, /buildPublicOfferLoginHref\(offer\.slug\)/);
const publicOfferResolverSource = readFileSync(resolve(process.cwd(), 'lib/seveno-public-offers-server.ts'), 'utf8');
assert.match(publicOfferResolverSource, /resolvePublicOfferIdBySlugServer/);
const candidateProfileServerSource = readFileSync(resolve(process.cwd(), 'lib/seveno-candidate-profile-server.ts'), 'utf8');
assert.match(candidateProfileServerSource, /randomBytes\(20\)\.toString\('hex'\)/);
assert.match(candidateProfileServerSource, /candidate_public_visibility_consents/);
assert.doesNotMatch(candidateProfileServerSource, /buildPublicCandidateSlug\(publicCandidateId/);

console.log('Public discovery SEO smoke test: OK');
