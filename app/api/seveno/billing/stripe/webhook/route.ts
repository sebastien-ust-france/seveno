import { NextRequest, NextResponse } from 'next/server';
import { constructStripeWebhookEvent, processStripeWebhookEvent, SevenoStripeError } from '@/lib/seveno-stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function maskedSuffix(value: string | null | undefined) {
  if (!value) return null;
  return `…${value.slice(-6)}`;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'stripe_signature_missing' }, { status: 400 });
  let eventType = 'unknown';
  let eventId: string | null = null;
  let orderId: string | null = null;
  try {
    const rawBody = await request.text();
    const event = constructStripeWebhookEvent(rawBody, signature);
    eventType = event.type;
    eventId = event.id;
    if (event.data.object && typeof event.data.object === 'object' && 'metadata' in event.data.object) {
      const object = event.data.object as { metadata?: { orderId?: string } | null };
      orderId = object.metadata?.orderId ?? null;
    }
    const result = await processStripeWebhookEvent(event);
    if (result.status === 'ignored') {
      console.info('[seveno-stripe-webhook-ignored]', {
        code: result.code,
        eventType,
        eventIdSuffix: eventId?.slice(-6) ?? null,
        orderId: maskedSuffix(result.orderId),
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof SevenoStripeError && error.status === 400) return NextResponse.json({ error: error.code }, { status: 400 });
    if (error instanceof Error && error.name === 'StripeSignatureVerificationError') return NextResponse.json({ error: 'stripe_signature_invalid' }, { status: 400 });
    console.error('[seveno-stripe-webhook]', {
      code: error instanceof SevenoStripeError ? error.code : 'stripe_webhook_failed',
      eventType,
      eventIdSuffix: eventId?.slice(-6) ?? null,
      orderId: maskedSuffix(orderId),
    });
    return NextResponse.json({ error: 'stripe_webhook_failed' }, { status: 500 });
  }
}
