# SEVENO

Première version de Seveno, construite avec Next.js, TypeScript, Tailwind CSS et Firebase.

## Ce que contient cette V1

- Page d&apos;accueil `/`
- Questionnaire adaptatif `/etude`
- Tableau de bord simple `/admin`
- Enregistrement des réponses dans Firestore, collection `study_responses`

## Installation

1. Installer les dépendances.
2. Copier `.env.local.example` vers `.env.local`.
3. Renseigner les variables Firebase et `NEXT_PUBLIC_ADMIN_CODE`.
4. Lancer `npm run dev`.

## Variables d&apos;environnement

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_ADMIN_CODE=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

## Firestore

La collection utilisée par le formulaire est `study_responses`.

Chaque document contient :

- `respondentType`
- `answers`
- `wantsLaunchNotification`
- `wantsBetaAccess`
- `email`
- `phone`
- `createdAt`

## Notes

- La protection `/admin` par code reste temporaire. Le vrai contrôle d&apos;accès passe par le serveur, qui lit Firestore via Firebase Admin.
- Les règles Firestore autorisent uniquement la création dans `study_responses` et bloquent les lectures publiques.
- Pour que `/admin` lise les données, il faut renseigner les variables Firebase Admin ci-dessus avec un compte de service.
