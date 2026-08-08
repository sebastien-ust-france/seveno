import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireSevenoApiToken, SevenoApiAuthError } from '@/lib/seveno-api-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USERS_COLLECTION = 'users';

class SevenoUserSyncError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSupportedAuthProvider(value: unknown) {
  return value === 'google' || value === 'password';
}

function resolveAuthProvider(signInProvider: unknown) {
  if (signInProvider === 'google.com') {
    return 'google' as const;
  }

  if (signInProvider === 'password') {
    return 'password' as const;
  }

  throw new SevenoUserSyncError(
    'unsupported_provider',
    400,
    'Le fournisseur de connexion Firebase n est pas pris en charge.',
  );
}

function getOptionalTokenText(value: unknown) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : undefined;
}

function getRequestedInitialRole(value: unknown) {
  return value === 'candidate' || value === 'company' ? value : null;
}

function getAdminDatabase() {
  if (!adminDb) {
    throw new SevenoApiAuthError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour synchroniser les comptes SevenO.',
    );
  }

  return adminDb;
}

async function syncSevenoUserDocument(
  uid: string,
  authProvider: unknown,
  email: unknown,
  emailVerified: boolean,
  displayName: unknown,
  photoURL: unknown,
  initialRole: 'candidate' | 'company' | null,
) {
  const firestore = getAdminDatabase();
  const ref = firestore.collection(USERS_COLLECTION).doc(uid);
  const now = Timestamp.now();

  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? snapshot.data() as Record<string, unknown> : null;
    const existingRole = existing?.role === 'candidate' || existing?.role === 'company' || existing?.role === 'admin'
      ? existing.role
      : null;
    const existingAuthProvider = isSupportedAuthProvider(existing?.authProvider) ? existing.authProvider : null;
    const resolvedEmail = getOptionalTokenText(email) || getOptionalTokenText(existing?.email);

    if (initialRole && existingRole && initialRole !== existingRole) {
      throw new SevenoUserSyncError(
        'role_already_assigned',
        409,
        'Ce compte possede deja un type de compte SevenO different.',
      );
    }

    if (!resolvedEmail) {
      throw new SevenoUserSyncError(
        'missing_email',
        400,
        'Impossible de synchroniser le document utilisateur sans adresse email.',
      );
    }

    const payload: Record<string, unknown> = {
      uid,
      role: existingRole ?? initialRole,
      authProvider: existingAuthProvider ?? resolveAuthProvider(authProvider),
      email: resolvedEmail,
      emailVerified,
      ...(getOptionalTokenText(displayName) ? { displayName: getOptionalTokenText(displayName) } : {}),
      ...(getOptionalTokenText(photoURL) ? { photoURL: getOptionalTokenText(photoURL) } : {}),
      onboardingCompleted: existing?.onboardingCompleted === true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    transaction.set(ref, payload, { merge: true });
  });
}

export async function POST(request: NextRequest) {
  try {
    const decodedToken = await requireSevenoApiToken(request);
    const body = (await request.json().catch(() => null)) as {
      initialRole?: 'candidate' | 'company' | null;
    } | null;
    const initialRole = getRequestedInitialRole(body?.initialRole ?? null);
    await syncSevenoUserDocument(
      decodedToken.uid,
      decodedToken.firebase?.sign_in_provider ?? null,
      decodedToken.email ?? null,
      decodedToken.email_verified === true,
      (decodedToken as { name?: unknown }).name ?? null,
      (decodedToken as { picture?: unknown }).picture ?? null,
      initialRole,
    );

    if (!adminDb) {
      throw new SevenoApiAuthError(
        'firebase_admin_missing',
        500,
        'Firebase Admin n est pas configure pour synchroniser les comptes SevenO.',
      );
    }

    return NextResponse.json({ synced: true }, { status: 200 });
  } catch (error) {
    if (error instanceof SevenoApiAuthError || error instanceof SevenoUserSyncError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: 'unexpected_error',
        message: error instanceof Error ? error.message : 'La synchronisation du compte SevenO a echoue.',
      },
      { status: 500 },
    );
  }
}
