import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = 'seveno-rate-limit-test';
process.env.PROJECT_ID = 'seveno-rate-limit-test';
process.env.FIREBASE_ADMIN_PROJECT_ID = 'seveno-rate-limit-test';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'seveno-rate-limit-test';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.SEVENO_RATE_LIMIT_HASH_SECRET = 'test-only-rate-limit-secret-32-bytes-minimum';

const { POST } = await import('@/app/api/study-responses/route');
const { adminDb } = await import('@/lib/firebase-admin');
assert.ok(adminDb);
const suffix = randomUUID();
const body = (email: string) => ({ respondentType: 'professional_available', answers: { sectorCode: 'construction' }, email, phone: '', wantsLaunchNotification: false, wantsBetaAccess: false });
const request = (value: Record<string, unknown>) => new NextRequest('http://localhost/api/study-responses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });

const invalid = await POST(request({}));
assert.equal(invalid.status, 400);
for (let index = 0; index < 3; index += 1) assert.equal((await POST(request(body(`study-${suffix}-${index}@example.test`)))).status, 200);
const limited = await POST(request(body(`study-${suffix}-3@example.test`)));
assert.equal(limited.status, 200, 'different contact identities remain independent');
const sameIdentity = `same-${suffix}@example.test`;
for (let index = 0; index < 3; index += 1) {
  assert.equal((await POST(request(body(sameIdentity)))).status, 200);
  const responses = await adminDb.collection('study_responses').where('email', '==', sameIdentity).get();
  await Promise.all(responses.docs.map((doc) => doc.ref.delete()));
}
const exceeded = await POST(request(body(sameIdentity)));
assert.equal(exceeded.status, 429);
const exceededBody = await exceeded.json() as { error?: unknown; retryAfterSeconds?: unknown };
assert.equal(exceededBody.error, 'rate_limit_exceeded');
assert.equal(typeof exceededBody.retryAfterSeconds, 'number');
assert.equal(exceeded.headers.get('Retry-After'), String(exceededBody.retryAfterSeconds));

const docs = await adminDb.collection('security_rate_limits').where('scope', '==', 'study-response-hour').get();
for (const doc of docs.docs) {
  const data = doc.data();
  assert.equal(typeof data.keyHash, 'string');
  assert.equal(JSON.stringify(data).includes('@example.test'), false);
}
console.log('Study rate-limit integration test: OK');
