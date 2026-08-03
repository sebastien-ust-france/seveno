/**
 * Pure parsing/filtering logic for foreground FCM messages received on the candidate dashboard.
 * Kept free of Firebase/browser imports so it can be unit tested directly under Node, and reused
 * by the actual subscription wiring in lib/seveno-candidate-availability-client.ts.
 */

export type CandidateForegroundNotificationKind = 'availability' | 'test' | 'unknown';

export interface CandidateForegroundNotification {
  title: string;
  body: string;
  kind: CandidateForegroundNotificationKind;
  requestId: string | null;
  token: string | null;
}

export interface ActionableCandidateAvailabilityForegroundNotification extends CandidateForegroundNotification {
  kind: 'availability';
  requestId: string;
  token: string;
}

const DEFAULT_AVAILABILITY_TITLE = 'Seven’O — Disponibilité';
const DEFAULT_AVAILABILITY_BODY = 'Êtes-vous toujours disponible immédiatement ?';
const DEFAULT_TEST_TITLE = 'Seven’O — Test de notification';
const DEFAULT_TEST_BODY = 'Les notifications sont correctement activées sur cet appareil.';

function toNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseCandidateForegroundNotification(
  data: Record<string, unknown> | undefined,
  notification: { title?: string | null; body?: string | null } | undefined,
): CandidateForegroundNotification {
  const rawKind = data?.kind;
  const kind: CandidateForegroundNotificationKind = rawKind === 'test' || rawKind === 'availability' ? rawKind : 'unknown';

  const title = notification?.title ?? (kind === 'test' ? DEFAULT_TEST_TITLE : DEFAULT_AVAILABILITY_TITLE);
  const body = notification?.body ?? (kind === 'test' ? DEFAULT_TEST_BODY : DEFAULT_AVAILABILITY_BODY);

  return {
    title,
    body,
    kind,
    requestId: toNonEmptyString(data?.requestId),
    token: toNonEmptyString(data?.token),
  };
}

/**
 * Only a genuine availability notification carrying a requestId + token can be answered inline
 * (Toujours disponible / Plus disponible) from the dashboard. Test messages and anything without
 * these fields must never trigger the actionable banner.
 */
export function isActionableAvailabilityForegroundNotification(
  notification: CandidateForegroundNotification,
): notification is ActionableCandidateAvailabilityForegroundNotification {
  return notification.kind === 'availability' && notification.requestId !== null && notification.token !== null;
}
