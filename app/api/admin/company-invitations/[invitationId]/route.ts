import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoAdminSessionFromRequest } from '@/lib/seveno-admin-auth';
import { revokeCompanyInvitation } from '@/lib/seveno-company-invitations';
import { toAdminApiErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Cache-Control': 'no-store',
    },
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ invitationId: string }> }) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const { invitationId } = await context.params;
    return jsonNoStore(await revokeCompanyInvitation(session, invitationId));
  } catch (error) {
    return toAdminApiErrorResponse(error);
  }
}
