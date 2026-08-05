'use client';

import type { User } from 'firebase/auth';
import { getToken, isSupported, getMessaging, onMessage } from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import {
  computeCandidatePushReadiness,
  type CandidatePushReadiness,
} from '@/lib/seveno-candidate-push-readiness';
import {
  parseCandidateForegroundNotification,
  type CandidateForegroundNotification,
} from '@/lib/seveno-candidate-availability-foreground';
import type {
  AvailabilityNotificationSource,
  CandidateAvailabilityConfirmationAction,
  CandidateProfile,
} from '@/types/seveno';

const AVAILABILITY_DEVICE_STORAGE_KEY = 'seveno.availability.deviceId';
const AVAILABILITY_SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

function hasWindow() {
  return typeof window !== 'undefined';
}

function logAvailabilityDebug(step: string, details?: Record<string, unknown>) {
  console.info('[SevenO availability test]', {
    step,
    ...details,
  });
}

function getOrCreateAvailabilityDeviceId() {
  if (!hasWindow()) {
    return crypto.randomUUID();
  }

  try {
    const stored = window.localStorage.getItem(AVAILABILITY_DEVICE_STORAGE_KEY);
    if (stored) {
      return stored;
    }

    const deviceId = crypto.randomUUID();
    window.localStorage.setItem(AVAILABILITY_DEVICE_STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    return crypto.randomUUID();
  }
}

async function ensureAvailabilityServiceWorker() {
  if (!hasWindow() || !('serviceWorker' in navigator)) {
    logAvailabilityDebug('service_worker_unavailable', {
      hasWindow: hasWindow(),
      hasServiceWorkerApi: hasWindow() ? 'serviceWorker' in navigator : false,
    });
    return null;
  }

  logAvailabilityDebug('service_worker_register_attempt', {
    path: AVAILABILITY_SERVICE_WORKER_PATH,
  });
  const registration = await navigator.serviceWorker.register(AVAILABILITY_SERVICE_WORKER_PATH, { scope: '/' });
  logAvailabilityDebug('service_worker_registered', {
    scope: registration.scope,
    active: Boolean(registration.active),
    waiting: Boolean(registration.waiting),
    installing: Boolean(registration.installing),
  });
  await navigator.serviceWorker.ready;
  logAvailabilityDebug('service_worker_ready', {
    scope: registration.scope,
    active: Boolean(registration.active),
    waiting: Boolean(registration.waiting),
    installing: Boolean(registration.installing),
  });
  return registration;
}

export async function requestCandidateAvailabilityPushToken() {
  if (!firebaseApp || !hasWindow()) {
    logAvailabilityDebug('push_support_unavailable', {
      hasFirebaseApp: Boolean(firebaseApp),
      hasWindow: hasWindow(),
    });
    return {
      permission: 'default' as NotificationPermission,
      token: null,
      deviceId: getOrCreateAvailabilityDeviceId(),
      serviceWorkerRegistration: null,
      supported: false,
      vapidKeyPresent: false,
    };
  }

  const hasNotificationApi = 'Notification' in window;
  const hasServiceWorkerApi = 'serviceWorker' in navigator;
  const hasPushManagerApi = 'PushManager' in window;
  if (!hasNotificationApi || !hasServiceWorkerApi || !hasPushManagerApi) {
    logAvailabilityDebug('browser_not_supported', {
      supported: false,
      hasNotificationApi,
      hasServiceWorkerApi,
      hasPushManagerApi,
    });
    return {
      permission: 'default' as NotificationPermission,
      token: null,
      deviceId: getOrCreateAvailabilityDeviceId(),
      serviceWorkerRegistration: null,
      supported: false,
      vapidKeyPresent: false,
    };
  }

  logAvailabilityDebug('browser_permission_before_request', {
    permission: Notification.permission,
  });
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  logAvailabilityDebug('permission_result', {
    permission,
  });
  logAvailabilityDebug('browser_permission_result', {
    permission,
  });
  const deviceId = getOrCreateAvailabilityDeviceId();
  const serviceWorkerRegistration = await ensureAvailabilityServiceWorker();
  const supported = await isSupported().catch(() => false);

  if (!supported) {
    logAvailabilityDebug('browser_not_supported', {
      supported,
      hasNotificationApi,
      hasServiceWorkerApi,
      hasPushManagerApi,
    });
    return {
      permission,
      token: null,
      deviceId,
      serviceWorkerRegistration,
      supported: false,
      vapidKeyPresent: false,
    };
  }

  if (permission !== 'granted' || !serviceWorkerRegistration) {
    logAvailabilityDebug('push_support_blocked_before_token', {
      permission,
      hasServiceWorkerRegistration: Boolean(serviceWorkerRegistration),
      serviceWorkerActive: Boolean(serviceWorkerRegistration?.active),
    });
    return {
      permission,
      token: null,
      deviceId,
      serviceWorkerRegistration,
      supported,
      vapidKeyPresent: false,
    };
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    logAvailabilityDebug('vapid_key_missing', {
      permission,
      serviceWorkerActive: Boolean(serviceWorkerRegistration.active),
    });
    return {
      permission,
      token: null,
      deviceId,
      serviceWorkerRegistration,
      supported,
      vapidKeyPresent: false,
    };
  }

  const messaging = getMessaging(firebaseApp);
  logAvailabilityDebug('token_generation_attempt', {
    deviceId,
    permission,
    serviceWorkerActive: Boolean(serviceWorkerRegistration.active),
    hasVapidKey: Boolean(vapidKey),
  });

  let token: string | null = null;
  try {
    token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });
  } catch (error) {
    logAvailabilityDebug('token_generation_failed', {
      code: error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code ?? 'unknown') : 'unknown',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (token) {
    logAvailabilityDebug('token_created', {
      deviceId,
      permission,
      serviceWorkerActive: Boolean(serviceWorkerRegistration.active),
    });
  }
  logAvailabilityDebug('token_generation_result', {
    tokenGenerated: Boolean(token),
  });

  return {
    permission,
    token,
    deviceId,
    serviceWorkerRegistration,
    supported,
    vapidKeyPresent: true,
  };
}

type CandidateAvailabilityPreferenceInput = Pick<
  CandidateProfile,
  'dailyAvailabilityConfirmationEnabled' | 'hasActiveAvailabilityPushSubscription'
>;

function resolveDailyPreferenceState(profile: CandidateAvailabilityPreferenceInput | null) {
  if (!profile) {
    return 'unknown' as const;
  }

  return profile.dailyAvailabilityConfirmationEnabled ? ('enabled' as const) : ('disabled' as const);
}

/**
 * Read-only snapshot of the push pipeline, safe to call on mount: it never registers the service
 * worker, never requests the notification permission, and never fetches a new FCM token. Use
 * {@link buildCandidatePushReadinessFromLiveSupport} right after an explicit user action (enable,
 * test) to refine the snapshot with the signals collected during that action.
 */
export async function getPassiveCandidatePushReadinessSnapshot(
  profile: CandidateAvailabilityPreferenceInput | null,
): Promise<CandidatePushReadiness> {
  const dailyPreference = resolveDailyPreferenceState(profile);
  const deviceRegistration = profile
    ? (profile.hasActiveAvailabilityPushSubscription ? ('registered' as const) : ('missing' as const))
    : ('unknown' as const);

  if (!hasWindow()) {
    return computeCandidatePushReadiness({
      browserSupport: 'unsupported',
      permission: 'unsupported',
      serviceWorker: 'unknown',
      hasToken: false,
      deviceRegistration,
      dailyPreference,
    });
  }

  const hasNotificationApi = 'Notification' in window;
  const hasServiceWorkerApi = 'serviceWorker' in navigator;
  const hasPushManagerApi = 'PushManager' in window;
  const browserSupport = hasNotificationApi && hasServiceWorkerApi && hasPushManagerApi
    ? ('supported' as const)
    : ('unsupported' as const);
  const permission = browserSupport === 'unsupported' ? ('unsupported' as const) : Notification.permission;

  let serviceWorker: 'unknown' | 'registering' | 'active' | 'error' = 'unknown';
  if (browserSupport === 'supported' && hasServiceWorkerApi) {
    try {
      const registration = await navigator.serviceWorker.getRegistration(AVAILABILITY_SERVICE_WORKER_PATH);
      serviceWorker = registration ? (registration.active ? 'active' : 'registering') : 'unknown';
    } catch {
      serviceWorker = 'error';
    }
  }

  return computeCandidatePushReadiness({
    browserSupport,
    permission,
    serviceWorker,
    // A device only ever gets registered server-side once a real token was created client-side,
    // so a registered device is proof a token exists without having to fetch it again here.
    hasToken: deviceRegistration === 'registered',
    deviceRegistration,
    dailyPreference,
  });
}

/**
 * Refines the readiness snapshot using the concrete signals returned by an explicit push action
 * (enable notifications, send test notification), which already performed the permission request,
 * service worker registration and token creation.
 */
export function buildCandidatePushReadinessFromLiveSupport(
  support: Awaited<ReturnType<typeof requestCandidateAvailabilityPushToken>>,
  profile: CandidateAvailabilityPreferenceInput | null,
  hasActiveDevice: boolean | null = null,
): CandidatePushReadiness {
  const deviceRegistration = hasActiveDevice !== null
    ? (hasActiveDevice ? ('registered' as const) : ('missing' as const))
    : profile
      ? (profile.hasActiveAvailabilityPushSubscription ? ('registered' as const) : ('missing' as const))
      : ('unknown' as const);

  return computeCandidatePushReadiness({
    browserSupport: support.supported ? 'supported' : 'unsupported',
    permission: support.permission,
    serviceWorker: support.serviceWorkerRegistration
      ? (support.serviceWorkerRegistration.active ? 'active' : 'registering')
      : 'unknown',
    hasToken: Boolean(support.token),
    deviceRegistration,
    dailyPreference: resolveDailyPreferenceState(profile),
  });
}

export async function registerCandidateAvailabilityDevice(
  authUser: User,
  input: {
    deviceId: string;
    token: string;
    permission: 'default' | 'granted' | 'denied';
    timezone?: string | null;
    platform?: string | null;
    userAgent?: string | null;
    source: AvailabilityNotificationSource;
  },
) {
  return fetchSevenoMatchApi<{
    device: unknown;
    hasActiveDevice: boolean;
  }>(
    authUser,
    '/api/seveno/candidates/availability/notifications',
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'register_device',
        ...input,
      }),
    },
    'availability_register_device',
  );
}

export async function updateCandidateAvailabilityNotifications(
  authUser: User,
  input: {
    action: 'enable' | 'disable';
    source: AvailabilityNotificationSource;
    permission?: 'default' | 'granted' | 'denied' | null;
  },
) {
  return fetchSevenoMatchApi<{ profile: CandidateProfile | null }>(
    authUser,
    '/api/seveno/candidates/availability/notifications',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    'availability_update_notifications',
  );
}

export async function updateCandidateMatchingOfferAlerts(
  authUser: User,
  enabled: boolean,
) {
  return fetchSevenoMatchApi<{ matchingOfferAlertsEnabled: boolean }>(
    authUser,
    '/api/seveno/candidates/availability/notifications',
    {
      method: 'POST',
      body: JSON.stringify({
        action: enabled ? 'enable_offer_alerts' : 'disable_offer_alerts',
      }),
    },
    'matching_offer_alerts_update',
  );
}

export async function sendCandidateAvailabilityTestNotification(
  authUser: User,
  input: {
    source: AvailabilityNotificationSource;
  },
) {
  return fetchSevenoMatchApi<{
    sent: number;
    failed: number;
    invalidDeviceIds: string[];
    hasActiveAvailabilityPushSubscription: boolean;
    profile: CandidateProfile | null;
  }>(
    authUser,
    '/api/seveno/candidates/availability/test-notification',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    'availability_test_notification',
  );
}

export async function subscribeToCandidateAvailabilityForegroundNotifications(
  handler: (notification: CandidateForegroundNotification) => void,
) {
  if (!firebaseApp || !hasWindow()) {
    return () => {};
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return () => {};
  }

  const messaging = getMessaging(firebaseApp);
  return onMessage(messaging, (payload) => {
    handler(parseCandidateForegroundNotification(payload.data, payload.notification));
  });
}

export async function confirmCandidateAvailabilityFromDashboard(
  authUser: User,
  input: {
    action: CandidateAvailabilityConfirmationAction | 'immediate';
    source: AvailabilityNotificationSource;
  },
) {
  return fetchSevenoMatchApi<{ profile: CandidateProfile | null }>(
    authUser,
    '/api/seveno/candidates/availability',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function respondToAvailabilityRequest(
  input: {
    requestId: string;
    token: string;
    action: CandidateAvailabilityConfirmationAction;
    source: AvailabilityNotificationSource;
  },
) {
  const response = await fetch('/api/seveno/candidates/availability/respond', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string'
      ? (payload as { message: string }).message
      : 'La confirmation de disponibilite a echoue.';
    throw new Error(message);
  }

  return payload as {
    requestId: string;
    candidateUid: string;
    status: string;
    availability?: string;
  };
}
