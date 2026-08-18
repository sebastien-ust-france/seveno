import 'server-only';

import { createHmac } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

const RATE_LIMIT_COLLECTION = 'security_rate_limits';

export type SevenoRateLimitQuota = {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
  /** A rolling cooldown: its expiry is measured from the last accepted request. */
  cooldown?: boolean;
};

export type SevenoRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export class SevenoRateLimitConfigurationError extends Error {}

function getHashSecret() {
  const secret = process.env.SEVENO_RATE_LIMIT_HASH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new SevenoRateLimitConfigurationError('SEVENO_RATE_LIMIT_HASH_SECRET is not configured.');
  }

  return secret;
}

function hashRateLimitKey(scope: string, key: string) {
  return createHmac('sha256', getHashSecret()).update(`${scope}\u0000${key}`).digest('base64url');
}

function assertQuota(quota: SevenoRateLimitQuota) {
  if (!quota.scope || !quota.key || !Number.isInteger(quota.limit) || quota.limit < 1 || !Number.isInteger(quota.windowSeconds) || quota.windowSeconds < 1) {
    throw new SevenoRateLimitConfigurationError('Invalid rate-limit quota.');
  }
}

/**
 * Consumes every quota in one Firestore transaction. A rejection writes nothing,
 * so a successful quota is never partially consumed when another one refuses.
 */
export async function consumeSevenoRateLimits(quotas: SevenoRateLimitQuota[], now = Date.now()): Promise<SevenoRateLimitResult> {
  if (!adminDb) {
    throw new SevenoRateLimitConfigurationError('Firebase Admin Firestore is not available.');
  }
  const firestore = adminDb;
  if (quotas.length === 0) {
    throw new SevenoRateLimitConfigurationError('At least one rate-limit quota is required.');
  }
  quotas.forEach(assertQuota);

  const prepared = quotas.map((quota) => {
    const windowMs = quota.windowSeconds * 1000;
    const windowStartMs = quota.cooldown ? now : Math.floor(now / windowMs) * windowMs;
    const keyHash = hashRateLimitKey(quota.scope, quota.key);
    const id = createHmac('sha256', getHashSecret())
      .update(`${quota.scope}\u0000${keyHash}\u0000${quota.cooldown ? 'cooldown' : windowStartMs}`)
      .digest('base64url');
    return {
      ...quota,
      keyHash,
      windowStartMs,
      windowEndMs: windowStartMs + windowMs,
      ref: firestore.collection(RATE_LIMIT_COLLECTION).doc(id),
    };
  });

  return firestore.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(prepared.map(({ ref }) => transaction.get(ref)));
    const blocked = prepared.flatMap((quota, index) => {
      const snapshot = snapshots[index];
      const data = snapshot.data();
      const expiresAt = data?.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0;
      const count = expiresAt > now && typeof data?.count === 'number' ? data.count : 0;
      return count >= quota.limit ? [Math.max(1, Math.ceil((quota.windowEndMs - now) / 1000))] : [];
    });

    if (blocked.length > 0) {
      return { allowed: false as const, retryAfterSeconds: Math.max(...blocked) };
    }

    prepared.forEach((quota, index) => {
      const snapshot = snapshots[index];
      const data = snapshot.data();
      const expiresAt = data?.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0;
      const count = expiresAt > now && typeof data?.count === 'number' ? data.count : 0;
      transaction.set(quota.ref, {
        scope: quota.scope,
        keyHash: quota.keyHash,
        windowStartedAt: Timestamp.fromMillis(quota.windowStartMs),
        count: count + 1,
        expiresAt: Timestamp.fromMillis(quota.windowEndMs),
        updatedAt: Timestamp.fromMillis(now),
      });
    });

    return { allowed: true as const };
  });
}

export function normalizeRateLimitEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeRateLimitPhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}
