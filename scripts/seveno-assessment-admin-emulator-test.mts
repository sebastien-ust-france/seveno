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

function configureLocalFirestoreEmulatorEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.SEVENO_EMULATOR_PROJECT_ID = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
  process.env.GCLOUD_PROJECT = process.env.SEVENO_EMULATOR_PROJECT_ID;
  process.env.PROJECT_ID = process.env.SEVENO_EMULATOR_PROJECT_ID;
  process.env.FIREBASE_ADMIN_PROJECT_ID = process.env.SEVENO_EMULATOR_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.SEVENO_EMULATOR_PROJECT_ID;
  process.env.SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE = 'firestore';
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
}

loadDotEnvFile(resolve(process.cwd(), '.env.local'));
configureLocalFirestoreEmulatorEnvironment();

await import('./seveno-assessment-admin-smoke-test.mts');
