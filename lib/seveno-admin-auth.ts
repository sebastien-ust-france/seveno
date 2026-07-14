import 'server-only';

import { type DecodedIdToken } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import type { SevenoUser } from '@/types/seveno';

export const SEVENO_ADMIN_SESSION_COOKIE = 'seveno_admin_session';

export class SevenoAdminAuthError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface SevenoAdminSession {
  token: string;
  decodedToken: DecodedIdToken;
  user: SevenoUser;
}

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get('authorization')?.trim() ?? '';
  if (!authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorizationHeader.slice(7).trim();
}

function getRequestToken(request: NextRequest) {
  const bearerToken = getBearerToken(request);
  if (bearerToken) {
    return bearerToken;
  }

  return request.cookies.get(SEVENO_ADMIN_SESSION_COOKIE)?.value?.trim() ?? '';
}

async function verifyAdminToken(token: string): Promise<SevenoAdminSession> {
  if (!isFirebaseAdminConfigured || !adminAuth) {
    throw new SevenoAdminAuthError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour verifier les acces admin.',
    );
  }

  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new SevenoAdminAuthError('auth_required', 401, 'Jeton Firebase manquant.');
  }

  let decodedToken: DecodedIdToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(normalizedToken);
  } catch {
    throw new SevenoAdminAuthError('invalid_token', 401, 'Jeton Firebase invalide.');
  }

  const user = await getSevenoUserByUid(decodedToken.uid);
  if (!user) {
    throw new SevenoAdminAuthError('admin_user_missing', 403, 'Compte administrateur introuvable.');
  }

  if (user.role !== 'admin') {
    throw new SevenoAdminAuthError('forbidden_role', 403, 'Acces admin refuse.');
  }

  return {
    token: normalizedToken,
    decodedToken,
    user,
  };
}

export async function requireSevenoAdminSessionFromRequest(request: NextRequest): Promise<SevenoAdminSession> {
  return await verifyAdminToken(getRequestToken(request));
}

export async function getSevenoAdminSessionFromCookies(): Promise<SevenoAdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SEVENO_ADMIN_SESSION_COOKIE)?.value?.trim() ?? '';
  if (!token) {
    return null;
  }

  try {
    return await verifyAdminToken(token);
  } catch {
    return null;
  }
}

export function setSevenoAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SEVENO_ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });
}

export function clearSevenoAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SEVENO_ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
