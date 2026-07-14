import 'server-only';

import { type DecodedIdToken } from 'firebase-admin/auth';
import { type NextRequest } from 'next/server';
import { adminAuth, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export class SevenoApiAuthError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getBearerToken(request: NextRequest) {
  const authorizationHeader = request.headers.get('authorization')?.trim() ?? '';
  if (!authorizationHeader) {
    return '';
  }

  if (!authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorizationHeader.slice(7).trim();
}

export async function requireSevenoApiToken(request: NextRequest): Promise<DecodedIdToken> {
  if (!isFirebaseAdminConfigured || !adminAuth) {
    throw new SevenoApiAuthError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour verifier les jetons Firebase.',
    );
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new SevenoApiAuthError('auth_required', 401, 'Jeton Firebase manquant.');
  }

  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    throw new SevenoApiAuthError('invalid_token', 401, 'Jeton Firebase invalide.');
  }
}
