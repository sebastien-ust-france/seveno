import assert from 'node:assert/strict';
import {
  isActionableAvailabilityForegroundNotification,
  isActionableCandidateOfferForegroundNotification,
  parseCandidateForegroundNotification,
} from '@/lib/seveno-candidate-availability-foreground';

function main() {
  // Un message de disponibilité complet (requestId + token) doit être jugé actionnable.
  const availability = parseCandidateForegroundNotification(
    { kind: 'availability', requestId: 'req-1', token: 'tok-1', candidateUid: 'uid-1' },
    { title: 'Titre', body: 'Corps' },
  );
  assert.equal(availability.kind, 'availability');
  assert.equal(availability.requestId, 'req-1');
  assert.equal(availability.token, 'tok-1');
  assert.equal(availability.title, 'Titre');
  assert.equal(availability.body, 'Corps');
  assert.equal(isActionableAvailabilityForegroundNotification(availability), true);

  // Un message de test ne doit jamais être actionnable, même s'il contient par erreur un requestId/token.
  const test = parseCandidateForegroundNotification(
    { kind: 'test', clickUrl: '/candidat', requestId: 'req-2', token: 'tok-2' },
    undefined,
  );
  assert.equal(test.kind, 'test');
  assert.equal(isActionableAvailabilityForegroundNotification(test), false);

  // Un message de disponibilité sans requestId/token (payload incomplet) ne doit pas être actionnable :
  // repli attendu côté UI vers un simple lien /candidat/disponibilite.
  const incompleteAvailability = parseCandidateForegroundNotification(
    { kind: 'availability' },
    undefined,
  );
  assert.equal(incompleteAvailability.requestId, null);
  assert.equal(incompleteAvailability.token, null);
  assert.equal(isActionableAvailabilityForegroundNotification(incompleteAvailability), false);

  // Un kind absent ou inconnu doit être classé 'unknown' et jamais actionnable.
  const unknown = parseCandidateForegroundNotification(undefined, undefined);
  assert.equal(unknown.kind, 'unknown');
  assert.equal(isActionableAvailabilityForegroundNotification(unknown), false);

  const unexpectedKind = parseCandidateForegroundNotification({ kind: 'something_else' }, undefined);
  assert.equal(unexpectedKind.kind, 'unknown');
  assert.equal(isActionableAvailabilityForegroundNotification(unexpectedKind), false);

  // requestId/token vides (chaîne vide) doivent être traités comme absents.
  const emptyStrings = parseCandidateForegroundNotification(
    { kind: 'availability', requestId: '', token: '' },
    undefined,
  );
  assert.equal(emptyStrings.requestId, null);
  assert.equal(emptyStrings.token, null);
  assert.equal(isActionableAvailabilityForegroundNotification(emptyStrings), false);

  const offer = parseCandidateForegroundNotification({
    kind: 'candidate_matching_offer_published',
    offerId: 'offer-1',
    clickUrl: '/candidat/offres/offer-1',
  }, { title: 'Nouvelle offre disponible', body: 'Une offre est disponible.' });
  assert.equal(isActionableCandidateOfferForegroundNotification(offer), true);
  assert.equal(isActionableAvailabilityForegroundNotification(offer), false);

  const externalOffer = parseCandidateForegroundNotification({
    kind: 'candidate_matching_offer_published',
    offerId: 'offer-1',
    clickUrl: 'https://example.com/candidat/offres/offer-1',
  }, undefined);
  assert.equal(isActionableCandidateOfferForegroundNotification(externalOffer), false);

  console.log('Candidate foreground notification parsing smoke test: OK');
}

main();
