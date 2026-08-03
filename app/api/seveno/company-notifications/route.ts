import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import {
  disableCompanyNotificationDevice,
  getCompanyNotificationState,
  registerCompanyNotificationDevice,
  setCompanyNotificationPreference,
  SevenoCompanyNotificationError,
} from '@/lib/seveno-company-notifications-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toErrorResponse(error: unknown) {
  if (error instanceof SevenoApiAuthError || error instanceof SevenoCompanyNotificationError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'unexpected_error', message: 'Les notifications entreprise sont temporairement indisponibles.' },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const deviceId = request.nextUrl.searchParams.get('deviceId');
    return NextResponse.json(await getCompanyNotificationState(token.uid, deviceId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await requireSevenoApiToken(request);
    const body = (await request.json().catch(() => null)) as {
      action?: 'register_device' | 'unregister_device' | 'enable' | 'disable';
      notificationType?: 'application_received' | 'questionnaire_completed';
      deviceId?: unknown;
      token?: unknown;
      permission?: unknown;
      platform?: unknown;
      userAgent?: unknown;
    } | null;

    if (body?.action === 'register_device') {
      const permission = body.permission === 'default' || body.permission === 'granted' || body.permission === 'denied'
        ? body.permission
        : 'default';
      return NextResponse.json(await registerCompanyNotificationDevice(token.uid, {
        deviceId: typeof body.deviceId === 'string' ? body.deviceId : '',
        token: typeof body.token === 'string' ? body.token : '',
        permission,
        platform: typeof body.platform === 'string' ? body.platform : null,
        userAgent: typeof body.userAgent === 'string' ? body.userAgent : null,
      }));
    }

    if (body?.action === 'unregister_device') {
      return NextResponse.json(await disableCompanyNotificationDevice(
        token.uid,
        typeof body.deviceId === 'string' ? body.deviceId : '',
      ));
    }

    if (body?.action === 'enable' || body?.action === 'disable') {
      return NextResponse.json(await setCompanyNotificationPreference(
        token.uid,
        body.notificationType ?? 'application_received',
        body.action === 'enable',
      ));
    }

    return NextResponse.json({ error: 'invalid_payload', message: 'L’action demandée est invalide.' }, { status: 400 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
