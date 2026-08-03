# Phase 1 - Notification d'une candidature finalisée

Cette phase ajoute une notification push entreprise lors du passage réel d'une candidature au statut `submitted`.

## Livraison fiable

La transaction de soumission écrit atomiquement la candidature et l'événement déterministe `application_submitted:{applicationId}` dans `notification_outbox`. Une tentative de livraison a lieu après le commit. Un échec FCM ne remet jamais en cause la soumission et conserve l'événement pour un retry.

Le dispatcher utilise un verrou avec bail, un maximum de cinq tentatives et `nextAttemptAt`. Les abonnements sont isolés dans `company_push_subscriptions/{companyUid}/devices/{deviceId}` et ne sont accessibles que par les routes serveur authentifiées.

## Traitement différé à configurer ultérieurement

La route `POST /api/cron/seveno-notification-outbox` traite au maximum vingt événements dus. Elle exige l'en-tête `Authorization: Bearer <SEVENO_NOTIFICATION_OUTBOX_CRON_SECRET>`. Ce secret est distinct de celui des rappels de disponibilité.

Aucun scheduler n'est créé ni activé pendant cette phase. Avant une future mise en production, il faudra :

1. créer `SEVENO_NOTIFICATION_OUTBOX_CRON_SECRET` dans le gestionnaire de secrets et le lier au runtime App Hosting ;
2. créer un job Cloud Scheduler distinct ciblant la route ci-dessus en `POST` ;
3. transmettre le secret uniquement dans l'en-tête `Authorization` ;
4. choisir une fréquence compatible avec le délai de retry de cinq minutes ;
5. contrôler les journaux sans exposer de token, d'identité candidat ou de secret.

## Périmètre

Seul le type `application_received` déclenche un envoi. Le code de préférence `questionnaire_completed` est réservé pour une phase ultérieure. Aucun rappel de disponibilité candidat n'est modifié.
