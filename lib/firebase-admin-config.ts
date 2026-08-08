export type FirebaseAdminInitializationMode = 'emulator' | 'application_default' | 'explicit_certificate';

type FirebaseAdminEnvironment = Record<string, string | undefined>;

export class FirebaseAdminConfigurationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function value(environment: FirebaseAdminEnvironment, name: string) {
  return environment[name]?.trim() ?? '';
}

function firebaseConfigProjectId(environment: FirebaseAdminEnvironment) {
  const raw = value(environment, 'FIREBASE_CONFIG');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { projectId?: unknown };
    return typeof parsed.projectId === 'string' ? parsed.projectId.trim() : '';
  } catch {
    return '';
  }
}

export function resolveFirebaseAdminProjectId(environment: FirebaseAdminEnvironment = process.env) {
  return value(environment, 'FIREBASE_ADMIN_PROJECT_ID')
    || value(environment, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID')
    || value(environment, 'GOOGLE_CLOUD_PROJECT')
    || value(environment, 'GCLOUD_PROJECT')
    || firebaseConfigProjectId(environment);
}

export function isGoogleManagedRuntime(environment: FirebaseAdminEnvironment = process.env) {
  return Boolean(
    value(environment, 'K_SERVICE')
    || value(environment, 'GAE_SERVICE')
    || value(environment, 'FUNCTION_TARGET')
    || (value(environment, 'NODE_ENV') === 'production'
      && (value(environment, 'GOOGLE_CLOUD_PROJECT') || value(environment, 'GCLOUD_PROJECT') || value(environment, 'FIREBASE_CONFIG'))),
  );
}

export function resolveFirebaseAdminInitialization(environment: FirebaseAdminEnvironment = process.env): {
  mode: FirebaseAdminInitializationMode;
  projectId: string;
} {
  const projectId = resolveFirebaseAdminProjectId(environment);
  if (value(environment, 'FIRESTORE_EMULATOR_HOST')) return { mode: 'emulator', projectId };

  const explicitValues = {
    projectId: value(environment, 'FIREBASE_ADMIN_PROJECT_ID'),
    clientEmail: value(environment, 'FIREBASE_ADMIN_CLIENT_EMAIL'),
    privateKey: value(environment, 'FIREBASE_ADMIN_PRIVATE_KEY'),
  };
  const hasExplicitCredentialMaterial = Boolean(explicitValues.clientEmail || explicitValues.privateKey);
  const hasCompleteExplicitCredentials = Boolean(explicitValues.projectId && explicitValues.clientEmail && explicitValues.privateKey);
  if (hasExplicitCredentialMaterial && !hasCompleteExplicitCredentials) {
    throw new FirebaseAdminConfigurationError(
      'firebase_admin_explicit_credentials_incomplete',
      'La configuration Firebase Admin explicite est incomplète.',
    );
  }

  if (isGoogleManagedRuntime(environment)) return { mode: 'application_default', projectId };
  if (hasCompleteExplicitCredentials) return { mode: 'explicit_certificate', projectId: explicitValues.projectId };
  return { mode: 'application_default', projectId };
}
