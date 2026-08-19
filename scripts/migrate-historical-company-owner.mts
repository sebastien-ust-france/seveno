import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { buildCompanyMembershipId } from '@/lib/seveno-company-memberships-server';
import { permissionsForRole } from '@/lib/seveno-company-roles';

const apply = process.argv.includes('--apply');
const auto = process.argv.includes('--auto');
const valueAfter = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() ?? '' : '';
};

if (!adminDb) throw new Error('Firebase Admin est indisponible.');

let ownerUid = valueAfter('--uid');
let companyId = valueAfter('--company-id');

if (auto) {
  if (ownerUid || companyId) throw new Error('--auto ne peut pas être combiné avec --uid ou --company-id.');
  const companyUsers = await adminDb.collection('users').where('role', '==', 'company').get();
  const candidates: Array<{ ownerUid: string; companyId: string }> = [];
  for (const user of companyUsers.docs) {
    const profiles = await adminDb.collection('company_profiles').where('ownerUid', '==', user.id).get();
    for (const profile of profiles.docs) {
      candidates.push({ ownerUid: user.id, companyId: profile.id });
    }
  }
  if (candidates.length !== 1) throw new Error(`Migration automatique refusée : ${candidates.length} owner(s) historique(s) incompatible(s) trouvé(s).`);
  ({ ownerUid, companyId } = candidates[0]);
}

if (!ownerUid || !companyId) throw new Error('Utilisez --uid <uid> --company-id <companyId>, ou --auto si un seul owner est incompatible.');

const userRef = adminDb.collection('users').doc(ownerUid);
const profileRef = adminDb.collection('company_profiles').doc(companyId);
const membershipRef = adminDb.collection('company_memberships').doc(buildCompanyMembershipId(companyId, ownerUid));
const billingRef = adminDb.collection('company_billing_accounts').doc(companyId);

const before = await adminDb.runTransaction(async (transaction) => {
  const [user, profile, membership, billing] = await Promise.all([
    transaction.get(userRef), transaction.get(profileRef), transaction.get(membershipRef), transaction.get(billingRef),
  ]);
  if (!user.exists || user.get('role') !== 'company') throw new Error('Compte entreprise introuvable.');
  if (!profile.exists) throw new Error('Profil entreprise existant introuvable.');
  const profileOwnerUid = String(profile.get('ownerUid') ?? profile.id);
  const canonicalCompanyId = String(profile.get('companyId') ?? profile.id);
  if (profileOwnerUid !== ownerUid || canonicalCompanyId !== companyId) throw new Error('Le rattachement owner/entreprise n’est pas démontré sans ambiguïté.');
  if (!billing.exists || billing.get('companyId') !== companyId) throw new Error('Le portefeuille historique correspondant est introuvable ou incohérent.');
  const activeCompanyId = user.get('activeCompanyId');
  if (activeCompanyId && activeCompanyId !== companyId) throw new Error('Le compte pointe déjà vers une autre entreprise active.');
  if (membership.exists && (membership.get('userUid') !== ownerUid || membership.get('companyId') !== companyId
    || membership.get('role') !== 'owner' || membership.get('status') !== 'active')) {
    throw new Error('Le membership existant est incompatible ; aucune élévation automatique n’est autorisée.');
  }
  const snapshot = {
    activeCompanyId: activeCompanyId ?? null,
    membershipExists: membership.exists,
    membershipRole: membership.exists ? membership.get('role') : null,
    membershipStatus: membership.exists ? membership.get('status') : null,
    canPurchaseCredits: membership.exists ? membership.get('permissions.canPurchaseCredits') ?? null : null,
  };
  if (!apply) return snapshot;
  const now = Timestamp.now();
  if (activeCompanyId !== companyId) transaction.update(userRef, { activeCompanyId: companyId, updatedAt: now });
  if (!membership.exists) {
    const createdAt = profile.get('createdAt') ?? now;
    transaction.create(membershipRef, {
      membershipId: membershipRef.id, companyId, userUid: ownerUid,
      ...(typeof user.get('displayName') === 'string' && user.get('displayName').trim() ? { displayName: user.get('displayName').trim() } : {}),
      role: 'owner', status: 'active', permissions: permissionsForRole('owner'), invitedByUid: null,
      joinedAt: createdAt, createdAt, updatedAt: now,
    });
  } else {
    const update: Record<string, unknown> = {};
    if (membership.get('permissions.canPurchaseCredits') !== true) update.permissions = permissionsForRole('owner');
    if (!membership.get('membershipId')) update.membershipId = membershipRef.id;
    if (!membership.get('joinedAt')) update.joinedAt = membership.get('createdAt') ?? profile.get('createdAt') ?? now;
    if (!membership.get('createdAt')) update.createdAt = profile.get('createdAt') ?? now;
    if (!membership.get('updatedAt') || Object.keys(update).length) update.updatedAt = now;
    if (Object.keys(update).length) transaction.update(membershipRef, update);
  }
  return snapshot;
});

const afterUser = apply ? await userRef.get() : null;
const afterMembership = apply ? await membershipRef.get() : null;
console.log(JSON.stringify({
  mode: apply ? 'applied' : 'dry-run',
  companyIdentity: ownerUid === companyId ? 'creator_uid' : 'existing_profile_id',
  before,
  after: apply ? {
    activeCompanyIdMatches: afterUser?.get('activeCompanyId') === companyId,
    membershipExists: afterMembership?.exists === true,
    membershipRole: afterMembership?.get('role') ?? null,
    membershipStatus: afterMembership?.get('status') ?? null,
    canPurchaseCredits: afterMembership?.get('permissions.canPurchaseCredits') ?? null,
  } : null,
}, null, 2));
