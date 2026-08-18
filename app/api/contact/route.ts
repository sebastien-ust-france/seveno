import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/app/api/seveno/matches/_shared';
import {
  buildContactMailtoHref,
  CONTACT_GENERAL_VALIDATION_MESSAGE,
  CONTACT_MIN_RENDER_DELAY_MS,
  CONTACT_SERVICE_UNAVAILABLE_MESSAGE,
  isTrustedContactOrigin,
  normalizeContactSubmission,
} from '@/lib/seveno-contact';
import { queueContactEmail } from '@/lib/seveno-contact-email';
import { consumeSevenoRateLimits, normalizeRateLimitEmail, SevenoRateLimitConfigurationError } from '@/lib/seveno-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CONTACT_BODY_CHARACTERS = 12_000;
const MIN_RENDER_MESSAGE = 'Veuillez patienter quelques secondes avant d’envoyer votre demande.';
const BODY_TOO_LARGE_MESSAGE = 'Le contenu envoyé est trop volumineux.';
const UNSUPPORTED_MEDIA_TYPE_MESSAGE = 'Le contenu envoyé doit être au format JSON.';
const INVALID_ORIGIN_MESSAGE = 'L’origine de la requête est invalide.';

function jsonResponse(
  status: number,
  payload: {
    ok: boolean;
    success: boolean;
    message: string;
    error?: string;
    requestId?: string;
    acknowledgementSent?: boolean;
    fieldErrors?: Record<string, string>;
    mailtoHref?: string;
  },
) {
  return NextResponse.json(payload, { status });
}

function jsonError(
  status: number,
  message: string,
  error: string,
  fieldErrors?: Record<string, string>,
  mailtoHref?: string,
) {
  return jsonResponse(status, {
    ok: false,
    success: false,
    message,
    error,
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(mailtoHref ? { mailtoHref } : {}),
  });
}

function isJsonContentType(contentType: string | null) {
  return Boolean(contentType && contentType.toLowerCase().includes('application/json'));
}

export async function POST(request: NextRequest) {
  if (!isJsonContentType(request.headers.get('content-type'))) {
    return jsonError(415, UNSUPPORTED_MEDIA_TYPE_MESSAGE, 'unsupported_media_type');
  }

  const body = await readJsonBody(request);
  if (!body) {
    return jsonError(400, CONTACT_GENERAL_VALIDATION_MESSAGE, 'invalid_payload', {
      general: CONTACT_GENERAL_VALIDATION_MESSAGE,
    });
  }

  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, success: true }, { status: 200 });
  }

  if (JSON.stringify(body).length > MAX_CONTACT_BODY_CHARACTERS) {
    return jsonError(413, CONTACT_GENERAL_VALIDATION_MESSAGE, 'payload_too_large', {
      general: BODY_TOO_LARGE_MESSAGE,
    });
  }

  if (!isTrustedContactOrigin(request.headers)) {
    return jsonError(403, INVALID_ORIGIN_MESSAGE, 'invalid_origin');
  }

  try {
    const submission = normalizeContactSubmission(body);

    const elapsedMs = Date.now() - submission.renderedAtMs;
    if (!Number.isFinite(elapsedMs) || elapsedMs < CONTACT_MIN_RENDER_DELAY_MS) {
      return jsonError(400, CONTACT_GENERAL_VALIDATION_MESSAGE, 'render_delay_not_respected', {
        general: MIN_RENDER_MESSAGE,
      });
    }

    const rateLimit = await consumeSevenoRateLimits([
      { scope: 'contact-email-hour', key: normalizeRateLimitEmail(submission.email), limit: 5, windowSeconds: 60 * 60 },
      { scope: 'contact-email-day', key: normalizeRateLimitEmail(submission.email), limit: 10, windowSeconds: 24 * 60 * 60 },
    ]);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'rate_limit_exceeded', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const requestId = randomUUID();
    const receivedAt = new Date();
    const delivery = await queueContactEmail({
      submission,
      requestId,
      receivedAt,
    });

    if (!delivery.queued) {
      const status = delivery.reason === 'provider_missing' ? 503 : 502;
      const error = delivery.reason === 'provider_missing' ? 'provider_missing' : 'send_failed';

      return jsonError(
        status,
        CONTACT_SERVICE_UNAVAILABLE_MESSAGE,
        error,
        undefined,
        buildContactMailtoHref(submission),
      );
    }

    return jsonResponse(201, {
      ok: true,
      success: true,
      message: delivery.acknowledgementSent
        ? 'Votre demande a bien été envoyée. Un message de confirmation a été transmis à l’adresse indiquée lorsque le service d’envoi le permet. Seven’O dispose désormais des informations nécessaires pour examiner votre demande.'
        : 'Votre demande a bien été envoyée. L’accusé de réception n’a pas pu être confirmé, mais la demande principale a bien été transmise à Seven’O.',
      requestId,
      acknowledgementSent: delivery.acknowledgementSent,
    });
  } catch (error) {
    const validationError = error as Error & {
      code?: string;
      status?: number;
      fieldErrors?: Record<string, string>;
    };

    if (validationError.code === 'validation_failed') {
      return jsonError(
        validationError.status ?? 400,
        CONTACT_GENERAL_VALIDATION_MESSAGE,
        'validation_failed',
        validationError.fieldErrors,
      );
    }

    if (error instanceof SevenoRateLimitConfigurationError) {
      console.error('[POST /api/contact] Rate limiter unavailable', error);
      return NextResponse.json({ error: 'rate_limit_unavailable' }, { status: 503 });
    }

    console.error('[POST /api/contact] Échec de traitement du formulaire', error);
    return jsonError(500, CONTACT_SERVICE_UNAVAILABLE_MESSAGE, 'unexpected_error');
  }
}
