import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCandidateMatchingOfferEventId,
  buildCandidateOfferApplicationGuardId,
  buildCandidateOfferFanoutId,
  isCandidateContractCompatible,
  mapOfferContractTypeToCandidateCode,
} from '@/lib/seveno-candidate-offer-notifications-server';
import { isFirstCandidateOfferPublication } from '@/lib/seveno-job-offers-server';
import {
  isActionableCandidateOfferForegroundNotification,
  parseCandidateForegroundNotification,
} from '@/lib/seveno-candidate-availability-foreground';

assert.equal(mapOfferContractTypeToCandidateCode('permanent'), 'CDI');
assert.equal(mapOfferContractTypeToCandidateCode('fixed_term'), 'CDD');
assert.equal(mapOfferContractTypeToCandidateCode('temporary'), 'INTERIM');
assert.equal(mapOfferContractTypeToCandidateCode('freelance'), 'FREELANCE');
assert.equal(mapOfferContractTypeToCandidateCode('apprenticeship'), 'ALTERNANCE');
assert.equal(mapOfferContractTypeToCandidateCode('internship'), 'STAGE');
assert.equal(mapOfferContractTypeToCandidateCode('other'), 'AUTRE');
assert.equal(isCandidateContractCompatible([], 'permanent'), true);
assert.equal(isCandidateContractCompatible(['CDI'], 'permanent'), true);
assert.equal(isCandidateContractCompatible(['CDD'], 'permanent'), false);
assert.equal(isFirstCandidateOfferPublication('draft', 'publish', false), true);
assert.equal(isFirstCandidateOfferPublication('draft', 'publish', true), false, 'Une version figée publiée bloque une nouvelle vague après restauration.');
assert.equal(isFirstCandidateOfferPublication('paused', 'reactivate', true), false);
assert.equal(isFirstCandidateOfferPublication('published', 'pause', true), false);
assert.equal(isFirstCandidateOfferPublication('closed', 'restore', true), false);

assert.equal(buildCandidateOfferFanoutId('offer-1'), 'candidate_offer_fanout:offer-1');
assert.equal(
  buildCandidateMatchingOfferEventId('offer-1', 'candidate-1'),
  'candidate_matching_offer_published:offer-1:candidate-1',
);
assert.equal(
  buildCandidateOfferApplicationGuardId('offer-1', 'candidate-1'),
  buildCandidateOfferApplicationGuardId('offer-1', 'candidate-1'),
);

const foreground = parseCandidateForegroundNotification({
  kind: 'candidate_matching_offer_published',
  offerId: 'offer-1',
  clickUrl: '/candidat/offres/offer-1',
}, { title: 'Nouvelle offre disponible', body: 'Une offre est disponible.' });
assert.equal(isActionableCandidateOfferForegroundNotification(foreground), true);
assert.equal(foreground.clickUrl, '/candidat/offres/offer-1');
assert.equal(isActionableCandidateOfferForegroundNotification(parseCandidateForegroundNotification({
  kind: 'candidate_matching_offer_published',
  offerId: 'offer-1',
  clickUrl: 'https://example.com/candidat/offres/offer-1',
}, undefined)), false);
assert.equal(parseCandidateForegroundNotification({ kind: 'unknown-kind' }, undefined).kind, 'unknown');

const publicationSource = readFileSync('lib/seveno-job-offers-server.ts', 'utf8');
assert.match(publicationSource, /isFirstCandidateOfferPublication\(/);
assert.match(publicationSource, /ref\.collection\('versions'\)\.doc\(String\(current\.version\)\)/);
assert.match(publicationSource, /publishedVersionSnapshot\.get\('status'\) === 'published'/);
assert.match(publicationSource, /prepareCandidateOfferFanout\(transaction/);
assert.match(publicationSource, /processCandidateOfferFanout\(result\.fanout\.fanoutId\)/);

const serverSource = readFileSync('lib/seveno-candidate-offer-notifications-server.ts', 'utf8');
for (const required of [
  "where('targetJobRoleIds', 'array-contains', fanout.jobRoleId)",
  "where('profileStatus', '==', 'active')",
  "where('matchingOfferAlertsEnabled', '==', true)",
  'FANOUT_PAGE_SIZE = 25',
  'daily_offer_alert_limit_reached',
  "where('enabled', '==', true)",
  "recipientRole: 'candidate'",
  "kind: CANDIDATE_MATCHING_OFFER_EVENT_TYPE",
]) assert.match(serverSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(serverSource, /candidateName|candidateEmail|candidatePhone/);

const dashboardSource = readFileSync('app/candidat/page.tsx', 'utf8');
assert.match(dashboardSource, /Nouvelles offres :/);
assert.match(dashboardSource, /Activer les alertes de nouvelles offres/);
assert.match(dashboardSource, /Voir l’offre/);
assert.doesNotMatch(dashboardSource, />Tester une notification</);
for (const jargon of ['VAPID', 'deviceId', 'service worker']) {
  assert.doesNotMatch(dashboardSource, new RegExp(`>${jargon}`, 'i'));
}

const workerSource = readFileSync('app/firebase-messaging-sw.js/route.ts', 'utf8');
assert.match(workerSource, /candidate_matching_offer_published/);
assert.match(workerSource, /getSafeCandidateOfferUrl/);
assert.match(workerSource, /if \(!isTestNotification && !isAvailabilityNotification && !isCompanyNotification && !isCandidateOfferNotification\)/);

const rules = readFileSync('firestore.rules', 'utf8');
assert.match(rules, /match \/offer_notification_fanouts\/\{fanoutId\}/);
assert.match(rules, /match \/candidate_offer_alert_quotas\/\{uid\}/);
const hosting = readFileSync('apphosting.yaml', 'utf8');
assert.match(hosting, /SEVENO_NOTIFICATION_OUTBOX_CRON_SECRET/);

console.log('Candidate matching offer notification smoke test: OK');
