import { NextRequest, NextResponse } from 'next/server';
import {
  COMPANY_INVITATION_COOKIE,
  getCompanyInvitationByToken,
} from '@/lib/seveno-company-invitations';

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

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COMPANY_INVITATION_COOKIE)?.value?.trim() ?? '';
  if (!token) {
    return jsonNoStore({ invitation: null });
  }

  const invitation = await getCompanyInvitationByToken(token);
  return jsonNoStore({ invitation });
}
