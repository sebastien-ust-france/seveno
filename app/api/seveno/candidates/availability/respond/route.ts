import { NextRequest, NextResponse } from 'next/server';
import { SevenoAvailabilityError, respondToAvailabilityConfirmationRequest } from '@/lib/seveno-candidate-availability-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toAvailabilityErrorResponse(error: unknown) {
  if (error instanceof SevenoAvailabilityError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'La confirmation de disponibilite est temporairement indisponible.',
    },
    { status: 500 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      requestId?: unknown;
      token?: unknown;
      action?: unknown;
      source?: unknown;
    } | null;

    const requestId = typeof body?.requestId === 'string' ? body.requestId : '';
    const token = typeof body?.token === 'string' ? body.token : '';
    const action = body?.action === 'yes' || body?.action === 'no' ? body.action : '';
    const source = body?.source === 'push_action'
      || body?.source === 'notification_page'
      || body?.source === 'dashboard'
      || body?.source === 'profile'
      || body?.source === 'scheduler'
      ? body.source
      : 'notification_page';

    if (!requestId || !token || !action) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'La confirmation est invalide.',
        },
        { status: 400 },
      );
    }

    const result = await respondToAvailabilityConfirmationRequest({
      requestId,
      token,
      action,
      source,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toAvailabilityErrorResponse(error);
  }
}

