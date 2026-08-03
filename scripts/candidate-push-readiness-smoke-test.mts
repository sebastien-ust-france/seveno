import assert from 'node:assert/strict';
import {
  computeCandidatePushReadiness,
  describeCandidatePushBlockingReason,
  describeCandidatePushReadinessForCandidate,
  type CandidatePushReadinessInput,
} from '@/lib/seveno-candidate-push-readiness';

function buildInput(overrides: Partial<CandidatePushReadinessInput> = {}): CandidatePushReadinessInput {
  return {
    browserSupport: 'supported',
    permission: 'granted',
    serviceWorker: 'active',
    hasToken: true,
    deviceRegistration: 'registered',
    dailyPreference: 'enabled',
    ...overrides,
  };
}

function main() {
  const fullyReady = computeCandidatePushReadiness(buildInput());
  assert.equal(fullyReady.ready, true);
  assert.equal(fullyReady.blockingReason, null);
  assert.match(describeCandidatePushBlockingReason(fullyReady.blockingReason), /opérationnel/);

  const unsupportedBrowser = computeCandidatePushReadiness(buildInput({ browserSupport: 'unsupported', permission: 'unsupported' }));
  assert.equal(unsupportedBrowser.ready, false);
  assert.equal(unsupportedBrowser.blockingReason, 'unsupported_browser');

  const permissionRequired = computeCandidatePushReadiness(buildInput({ permission: 'default' }));
  assert.equal(permissionRequired.ready, false);
  assert.equal(permissionRequired.blockingReason, 'permission_required');

  const permissionDenied = computeCandidatePushReadiness(buildInput({ permission: 'denied' }));
  assert.equal(permissionDenied.ready, false);
  assert.equal(permissionDenied.blockingReason, 'permission_denied');

  const serviceWorkerNotActive = computeCandidatePushReadiness(buildInput({ serviceWorker: 'registering' }));
  assert.equal(serviceWorkerNotActive.ready, false);
  assert.equal(serviceWorkerNotActive.blockingReason, 'service_worker_error');

  const serviceWorkerError = computeCandidatePushReadiness(buildInput({ serviceWorker: 'error' }));
  assert.equal(serviceWorkerError.ready, false);
  assert.equal(serviceWorkerError.blockingReason, 'service_worker_error');

  const tokenMissing = computeCandidatePushReadiness(buildInput({ hasToken: false }));
  assert.equal(tokenMissing.ready, false);
  assert.equal(tokenMissing.blockingReason, 'token_missing');

  const deviceNotRegistered = computeCandidatePushReadiness(buildInput({ deviceRegistration: 'missing' }));
  assert.equal(deviceNotRegistered.ready, false);
  assert.equal(deviceNotRegistered.blockingReason, 'device_not_registered');

  const invalidDevice = computeCandidatePushReadiness(buildInput({ deviceRegistration: 'invalid' }));
  assert.equal(invalidDevice.ready, false);
  assert.equal(invalidDevice.blockingReason, 'device_not_registered');

  const preferenceDisabled = computeCandidatePushReadiness(buildInput({ dailyPreference: 'disabled' }));
  assert.equal(preferenceDisabled.ready, false);
  assert.equal(preferenceDisabled.blockingReason, 'preference_disabled');

  // Priority ordering: an unsupported browser must win over every other signal.
  const everythingWrongAtOnce = computeCandidatePushReadiness(buildInput({
    browserSupport: 'unsupported',
    permission: 'denied',
    serviceWorker: 'error',
    hasToken: false,
    deviceRegistration: 'missing',
    dailyPreference: 'disabled',
  }));
  assert.equal(everythingWrongAtOnce.blockingReason, 'unsupported_browser');

  // Candidate-facing summary must stay free of technical jargon (no "service worker", "FCM",
  // "VAPID", "token", "deviceId"...) and use exactly the plain wording expected on the dashboard.
  const readySummary = describeCandidatePushReadinessForCandidate(fullyReady);
  assert.deepEqual(readySummary, {
    browserLabel: 'Autorisé',
    deviceLabel: 'Enregistré',
    dailyPreferenceLabel: 'Actives',
  });

  const deniedSummary = describeCandidatePushReadinessForCandidate(permissionDenied);
  assert.equal(deniedSummary.browserLabel, 'Refusé');

  const unsupportedSummary = describeCandidatePushReadinessForCandidate(unsupportedBrowser);
  assert.equal(unsupportedSummary.browserLabel, 'Non compatible');

  const tokenMissingSummary = describeCandidatePushReadinessForCandidate(tokenMissing);
  assert.equal(tokenMissingSummary.deviceLabel, 'Non enregistré');

  const preferenceDisabledSummary = describeCandidatePushReadinessForCandidate(preferenceDisabled);
  assert.equal(preferenceDisabledSummary.dailyPreferenceLabel, 'Désactivées');

  const jargonWords = ['service worker', 'Service Worker', 'FCM', 'VAPID', 'token', 'deviceId', 'endpoint'];
  for (const summary of [readySummary, deniedSummary, unsupportedSummary, tokenMissingSummary, preferenceDisabledSummary]) {
    const serialized = JSON.stringify(summary);
    for (const jargonWord of jargonWords) {
      assert.equal(serialized.includes(jargonWord), false, `Le résumé candidat ne doit pas contenir "${jargonWord}"`);
    }
  }

  console.log('Candidate push readiness smoke test: OK');
}

main();
