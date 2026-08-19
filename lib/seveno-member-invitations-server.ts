import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { buildCompanyMembershipId, CompanyMembershipError } from '@/lib/seveno-company-memberships-server';
import type { CompanyMembershipPermissions, CompanyMembershipRole } from '@/types/seveno-billing';
import { COMPANY_ROLE_PRESENTATION, permissionsForRole } from '@/lib/seveno-company-roles';
import { sendMemberInvitationEmail } from '@/lib/seveno-member-invitation-email';

const COLLECTION = 'company_member_invitations';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MEMBER_INVITATION_COOKIE = 'seveno_member_invitation';
export const MEMBER_INVITATION_SESSION_SECONDS = 2 * 60 * 60;
const INVITABLE_ROLES: CompanyMembershipRole[] = ['admin', 'recruiter', 'billing_manager', 'viewer'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();

type StoredInvitation = {
  invitationId: string; companyId: string; emailNormalized: string; role: CompanyMembershipRole;
  permissions: CompanyMembershipPermissions; tokenHash: string; status: 'pending' | 'accepted' | 'revoked';
  createdByUid: string; createdAt: Timestamp; updatedAt: Timestamp; expiresAt: Timestamp;
  acceptedByUid?: string; acceptedAt?: Timestamp;
};

export type MemberInvitationView = {
  invitationId: string; companyId: string; companyName: string; email: string; role: CompanyMembershipRole;
  roleLabel: string; status: 'pending' | 'expired' | 'accepted' | 'revoked'; expiresAt: string;
};

function db() {
  if (!adminDb) throw new CompanyMembershipError('firebase_admin_missing', 500, 'Firebase Admin est indisponible.');
  return adminDb;
}

function invitationStatus(invitation: StoredInvitation): MemberInvitationView['status'] {
  return invitation.status === 'pending' && invitation.expiresAt.toMillis() <= Date.now() ? 'expired' : invitation.status;
}

function requireToken(token: string) {
  const clean = token.trim();
  if (!tokenPattern.test(clean)) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
  return clean;
}

function validateStoredInvitation(invitation: StoredInvitation) {
  if (!INVITABLE_ROLES.includes(invitation.role)) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
  const expected = permissionsForRole(invitation.role, invitation.permissions?.canPurchaseCredits === true);
  if (invitation.permissions?.canPurchaseCredits !== expected.canPurchaseCredits) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
}

async function findInvitation(token: string) {
  const firestore = db();
  const matches = await firestore.collection(COLLECTION).where('tokenHash', '==', hash(requireToken(token))).limit(1).get();
  const doc = matches.docs[0];
  return doc ? { ref: doc.ref, invitation: doc.data() as StoredInvitation } : null;
}

async function viewFor(invitation: StoredInvitation): Promise<MemberInvitationView> {
  validateStoredInvitation(invitation);
  const company = await db().collection('company_profiles').doc(invitation.companyId).get();
  if (!company.exists) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
  const companyName = String(company.get('companyName') ?? '').trim();
  if (!companyName) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
  return { invitationId: invitation.invitationId, companyId: invitation.companyId, companyName, email: invitation.emailNormalized, role: invitation.role, roleLabel: COMPANY_ROLE_PRESENTATION[invitation.role].label, status: invitationStatus(invitation), expiresAt: invitation.expiresAt.toDate().toISOString() };
}

export async function getMemberInvitation(token: string) {
  const match = await findInvitation(token);
  if (!match) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
  return viewFor(match.invitation);
}

export async function claimMemberInvitation(token: string) {
  const view = await getMemberInvitation(token);
  if (view.status === 'expired') throw new CompanyMembershipError('invitation_expired', 410, 'Cette invitation a expiré. Demandez à votre entreprise de vous envoyer une nouvelle invitation.');
  if (view.status === 'revoked') throw new CompanyMembershipError('invitation_revoked', 410, 'Cette invitation n’est plus valide.');
  if (view.status === 'accepted') throw new CompanyMembershipError('invitation_used', 410, 'Cette invitation a déjà été utilisée.');
  return view;
}

function invitationOrigin() {
  const configured = process.env.SEVENO_PUBLIC_ORIGIN?.trim();
  if (configured) return new URL(configured).origin;
  if (process.env.NEXT_PUBLIC_SEVENO_USE_FIREBASE_EMULATORS === 'true') return new URL(process.env.SEVENO_EMULATOR_APP_ORIGIN ?? 'http://localhost:3001').origin;
  return 'https://seveno.eu';
}

export async function createMemberInvitation(input: { companyId: string; actorUid: string; actorRole: CompanyMembershipRole; email: string; role: CompanyMembershipRole; adminCanPurchaseCredits?: boolean }) {
  const email = normalizeEmail(input.email);
  if (!emailPattern.test(email) || email.length > 254) throw new CompanyMembershipError('invalid_email', 400, 'Adresse email invalide.');
  if (!INVITABLE_ROLES.includes(input.role)) throw new CompanyMembershipError('invalid_invitation_role', 400, 'Rôle d’invitation invalide.');
  if (input.actorRole === 'admin' && input.role === 'admin') throw new CompanyMembershipError('forbidden_role_assignment', 403, 'Seul un owner peut inviter un admin.');
  const firestore = db();
  const token = randomBytes(32).toString('base64url');
  const now = Timestamp.now();
  const ref = firestore.collection(COLLECTION).doc();
  let companyName = '';
  await firestore.runTransaction(async (transaction) => {
    const [company, pending] = await Promise.all([
      transaction.get(firestore.collection('company_profiles').doc(input.companyId)),
      transaction.get(firestore.collection(COLLECTION).where('companyId', '==', input.companyId).where('emailNormalized', '==', email).where('status', '==', 'pending')),
    ]);
    companyName = String(company.get('companyName') ?? '').trim();
    if (!company.exists || !companyName) throw new CompanyMembershipError('company_not_found', 404, 'Entreprise introuvable.');
    if (pending.docs.some((doc) => (doc.get('expiresAt') as Timestamp).toMillis() > now.toMillis())) throw new CompanyMembershipError('invitation_already_pending', 409, 'Une invitation active existe déjà pour cette adresse.');
    transaction.create(ref, { invitationId: ref.id, companyId: input.companyId, emailNormalized: email, role: input.role, permissions: permissionsForRole(input.role, input.role === 'admin' && input.adminCanPurchaseCredits !== false), tokenHash: hash(token), status: 'pending', createdByUid: input.actorUid, createdAt: now, updatedAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + TTL_MS) });
  });
  const invitationUrl = `${invitationOrigin()}/invitation-membre/${encodeURIComponent(token)}`;
  const delivery = await sendMemberInvitationEmail({ to: email, companyName, role: input.role, invitationUrl });
  return { invitationId: ref.id, token, email, role: input.role, expiresAt: new Date(now.toMillis() + TTL_MS).toISOString(), invitationUrl, emailSent: delivery.sent, emailFailureReason: delivery.reason };
}

export async function acceptMemberInvitation(input: { token: string; uid: string; email: string; emailVerified: boolean }) {
  if (!input.emailVerified) throw new CompanyMembershipError('email_not_verified', 412, 'Vérifiez votre adresse e-mail avant d’accepter l’invitation.');
  const email = normalizeEmail(input.email);
  const firestore = db();
  const match = await findInvitation(input.token);
  if (!match) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
  return firestore.runTransaction(async (transaction) => {
    const invitationSnap = await transaction.get(match.ref);
    if (!invitationSnap.exists) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
    const invitation = invitationSnap.data() as StoredInvitation;
    validateStoredInvitation(invitation);
    const companyId = invitation.companyId;
    const membershipRef = firestore.collection('company_memberships').doc(buildCompanyMembershipId(companyId, input.uid));
    const userRef = firestore.collection('users').doc(input.uid);
    const [company, membership, user] = await Promise.all([transaction.get(firestore.collection('company_profiles').doc(companyId)), transaction.get(membershipRef), transaction.get(userRef)]);
    if (!company.exists) throw new CompanyMembershipError('invitation_invalid', 404, 'Cette invitation n’est pas valide.');
    if (invitation.status === 'accepted' && invitation.acceptedByUid === input.uid && membership.exists && membership.get('status') === 'active') return { companyId, role: invitation.role };
    if (invitation.status === 'revoked') throw new CompanyMembershipError('invitation_revoked', 410, 'Cette invitation n’est plus valide.');
    if (invitation.status !== 'pending') throw new CompanyMembershipError('invitation_used', 410, 'Cette invitation a déjà été utilisée.');
    if (invitation.expiresAt.toMillis() <= Date.now()) throw new CompanyMembershipError('invitation_expired', 410, 'Cette invitation a expiré. Demandez à votre entreprise de vous envoyer une nouvelle invitation.');
    if (invitation.emailNormalized !== email) throw new CompanyMembershipError('email_mismatch', 403, 'Cette invitation est destinée à une autre adresse e-mail.');
    const existingRole = user.get('role');
    if (existingRole && existingRole !== 'company') throw new CompanyMembershipError('role_conflict', 409, 'Ce compte possède déjà un rôle incompatible.');
    const now = Timestamp.now();
    transaction.set(membershipRef, { membershipId: membershipRef.id, companyId, userUid: input.uid, role: invitation.role, status: 'active', permissions: invitation.permissions, invitedByUid: invitation.createdByUid, joinedAt: now, createdAt: membership.get('createdAt') ?? now, updatedAt: now });
    transaction.set(userRef, { uid: input.uid, email, emailVerified: true, role: 'company', activeCompanyId: companyId, onboardingCompleted: true, createdAt: user.get('createdAt') ?? now, updatedAt: now }, { merge: true });
    transaction.update(match.ref, { status: 'accepted', acceptedByUid: input.uid, acceptedAt: now, updatedAt: now });
    return { companyId, role: invitation.role };
  });
}
