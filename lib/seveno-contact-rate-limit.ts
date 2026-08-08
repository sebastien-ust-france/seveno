import 'server-only';

import { createHash } from 'node:crypto';

const CONTACT_ORIGIN_WINDOW_MS = 60 * 60 * 1000;
const CONTACT_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ORIGIN_ATTEMPTS_PER_HOUR = 5;
const MAX_EMAIL_ATTEMPTS_PER_DAY = 10;

type StoredAttempt = {
  at: number;
};

const originAttempts = new Map<string, StoredAttempt[]>();
const emailAttempts = new Map<string, StoredAttempt[]>();

function getRateLimitSecret() {
  return (
    process.env.SEVENO_CONTACT_RATE_LIMIT_SECRET
    || process.env.SEVENO_AVAILABILITY_CRON_SECRET
    || 'seveno-contact-rate-limit'
  );
}

function hashValue(value: string) {
  return createHash('sha256').update(`${getRateLimitSecret()}\0${value}`, 'utf8').digest('hex');
}

function pruneAttempts(attempts: StoredAttempt[], windowMs: number, now: number) {
  return attempts.filter((attempt) => now - attempt.at <= windowMs);
}

function countAttempts(map: Map<string, StoredAttempt[]>, key: string, windowMs: number, now: number) {
  const attempts = map.get(key) ?? [];
  const keptAttempts = pruneAttempts(attempts, windowMs, now);
  if (keptAttempts.length > 0) {
    map.set(key, keptAttempts);
  } else {
    map.delete(key);
  }

  return keptAttempts.length;
}

function recordAttempt(map: Map<string, StoredAttempt[]>, key: string, now: number) {
  const attempts = map.get(key) ?? [];
  attempts.push({ at: now });
  map.set(key, attempts);
}

export type ContactRateLimitCheck = {
  allowed: boolean;
  retryAfterMs?: number;
  reason?: 'origin' | 'email';
};

export function buildContactOriginKey(origin: string, userAgent: string) {
  return hashValue(`${origin}\0${userAgent}`);
}

export function buildContactEmailKey(email: string) {
  return hashValue(email.trim().toLowerCase());
}

export function checkContactRateLimit(input: {
  origin: string;
  userAgent: string;
  email: string;
  now?: number;
}): ContactRateLimitCheck {
  const now = input.now ?? Date.now();
  const originKey = buildContactOriginKey(input.origin, input.userAgent);
  const emailKey = buildContactEmailKey(input.email);

  const originCount = countAttempts(originAttempts, originKey, CONTACT_ORIGIN_WINDOW_MS, now);
  if (originCount >= MAX_ORIGIN_ATTEMPTS_PER_HOUR) {
    return {
      allowed: false,
      retryAfterMs: CONTACT_ORIGIN_WINDOW_MS,
      reason: 'origin',
    };
  }

  const emailCount = countAttempts(emailAttempts, emailKey, CONTACT_EMAIL_WINDOW_MS, now);
  if (emailCount >= MAX_EMAIL_ATTEMPTS_PER_DAY) {
    return {
      allowed: false,
      retryAfterMs: CONTACT_EMAIL_WINDOW_MS,
      reason: 'email',
    };
  }

  return {
    allowed: true,
  };
}

export function recordContactAttempt(input: {
  origin: string;
  userAgent: string;
  email: string;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const originKey = buildContactOriginKey(input.origin, input.userAgent);
  const emailKey = buildContactEmailKey(input.email);

  recordAttempt(originAttempts, originKey, now);
  recordAttempt(emailAttempts, emailKey, now);
}

export function resetContactRateLimitState() {
  originAttempts.clear();
  emailAttempts.clear();
}

