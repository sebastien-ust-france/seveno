import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import type { CompanyMembershipRole, CompanyMembershipStatus } from '@/types/seveno-billing';

const PROFILES = 'company_profiles';
const MEMBERSHIPS = 'company_memberships';
type RecordValue = Record<string, unknown>;

export class CompanyMembershipError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code = code; this.status = status; }
}

function db() {
  if (!isFirebaseAdminConfigured || !adminDb) throw new CompanyMembershipError('firebase_admin_missing', 500, 'Firebase Admin est indisponible.');
  return adminDb;
}

export function buildCompanyMembershipId(companyId: string, userUid: string) {
  const company = companyId.trim();
  const user = userUid.trim();
  if (!company || !user || company.length > 120 || user.length > 128) throw new CompanyMembershipError('invalid_membership', 400, 'Adhésion invalide.');
  return `${createHash('sha256').update(company).digest('hex').slice(0, 24)}__${createHash('sha256').update(user).digest('hex').slice(0, 24)}`;
}

export async function migrateHistoricalCompany(companyId: string) {
  const firestore = db();
  const profileRef = firestore.collection(PROFILES).doc(companyId);
  const membershipRef = firestore.collection(MEMBERSHIPS).doc(buildCompanyMembershipId(companyId, companyId));
  return firestore.runTransaction(async (transaction) => {
    const [profile, membership] = await Promise.all([transaction.get(profileRef), transaction.get(membershipRef)]);
    if (!profile.exists) throw new CompanyMembershipError('company_not_found', 404, 'Entreprise introuvable.');
    const data = profile.data() as RecordValue;
    const ownerUid = typeof data.ownerUid === 'string' && data.ownerUid ? data.ownerUid : companyId;
    const canonicalCompanyId = typeof data.companyId === 'string' && data.companyId ? data.companyId : profile.id;
    const now = Timestamp.now();
    if (canonicalCompanyId !== companyId) throw new CompanyMembershipError('company_id_mismatch', 409, 'Identité entreprise incohérente.');
    transaction.set(profileRef, { companyId: canonicalCompanyId, ownerUid, updatedAt: now }, { merge: true });
    const ownerMembershipRef = ownerUid === companyId ? membershipRef : firestore.collection(MEMBERSHIPS).doc(buildCompanyMembershipId(companyId, ownerUid));
    if (!membership.exists || ownerUid !== companyId) {
      transaction.set(ownerMembershipRef, {
        membershipId: ownerMembershipRef.id, companyId, userUid: ownerUid, role: 'owner', status: 'active',
        invitedByUid: null, joinedAt: data.createdAt instanceof Timestamp ? data.createdAt : now,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : now, updatedAt: now,
      }, { merge: true });
    }
    return { companyId, ownerUid, membershipId: ownerMembershipRef.id };
  });
}

export async function listActiveCompanyMemberships(userUid: string) {
  const snapshot = await db().collection(MEMBERSHIPS).where('userUid', '==', userUid).where('status', '==', 'active').get();
  if (snapshot.empty) {
    const historical = await db().collection(PROFILES).doc(userUid).get();
    if (historical.exists) {
      await migrateHistoricalCompany(userUid);
      return listActiveCompanyMemberships(userUid);
    }
  }
  return snapshot.docs.map((doc) => doc.data() as RecordValue);
}

export async function requireActiveCompanyMembership(input: {
  userUid: string; companyId?: string | null; allowedRoles?: readonly CompanyMembershipRole[];
}) {
  const user = await getSevenoUserByUid(input.userUid);
  if (!user || user.role !== 'company') throw new CompanyMembershipError('forbidden_role', 403, 'Compte entreprise requis.');
  const memberships = await listActiveCompanyMemberships(input.userUid);
  const requested = input.companyId?.trim();
  const membership = requested
    ? memberships.find((item) => item.companyId === requested)
    : memberships.length === 1 ? memberships[0] : null;
  if (!membership) throw new CompanyMembershipError(requested ? 'forbidden_company' : 'active_company_required', requested ? 403 : 409, requested ? 'Accès à cette entreprise refusé.' : 'Sélectionnez une entreprise active.');
  const role = membership.role as CompanyMembershipRole;
  if (input.allowedRoles && !input.allowedRoles.includes(role)) throw new CompanyMembershipError('forbidden_membership_role', 403, 'Votre rôle ne permet pas cette action.');
  const profile = await db().collection(PROFILES).doc(String(membership.companyId)).get();
  if (!profile.exists || profile.get('profileStatus') === 'suspended') throw new CompanyMembershipError('company_unavailable', 403, 'Entreprise indisponible.');
  return { companyId: String(membership.companyId), userUid: input.userUid, role, profile: profile.data() as RecordValue };
}

export async function upsertCompanyMembership(input: {
  companyId: string; userUid: string; role: CompanyMembershipRole; status: CompanyMembershipStatus;
  actorUid: string; reason: string;
}) {
  if (!input.reason.trim()) throw new CompanyMembershipError('reason_required', 400, 'Un motif est obligatoire.');
  if (!['owner', 'admin', 'recruiter', 'billing_manager', 'viewer'].includes(input.role)
    || !['active', 'invited', 'suspended', 'removed'].includes(input.status)) {
    throw new CompanyMembershipError('invalid_membership', 400, 'Rôle ou statut invalide.');
  }
  const firestore = db();
  const ref = firestore.collection(MEMBERSHIPS).doc(buildCompanyMembershipId(input.companyId, input.userUid));
  const now = Timestamp.now();
  await firestore.runTransaction(async (transaction) => {
    const [profile, target, owners] = await Promise.all([
      transaction.get(firestore.collection(PROFILES).doc(input.companyId)),
      transaction.get(ref),
      transaction.get(firestore.collection(MEMBERSHIPS).where('companyId', '==', input.companyId).where('role', '==', 'owner').where('status', '==', 'active')),
    ]);
    if (!profile.exists) throw new CompanyMembershipError('company_not_found', 404, 'Entreprise introuvable.');
    if (target.exists && target.get('role') === 'owner' && target.get('status') === 'active'
      && (input.role !== 'owner' || input.status !== 'active') && owners.size <= 1) {
      throw new CompanyMembershipError('last_owner_required', 409, 'Le dernier propriétaire actif doit être conservé.');
    }
    transaction.set(ref, {
      membershipId: ref.id, companyId: input.companyId, userUid: input.userUid, role: input.role, status: input.status,
      invitedByUid: target.exists ? target.get('invitedByUid') ?? null : input.actorUid,
      joinedAt: input.status === 'active' ? target.get('joinedAt') ?? now : target.get('joinedAt') ?? null,
      createdAt: target.get('createdAt') ?? now, updatedAt: now,
    });
    transaction.create(firestore.collection('admin_logs').doc(), {
      actorUserId: input.actorUid, actorRole: 'admin', action: 'company_membership_changed', targetCollection: MEMBERSHIPS,
      targetId: ref.id, metadata: { companyId: input.companyId, userUid: input.userUid, role: input.role, status: input.status, reason: input.reason.trim() }, createdAt: now,
    });
  });
  return ref.id;
}
