import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeCompanyNotificationReadiness,
  COMPANY_NOTIFICATION_BROWSER_LABELS,
  COMPANY_NOTIFICATION_DEVICE_LABELS,
  COMPANY_NOTIFICATION_PREFERENCE_LABELS,
  type CompanyNotificationServerState,
} from '@/lib/seveno-company-notification-readiness';
import {
  buildCompanyApplicationClickUrl,
  parseCompanyApplicationForegroundNotification,
} from '@/lib/seveno-company-notification-foreground';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function count(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

const disabledServerState: CompanyNotificationServerState = {
  applicationReceivedEnabled: false,
  questionnaireCompletedEnabled: false,
  currentDeviceRegistered: false,
  hasActiveDevice: false,
};

const unsupported = computeCompanyNotificationReadiness({
  supported: false,
  permission: 'unsupported',
  serviceWorkerActive: false,
  serverState: disabledServerState,
});
assert.equal(unsupported.browser, 'unsupported');
assert.equal(unsupported.ready, false);

const prompt = computeCompanyNotificationReadiness({
  supported: true,
  permission: 'default',
  serviceWorkerActive: false,
  serverState: disabledServerState,
});
assert.equal(prompt.browser, 'prompt');

const denied = computeCompanyNotificationReadiness({
  supported: true,
  permission: 'denied',
  serviceWorkerActive: false,
  serverState: disabledServerState,
});
assert.equal(denied.browser, 'denied');

const tokenMissing = computeCompanyNotificationReadiness({
  supported: true,
  permission: 'granted',
  serviceWorkerActive: true,
  serverState: disabledServerState,
});
assert.equal(tokenMissing.device, 'missing');
assert.equal(tokenMissing.ready, false);

const ready = computeCompanyNotificationReadiness({
  supported: true,
  permission: 'granted',
  serviceWorkerActive: true,
  serverState: {
    ...disabledServerState,
    applicationReceivedEnabled: true,
    currentDeviceRegistered: true,
    hasActiveDevice: true,
  },
});
assert.equal(ready.ready, true);
assert.equal(COMPANY_NOTIFICATION_BROWSER_LABELS[ready.browser], 'Autorisé');
assert.equal(COMPANY_NOTIFICATION_DEVICE_LABELS[ready.device], 'Enregistré');
assert.equal(COMPANY_NOTIFICATION_PREFERENCE_LABELS[ready.applicationReceived], 'Activées');

const applicationId = 'application-1';
const validForeground = parseCompanyApplicationForegroundNotification({
  kind: 'company_application_submitted',
  applicationId,
  offerId: 'offer-1',
  clickUrl: buildCompanyApplicationClickUrl(applicationId),
  payloadVersion: '1',
}, { title: 'Nouvelle candidature reçue', body: 'Un candidat vient de postuler.' });
assert.equal(validForeground?.applicationId, applicationId);
assert.equal(validForeground?.clickUrl, '/entreprise/demandes/application-1');
assert.equal(parseCompanyApplicationForegroundNotification({ kind: 'test' }, undefined), null);
assert.equal(parseCompanyApplicationForegroundNotification({ kind: 'availability' }, undefined), null);
assert.equal(parseCompanyApplicationForegroundNotification({ kind: 'unknown' }, undefined), null);
assert.equal(parseCompanyApplicationForegroundNotification({
  kind: 'company_application_submitted',
  offerId: 'offer-1',
  clickUrl: '/entreprise/demandes/application-1',
  payloadVersion: '1',
}, undefined), null);
assert.equal(parseCompanyApplicationForegroundNotification({
  kind: 'company_application_submitted',
  applicationId,
  offerId: 'offer-1',
  clickUrl: 'https://evil.example/entreprise/demandes/application-1',
  payloadVersion: '1',
}, undefined), null);

const ui = source('components/entreprise/CompanyNotificationCenter.tsx');
assert.equal(ui.includes('Tester une notification'), false);
assert.equal(count(ui, /<button\s/g), 2, 'Un contrôle principal et un bouton Fermer sont attendus.');
assert.equal(count(ui, /onClick=\{\(\) => void handleToggle\(\)\}/g), 1);
for (const label of ['Navigateur :', 'Cet appareil :', 'Nouvelles candidatures :', 'Voir la candidature']) {
  assert.equal(ui.includes(label), true, `Libellé manquant: ${label}`);
}
for (const jargon of ['FCM', 'VAPID', 'service worker', 'deviceId', 'collection Firestore', 'endpoint']) {
  assert.equal(ui.includes(jargon), false, `Jargon visible interdit: ${jargon}`);
}
assert.equal(count(ui, /void subscribeToCompanyApplicationForegroundNotifications/g), 1);
assert.equal(ui.includes('unsubscribe?.();'), true);

const client = source('lib/seveno-company-notifications-client.ts');
const serviceWorkerIndex = client.indexOf('ensureSevenoMessagingServiceWorker()');
const permissionIndex = client.indexOf('requestSevenoNotificationPermission()');
const tokenIndex = client.indexOf('createSevenoPushToken(serviceWorkerRegistration)');
const registerIndex = client.indexOf('registerCompanyNotificationDevice(authUser');
const preferenceIndex = client.indexOf('setCompanyApplicationNotifications(authUser, true)');
assert.equal(serviceWorkerIndex < permissionIndex && permissionIndex < tokenIndex && tokenIndex < registerIndex && registerIndex < preferenceIndex, true);

const submitServer = source('lib/seveno-job-applications-server.ts');
const transactionIndex = submitServer.indexOf('firestore.runTransaction');
const eventIndex = submitServer.indexOf('prepareApplicationSubmittedNotificationEvent(transaction');
const dispatchIndex = submitServer.indexOf('dispatchCompanyNotificationEvent(notificationEventId)');
assert.equal(transactionIndex >= 0 && eventIndex > transactionIndex && dispatchIndex > eventIndex, true);
assert.equal(submitServer.includes("status: 'submitted'"), true);

const notificationServer = source('lib/seveno-company-notifications-server.ts');
for (const forbiddenPayloadField of ['candidateName', 'candidateEmail', 'candidatePhone', 'firstName', 'lastName']) {
  assert.equal(notificationServer.includes(forbiddenPayloadField), false, `Donnée candidat interdite: ${forbiddenPayloadField}`);
}
for (const requiredPayloadField of [
  "kind: 'company_application_submitted'",
  'applicationId: event.applicationId',
  'offerId: event.offerId',
  'clickUrl,',
  'payloadVersion: String(COMPANY_NOTIFICATION_PAYLOAD_VERSION)',
]) {
  assert.equal(notificationServer.includes(requiredPayloadField), true, `Champ payload manquant: ${requiredPayloadField}`);
}

const serviceWorker = source('app/firebase-messaging-sw.js/route.ts');
assert.equal(serviceWorker.includes("data.kind === 'company_application_submitted'"), true);
assert.equal(serviceWorker.includes('getSafeCompanyApplicationUrl'), true);
assert.equal(serviceWorker.includes('client.navigate(companyApplicationUrl)'), true);
assert.equal(serviceWorker.includes("action === 'availability_yes'"), true);

const apiRoute = source('app/api/seveno/company-notifications/route.ts');
assert.equal(apiRoute.includes('requireSevenoApiToken(request)'), true);
assert.equal(apiRoute.includes('token.uid'), true);
assert.equal(apiRoute.includes('companyUid'), false, 'Le client ne choisit jamais un autre UID entreprise.');

const rules = source('firestore.rules');
assert.match(rules, /match \/company_push_subscriptions\/\{uid\}[\s\S]*?allow read, write: if false;/);
assert.match(rules, /match \/notification_outbox\/\{eventId\}[\s\S]*?allow read, write: if false;/);

console.log('Company notifications Phase 1 smoke test: OK');
