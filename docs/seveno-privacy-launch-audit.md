# Audit de lancement — Politique de confidentialité Seven’O

**Date d’audit :** 21 juillet 2026  
**Périmètre :** parcours public, compte, candidats, entreprises, recommandations, étude, notifications, journalisation et suppression.

## Conformité confirmée

- `users/{uid}` porte bien les données de compte, l’état du rôle, le fournisseur d’authentification et les informations d’identité privée utiles au parcours.
- `candidate_profiles/{uid}` reste une projection anonyme destinée à la lecture métier, sans exposition directe du `uid` aux entreprises.
- `candidate_private_data/{uid}` est protégé côté règles et n’est pas lisible par le client.
- La recherche entreprise passe par une projection serveur anonyme.
- Les recommandations sont soumises directement sur Seven’O à partir d’un lien sécurisé.
- Aucun système de lecture de boîte Gmail n’a été trouvé pour les recommandations.
- `study_responses` est séparé du reste des données métier.
- `admin_logs` reste réservé aux usages administratifs.
- Les messages, les candidatures, les offres, les questionnaires et les mises en relation sont séparés par collection et par finalité.

## Affirmations à corriger ou à surveiller

- La suppression complète d’un compte n’est pas confirmée comme entièrement automatisée de bout en bout.
- Certaines durées de conservation sont encore formulées comme politique de référence et ne sont pas toutes appliquées par un mécanisme de purge vérifié.
- Aucun fournisseur d’email réellement intégré pour les invitations de recommandation n’a été confirmé dans le code audité.
- Les transferts techniques liés à Firebase et à Google Cloud doivent être documentés sans promettre une localisation exclusive en France.

## Fonctionnalités manquantes

- Une procédure de suppression de compte complète et vérifiée, couvrant à la fois Firebase Auth et les données applicatives.
- Une mécanique d’archivage ou de purge automatique pour certaines catégories de données lorsque la politique impose une durée stricte.

## Durées non appliquées ou non vérifiées

- Logs techniques et de sécurité.
- Données de compte et preuves d’acceptation.
- Données de profil anonyme et d’identité privée.
- Recommandations et candidatures.
- Notifications et jetons d’appareil.
- Journaux d’administration.

## Prestataires à confirmer

- Fournisseur d’envoi d’email pour les invitations de recommandation, si l’envoi réel doit être activé.

## Transferts à documenter

- Traitements pouvant passer par Firebase / Google Cloud selon l’infrastructure utilisée.
- Éventuels transferts hors de l’Union européenne ou de l’Espace économique européen liés aux services tiers nécessaires au fonctionnement.

## Suppression incomplète

- La suppression du compte Firebase Auth ne suffit pas, à elle seule, à attester de la suppression complète des données applicatives.
- Aucun parcours complet de purge applicative n’a été confirmé dans ce contrôle.

## Règle relative aux mineurs à décider

- Le parcours candidat ne permet pas encore de trancher définitivement le traitement des mineurs.
- La règle produit doit être fixée avant une ouverture générale.

## Action bloquante avant lancement

- Définir et valider la règle relative aux mineurs.
- Fixer les durées de conservation applicables par catégorie et vérifier leur mécanisme de purge ou d’archivage.
- Confirmer la chaîne d’envoi d’email si les invitations de recommandation doivent être réellement expédiées.

## Action pouvant être traitée après lancement contrôlé

- Compléter les mécanismes d’automatisation de suppression ou d’archivage si une version plus stricte de la politique doit être appliquée ensuite.

