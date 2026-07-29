import { NextRequest, NextResponse } from 'next/server';
import {
  COMPANY_INVITATION_COOKIE,
  claimCompanyInvitationToken,
} from '@/lib/seveno-company-invitations';
import { readJsonBody, toCompanyInvitationApiErrorResponse } from '../_shared';

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

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) {
      return jsonNoStore(
        {
          error: 'missing_token',
          message: 'Le jeton d invitation est manquant.',
        },
        { status: 400 },
      );
    }

    const invitation = await claimCompanyInvitationToken(token);
    const response = jsonNoStore({ invitation });
    const expiresAtMs = Date.parse(invitation.expiresAt);
    const maxAge = Number.isFinite(expiresAtMs)
      ? Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
      : 0;
    response.cookies.set({
      name: COMPANY_INVITATION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/api/seveno/company-invitations',
      maxAge,
    });
    return response;
  } catch (error) {
    return toCompanyInvitationApiErrorResponse(error);
  }
}
