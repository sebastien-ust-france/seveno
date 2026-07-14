import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { getSevenoUserByUid, SevenoMatchRequestError } from '@/lib/seveno-match-requests';
import {
  SevenoAvailabilityError,
  disableCandidateAvailabilityDevice,
  registerCandidateAvailabilityDevice,
  setCandidateAvailabilityNotifications,
} from '@/lib/seveno-candidate-availability-server';
import type { AvailabilityNotificationSource } from '@/types/seveno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toAvailabilityErrorResponse(error: unknown) {
  if (
    error instanceof SevenoApiAuthError
    || error instanceof SevenoMatchRequestError
    || error instanceof SevenoAvailabilityError
  ) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'Les notifications de disponibilite sont temporairement indisponibles.',
    },
    { status: 500 },
  );
}

function isPermission(value: unknown): value is 'default' | 'granted' | 'denied' {
  return value === 'default' || value === 'granted' || value === 'denied';
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const actor = await getSevenoUserByUid(decodedToken.uid);
    if (!actor || actor.role !== 'candidate') {
      throw new SevenoMatchRequestError('forbidden_role', 403, 'Seuls les candidats peuvent gerer leurs notifications.');
    }

    const body = (await request.json().catch(() => null)) as {
      action?: 'enable' | 'disable' | 'register_device' | 'unregister_device';
      source?: AvailabilityNotificationSource;
      permission?: unknown;
      deviceId?: unknown;
      token?: unknown;
      timezone?: unknown;
      platform?: unknown;
      userAgent?: unknown;
    } | null;

    const action = body?.action;
    if (!action) {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'L action est manquante.',
        },
        { status: 400 },
      );
    }

    if (action === 'enable' || action === 'disable') {
      const result = await setCandidateAvailabilityNotifications(decodedToken.uid, {
        enabled: action === 'enable',
        source: body?.source ?? 'dashboard',
        permission: isPermission(body?.permission) ? body.permission : undefined,
      });

      return NextResponse.json({ profile: result });
    }

    if (action === 'register_device') {
      const permission = isPermission(body?.permission) ? body.permission : null;
      if (!permission) {
        return NextResponse.json(
          {
            error: 'invalid_payload',
            message: 'La permission de notification est invalide.',
          },
          { status: 400 },
        );
      }

      const result = await registerCandidateAvailabilityDevice(decodedToken.uid, {
        deviceId: typeof body?.deviceId === 'string' ? body.deviceId : '',
        token: typeof body?.token === 'string' ? body.token : '',
        permission,
        timezone: typeof body?.timezone === 'string' ? body.timezone : null,
        platform: typeof body?.platform === 'string' ? body.platform : null,
        userAgent: typeof body?.userAgent === 'string' ? body.userAgent : null,
        source: body?.source ?? 'dashboard',
      });

      return NextResponse.json(result);
    }

    if (action === 'unregister_device') {
      const result = await disableCandidateAvailabilityDevice(decodedToken.uid, {
        deviceId: typeof body?.deviceId === 'string' ? body.deviceId : '',
        source: body?.source ?? 'dashboard',
      });

      return NextResponse.json({ hasActiveDevice: Boolean(result) });
    }

    return NextResponse.json(
      {
        error: 'invalid_payload',
        message: 'L action de notification est invalide.',
      },
      { status: 400 },
    );
  } catch (error) {
    return toAvailabilityErrorResponse(error);
  }
}

