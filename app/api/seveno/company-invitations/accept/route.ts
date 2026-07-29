import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken } from '@/lib/seveno-api-auth';
import {
  COMPANY_INVITATION_COOKIE,
  acceptCompanyInvitationForAuth,
  toInvitationAuthContext,
} from '@/lib/seveno-company-invitations';
import { toCompanyInvitationApiErrorResponse } from '../_shared';

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

function clearInvitationCookie(response: NextResponse) {
  response.cookies.set({
    name: COMPANY_INVITATION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
      path: '/api/seveno/company-invitations',
      maxAge: 0,
    });
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const invitationToken = request.cookies.get(COMPANY_INVITATION_COOKIE)?.value?.trim() ?? '';
    if (!invitationToken) {
      return jsonNoStore(
        {
          error: 'invitation_missing',
          message: 'Aucune invitation entreprise valide n est disponible pour cette session.',
        },
        { status: 400 },
      );
    }

    const result = await acceptCompanyInvitationForAuth(toInvitationAuthContext(decodedToken), invitationToken);
    const response = jsonNoStore({
      accepted: true,
      invitation: result.invitation,
      redirectPath: '/entreprise/onboarding',
    });
    clearInvitationCookie(response);
    return response;
  } catch (error) {
    return toCompanyInvitationApiErrorResponse(error);
  }
}
