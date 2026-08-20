export const PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION = '1.0';

export type PublicSearchConsentDecision =
  | 'unchanged'
  | 'accepted'
  | 'revoked'
  | 'explicit_acceptance_required';

export type PublicSearchConsentState<T> = {
  enabled: boolean;
  acceptedVersion: string | null;
  acceptedAt: T | null;
  revokedAt: T | null;
  updatedAt: T;
};

export function decidePublicSearchConsentTransition(input: {
  existingEnabled: boolean;
  existingAcceptedVersion: string | null;
  requestedEnabled: boolean;
  explicitlyAcceptedVersion: string | null;
}): PublicSearchConsentDecision {
  if (!input.requestedEnabled) {
    return input.existingEnabled ? 'revoked' : 'unchanged';
  }

  if (
    input.existingEnabled
    && input.existingAcceptedVersion === PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION
  ) {
    return 'unchanged';
  }

  if (input.explicitlyAcceptedVersion === PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION) {
    return 'accepted';
  }

  return 'explicit_acceptance_required';
}

export function applyPublicSearchConsentDecision<T>(input: {
  decision: Exclude<PublicSearchConsentDecision, 'explicit_acceptance_required'>;
  existing: PublicSearchConsentState<T>;
  now: T;
}): PublicSearchConsentState<T> {
  if (input.decision === 'accepted') {
    return {
      enabled: true,
      acceptedVersion: PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION,
      acceptedAt: input.now,
      revokedAt: null,
      updatedAt: input.now,
    };
  }

  if (input.decision === 'revoked') {
    return {
      ...input.existing,
      enabled: false,
      revokedAt: input.now,
      updatedAt: input.now,
    };
  }

  return input.existing;
}
