'use client';

import type { User } from 'firebase/auth';
import { getToken, isSupported, getMessaging, onMessage } from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
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

  const supported = await isSupported().catch(() => false);
  if (!supported || !('Notification' in window)) {
    logAvailabilityDebug('browser_not_supported', {
      supported,
      hasNotificationApi: 'Notification' in window,
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
  logAvailabilityDebug('browser_permission_result', {
    permission,
  });
  const deviceId = getOrCreateAvailabilityDeviceId();
  const serviceWorkerRegistration = await ensureAvailabilityServiceWorker();

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
  handler: (input: {
    title: string;
    body: string;
    kind: 'availability' | 'test' | 'unknown';
  }) => void,
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
    const data = payload.data ?? {};
    const kind = data.kind === 'test' || data.kind === 'availability' ? data.kind : 'unknown';
    const title = payload.notification?.title
      ?? (kind === 'test'
        ? "Seven’O — Test de notification"
        : "Seven’O — Disponibilité");
    const body = payload.notification?.body
      ?? (kind === 'test'
        ? 'Les notifications sont correctement activées sur cet appareil.'
        : 'Vous avez reçu une nouvelle notification Seven’O.');

    handler({ title, body, kind });
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
