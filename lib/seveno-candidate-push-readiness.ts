/**
 * Unified, non-boolean representation of the candidate push notification pipeline.
 *
 * The previous implementation collapsed three independent concerns (browser permission,
 * device/service worker/token state, and the Seven'O "daily confirmation" preference) into a
 * single toggle. This made it impossible to tell *why* push notifications were not working for
 * a given candidate. This module exposes each dimension explicitly and derives a single
 * actionable `blockingReason` without hiding the underlying detail.
 */

export type CandidatePushBrowserSupport = 'supported' | 'unsupported';

export type CandidatePushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export type CandidatePushServiceWorkerState = 'unknown' | 'registering' | 'active' | 'error';

export type CandidatePushDeviceRegistrationState = 'unknown' | 'missing' | 'registered' | 'invalid';

export type CandidatePushDailyPreferenceState = 'unknown' | 'enabled' | 'disabled';

export type CandidatePushBlockingReason =
  | null
  | 'unsupported_browser'
  | 'permission_required'
  | 'permission_denied'
  | 'service_worker_error'
  | 'token_missing'
  | 'device_not_registered'
  | 'preference_disabled';

export interface CandidatePushReadinessInput {
  browserSupport: CandidatePushBrowserSupport;
  permission: CandidatePushPermission;
  serviceWorker: CandidatePushServiceWorkerState;
  hasToken: boolean;
  deviceRegistration: CandidatePushDeviceRegistrationState;
  dailyPreference: CandidatePushDailyPreferenceState;
}

export interface CandidatePushReadiness extends CandidatePushReadinessInput {
  ready: boolean;
  blockingReason: CandidatePushBlockingReason;
}

/**
 * Combines the independent push signals into one explicit state, in the order a candidate would
 * actually need to resolve them (support, then permission, then device, then preference).
 */
export function computeCandidatePushReadiness(input: CandidatePushReadinessInput): CandidatePushReadiness {
  const blockingReason = resolveBlockingReason(input);

  return {
    ...input,
    ready: blockingReason === null,
    blockingReason,
  };
}

function resolveBlockingReason(input: CandidatePushReadinessInput): CandidatePushBlockingReason {
  if (input.browserSupport === 'unsupported' || input.permission === 'unsupported') {
    return 'unsupported_browser';
  }

  if (input.permission === 'default') {
    return 'permission_required';
  }

  if (input.permission === 'denied') {
    return 'permission_denied';
  }

  if (input.serviceWorker !== 'active') {
    return 'service_worker_error';
  }

  if (!input.hasToken) {
    return 'token_missing';
  }

  if (input.deviceRegistration !== 'registered') {
    return 'device_not_registered';
  }

  if (input.dailyPreference !== 'enabled') {
    return 'preference_disabled';
  }

  return null;
}

const BLOCKING_REASON_LABELS: Record<Exclude<CandidatePushBlockingReason, null>, string> = {
  unsupported_browser: 'Ce navigateur ne prend pas en charge les notifications push.',
  permission_required: 'La permission de notification n’a pas encore été accordée.',
  permission_denied: 'La permission de notification a été refusée dans le navigateur.',
  service_worker_error: 'Le service worker de notifications n’est pas actif.',
  token_missing: 'Aucun abonnement Firebase (token) n’a encore été créé.',
  device_not_registered: 'Cet appareil n’est pas enregistré côté serveur.',
  preference_disabled: 'Les confirmations quotidiennes sont désactivées.',
};

export function describeCandidatePushBlockingReason(reason: CandidatePushBlockingReason): string {
  return reason ? BLOCKING_REASON_LABELS[reason] : 'Le pipeline de notifications est opérationnel.';
}

export interface CandidatePushCandidateFacingSummary {
  browserLabel: 'Autorisé' | 'À autoriser' | 'Refusé' | 'Non compatible';
  deviceLabel: 'Enregistré' | 'Non enregistré' | 'Erreur';
  dailyPreferenceLabel: 'Actives' | 'Désactivées';
}

/**
 * Candidate-facing summary of a readiness snapshot, in plain French, with no technical jargon
 * (no "service worker", "FCM", "VAPID", "token", "deviceId"...). Intended for the candidate
 * dashboard only; the raw `CandidatePushReadiness` stays available for admin/diagnostic use.
 */
export function describeCandidatePushReadinessForCandidate(
  readiness: CandidatePushReadiness,
): CandidatePushCandidateFacingSummary {
  const browserLabel: CandidatePushCandidateFacingSummary['browserLabel'] = (
    readiness.browserSupport === 'unsupported' || readiness.permission === 'unsupported'
  )
    ? 'Non compatible'
    : readiness.permission === 'denied'
      ? 'Refusé'
      : readiness.permission === 'default'
        ? 'À autoriser'
        : 'Autorisé';

  const deviceLabel: CandidatePushCandidateFacingSummary['deviceLabel'] = readiness.serviceWorker === 'error'
    || readiness.deviceRegistration === 'invalid'
    ? 'Erreur'
    : readiness.deviceRegistration === 'registered' && readiness.hasToken
      ? 'Enregistré'
      : 'Non enregistré';

  const dailyPreferenceLabel: CandidatePushCandidateFacingSummary['dailyPreferenceLabel'] = readiness.dailyPreference === 'enabled'
    ? 'Actives'
    : 'Désactivées';

  return { browserLabel, deviceLabel, dailyPreferenceLabel };
}

