type FirebaseEmulatorScope = 'client' | 'server';

function isRequested() {
  return process.env.NEXT_PUBLIC_SEVENO_USE_FIREBASE_EMULATORS === 'true';
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function normalize(value: string | undefined | null) {
  return value?.trim() ?? '';
}

function formatMissingVariables(missing: string[]) {
  return missing.join(', ');
}

function assertEmulatorModeAllowed(scope: FirebaseEmulatorScope) {
  if (!isRequested()) {
    return false;
  }

  if (isProduction()) {
    throw new Error(`Le mode Firebase Emulator Seven’O est interdit en production (${scope}).`);
  }

  return true;
}

export function isSevenoFirebaseEmulatorModeEnabled() {
  return assertEmulatorModeAllowed('client');
}

export function getSevenoFirebaseClientEmulatorProjectId() {
  if (!isRequested()) {
    return normalize(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || normalize(process.env.FIREBASE_ADMIN_PROJECT_ID);
  }

  assertEmulatorModeAllowed('client');

  const emulatorProjectId = normalize(process.env.NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID);
  if (!emulatorProjectId) {
    throw new Error('Le mode Firebase Emulator Seven’O est activé mais NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID est manquant.');
  }

  return emulatorProjectId;
}

export function assertSevenoClientFirebaseEmulatorConfiguration() {
  if (!assertEmulatorModeAllowed('client')) {
    return;
  }

  const missing: string[] = [];
  const emulatorProjectId = normalize(process.env.NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID);

  if (!normalize(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!normalize(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)) missing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!normalize(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)) missing.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  if (!normalize(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID)) missing.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!normalize(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)) missing.push('NEXT_PUBLIC_FIREBASE_APP_ID');
  if (!emulatorProjectId) missing.push('NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID');
  if (!normalize(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL)) missing.push('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL');
  if (!normalize(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST)) missing.push('NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST');
  if (!normalize(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT)) missing.push('NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT');

  if (missing.length > 0) {
    throw new Error(`Le mode Firebase Emulator Seven’O est activé mais la configuration client est incomplète : ${formatMissingVariables(missing)}.`);
  }
}

export function getSevenoClientFirestoreEmulatorConfig() {
  assertSevenoClientFirebaseEmulatorConfiguration();

  const host = normalize(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST);
  const portValue = Number(normalize(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT));
  if (!host || !Number.isFinite(portValue)) {
    throw new Error('La configuration Firestore Emulator Seven’O du navigateur est invalide.');
  }

  return {
    host,
    port: portValue,
  };
}

export function getSevenoClientAuthEmulatorUrl() {
  assertSevenoClientFirebaseEmulatorConfiguration();

  const url = normalize(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL);
  if (!url) {
    throw new Error('La configuration Auth Emulator Seven’O du navigateur est invalide.');
  }

  return url;
}

export function assertSevenoServerFirebaseEmulatorConfiguration() {
  if (!assertEmulatorModeAllowed('server')) {
    return;
  }

  const missing: string[] = [];
  if (!normalize(process.env.SEVENO_EMULATOR_PROJECT_ID)) missing.push('SEVENO_EMULATOR_PROJECT_ID');
  if (!normalize(process.env.FIREBASE_AUTH_EMULATOR_HOST)) missing.push('FIREBASE_AUTH_EMULATOR_HOST');
  if (!normalize(process.env.FIRESTORE_EMULATOR_HOST)) missing.push('FIRESTORE_EMULATOR_HOST');

  if (missing.length > 0) {
    throw new Error(`Le mode Firebase Emulator Seven’O est activé mais la configuration serveur est incomplète : ${formatMissingVariables(missing)}.`);
  }
}

export function getSevenoFirebaseServerEmulatorProjectId() {
  if (!isRequested()) {
    return normalize(process.env.FIREBASE_ADMIN_PROJECT_ID) || normalize(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  }

  assertSevenoServerFirebaseEmulatorConfiguration();

  const emulatorProjectId = normalize(process.env.SEVENO_EMULATOR_PROJECT_ID);
  if (!emulatorProjectId) {
    throw new Error('Le mode Firebase Emulator Seven’O est activé mais SEVENO_EMULATOR_PROJECT_ID est manquant.');
  }

  return emulatorProjectId;
}
