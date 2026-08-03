# Phase 0 — Fiabiliser le socle des notifications de disponibilité candidat

**Date :** implémentation Phase 0 suite à l'audit complet du système de notifications, puis correction suite à une revue ayant identifié une violation des consignes (bouton de test visible dans l'interface candidate).
**Périmètre :** uniquement la disponibilité candidat (FCM push, service worker, cron de rappel). Les notifications entreprise et les alertes d'offres pertinentes restent hors périmètre.
**Contraintes respectées :** aucun commit/push, aucun déploiement, aucune création de Cloud Scheduler en production, aucune notification réelle envoyée, aucune écriture de test dans Firestore production, aucune modification des fichiers de rebranding couleur en cours, **aucune action de test de notification visible dans l'interface candidate normale**.

> **Statut honnête :** la Phase 0 ne peut pas être déclarée totalement opérationnelle. Le Cloud Scheduler réel n'a pas été vérifié dans l'environnement Google Cloud (voir section 5), et aucun envoi de notification réelle n'a été effectué dans cette session, conformément aux contraintes imposées.

## Rappel des 3 ruptures identifiées par l'audit

1. **Scheduler absent** — la route `app/api/cron/seveno-availability-reminders/route.ts` existe et est protégée par `SEVENO_AVAILABILITY_CRON_SECRET`, mais aucun Cloud Scheduler ne l'appelle en production.
2. **Réception foreground non branchée** — `subscribeToCandidateAvailabilityForegroundNotifications` (dans [lib/seveno-candidate-availability-client.ts](../lib/seveno-candidate-availability-client.ts)) existait mais n'était appelée nulle part dans l'UI.
3. **Bouton de test non relié** — `handleSendAvailabilityTestNotification` (dans [app/candidat/page.tsx](../app/candidat/page.tsx)) était complet mais neutralisé par un `void`, sans bouton JSX pour le déclencher.

## Ce qui a été fait

### 1. Modèle de "readiness" unifié (nouveau)

Nouveau fichier [lib/seveno-candidate-push-readiness.ts](../lib/seveno-candidate-push-readiness.ts) : le type `CandidatePushReadiness` distingue explicitement les 3 dimensions qui étaient auparavant réduites à un simple booléen `availabilityNotificationsEnabled` :

- `browserSupport` : le navigateur prend-il en charge les notifications ?
- `permission` : la permission `Notification` du navigateur.
- `serviceWorker` : l'état du service worker FCM (`unknown` / `registering` / `active` / `error`).
- `deviceRegistration` : l'appareil est-il enregistré côté serveur (`candidate_push_subscriptions`) ?
- `dailyPreference` : la préférence Seven'O "confirmations quotidiennes" est-elle activée ?
- `ready` + `blockingReason` : un diagnostic actionnable unique, calculé par priorité (support → permission → service worker → token → appareil → préférence).

La fonction pure `computeCandidatePushReadiness` est testée unitairement dans [scripts/candidate-push-readiness-smoke-test.mts](../scripts/candidate-push-readiness-smoke-test.mts) (`npm run test:push-readiness`), sans dépendance navigateur ni Firebase.

Deux fonctions de pont côté client, dans [lib/seveno-candidate-availability-client.ts](../lib/seveno-candidate-availability-client.ts) :

- `getPassiveCandidatePushReadinessSnapshot(profile)` : lecture **sans effet de bord** (pas d'enregistrement du service worker, pas de demande de permission, pas de génération de token) — utilisée au chargement du tableau de bord.
- `buildCandidatePushReadinessFromLiveSupport(support, profile, hasActiveDevice)` : affine l'état avec les signaux réels obtenus lors d'une action explicite (activation, test).

Le tableau de bord candidat ([app/candidat/page.tsx](../app/candidat/page.tsx)) affiche ce diagnostic dans le panneau "Disponibilité", sous une forme **strictement sobre et sans jargon technique**, via `describeCandidatePushReadinessForCandidate` (dans [lib/seveno-candidate-push-readiness.ts](../lib/seveno-candidate-push-readiness.ts)) :

- **Navigateur** : Autorisé / À autoriser / Refusé / Non compatible.
- **Cet appareil** : Enregistré / Non enregistré / Erreur.
- **Confirmations quotidiennes** : Actives / Désactivées.

Aucune mention de "service worker", "FCM", "VAPID", "token" ou "deviceId" n'apparaît côté candidat ; ce vocabulaire reste réservé aux champs internes de `CandidatePushReadiness` (usage diagnostic/admin futur). Le test [scripts/candidate-push-readiness-smoke-test.mts](../scripts/candidate-push-readiness-smoke-test.mts) vérifie explicitement l'absence de ce jargon dans le résumé candidat.

### 2. Réception foreground branchée et actionnable

La logique de lecture/filtrage des messages FCM reçus au premier plan a été extraite dans un module pur [lib/seveno-candidate-availability-foreground.ts](../lib/seveno-candidate-availability-foreground.ts) (`parseCandidateForegroundNotification`, `isActionableAvailabilityForegroundNotification`), testé unitairement dans [scripts/candidate-foreground-notification-smoke-test.mts](../scripts/candidate-foreground-notification-smoke-test.mts) (`npm run test:foreground-notifications`).

Dans `app/candidat/page.tsx`, un `useEffect` (dépendances `[]`, désabonnement propre au démontage) s'abonne une seule fois via `subscribeToCandidateAvailabilityForegroundNotifications` :

- Les messages `kind: 'test'` ou sans `requestId`/`token` valides sont **ignorés côté UI candidate** (aucune bannière, aucune action).
- Un message `kind: 'availability'` avec `requestId`/`token` déclenche une bannière actionnable proposant **"Toujours disponible"** / **"Plus disponible"**, qui appellent `respondToAvailabilityRequest` (fonction métier déjà utilisée par [app/candidat/disponibilite/page.tsx](../app/candidat/disponibilite/page.tsx)) — aucun second mécanisme de confirmation n'a été créé. Un lien de repli vers `/candidat/disponibilite` reste disponible.

### 3. Suppression du bouton de test visible (correction)

La première version de cette Phase 0 avait ajouté un bouton **"Tester une notification"** visible en permanence dans le tableau de bord candidat normal. **Cette action ne devait pas être accessible depuis l'interface candidate courante** ; le bouton, la fonction `handleSendAvailabilityTestNotification` et l'état `'send_test_notification'` ont été entièrement retirés de `app/candidat/page.tsx`.

La fonction serveur de test (`sendCandidateAvailabilityTestNotification`, route [app/api/seveno/candidates/availability/test-notification/route.ts](../app/api/seveno/candidates/availability/test-notification/route.ts)) reste inchangée et disponible pour un déclenchement contrôlé **hors de l'interface candidate normale** (script/route, non exposée dans l'UI).

**Stratégie retenue pour un futur diagnostic contrôlé (Stratégie B)** : aucun espace admin existant ne dispose d'une convention de bouton d'action adaptée. [app/admin/tests/page.tsx](../app/admin/tests/page.tsx) a été inspecté et concerne les sessions d'évaluation candidates (sans rapport). [app/admin/candidats/[uid]/page.tsx](../app/admin/candidats/%5Buid%5D/page.tsx) a été passé en revue (recherche de `button`/`onClick`/`envoyer`/`notification`) : aucune convention de bouton d'action n'y existe. En l'absence d'espace adapté, la Stratégie B a été retenue : la route API et les tests automatisés restent le seul moyen de déclencher une notification de test, **sans ajout d'interface visible**, tant qu'un espace de diagnostic admin dédié n'aura pas été explicitement demandé et conçu.

### 4. Tests

- `npm run test:push-readiness` (nouveau) : logique pure du modèle de readiness, y compris le résumé candidat sans jargon.
- `npm run test:foreground-notifications` (nouveau) : filtrage/parsing purs des messages foreground (availability actionnable, test ignoré, kind inconnu, requestId/token absents ou vides).
- `npm run test:candidate-notification-ui-guard` (nouveau) : garde de non-régression — vérifie par lecture du code source que `app/candidat/page.tsx` ne contient ni le bouton "Tester une notification", ni `handleSendAvailabilityTestNotification`, ni de jargon technique ("Service worker", "Token FCM"), et que les actions candidates légitimes restent présentes.
- `npm run test:availability-reminders:emulator` (script npm existant depuis cette Phase 0, le fichier de test existait déjà mais n'était pas exposé) : exécute `processAvailabilityRemindersBatch` contre l'émulateur Firestore local. Nécessite `npm run emulators:firestore` dans un terminal séparé au préalable. Validé avec succès (sélection de candidats, création de demandes de confirmation, gestion des tokens invalides — cf. sortie `SevenO availability reminders smoke test: OK`).
- `npm run test:availability` (existant, non modifié) : toujours vert.

**Limite assumée** : il n'existe pas de framework de test de composants React dans ce dépôt. Le comportement runtime réel de l'abonnement `onMessage` (réception effective d'un message Firebase au premier plan, rendu de la bannière) n'a donc pas pu être vérifié par un test automatisé — seule la logique pure de filtrage/parsing (`parseCandidateForegroundNotification`, `isActionableAvailabilityForegroundNotification`) est testée unitairement. Une vérification manuelle en navigateur reste nécessaire pour couvrir ce point.

### 5. Vérification du Cloud Scheduler — non vérifiée, statut honnête

Aucun CLI `gcloud` n'est installé dans cet environnement (`gcloud` introuvable). Il n'a donc pas été possible de lister les jobs Cloud Scheduler du projet `seveno-a8eb1` en lecture seule depuis cette session. Aucune tentative d'authentification ou d'appel réseau vers l'API Cloud Scheduler avec les identifiants Firebase Admin de production n'a été faite (risque jugé disproportionné pour une simple vérification en lecture).

**Formulation exacte à retenir tant que la vérification manuelle n'a pas été faite :**

> Aucun scheduler n'est déclaré dans le dépôt. L'existence d'un scheduler configuré manuellement dans Google Cloud reste non vérifiée.

**Procédure de vérification manuelle (Google Cloud Console, à exécuter par une personne disposant des droits, hors de cette session) :**

1. Ouvrir la Google Cloud Console et sélectionner le projet `seveno-a8eb1`.
2. Aller dans le menu **Cloud Scheduler** (Navigation → Outils d'intégration → Cloud Scheduler).
3. Vérifier la région : les jobs pertinents devraient être en `europe-west4`.
4. Rechercher un job dont l'URI cible correspond à `POST /api/cron/seveno-availability-reminders` sur le domaine de production.
5. Vérifier l'URL exacte appelée (doit correspondre au domaine de production réel de l'application).
6. Vérifier la fréquence configurée (doit être cohérente avec `DEFAULT_AVAILABILITY_REMINDER_HOUR` / `buildNextAvailabilityReminderAt` dans [lib/seveno-candidate-availability.ts](../lib/seveno-candidate-availability.ts)).
7. Vérifier le statut du job (activé/en pause) et la date/heure de la dernière exécution.
8. Vérifier le résultat de la dernière exécution (succès/échec) dans les journaux du job.

Si aucun job de ce type n'existe, en créer un manuellement (exemple, à valider avant exécution — **ne pas exécuter depuis cette session** ni sans autorisation explicite) :

```bash
gcloud scheduler jobs list --project=seveno-a8eb1 --location=europe-west4
```

```bash
gcloud scheduler jobs create http seveno-availability-reminders \
  --project=seveno-a8eb1 \
  --location=europe-west4 \
  --schedule="*/15 * * * *" \
  --uri="https://<domaine-production>/api/cron/seveno-availability-reminders" \
  --http-method=POST \
  --headers="Authorization=Bearer <valeur-de-SEVENO_AVAILABILITY_CRON_SECRET>"
```

La fréquence exacte (`*/15 * * * *` à titre d'exemple) doit être choisie selon `DEFAULT_AVAILABILITY_REMINDER_HOUR`/la logique de `buildNextAvailabilityReminderAt` dans [lib/seveno-candidate-availability.ts](../lib/seveno-candidate-availability.ts).

## Hors périmètre de la Phase 0

- Notifications entreprise.
- Alertes d'offres pertinentes.
- Vérification et/ou création réelle du Cloud Scheduler en production (nécessite une action manuelle avec accès Google Cloud, cf. section 5).
- Un envoi de notification réelle contrôlé en environnement autorisé (non effectué dans cette session).
- Le rebranding couleur en cours sur plusieurs pages (non lié aux notifications, non touché).

**La Phase 0 ne doit pas être présentée comme entièrement opérationnelle tant que le scheduler réel n'a pas été vérifié et qu'un test FCM contrôlé n'a pas été effectué ultérieurement dans un environnement autorisé.**
