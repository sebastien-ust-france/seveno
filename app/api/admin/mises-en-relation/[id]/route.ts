import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { updateAdminMatchRequestStatus, writeAdminLog } from '@/lib/seveno-admin-service';
import { readJsonBody, toAdminApiErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const body = await readJsonBody(request);
    const { id } = await context.params;

    if (!body || typeof body.status !== 'string') {
      return NextResponse.json(
        {
          error: 'invalid_payload',
          message: 'Le contenu envoye est invalide.',
        },
        { status: 400 },
      );
    }

    if (body.status !== 'cancelled' && body.status !== 'expired') {
      return NextResponse.json(
        {
          error: 'invalid_status',
          message: 'Le statut de moderation admin doit etre cancelled ou expired.',
        },
        { status: 400 },
      );
    }

    const payload = await updateAdminMatchRequestStatus(id, body.status, session.user);
    await writeAdminLog('match_request_moderated', session.user, 'match_requests', id, {
      status: body.status,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}
