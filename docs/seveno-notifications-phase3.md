# Phase 3 - alertes candidat pour les nouvelles offres

## Portée du matching

La première publication `draft -> published` crée un fan-out déterministe. Le traitement sélectionne par pages les profils actifs qui ont explicitement activé `matchingOfferAlertsEnabled` et dont `targetJobRoleIds` contient exactement le `jobRoleId` de l'offre. Le type de contrat est ensuite contrôlé en mémoire, car Firestore ne permet pas de combiner deux filtres `array-contains` indépendants.

Un tableau `desiredContractTypeCodes` vide ne bloque pas une alerte. Lorsqu'il est renseigné, le code de l'offre est converti vers les codes candidat stables (`CDI`, `CDD`, `INTERIM`, `FREELANCE`, `ALTERNANCE`, `STAGE`, `AUTRE`). La zone, l'expérience, la disponibilité, les prérequis, les scores et toute similarité sémantique sont explicitement hors périmètre.

## Fiabilité et idempotence

- Fan-out : `candidate_offer_fanout:{offerId}` dans `offer_notification_fanouts`.
- Événement individuel : `candidate_matching_offer_published:{offerId}:{candidateUid}` dans `notification_outbox`.
- Pagination : 25 profils, curseur sur l'identifiant du profil.
- Concurrence : bail de cinq minutes pour le fan-out et l'événement.
- Reprise : la route sécurisée `/api/cron/seveno-notification-outbox` traite les fan-outs et les événements retentables.
- Publication : seule la création du fan-out est transactionnelle avec l'offre. Son traitement est hors transaction et un échec n'annule jamais la publication.

## Quota

Les livraisons sont réservées transactionnellement dans `candidate_offer_alert_quotas/{uid}/deliveries/{eventId}`. Trois réservations ou envois au maximum sont admis sur une fenêtre glissante de 24 heures. Une réservation est supprimée si aucun appareil ne reçoit le message ; elle devient `sent` dès qu'au moins une livraison réussit. La quatrième alerte est marquée `skipped` avec `daily_offer_alert_limit_reached`.

## Coût de lecture par page

Une page lit au plus 25 profils, 25 utilisateurs, 25 guards anti-double candidature et une requête limitée sur les appareils de chaque candidat. Les tokens ne sont jamais copiés dans le fan-out ni dans l'outbox.

## Configuration requise

`SEVENO_NOTIFICATION_OUTBOX_CRON_SECRET` doit exister dans Secret Manager et être lié au runtime App Hosting. Cette phase ajoute uniquement la référence de configuration. Aucun secret, Scheduler ou déploiement n'est créé localement.
