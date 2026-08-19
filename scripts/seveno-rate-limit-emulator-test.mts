import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = 'seveno-rate-limit-test';
process.env.PROJECT_ID = 'seveno-rate-limit-test';
process.env.FIREBASE_ADMIN_PROJECT_ID = 'seveno-rate-limit-test';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'seveno-rate-limit-test';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
process.env.SEVENO_RATE_LIMIT_HASH_SECRET = 'test-only-rate-limit-secret-32-bytes-minimum';

const { adminDb } = await import('@/lib/firebase-admin');
const { consumeSevenoRateLimits } = await import('@/lib/seveno-rate-limit');

assert.ok(adminDb, 'Firestore emulator must be available');
const firestore = adminDb;
const suffix = randomUUID();
const now = 1_800_000_000_000;
const quota = (scope: string, key: string, limit: number, windowSeconds: number, cooldown = false) => ({ scope: `${scope}-${suffix}`, key, limit, windowSeconds, ...(cooldown ? { cooldown: true } : {}) });

async function count(scope: string) {
  return (await firestore.collection('security_rate_limits').where('scope', '==', scope).get()).docs.map((doc) => doc.data());
}

async function main() {
  const fixed = quota('fixed', 'subject-a', 5, 60);
  for (let index = 0; index < 5; index += 1) assert.equal((await consumeSevenoRateLimits([fixed], now)).allowed, true);
  const refused = await consumeSevenoRateLimits([fixed], now);
  assert.deepEqual(refused, { allowed: false, retryAfterSeconds: 60 });
  assert.equal((await count(fixed.scope))[0]?.count, 5, 'a refusal must not increment the counter');

  assert.equal((await consumeSevenoRateLimits([fixed], now + 61_000)).allowed, true, 'a new fixed window must be allowed');

  const cooldown = quota('cooldown', 'subject-b', 1, 60, true);
  assert.equal((await consumeSevenoRateLimits([cooldown], now)).allowed, true);
  assert.equal((await consumeSevenoRateLimits([cooldown], now + 61_000)).allowed, true, 'an expired document must be reusable without TTL deletion');
  assert.equal((await count(cooldown.scope))[0]?.count, 1);

  const atomicA = quota('atomic-a', 'company-a', 2, 60);
  const atomicB = quota('atomic-b', 'company-a', 1, 60);
  assert.equal((await consumeSevenoRateLimits([atomicB], now)).allowed, true);
  assert.equal((await consumeSevenoRateLimits([atomicA, atomicB], now)).allowed, false);
  assert.equal((await count(atomicA.scope)).length, 0, 'all quotas must remain untouched when one refuses');
  const atomicC = quota('atomic-c', 'company-b', 2, 60);
  const atomicD = quota('atomic-d', 'recipient-b', 2, 60);
  assert.equal((await consumeSevenoRateLimits([atomicC, atomicD], now)).allowed, true);
  assert.equal((await count(atomicC.scope))[0]?.count, 1);
  assert.equal((await count(atomicD.scope))[0]?.count, 1);

  const concurrent = quota('concurrent', 'uid-a', 5, 60);
  for (let index = 0; index < 4; index += 1) assert.equal((await consumeSevenoRateLimits([concurrent], now)).allowed, true);
  const concurrentResults = await Promise.all(Array.from({ length: 8 }, () => consumeSevenoRateLimits([concurrent], now)));
  assert.equal(concurrentResults.filter((result) => result.allowed).length, 1, 'only one concurrent request may take the final slot');
  assert.equal((await count(concurrent.scope))[0]?.count, 5);

  console.log('SevenO rate-limit Firestore emulator tests: OK');
}

await main();
