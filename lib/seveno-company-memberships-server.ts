import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import type { CompanyMembershipRole, CompanyMembershipStatus } from '@/types/seveno-billing';
import { permissionsForRole } from '@/lib/seveno-company-roles';

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
        permissions: permissionsForRole('owner'),
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
  userUid: string; companyId?: string | null; allowedRoles?: readonly CompanyMembershipRole[]; allowUnapproved?: boolean;
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
  if (!input.allowUnapproved && profile.get('verificationStatus') !== 'verified') {
    throw new CompanyMembershipError('company_approval_required', 403, 'Votre entreprise doit être validée par Seven’O avant d’accéder à cette fonctionnalité.');
  }
  const permissions = membership.permissions && typeof membership.permissions === 'object' ? membership.permissions as { canPurchaseCredits?: boolean } : undefined;
  return { companyId: String(membership.companyId), userUid: input.userUid, role, permissions, profile: profile.data() as RecordValue };
}

export async function upsertCompanyMembership(input: {
  companyId: string; userUid: string; role: CompanyMembershipRole; status: CompanyMembershipStatus;
  actorUid: string; actorMembershipRole?: CompanyMembershipRole; reason: string;
}) {
  if (!input.reason.trim()) throw new CompanyMembershipError('reason_required', 400, 'Un motif est obligatoire.');
  if (!['owner', 'admin', 'recruiter', 'billing_manager', 'viewer'].includes(input.role)
    || !['active', 'invited', 'suspended', 'removed'].includes(input.status)) {
    throw new CompanyMembershipError('invalid_membership', 400, 'Rôle ou statut invalide.');
  }
  if (input.actorMembershipRole && input.actorUid === input.userUid) {
    throw new CompanyMembershipError('unsafe_self_membership_change', 403, 'Vous ne pouvez pas modifier votre propre adhésion.');
  }
  if (input.actorMembershipRole === 'admin' && (input.role === 'owner' || input.role === 'admin')) {
    throw new CompanyMembershipError('forbidden_role_assignment', 403, 'Seul un owner peut attribuer ce rôle.');
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
    if (input.actorMembershipRole === 'admin' && target.exists && ['owner', 'admin'].includes(String(target.get('role')))) {
      throw new CompanyMembershipError('forbidden_membership_target', 403, 'Un admin ne peut pas modifier un owner ou un autre admin.');
    }
    if (target.exists && target.get('role') === 'owner' && target.get('status') === 'active'
      && (input.role !== 'owner' || input.status !== 'active') && owners.size <= 1) {
      throw new CompanyMembershipError('last_owner_required', 409, 'Le dernier propriétaire actif doit être conservé.');
    }
    transaction.set(ref, {
      membershipId: ref.id, companyId: input.companyId, userUid: input.userUid, role: input.role, status: input.status,
      permissions: target.exists && target.get('role') === input.role && target.get('permissions')
        ? target.get('permissions')
        : permissionsForRole(input.role),
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

export async function updateAdminPurchasePermission(input: { companyId: string; targetUserUid: string; actorUid: string; canPurchaseCredits: boolean }) {
  const firestore = db();
  const actorRef = firestore.collection(MEMBERSHIPS).doc(buildCompanyMembershipId(input.companyId, input.actorUid));
  const targetRef = firestore.collection(MEMBERSHIPS).doc(buildCompanyMembershipId(input.companyId, input.targetUserUid));
  await firestore.runTransaction(async (transaction) => {
    const [actor, target] = await Promise.all([transaction.get(actorRef), transaction.get(targetRef)]);
    if (!actor.exists || actor.get('status') !== 'active' || actor.get('role') !== 'owner') throw new CompanyMembershipError('owner_required', 403, 'Seul un propriétaire actif peut modifier cette autorisation.');
    if (!target.exists || target.get('companyId') !== input.companyId || target.get('status') !== 'active' || target.get('role') !== 'admin') throw new CompanyMembershipError('admin_membership_required', 400, 'Administrateur actif introuvable.');
    transaction.update(targetRef, { 'permissions.canPurchaseCredits': input.canPurchaseCredits, updatedAt: Timestamp.now() });
  });
}

export type CompanyMembershipMutation =
  | { action: 'update'; displayName: string; role: Exclude<CompanyMembershipRole, 'owner'>; canPurchaseCredits?: boolean }
  | { action: 'suspend' | 'reactivate' | 'remove' };

function validateMembershipDisplayName(value: string) {
  const displayName = value.trim();
  if (displayName.length < 2 || displayName.length > 80 || /[<>]/.test(displayName)) {
    throw new CompanyMembershipError('invalid_display_name', 400, 'Le nom affiché doit contenir entre 2 et 80 caractères et ne peut pas contenir de HTML.');
  }
  return displayName;
}

export async function mutateCompanyMembership(input: {
  companyId: string; membershipId: string; actorUid: string; actorRole: CompanyMembershipRole; mutation: CompanyMembershipMutation;
}) {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(input.membershipId)) throw new CompanyMembershipError('invalid_membership', 400, 'Adhésion invalide.');
  const firestore = db();
  const targetRef = firestore.collection(MEMBERSHIPS).doc(input.membershipId);
  const actorRef = firestore.collection(MEMBERSHIPS).doc(buildCompanyMembershipId(input.companyId, input.actorUid));
  const now = Timestamp.now();
  return firestore.runTransaction(async (transaction) => {
    const [actor, target] = await Promise.all([transaction.get(actorRef), transaction.get(targetRef)]);
    if (!actor.exists || actor.get('status') !== 'active' || actor.get('role') !== input.actorRole) throw new CompanyMembershipError('actor_membership_invalid', 403, 'Accès refusé.');
    if (!target.exists || target.get('companyId') !== input.companyId) throw new CompanyMembershipError('membership_not_found', 404, 'Membre introuvable.');
    const targetUid = String(target.get('userUid'));
    const previousRole = target.get('role') as CompanyMembershipRole;
    const previousStatus = String(target.get('status'));
    const losesRecruitmentAccess = input.mutation.action === 'suspend' || input.mutation.action === 'remove'
      || (input.mutation.action === 'update' && ['billing_manager', 'viewer'].includes(input.mutation.role));
    if (losesRecruitmentAccess) {
      const operationalOffers = await transaction.get(firestore.collection('job_offers').where('companyId', '==', input.companyId).where('assignedToUid', '==', targetUid).where('status', 'in', ['draft', 'published', 'paused']).limit(1));
      if (!operationalOffers.empty) throw new CompanyMembershipError('active_recruitments_assigned', 409, 'Ce membre est responsable de recrutements actifs. Réattribuez-les avant de modifier son accès.');
    }
    if (!['owner', 'admin'].includes(input.actorRole)) throw new CompanyMembershipError('forbidden_membership_role', 403, 'Votre rôle ne permet pas cette action.');
    if (targetUid === input.actorUid) throw new CompanyMembershipError('unsafe_self_membership_change', 403, 'Vous ne pouvez pas modifier votre propre adhésion.');
    if (previousRole === 'owner') throw new CompanyMembershipError('primary_owner_protected', 409, 'Le propriétaire principal de l’entreprise ne peut pas être retiré ou suspendu depuis cette interface.');
    if (input.actorRole === 'admin' && previousRole === 'admin') throw new CompanyMembershipError('forbidden_membership_target', 403, 'Un administrateur ne peut pas modifier un autre administrateur.');

    const update: RecordValue = { updatedAt: now };
    let eventType: string;
    if (input.mutation.action === 'update') {
      if (previousStatus !== 'active' && previousStatus !== 'suspended') throw new CompanyMembershipError('removed_membership_immutable', 409, 'Un ancien membre doit être invité de nouveau.');
      if (input.actorRole === 'admin' && input.mutation.role === 'admin') throw new CompanyMembershipError('forbidden_role_assignment', 403, 'Seul un propriétaire peut attribuer le rôle administrateur.');
      update.displayName = validateMembershipDisplayName(input.mutation.displayName);
      update.role = input.mutation.role;
      if (input.mutation.role === 'admin') {
        if (input.actorRole !== 'owner') throw new CompanyMembershipError('owner_required', 403, 'Seul un propriétaire peut attribuer le rôle administrateur.');
        update.permissions = permissionsForRole('admin', input.mutation.canPurchaseCredits !== false);
      }
      eventType = 'member_updated';
    } else if (input.mutation.action === 'suspend') {
      if (previousStatus !== 'active') throw new CompanyMembershipError('invalid_membership_transition', 409, 'Seul un membre actif peut être suspendu.');
      Object.assign(update, { status: 'suspended', suspendedAt: now, suspendedByUid: input.actorUid });
      eventType = 'member_suspended';
    } else if (input.mutation.action === 'reactivate') {
      if (input.actorRole !== 'owner') throw new CompanyMembershipError('owner_required', 403, 'Seul un propriétaire peut réactiver ce membre.');
      if (previousStatus !== 'suspended') throw new CompanyMembershipError('invalid_membership_transition', 409, 'Seul un membre suspendu peut être réactivé.');
      Object.assign(update, { status: 'active', reactivatedAt: now, reactivatedByUid: input.actorUid });
      eventType = 'member_reactivated';
    } else {
      if (previousStatus === 'removed') throw new CompanyMembershipError('invalid_membership_transition', 409, 'Ce membre a déjà été retiré.');
      Object.assign(update, { status: 'removed', removedAt: now, removedByUid: input.actorUid });
      eventType = 'member_removed';
    }
    const userRef = firestore.collection('users').doc(targetUid);
    const user = await transaction.get(userRef);
    transaction.update(targetRef, update);
    if (input.mutation.action !== 'update' && user.exists && user.get('activeCompanyId') === input.companyId) transaction.update(userRef, { activeCompanyId: null, updatedAt: now });
    const eventRef = firestore.collection('company_membership_events').doc();
    transaction.create(eventRef, {
      eventType, companyId: input.companyId, membershipId: targetRef.id, actorUid: input.actorUid, targetUid,
      previousRole, newRole: input.mutation.action === 'update' ? input.mutation.role : previousRole,
      previousStatus, newStatus: update.status ?? previousStatus,
      ...(input.mutation.action === 'update' && input.mutation.role === 'admin' ? {
        previousValue: target.get('permissions.canPurchaseCredits') !== false,
        newValue: input.mutation.canPurchaseCredits !== false,
      } : {}), createdAt: now,
    });
    return { membershipId: targetRef.id, eventId: eventRef.id };
  });
}
