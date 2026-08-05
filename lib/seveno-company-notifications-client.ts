'use client';

import type { User } from 'firebase/auth';
import { fetchSevenoMatchApi } from '@/lib/seveno-match-api';
import {
  createSevenoPushToken,
  detectSevenoPushBrowserSupport,
  ensureSevenoMessagingServiceWorker,
  getOrCreateSevenoPushDeviceId,
  getPassiveSevenoPushBrowserSupport,
  requestSevenoNotificationPermission,
  subscribeToSevenoForegroundMessages,
} from '@/lib/seveno-push-client';
import {
  computeCompanyNotificationReadiness,
  type CompanyNotificationReadiness,
  type CompanyNotificationServerState,
} from '@/lib/seveno-company-notification-readiness';
import {
  parseCompanyApplicationForegroundNotification,
  type CompanyApplicationForegroundNotification,
} from '@/lib/seveno-company-notification-foreground';

const COMPANY_DEVICE_STORAGE_KEY = 'seveno.company.notifications.deviceId';
const COMPANY_NOTIFICATION_API_PATH = '/api/seveno/company-notifications';
type CompanyNotificationType = 'application_received' | 'questionnaire_completed';

export function getCompanyNotificationDeviceId() {
  return getOrCreateSevenoPushDeviceId(COMPANY_DEVICE_STORAGE_KEY);
}

export async function getCompanyNotificationState(authUser: User) {
  const deviceId = getCompanyNotificationDeviceId();
  return fetchSevenoMatchApi<CompanyNotificationServerState>(
    authUser,
    `${COMPANY_NOTIFICATION_API_PATH}?deviceId=${encodeURIComponent(deviceId)}`,
  );
}

export async function registerCompanyNotificationDevice(
  authUser: User,
  input: {
    deviceId: string;
    token: string;
    permission: NotificationPermission;
    platform?: string | null;
    userAgent?: string | null;
  },
) {
  return fetchSevenoMatchApi<CompanyNotificationServerState>(authUser, COMPANY_NOTIFICATION_API_PATH, {
    method: 'POST',
    body: JSON.stringify({ action: 'register_device', ...input }),
  });
}

async function setCompanyNotificationPreference(
  authUser: User,
  notificationType: CompanyNotificationType,
  enabled: boolean,
) {
  return fetchSevenoMatchApi<CompanyNotificationServerState>(authUser, COMPANY_NOTIFICATION_API_PATH, {
    method: 'POST',
    body: JSON.stringify({ action: enabled ? 'enable' : 'disable', notificationType }),
  });
}

export function setCompanyApplicationNotifications(authUser: User, enabled: boolean) {
  return setCompanyNotificationPreference(authUser, 'application_received', enabled);
}

export function setCompanyQuestionnaireNotifications(authUser: User, enabled: boolean) {
  return setCompanyNotificationPreference(authUser, 'questionnaire_completed', enabled);
}

export async function getPassiveCompanyNotificationReadiness(
  serverState: CompanyNotificationServerState,
): Promise<CompanyNotificationReadiness> {
  const browser = await getPassiveSevenoPushBrowserSupport();
  return computeCompanyNotificationReadiness({
    supported: browser.supported,
    permission: browser.permission,
    serviceWorkerActive: Boolean(browser.serviceWorkerRegistration?.active),
    serverState,
  });
}

async function activateCompanyNotifications(authUser: User, notificationType: CompanyNotificationType) {
  if (!detectSevenoPushBrowserSupport()) {
    throw new Error('Ce navigateur ne prend pas en charge les notifications.');
  }

  const serviceWorkerRegistration = await ensureSevenoMessagingServiceWorker();
  if (!serviceWorkerRegistration) {
    throw new Error('Les notifications ne peuvent pas être activées sur cet appareil.');
  }

  const permission = await requestSevenoNotificationPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Les notifications sont refusées dans les réglages du navigateur.'
      : 'La permission de notification doit être accordée pour continuer.');
  }

  const token = await createSevenoPushToken(serviceWorkerRegistration);
  if (!token) {
    throw new Error('L’abonnement aux notifications n’a pas pu être créé.');
  }

  const deviceId = getCompanyNotificationDeviceId();
  await registerCompanyNotificationDevice(authUser, {
    deviceId,
    token,
    permission,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  });
  await setCompanyNotificationPreference(authUser, notificationType, true);
  const serverState = await getCompanyNotificationState(authUser);

  return computeCompanyNotificationReadiness({
    supported: true,
    permission,
    serviceWorkerActive: Boolean(serviceWorkerRegistration.active),
    serverState,
  });
}

export function activateCompanyApplicationNotifications(authUser: User) {
  return activateCompanyNotifications(authUser, 'application_received');
}

export function activateCompanyQuestionnaireNotifications(authUser: User) {
  return activateCompanyNotifications(authUser, 'questionnaire_completed');
}

export async function subscribeToCompanyApplicationForegroundNotifications(
  handler: (notification: CompanyApplicationForegroundNotification) => void,
) {
  return subscribeToSevenoForegroundMessages((payload) => {
    const parsed = parseCompanyApplicationForegroundNotification(payload.data, payload.notification);
    if (parsed) {
      handler(parsed);
    }
  });
}
