export type CompanyNotificationBrowserState = 'authorized' | 'prompt' | 'denied' | 'unsupported';
export type CompanyNotificationDeviceState = 'registered' | 'missing' | 'error';
export type CompanyApplicationNotificationPreference = 'enabled' | 'disabled';

export interface CompanyNotificationReadiness {
  browser: CompanyNotificationBrowserState;
  device: CompanyNotificationDeviceState;
  applicationReceived: CompanyApplicationNotificationPreference;
  questionnaireCompleted: CompanyApplicationNotificationPreference;
  ready: boolean;
  questionnaireReady: boolean;
}

export interface CompanyNotificationServerState {
  applicationReceivedEnabled: boolean;
  questionnaireCompletedEnabled: boolean;
  currentDeviceRegistered: boolean;
  hasActiveDevice: boolean;
}

export function computeCompanyNotificationReadiness(input: {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  serviceWorkerActive: boolean;
  serverState: CompanyNotificationServerState;
  deviceError?: boolean;
}): CompanyNotificationReadiness {
  const browser: CompanyNotificationBrowserState = !input.supported || input.permission === 'unsupported'
    ? 'unsupported'
    : input.permission === 'granted'
      ? 'authorized'
      : input.permission === 'denied'
        ? 'denied'
        : 'prompt';
  const device: CompanyNotificationDeviceState = input.deviceError
    ? 'error'
    : input.serverState.currentDeviceRegistered && input.serviceWorkerActive
      ? 'registered'
      : 'missing';
  const applicationReceived: CompanyApplicationNotificationPreference = input.serverState.applicationReceivedEnabled
    ? 'enabled'
    : 'disabled';
  const questionnaireCompleted: CompanyApplicationNotificationPreference = input.serverState.questionnaireCompletedEnabled
    ? 'enabled'
    : 'disabled';
  const deviceReady = browser === 'authorized' && device === 'registered';

  return {
    browser,
    device,
    applicationReceived,
    questionnaireCompleted,
    ready: deviceReady && applicationReceived === 'enabled',
    questionnaireReady: deviceReady && questionnaireCompleted === 'enabled',
  };
}

export const COMPANY_NOTIFICATION_BROWSER_LABELS: Record<CompanyNotificationBrowserState, string> = {
  authorized: 'Autorisé',
  prompt: 'À autoriser',
  denied: 'Refusé',
  unsupported: 'Non compatible',
};

export const COMPANY_NOTIFICATION_DEVICE_LABELS: Record<CompanyNotificationDeviceState, string> = {
  registered: 'Enregistré',
  missing: 'Non enregistré',
  error: 'Erreur',
};

export const COMPANY_NOTIFICATION_PREFERENCE_LABELS: Record<CompanyApplicationNotificationPreference, string> = {
  enabled: 'Activées',
  disabled: 'Désactivées',
};
