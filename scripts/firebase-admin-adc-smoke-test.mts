import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FirebaseAdminConfigurationError,
  resolveFirebaseAdminInitialization,
  resolveFirebaseAdminProjectId,
} from '@/lib/firebase-admin-config';
import {
  checkContactRateLimit,
  recordContactAttempt,
  resetContactRateLimitState,
} from '@/lib/seveno-contact-rate-limit';

const appHosting = {
  NODE_ENV: 'production',
  K_SERVICE: 'seveno-runtime',
  GOOGLE_CLOUD_PROJECT: 'seveno-project',
};
assert.deepEqual(resolveFirebaseAdminInitialization(appHosting), {
  mode: 'application_default',
  projectId: 'seveno-project',
});
assert.equal(resolveFirebaseAdminProjectId({ FIREBASE_CONFIG: JSON.stringify({ projectId: 'firebase-config-project' }) }), 'firebase-config-project');
assert.equal(resolveFirebaseAdminInitialization({}).mode, 'application_default');
assert.deepEqual(resolveFirebaseAdminInitialization({ FIREBASE_ADMIN_PROJECT_ID: 'adc-project' }), {
  mode: 'application_default',
  projectId: 'adc-project',
});

const completeHistorical = {
  FIREBASE_ADMIN_PROJECT_ID: 'local-project',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'local@example.invalid',
  FIREBASE_ADMIN_PRIVATE_KEY: 'synthetic-private-key',
};
assert.equal(resolveFirebaseAdminInitialization(completeHistorical).mode, 'explicit_certificate');
assert.equal(resolveFirebaseAdminInitialization({ ...completeHistorical, ...appHosting }).mode, 'application_default');

for (const partial of [
  { FIREBASE_ADMIN_PROJECT_ID: 'local-project', FIREBASE_ADMIN_CLIENT_EMAIL: 'local@example.invalid' },
  { FIREBASE_ADMIN_PROJECT_ID: 'local-project', FIREBASE_ADMIN_PRIVATE_KEY: 'synthetic-private-key' },
  { FIREBASE_ADMIN_CLIENT_EMAIL: 'local@example.invalid', FIREBASE_ADMIN_PRIVATE_KEY: 'synthetic-private-key' },
]) {
  assert.throws(
    () => resolveFirebaseAdminInitialization(partial),
    (error: unknown) => error instanceof FirebaseAdminConfigurationError
      && error.code === 'firebase_admin_explicit_credentials_incomplete',
  );
}

assert.deepEqual(resolveFirebaseAdminInitialization({
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_ADMIN_PROJECT_ID: 'demo-seveno-local',
}), { mode: 'emulator', projectId: 'demo-seveno-local' });

delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
process.env.K_SERVICE = 'seveno-runtime';
process.env.GOOGLE_CLOUD_PROJECT = 'seveno-project';
resetContactRateLimitState();
const rateInput = { origin: '203.0.113.10', userAgent: 'adc-test', email: 'adc@example.invalid', now: 1000 };
for (let index = 0; index < 5; index += 1) {
  assert.equal(checkContactRateLimit(rateInput).allowed, true);
  recordContactAttempt(rateInput);
}
assert.deepEqual(checkContactRateLimit(rateInput), { allowed: false, retryAfterMs: 60 * 60 * 1000, reason: 'origin' });
resetContactRateLimitState();

const root = resolve(import.meta.dirname, '..');
const adminSource = readFileSync(resolve(root, 'lib/firebase-admin.ts'), 'utf8');
const hostingSource = readFileSync(resolve(root, 'apphosting.yaml'), 'utf8');
assert.match(adminSource, /credential:\s*applicationDefault\(\)/);
assert.match(adminSource, /getFirestore\(adminApp\)/);
assert.match(adminSource, /getAuth\(adminApp\)/);
assert.doesNotMatch(hostingSource, /FIREBASE_ADMIN_PRIVATE_KEY|FIREBASE_ADMIN_CLIENT_EMAIL|GOOGLE_APPLICATION_CREDENTIALS/);
assert.match(hostingSource, /variable:\s*STRIPE_CHECKOUT_ENABLED\s+value:\s*["']?true["']?/);

console.log('Firebase Admin ADC smoke test passed.');
