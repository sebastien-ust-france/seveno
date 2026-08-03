'use client';

import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase';

export const SEVENO_MESSAGING_SERVICE_WORKER_PATH = '/firebase-messaging-sw.js';

export type SevenoPushBrowserSupport = {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerRegistration: ServiceWorkerRegistration | null;
};

function hasBrowserWindow() {
  return typeof window !== 'undefined';
}

export function getOrCreateSevenoPushDeviceId(storageKey: string) {
  if (!hasBrowserWindow()) {
    return crypto.randomUUID();
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      return stored;
    }

    const deviceId = crypto.randomUUID();
    window.localStorage.setItem(storageKey, deviceId);
    return deviceId;
  } catch {
    return crypto.randomUUID();
  }
}

export function detectSevenoPushBrowserSupport() {
  if (!firebaseApp || !hasBrowserWindow()) {
    return false;
  }

  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPassiveSevenoPushBrowserSupport(): Promise<SevenoPushBrowserSupport> {
  if (!detectSevenoPushBrowserSupport()) {
    return {
      supported: false,
      permission: 'unsupported',
      serviceWorkerRegistration: null,
    };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return {
      supported: false,
      permission: 'unsupported',
      serviceWorkerRegistration: null,
    };
  }

  const serviceWorkerRegistration = await navigator.serviceWorker
    .getRegistration(SEVENO_MESSAGING_SERVICE_WORKER_PATH)
    .catch(() => undefined);

  return {
    supported: true,
    permission: Notification.permission,
    serviceWorkerRegistration: serviceWorkerRegistration ?? null,
  };
}

export async function ensureSevenoMessagingServiceWorker() {
  if (!detectSevenoPushBrowserSupport()) {
    return null;
  }

  const registration = await navigator.serviceWorker.register(SEVENO_MESSAGING_SERVICE_WORKER_PATH, { scope: '/' });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function requestSevenoNotificationPermission() {
  if (!detectSevenoPushBrowserSupport()) {
    return 'unsupported' as const;
  }

  return Notification.permission === 'default'
    ? Notification.requestPermission()
    : Notification.permission;
}

export async function createSevenoPushToken(serviceWorkerRegistration: ServiceWorkerRegistration) {
  if (!firebaseApp) {
    return null;
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    return null;
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return null;
  }

  return getToken(getMessaging(firebaseApp), {
    vapidKey,
    serviceWorkerRegistration,
  }).catch(() => null);
}

export async function subscribeToSevenoForegroundMessages(
  handler: (payload: MessagePayload) => void,
) {
  if (!firebaseApp || !hasBrowserWindow()) {
    return () => {};
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return () => {};
  }

  return onMessage(getMessaging(firebaseApp), handler);
}
