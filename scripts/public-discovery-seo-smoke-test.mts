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
  PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
  serializeJsonLd,
} from '@/lib/seveno-public-discovery';

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
};

const offer = projectPublicOffer('private-firestore-id', privateOffer);
assert.ok(offer);
assert.deepEqual(offer.requiredPrerequisites, ['Permis B']);
assert.deepEqual(offer.preferredPrerequisites, ['Premiers secours']);
const offerJson = JSON.stringify(offer);
for (const forbidden of ['companyUid', 'companyId', 'createdByUid', 'assignedToUid', 'questionnaireId', 'private-firestore-id', 'prerequisiteId', 'expectedCriterion']) {
  assert.equal(offerJson.includes(forbidden), false, `Forbidden offer field leaked: ${forbidden}`);
}
for (const status of ['draft', 'paused', 'closed', 'archived']) {
  assert.equal(projectPublicOffer('offer-id', { ...privateOffer, status }), null);
}
assert.equal(isPublicOfferPublicationActive(privateOffer, null), true);
assert.equal(isPublicOfferPublicationActive(
  { ...privateOffer, activeCampaignId: 'campaign-id' },
  { status: 'active', endsAt: new Date('2026-08-21T10:00:00.000Z') },
  new Date('2026-08-20T10:00:00.000Z'),
), true);
assert.equal(isPublicOfferPublicationActive(
  { ...privateOffer, activeCampaignId: 'campaign-id' },
  { status: 'active', endsAt: new Date('2026-08-19T10:00:00.000Z') },
  new Date('2026-08-20T10:00:00.000Z'),
), false);
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
assert.equal('validThrough' in jobPosting, false);
assert.equal('jobLocation' in jobPosting, true);

const remoteOffer = projectPublicOffer('remote-id', { ...privateOffer, workMode: 'remote', cityName: '', location: 'France' });
assert.ok(remoteOffer);
const remoteJobPosting = buildJobPostingJsonLd(remoteOffer);
assert.equal(remoteJobPosting.jobLocationType, 'TELECOMMUTE');
assert.equal('jobLocation' in remoteJobPosting, false);
assert.equal(remoteJobPosting.applicantLocationRequirements.name, 'FR');

const publicCandidateId = 'SEV-CAND-ABC234';
const publicSearchSlug = buildPublicCandidateSlug(publicCandidateId, 'Responsable magasin', 'Gironde, France');
const candidateSource = {
  profileStatus: 'active',
  publicSearchVisibilityEnabled: true,
  publicSearchVisibilityConsentVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
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
assert.equal(projectPublicCandidate({ ...candidateSource, publicSearchVisibilityConsentVersion: null }), null);
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

console.log('Public discovery SEO smoke test: OK');
