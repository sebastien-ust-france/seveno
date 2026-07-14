'use client';

import type { User } from 'firebase/auth';
import { getToken, isSupported, getMessaging } from 'firebase/messaging';
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
    return null;
  }

  const registration = await navigator.serviceWorker.register(AVAILABILITY_SERVICE_WORKER_PATH, { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function requestCandidateAvailabilityPushToken() {
  if (!firebaseApp || !hasWindow()) {
    return {
      permission: 'default' as NotificationPermission,
      token: null,
      deviceId: getOrCreateAvailabilityDeviceId(),
      serviceWorkerRegistration: null,
      supported: false,
    };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported || !('Notification' in window)) {
    return {
      permission: 'default' as NotificationPermission,
      token: null,
      deviceId: getOrCreateAvailabilityDeviceId(),
      serviceWorkerRegistration: null,
      supported: false,
    };
  }

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  const deviceId = getOrCreateAvailabilityDeviceId();
  const serviceWorkerRegistration = await ensureAvailabilityServiceWorker();

  if (permission !== 'granted' || !serviceWorkerRegistration) {
    return {
      permission,
      token: null,
      deviceId,
      serviceWorkerRegistration,
      supported,
    };
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    return {
      permission,
      token: null,
      deviceId,
      serviceWorkerRegistration,
      supported,
    };
  }

  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });

  return {
    permission,
    token,
    deviceId,
    serviceWorkerRegistration,
    supported,
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
  );
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

