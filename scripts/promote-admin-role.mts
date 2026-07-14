import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function configureEnvironment() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
  if (!projectId) {
    throw new Error('Le projet Firebase est introuvable dans l environnement.');
  }

  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  const index = process.argv.findIndex((value) => value === `--${name}` || value.startsWith(prefix));
  if (index < 0) {
    return '';
  }

  const current = process.argv[index];
  if (current.startsWith(prefix)) {
    return current.slice(prefix.length).trim();
  }

  const next = process.argv[index + 1];
  return typeof next === 'string' ? next.trim() : '';
}

function requireUid() {
  const uid = readArg('uid');
  if (!uid) {
    throw new Error('Usage: npm run promote:admin -- --uid=<firebase-auth-uid> --confirm=promote-company-to-admin');
  }

  return uid;
}

function requireConfirmation() {
  const confirm = readArg('confirm');
  if (confirm !== 'promote-company-to-admin') {
    throw new Error('Ajoutez --confirm=promote-company-to-admin pour eviter une promotion accidentelle.');
  }
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEnvironment();
  requireConfirmation();

  const uid = requireUid();
  const { Timestamp } = await import('firebase-admin/firestore');
  const { adminAuth, adminDb, isFirebaseAdminConfigured } = await import('@/lib/firebase-admin');

  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new Error('Firebase Admin n est pas configure.');
  }

  const userRef = adminDb.collection('users').doc(uid);
  const userSnapshot = await userRef.get();
  const authUser = await adminAuth?.getUser(uid).catch(() => null);
  if (!userSnapshot.exists && !authUser) {
    throw new Error(`Le document users/${uid} est introuvable et le compte Auth correspondant est absent.`);
  }

  const userData = userSnapshot.data() as { role?: unknown; email?: unknown } | undefined;
  const currentRole = userData?.role === 'candidate' || userData?.role === 'company' || userData?.role === 'admin'
    ? userData.role
    : null;

  if (currentRole === 'admin') {
    console.log(`Le compte ${uid} est deja admin. Aucun changement applique.`);
    return;
  }

  if (currentRole !== 'company' && userSnapshot.exists) {
    throw new Error(`Le compte ${uid} doit avoir le role company avant promotion. Role actuel: ${String(currentRole)}`);
  }

  if (userSnapshot.exists) {
    await userRef.update({
      role: 'admin',
      updatedAt: Timestamp.now(),
    });
  } else {
    const providerId = authUser?.providerData.some((provider) => provider.providerId === 'google.com')
      ? 'google'
      : 'password';

    await userRef.set({
      uid,
      role: 'admin',
      authProvider: providerId,
      email: authUser?.email ?? '',
      emailVerified: authUser?.emailVerified ?? false,
      displayName: authUser?.displayName ?? undefined,
      photoURL: authUser?.photoURL ?? undefined,
      onboardingCompleted: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  const promotedSnapshot = await userRef.get();
  const promotedData = promotedSnapshot.data() as { role?: unknown; email?: unknown } | undefined;
  const companyProfileExists = await adminDb.collection('company_profiles').doc(uid).get().then((snapshot) => snapshot.exists);

  console.log('Promotion SevenO reussie', {
    uid,
    previousRole: currentRole,
    nextRole: promotedData?.role ?? 'admin',
    companyProfilePreserved: companyProfileExists,
  });
}

await main();
