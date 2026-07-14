import { NextRequest, NextResponse } from 'next/server';
import {
  requireSevenoAdminSessionFromRequest,
  clearSevenoAdminSessionCookie,
  setSevenoAdminSessionCookie,
  SevenoAdminAuthError,
} from '@/lib/seveno-admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toAdminSessionErrorResponse(error: unknown) {
  if (error instanceof SevenoAdminAuthError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  return NextResponse.json(
    {
      error: 'unexpected_error',
      message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.',
    },
    {
      status: 500,
    },
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSevenoAdminSessionFromRequest(request);
    const response = NextResponse.json({
      ok: true,
      uid: session.decodedToken.uid,
      email: session.user.email,
      role: session.user.role,
    });

    setSevenoAdminSessionCookie(response, session.token);
    return response;
  } catch (error) {
    return toAdminSessionErrorResponse(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSevenoAdminSessionCookie(response);
  return response;
}
