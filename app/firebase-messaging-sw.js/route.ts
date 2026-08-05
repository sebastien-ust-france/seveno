import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  };
}

function toJavaScriptLiteral(value: string) {
  return JSON.stringify(value);
}

export async function GET() {
  const config = buildFirebaseConfig();
  const firebaseAppCompatUrl = toJavaScriptLiteral('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
  const firebaseMessagingCompatUrl = toJavaScriptLiteral('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');
  const availabilityNotificationTitleLiteral = toJavaScriptLiteral("Seven’O — Disponibilité");
  const availabilityNotificationBodyLiteral = toJavaScriptLiteral('Êtes-vous toujours disponible immédiatement ?');
  const availabilityFallbackPathLiteral = toJavaScriptLiteral('/candidat/disponibilite');
  const testNotificationTitleLiteral = toJavaScriptLiteral("Seven’O — Test de notification");
  const testNotificationBodyLiteral = toJavaScriptLiteral('Les notifications sont correctement activées sur cet appareil.');
  const testNotificationTagLiteral = toJavaScriptLiteral('seveno-notification-test');
  const testNotificationClickPathLiteral = toJavaScriptLiteral('/candidat');
  const availabilityYesActionTitleLiteral = toJavaScriptLiteral('Oui');
  const availabilityNoActionTitleLiteral = toJavaScriptLiteral('Non');
  const companyApplicationNotificationTitleLiteral = toJavaScriptLiteral('Nouvelle candidature reçue');
  const companyApplicationNotificationBodyLiteral = toJavaScriptLiteral('Un candidat vient de postuler à l’une de vos offres.');
  const companyQuestionnaireNotificationTitleLiteral = toJavaScriptLiteral('Questionnaire candidat terminé');
  const companyQuestionnaireNotificationBodyLiteral = toJavaScriptLiteral('Un candidat a terminé le questionnaire lié à l’une de vos offres.');
  const candidateOfferNotificationTitleLiteral = toJavaScriptLiteral('Nouvelle offre disponible');
  const candidateOfferNotificationBodyLiteral = toJavaScriptLiteral('Une nouvelle offre correspondant à l’un de vos métiers recherchés vient d’être publiée.');
  const script = `
    importScripts(${firebaseAppCompatUrl});
    importScripts(${firebaseMessagingCompatUrl});

    const availabilityNotificationTitle = ${availabilityNotificationTitleLiteral};
    const availabilityNotificationBody = ${availabilityNotificationBodyLiteral};
    const availabilityFallbackPath = ${availabilityFallbackPathLiteral};
    const testNotificationTitle = ${testNotificationTitleLiteral};
    const testNotificationBody = ${testNotificationBodyLiteral};
    const testNotificationTag = ${testNotificationTagLiteral};
    const testNotificationClickPath = ${testNotificationClickPathLiteral};
    const companyApplicationNotificationTitle = ${companyApplicationNotificationTitleLiteral};
    const companyApplicationNotificationBody = ${companyApplicationNotificationBodyLiteral};
    const companyQuestionnaireNotificationTitle = ${companyQuestionnaireNotificationTitleLiteral};
    const companyQuestionnaireNotificationBody = ${companyQuestionnaireNotificationBodyLiteral};
    const candidateOfferNotificationTitle = ${candidateOfferNotificationTitleLiteral};
    const candidateOfferNotificationBody = ${candidateOfferNotificationBodyLiteral};
    const firebaseConfig = ${JSON.stringify(config)};

    function buildFallbackUrl(data, decision) {
      if (!data || !data.requestId || !data.token) {
        return availabilityFallbackPath;
      }

      const params = new URLSearchParams({
        requestId: String(data.requestId),
        token: String(data.token),
      });

      if (decision === 'yes' || decision === 'no') {
        params.set('decision', decision);
      }

      return \`\${availabilityFallbackPath}?\${params.toString()}\`;
    }

    async function respondToAvailability(data, action) {
      if (!data || !data.requestId || !data.token || (action !== 'yes' && action !== 'no')) {
        return false;
      }

      try {
        const response = await fetch('/api/seveno/candidates/availability/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: data.requestId,
            token: data.token,
            action,
            source: 'push_action',
          }),
        });

        return response.ok;
      } catch {
        return false;
      }
    }

    function getSafeCompanyApplicationUrl(data) {
      if (
        !data
        || (data.kind !== 'company_application_submitted' && data.kind !== 'company_questionnaire_completed')
        || !data.applicationId
        || !data.clickUrl
      ) {
        return null;
      }

      const expectedPath = '/entreprise/demandes/' + encodeURIComponent(String(data.applicationId));
      return data.clickUrl === expectedPath ? expectedPath : null;
    }

    function getSafeCandidateOfferUrl(data) {
      if (!data || data.kind !== 'candidate_matching_offer_published' || !data.offerId || !data.clickUrl) {
        return null;
      }
      const expectedPath = '/candidat/offres/' + encodeURIComponent(String(data.offerId));
      return data.clickUrl === expectedPath ? expectedPath : null;
    }

    if (
      firebaseConfig
      && firebaseConfig.apiKey
      && firebaseConfig.projectId
      && firebaseConfig.messagingSenderId
      && firebaseConfig.appId
    ) {
      firebase.initializeApp(firebaseConfig);
      const messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        const data = payload && payload.data ? payload.data : {};
        const notification = payload && payload.notification ? payload.notification : null;
        const isTestNotification = data && data.kind === 'test';
        const isAvailabilityNotification = data && data.kind === 'availability';
        const isCompanyApplicationNotification = data && data.kind === 'company_application_submitted';
        const isCompanyQuestionnaireNotification = data && data.kind === 'company_questionnaire_completed';
        const isCompanyNotification = isCompanyApplicationNotification || isCompanyQuestionnaireNotification;
        const isCandidateOfferNotification = data && data.kind === 'candidate_matching_offer_published';
        if (!isTestNotification && !isAvailabilityNotification && !isCompanyNotification && !isCandidateOfferNotification) {
          return;
        }
        const title = notification && notification.title
          ? notification.title
          : isCompanyNotification
            ? isCompanyQuestionnaireNotification
              ? companyQuestionnaireNotificationTitle
              : companyApplicationNotificationTitle
            : isCandidateOfferNotification
              ? candidateOfferNotificationTitle
              : isTestNotification
              ? testNotificationTitle
              : availabilityNotificationTitle;
        const options = isCandidateOfferNotification
          ? {
              body: notification && notification.body ? notification.body : candidateOfferNotificationBody,
              icon: '/images/favicon-seveno.png',
              badge: '/images/favicon-seveno.png',
              data: {
                kind: data.kind,
                offerId: data.offerId || '',
                clickUrl: getSafeCandidateOfferUrl(data),
                payloadVersion: data.payloadVersion || '',
              },
            }
          : isCompanyNotification
          ? {
              body: notification && notification.body
                ? notification.body
                : isCompanyQuestionnaireNotification
                  ? companyQuestionnaireNotificationBody
                  : companyApplicationNotificationBody,
              icon: '/images/favicon-seveno.png',
              badge: '/images/favicon-seveno.png',
              data: {
                kind: data.kind,
                applicationId: data.applicationId || '',
                offerId: data.offerId || '',
                clickUrl: getSafeCompanyApplicationUrl(data),
                payloadVersion: data.payloadVersion || '',
              },
            }
          : isTestNotification
          ? {
              body: notification && notification.body ? notification.body : testNotificationBody,
              icon: '/images/favicon-seveno.png',
              badge: '/images/favicon-seveno.png',
              tag: testNotificationTag,
              renotify: true,
              data: {
                clickUrl: data.clickUrl || testNotificationClickPath,
              },
              requireInteraction: true,
            }
          : {
              body: notification && notification.body ? notification.body : availabilityNotificationBody,
              icon: '/images/favicon-seveno.png',
              badge: '/images/favicon-seveno.png',
              data: {
                requestId: data.requestId || '',
                token: data.token || '',
                clickUrl: buildFallbackUrl(data),
                yesUrl: buildFallbackUrl(data, 'yes'),
                noUrl: buildFallbackUrl(data, 'no'),
              },
              actions: [
                { action: 'availability_yes', title: ${availabilityYesActionTitleLiteral} },
                { action: 'availability_no', title: ${availabilityNoActionTitleLiteral} },
              ],
              requireInteraction: true,
            };

        self.registration.showNotification(title, options);
      });
    }

    self.addEventListener('notificationclick', (event) => {
      const action = event.action;
      const data = event.notification && event.notification.data ? event.notification.data : {};
      event.notification.close();

      event.waitUntil((async () => {
        const companyApplicationUrl = getSafeCompanyApplicationUrl(data);
        if (companyApplicationUrl) {
          const existingClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of existingClients) {
            if ('navigate' in client) {
              await client.navigate(companyApplicationUrl);
            }
            if ('focus' in client) {
              await client.focus();
              return;
            }
          }
          if (clients.openWindow) {
            await clients.openWindow(companyApplicationUrl);
          }
          return;
        }

        const candidateOfferUrl = getSafeCandidateOfferUrl(data);
        if (candidateOfferUrl) {
          const existingClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of existingClients) {
            if ('navigate' in client) await client.navigate(candidateOfferUrl);
            if ('focus' in client) {
              await client.focus();
              return;
            }
          }
          if (clients.openWindow) await clients.openWindow(candidateOfferUrl);
          return;
        }

        if (data.kind !== 'availability' && data.kind !== 'test') {
          return;
        }

        if (action === 'availability_yes' || action === 'availability_no') {
          const succeeded = await respondToAvailability(data, action === 'availability_yes' ? 'yes' : 'no');
          if (succeeded) {
            return;
          }
        }

        const url = action === 'availability_yes'
          ? data.yesUrl || buildFallbackUrl(data, 'yes')
          : action === 'availability_no'
            ? data.noUrl || buildFallbackUrl(data, 'no')
            : data.clickUrl || buildFallbackUrl(data);

        const existingClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of existingClients) {
          if ('focus' in client) {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname === availabilityFallbackPath) {
              await client.focus();
              return;
            }
          }
        }

        if (clients.openWindow) {
          await clients.openWindow(url);
        }
      })());
    });
  `;

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
