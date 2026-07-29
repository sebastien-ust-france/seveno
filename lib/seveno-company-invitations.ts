import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { SevenoAdminServiceError } from '@/lib/seveno-admin-service';
import type { SevenoAdminSession } from '@/lib/seveno-admin-auth';
import type {
  CompanyInvitation,
  CompanyInvitationStatus,
  PublicCompanyInvitationView,
} from '@/types/seveno';
import type {
  AdminCompanyInvitationCreateResult,
  AdminCompanyInvitationListPayload,
  AdminCompanyInvitationSummary,
} from '@/types/seveno-admin';

export const COMPANY_INVITATIONS_COLLECTION = 'company_invitations';
export const COMPANY_INVITATION_COOKIE = 'seveno_company_invitation';
export const COMPANY_INVITATION_TTL_DAYS = 7;
export const COMPANY_INVITATION_TTL_SECONDS = COMPANY_INVITATION_TTL_DAYS * 24 * 60 * 60;

interface StoredCompanyInvitation extends Omit<CompanyInvitation, 'createdAt' | 'updatedAt' | 'expiresAt' | 'acceptedAt' | 'revokedAt'> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp | null;
  revokedAt?: Timestamp | null;
}

interface CompanyInvitationAuthContext {
  uid: string;
  email: string;
  emailVerified: boolean;
  authProvider: 'google' | 'password';
  displayName?: string | null;
  photoURL?: string | null;
}

export interface CompanyInvitationAcceptanceResult {
  invitation: PublicCompanyInvitationView;
  userRole: 'company';
  onboardingCompleted: boolean;
}

function requireCompanyInvitationDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoAdminServiceError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour gerer les invitations entreprise.',
    );
  }

  return adminDb;
}

function requireAdminSession(session: SevenoAdminSession) {
  if (session.user.role !== 'admin') {
    throw new SevenoAdminServiceError('forbidden_role', 403, 'Acces admin refuse.');
  }
}

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(email: string) {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) {
    return trimmed;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const firstChar = localPart.slice(0, 1);

  if (!firstChar) {
    return `***@${domain}`;
  }

  return `${firstChar}***@${domain}`;
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeInvitationOrigin(origin: string) {
  const trimmed = origin.trim().replace(/\/+$/g, '');
  if (!trimmed) {
    throw new SevenoAdminServiceError('invalid_origin', 500, 'L origine de l invitation entreprise est invalide.');
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(trimmed);
  } catch {
    throw new SevenoAdminServiceError('invalid_origin', 500, 'L origine de l invitation entreprise est invalide.');
  }

  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
    throw new SevenoAdminServiceError('invalid_origin', 500, 'L origine de l invitation entreprise est invalide.');
  }

  return parsedOrigin.origin;
}

export function getCompanyInvitationAppOrigin() {
  if (process.env.NEXT_PUBLIC_SEVENO_USE_FIREBASE_EMULATORS === 'true') {
    const localOrigin = process.env.SEVENO_EMULATOR_APP_ORIGIN?.trim() ?? '';
    if (!localOrigin) {
      throw new SevenoAdminServiceError(
        'missing_emulator_origin',
        500,
        'Le mode émulateurs exige SEVENO_EMULATOR_APP_ORIGIN.',
      );
    }

    const normalizedLocalOrigin = normalizeInvitationOrigin(localOrigin);
    if (!normalizedLocalOrigin.startsWith('http://localhost') && !normalizedLocalOrigin.startsWith('http://127.0.0.1')) {
      throw new SevenoAdminServiceError(
        'invalid_emulator_origin',
        500,
        'L origine locale des invitations doit pointer vers localhost ou 127.0.0.1.',
      );
    }

    return normalizedLocalOrigin;
  }

  return 'https://seveno.eu';
}

function buildInvitationUrl(token: string) {
  const origin = getCompanyInvitationAppOrigin();
  return new URL(`/invitation-entreprise/${encodeURIComponent(token)}`, origin).toString();
}

function toInvitationStatus(
  invitation: StoredCompanyInvitation,
  referenceTime = Timestamp.now(),
): CompanyInvitationStatus {
  if (invitation.status === 'pending' && invitation.expiresAt.toMillis() <= referenceTime.toMillis()) {
    return 'expired';
  }

  return invitation.status;
}

function serializeInvitation(invitationId: string, invitation: StoredCompanyInvitation): AdminCompanyInvitationSummary {
  const status = toInvitationStatus(invitation);
  return {
    invitationId,
    email: invitation.email,
    status,
    createdAt: invitation.createdAt.toDate().toISOString(),
    updatedAt: invitation.updatedAt.toDate().toISOString(),
    expiresAt: invitation.expiresAt.toDate().toISOString(),
    createdByUid: invitation.createdByUid,
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toDate().toISOString() : null,
    acceptedByUid: invitation.acceptedByUid ?? null,
    revokedAt: invitation.revokedAt ? invitation.revokedAt.toDate().toISOString() : null,
    revokedByUid: invitation.revokedByUid ?? null,
  };
}

function serializePublicInvitation(invitationId: string, invitation: StoredCompanyInvitation): PublicCompanyInvitationView {
  return {
    invitationId,
    emailNormalized: invitation.emailNormalized,
    emailMasked: maskEmail(invitation.email),
    status: toInvitationStatus(invitation),
    createdAt: invitation.createdAt.toDate().toISOString(),
    updatedAt: invitation.updatedAt.toDate().toISOString(),
    expiresAt: invitation.expiresAt.toDate().toISOString(),
  };
}

function ensureInvitationIsActive(invitation: StoredCompanyInvitation) {
  const status = toInvitationStatus(invitation);

  if (status === 'pending') {
    return;
  }

  if (status === 'expired') {
    throw new SevenoAdminServiceError(
      'invitation_expired',
      410,
      'Cette invitation a expiré. Demandez une nouvelle invitation à l administrateur SevenO.',
    );
  }

  if (status === 'revoked') {
    throw new SevenoAdminServiceError(
      'invitation_revoked',
      410,
      'Cette invitation n est plus valide. Demandez une nouvelle invitation à l administrateur SevenO.',
    );
  }

  throw new SevenoAdminServiceError(
    'invitation_used',
    410,
    'Cette invitation a déjà été utilisée.',
  );
}

async function getInvitationDocumentByToken(token: string) {
  const firestore = requireCompanyInvitationDatabase();
  const tokenHash = hashToken(token);
  const snapshot = await firestore
    .collection(COMPANY_INVITATIONS_COLLECTION)
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  const match = snapshot.docs[0];
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    invitation: match.data() as StoredCompanyInvitation,
  };
}

export function normalizeCompanyInvitationEmail(email: string) {
  return cleanEmail(email);
}

export function isCompanyInvitationEmailValid(email: string) {
  return isValidEmail(cleanEmail(email));
}

export async function createCompanyInvitation(
  session: SevenoAdminSession,
  email: string,
): Promise<AdminCompanyInvitationCreateResult> {
  requireAdminSession(session);
  const normalizedEmail = cleanEmail(email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw new SevenoAdminServiceError('invalid_email', 400, 'Adresse email professionnelle invalide.');
  }

  const firestore = requireCompanyInvitationDatabase();
  const invitationId = firestore.collection(COMPANY_INVITATIONS_COLLECTION).doc().id;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + COMPANY_INVITATION_TTL_SECONDS * 1000);
  const invitationRef = firestore.collection(COMPANY_INVITATIONS_COLLECTION).doc(invitationId);

  await firestore.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(
      firestore.collection(COMPANY_INVITATIONS_COLLECTION).where('emailNormalized', '==', normalizedEmail),
    );
    const existingActive = existingSnapshot.docs.find((doc) => {
      const data = doc.data() as StoredCompanyInvitation;
      return toInvitationStatus(data, now) === 'pending';
    });

    if (existingActive) {
      throw new SevenoAdminServiceError(
        'invitation_already_pending',
        409,
        'Une invitation en attente existe déjà pour cette adresse.',
      );
    }

    const payload: StoredCompanyInvitation = {
      invitationId,
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      tokenHash,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      expiresAt,
      createdByUid: session.user.uid,
    };

    transaction.set(invitationRef, payload);
  });

  return {
    invitationId,
    email: normalizedEmail,
    status: 'pending',
    expiresAt: expiresAt.toDate().toISOString(),
    invitationUrl: buildInvitationUrl(token),
  };
}

export async function listCompanyInvitations(
  session: SevenoAdminSession,
): Promise<AdminCompanyInvitationListPayload> {
  requireAdminSession(session);
  const firestore = requireCompanyInvitationDatabase();
  const snapshot = await firestore.collection(COMPANY_INVITATIONS_COLLECTION).get();
  const invitations = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      invitation: doc.data() as StoredCompanyInvitation,
    }))
    .sort((left, right) => right.invitation.createdAt.toMillis() - left.invitation.createdAt.toMillis())
    .map(({ id, invitation }) => serializeInvitation(id, invitation));

  return { invitations };
}

export async function revokeCompanyInvitation(
  session: SevenoAdminSession,
  invitationId: string,
) {
  requireAdminSession(session);
  const firestore = requireCompanyInvitationDatabase();
  const invitationRef = firestore.collection(COMPANY_INVITATIONS_COLLECTION).doc(invitationId);
  const currentSnapshot = await invitationRef.get();
  if (!currentSnapshot.exists) {
    throw new SevenoAdminServiceError('invitation_not_found', 404, 'Invitation introuvable.');
  }

  const current = currentSnapshot.data() as StoredCompanyInvitation;
  if (toInvitationStatus(current) !== 'pending') {
    throw new SevenoAdminServiceError(
      'invitation_not_revocable',
      409,
      'Seule une invitation en attente peut être révoquée.',
    );
  }

  const now = Timestamp.now();
  await invitationRef.update({
    status: 'revoked',
    revokedAt: now,
    revokedByUid: session.user.uid,
    updatedAt: now,
  });

  const updatedSnapshot = await invitationRef.get();
  const updated = updatedSnapshot.data() as StoredCompanyInvitation;
  return serializeInvitation(invitationId, updated);
}

export async function getCompanyInvitationByToken(token: string): Promise<PublicCompanyInvitationView | null> {
  if (!token.trim()) {
    return null;
  }

  const match = await getInvitationDocumentByToken(token);
  if (!match) {
    return null;
  }

  return serializePublicInvitation(match.id, match.invitation);
}

export async function claimCompanyInvitationToken(token: string): Promise<PublicCompanyInvitationView> {
  const invitation = await getInvitationDocumentByToken(token);
  if (!invitation) {
    throw new SevenoAdminServiceError(
      'invitation_invalid',
      404,
      'Cette invitation est invalide ou n existe plus.',
    );
  }

  ensureInvitationIsActive(invitation.invitation);
  return serializePublicInvitation(invitation.id, invitation.invitation);
}

export async function acceptCompanyInvitationForAuth(
  authContext: CompanyInvitationAuthContext,
  token: string,
): Promise<CompanyInvitationAcceptanceResult> {
  const normalizedEmail = cleanEmail(authContext.email);
  if (!normalizedEmail) {
    throw new SevenoAdminServiceError(
      'missing_email',
      400,
      'Impossible de valider une invitation sans adresse email.',
    );
  }

  if (!authContext.emailVerified) {
    throw new SevenoAdminServiceError(
      'email_not_verified',
      412,
      'Vérifiez votre adresse email pour poursuivre la création de votre compte entreprise.',
    );
  }

  const firestore = requireCompanyInvitationDatabase();
  const invitationMatch = await getInvitationDocumentByToken(token);
  if (!invitationMatch) {
    throw new SevenoAdminServiceError(
      'invitation_invalid',
      404,
      'Cette invitation est invalide ou n existe plus.',
    );
  }

  const invitationRef = firestore.collection(COMPANY_INVITATIONS_COLLECTION).doc(invitationMatch.id);
  const userRef = firestore.collection('users').doc(authContext.uid);
  const now = Timestamp.now();

  const result = await firestore.runTransaction(async (transaction) => {
    const [invitationSnapshot, userSnapshot] = await Promise.all([
      transaction.get(invitationRef),
      transaction.get(userRef),
    ]);

    if (!invitationSnapshot.exists) {
      throw new SevenoAdminServiceError(
        'invitation_invalid',
        404,
        'Cette invitation est invalide ou n existe plus.',
      );
    }

    const currentInvitation = invitationSnapshot.data() as StoredCompanyInvitation;
    const currentStatus = toInvitationStatus(currentInvitation, now);
    if (currentStatus === 'expired') {
      throw new SevenoAdminServiceError(
        'invitation_expired',
        410,
        'Cette invitation a expiré. Demandez une nouvelle invitation à l administrateur SevenO.',
      );
    }

    if (currentStatus === 'revoked') {
      throw new SevenoAdminServiceError(
        'invitation_revoked',
        410,
        'Cette invitation n est plus valide. Demandez une nouvelle invitation à l administrateur SevenO.',
      );
    }

    if (currentInvitation.status === 'accepted') {
      if (currentInvitation.acceptedByUid === authContext.uid && userSnapshot.exists) {
        const currentUser = userSnapshot.data() as Record<string, unknown>;
        if (currentUser.role === 'company' && cleanEmail(String(currentUser.email ?? '')) === normalizedEmail) {
          return serializePublicInvitation(invitationSnapshot.id, currentInvitation);
        }
      }

      throw new SevenoAdminServiceError(
        'invitation_used',
        410,
        'Cette invitation a déjà été utilisée.',
      );
    }

    const existingUser = userSnapshot.exists ? (userSnapshot.data() as Record<string, unknown>) : null;
    const existingRole = existingUser?.role === 'candidate' || existingUser?.role === 'company' || existingUser?.role === 'admin'
      ? existingUser.role
      : null;
    const existingEmail = typeof existingUser?.email === 'string' ? cleanEmail(existingUser.email) : '';

    if (existingRole === 'candidate') {
      throw new SevenoAdminServiceError(
        'candidate_role_conflict',
        409,
        'Un compte candidat existe déjà avec cette adresse. Utilisez une autre adresse professionnelle ou contactez l administrateur SevenO.',
      );
    }

    if (existingRole && existingRole !== 'company') {
      throw new SevenoAdminServiceError(
        'role_conflict',
        409,
        'Le compte lié à cette adresse ne peut pas être transformé en compte entreprise.',
      );
    }

    if (existingEmail && existingEmail !== normalizedEmail) {
      throw new SevenoAdminServiceError(
        'email_mismatch',
        403,
        'Cette invitation est réservée à une autre adresse email.',
      );
    }

    if (cleanEmail(invitationMatch.invitation.email) !== normalizedEmail) {
      throw new SevenoAdminServiceError(
        'email_mismatch',
        403,
        'Cette invitation est réservée à une autre adresse email.',
      );
    }

    const authProvider = authContext.authProvider;
    const nextUser = {
      uid: authContext.uid,
      role: 'company' as const,
      authProvider,
      email: normalizedEmail,
      emailVerified: true,
      ...(authContext.displayName ? { displayName: authContext.displayName } : {}),
      ...(authContext.photoURL ? { photoURL: authContext.photoURL } : {}),
      onboardingCompleted: existingUser?.onboardingCompleted === true ? true : false,
      createdAt: existingUser?.createdAt ?? now,
      updatedAt: now,
    };

    transaction.set(userRef, nextUser, { merge: true });
    transaction.update(invitationRef, {
      status: 'accepted',
      acceptedAt: now,
      acceptedByUid: authContext.uid,
      updatedAt: now,
    });

    return serializePublicInvitation(invitationSnapshot.id, {
      ...(currentInvitation as StoredCompanyInvitation),
      status: 'accepted',
      acceptedAt: now,
      acceptedByUid: authContext.uid,
      updatedAt: now,
    });
  });

  return {
    invitation: result,
    userRole: 'company',
    onboardingCompleted: false,
  };
}

export function toInvitationAuthContext(decodedToken: {
  uid: string;
  email?: string | null;
  email_verified?: boolean | null;
  firebase?: { sign_in_provider?: string | null } | null;
  name?: string | null;
  picture?: string | null;
}): CompanyInvitationAuthContext {
  const signInProvider = decodedToken.firebase?.sign_in_provider ?? null;
  if (signInProvider !== 'google.com' && signInProvider !== 'password') {
    throw new SevenoAdminServiceError(
      'unsupported_provider',
      400,
      'Le fournisseur de connexion Firebase n est pas pris en charge pour les invitations entreprise.',
    );
  }

  if (!decodedToken.email) {
    throw new SevenoAdminServiceError(
      'missing_email',
      400,
      'Impossible de valider une invitation sans adresse email.',
    );
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    emailVerified: decodedToken.email_verified === true,
    authProvider: signInProvider === 'google.com' ? 'google' : 'password',
    ...(decodedToken.name ? { displayName: decodedToken.name } : {}),
    ...(decodedToken.picture ? { photoURL: decodedToken.picture } : {}),
  };
}
