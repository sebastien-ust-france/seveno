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

function escapeForJavaScript(value: string) {
  return JSON.stringify(value);
}

export async function GET() {
  const config = buildFirebaseConfig();
  const script = `
    importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js');

    const availabilityNotificationTitle = ${escapeForJavaScript("Seven'O - Disponibilite")};
    const availabilityNotificationBody = ${escapeForJavaScript("Etes-vous toujours disponible immediatement ?")};
    const availabilityFallbackPath = ${escapeForJavaScript('/candidat/disponibilite')};
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
        const title = notification && notification.title ? notification.title : availabilityNotificationTitle;
        const options = {
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
            { action: 'availability_yes', title: 'Oui' },
            { action: 'availability_no', title: 'Non' },
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

