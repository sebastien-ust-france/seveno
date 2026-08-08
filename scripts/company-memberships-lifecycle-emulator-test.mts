import assert from 'node:assert/strict';
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-seveno-local';
process.env.NODE_ENV = 'test'; process.env.GCLOUD_PROJECT = projectId; process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId; process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
await new Promise<void>((ok, fail) => { const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':'); const socket = net.createConnection({ host, port: Number(port) }); socket.once('connect', () => { socket.end(); ok(); }); socket.once('error', fail); });

const { adminDb } = await import('@/lib/firebase-admin');
const { Timestamp } = await import('firebase-admin/firestore');
const { buildCompanyMembershipId, mutateCompanyMembership, requireActiveCompanyMembership } = await import('@/lib/seveno-company-memberships-server');
const { canPurchaseCompanyCredits } = await import('@/lib/seveno-company-roles');
const { createMemberInvitation, acceptMemberInvitation } = await import('@/lib/seveno-member-invitations-server');
if (!adminDb) throw new Error('Firebase Admin indisponible.');

const ownerA = 'lifecycle-owner-a'; const ownerB = 'lifecycle-owner-b';
const companyA = ownerA; const companyB = 'lifecycle-company-b';
const recruiter = 'lifecycle-recruiter'; const admin = 'lifecycle-admin';
for (const companyId of [companyA, companyB]) {
  for (const collection of ['company_memberships', 'company_membership_events']) {
    const docs = await adminDb.collection(collection).where('companyId', '==', companyId).get();
    for (const item of docs.docs) await item.ref.delete();
  }
  await adminDb.collection('company_profiles').doc(companyId).set({ companyId, companyName: companyId, profileStatus: 'active', verificationStatus: 'verified' });
}
for (const uid of [ownerA, ownerB, recruiter, admin]) await adminDb.collection('users').doc(uid).set({ uid, role: 'company', authProvider: 'password', email: `${uid}@example.test`, emailVerified: true, onboardingCompleted: true, activeCompanyId: uid === ownerB ? companyB : companyA, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
const membership = (companyId: string, uid: string, role: string) => ({ membershipId: buildCompanyMembershipId(companyId, uid), companyId, userUid: uid, role, status: 'active', permissions: { canPurchaseCredits: role === 'owner' || role === 'admin' || role === 'billing_manager' }, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
for (const data of [membership(companyA, ownerA, 'owner'), membership(companyA, recruiter, 'recruiter'), membership(companyA, admin, 'admin'), membership(companyB, ownerB, 'owner')]) await adminDb.collection('company_memberships').doc(data.membershipId).set(data);
const recruiterId = buildCompanyMembershipId(companyA, recruiter); const adminId = buildCompanyMembershipId(companyA, admin);

const pendingCompany = 'lifecycle-pending-company'; const pendingOwner = 'lifecycle-pending-owner';
await adminDb.collection('users').doc(pendingOwner).set({ uid: pendingOwner, role: 'company', authProvider: 'password', email: `${pendingOwner}@example.test`, emailVerified: true, onboardingCompleted: true, activeCompanyId: pendingCompany, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
await adminDb.collection('company_profiles').doc(pendingCompany).set({ companyId: pendingCompany, ownerUid: pendingOwner, companyName: 'Pending', profileStatus: 'active', verificationStatus: 'pending' });
const pendingMembership = membership(pendingCompany, pendingOwner, 'owner');
await adminDb.collection('company_memberships').doc(pendingMembership.membershipId).set(pendingMembership);
await assert.rejects(requireActiveCompanyMembership({ userUid: pendingOwner, companyId: pendingCompany }), /validée par Seven’O/);
assert.equal((await requireActiveCompanyMembership({ userUid: pendingOwner, companyId: pendingCompany, allowUnapproved: true })).companyId, pendingCompany);
await adminDb.collection('company_profiles').doc(pendingCompany).update({ verificationStatus: 'verified' });
assert.equal((await requireActiveCompanyMembership({ userUid: pendingOwner, companyId: pendingCompany })).companyId, pendingCompany);
await adminDb.collection('company_profiles').doc(pendingCompany).update({ profileStatus: 'suspended' });
await assert.rejects(requireActiveCompanyMembership({ userUid: pendingOwner, companyId: pendingCompany }), /indisponible/);

await mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'update', displayName: 'Marie Dupont', role: 'admin', canPurchaseCredits: false } });
let target = await adminDb.collection('company_memberships').doc(recruiterId).get();
assert.equal(target.get('displayName'), 'Marie Dupont'); assert.equal(target.get('role'), 'admin'); assert.equal(target.get('permissions.canPurchaseCredits'), false);
await mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'update', displayName: 'Marie Dupont', role: 'recruiter' } });
target = await adminDb.collection('company_memberships').doc(recruiterId).get();
assert.equal(canPurchaseCompanyCredits({ role: 'recruiter', permissions: target.get('permissions') }), false);
await Promise.all([
  mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'update', displayName: 'Marie Concurrente A', role: 'recruiter' } }),
  mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'update', displayName: 'Marie Concurrente B', role: 'recruiter' } }),
]);
assert.match(String((await adminDb.collection('company_memberships').doc(recruiterId).get()).get('displayName')), /^Marie Concurrente [AB]$/);

await assert.rejects(mutateCompanyMembership({ companyId: companyA, membershipId: buildCompanyMembershipId(companyA, ownerA), actorUid: admin, actorRole: 'admin', mutation: { action: 'suspend' } }));
await assert.rejects(mutateCompanyMembership({ companyId: companyA, membershipId: adminId, actorUid: admin, actorRole: 'admin', mutation: { action: 'remove' } }));
await assert.rejects(mutateCompanyMembership({ companyId: companyA, membershipId: adminId, actorUid: recruiter, actorRole: 'recruiter', mutation: { action: 'remove' } }));
await assert.rejects(mutateCompanyMembership({ companyId: companyA, membershipId: buildCompanyMembershipId(companyB, ownerB), actorUid: ownerA, actorRole: 'owner', mutation: { action: 'remove' } }));

await mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'suspend' } });
await assert.rejects(requireActiveCompanyMembership({ userUid: recruiter, companyId: companyA }));
assert.equal((await adminDb.collection('users').doc(recruiter).get()).get('activeCompanyId'), null);
await mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'reactivate' } });
assert.equal((await requireActiveCompanyMembership({ userUid: recruiter, companyId: companyA })).companyId, companyA);
const beforeEvents = (await adminDb.collection('company_membership_events').where('companyId', '==', companyA).get()).size;
await mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'remove' } });
await assert.rejects(requireActiveCompanyMembership({ userUid: recruiter, companyId: companyA }));
assert.equal((await adminDb.collection('users').doc(recruiter).get()).exists, true, 'Le compte utilisateur doit être conservé.');
assert.equal((await adminDb.collection('company_membership_events').where('companyId', '==', companyA).get()).size, beforeEvents + 1);
await assert.rejects(mutateCompanyMembership({ companyId: companyA, membershipId: recruiterId, actorUid: ownerA, actorRole: 'owner', mutation: { action: 'reactivate' } }));
const reinvitation = await createMemberInvitation({ companyId: companyA, actorUid: ownerA, actorRole: 'owner', email: `${recruiter}@example.test`, role: 'viewer' });
await acceptMemberInvitation({ token: reinvitation.token, uid: recruiter, email: `${recruiter}@example.test`, emailVerified: true });
const rejoined = await adminDb.collection('company_memberships').doc(recruiterId).get();
assert.equal(rejoined.get('status'), 'active'); assert.equal(rejoined.get('role'), 'viewer'); assert.equal(rejoined.get('permissions.canPurchaseCredits'), false);

const invitee = 'lifecycle-invitee';
await adminDb.collection('users').doc(invitee).set({ uid: invitee, role: 'company', authProvider: 'password', email: `${invitee}@example.test`, emailVerified: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
const validInvitation = await createMemberInvitation({ companyId: companyA, actorUid: ownerA, actorRole: 'owner', email: `${invitee}@example.test`, role: 'admin', adminCanPurchaseCredits: false });
assert.equal(validInvitation.email, `${invitee}@example.test`, 'L’adresse normalisée vient de l’invitation.');
await assert.rejects(acceptMemberInvitation({ token: validInvitation.token, uid: invitee, email: 'substitution@example.test', emailVerified: true }), /autre adresse/);
await assert.rejects(acceptMemberInvitation({ token: validInvitation.token, uid: invitee, email: `${invitee}@example.test`, emailVerified: false }), /Vérifiez/);
const concurrent = await Promise.all([acceptMemberInvitation({ token: validInvitation.token, uid: invitee, email: `${invitee}@example.test`, emailVerified: true }), acceptMemberInvitation({ token: validInvitation.token, uid: invitee, email: `${invitee}@example.test`, emailVerified: true })]);
assert.equal(concurrent[0].companyId, companyA); assert.equal(concurrent[1].companyId, companyA);
const invitedMembership = await adminDb.collection('company_memberships').doc(buildCompanyMembershipId(companyA, invitee)).get();
assert.equal(invitedMembership.get('role'), 'admin'); assert.equal(invitedMembership.get('permissions.canPurchaseCredits'), false);
assert.equal((await adminDb.collection('company_memberships').where('companyId', '==', companyA).where('userUid', '==', invitee).get()).size, 1);
const ownerContext = await requireActiveCompanyMembership({ userUid: ownerA, companyId: companyA });
const invitedContext = await requireActiveCompanyMembership({ userUid: invitee, companyId: companyA });
assert.equal(ownerA, companyA, 'Le cas historique ownerUid === companyId doit être couvert.');
assert.notEqual(invitee, companyA, 'Le membre invité doit avoir une identité distincte de l’entreprise.');
assert.equal(ownerContext.companyId, companyA);
assert.equal(invitedContext.companyId, companyA);
assert.equal(ownerContext.profile.companyName, companyA);
assert.equal(invitedContext.profile.companyName, companyA);
await assert.rejects(requireActiveCompanyMembership({ userUid: invitee, companyId: companyB }));
await assert.rejects(acceptMemberInvitation({ token: 'invalid', uid: invitee, email: `${invitee}@example.test`, emailVerified: true }), /pas valide/);

const expired = await createMemberInvitation({ companyId: companyA, actorUid: ownerA, actorRole: 'owner', email: 'expired@example.test', role: 'recruiter' });
await adminDb.collection('company_member_invitations').doc(expired.invitationId).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) });
await assert.rejects(acceptMemberInvitation({ token: expired.token, uid: 'expired', email: 'expired@example.test', emailVerified: true }), /expiré/);
const revoked = await createMemberInvitation({ companyId: companyA, actorUid: ownerA, actorRole: 'owner', email: 'revoked@example.test', role: 'recruiter' });
await adminDb.collection('company_member_invitations').doc(revoked.invitationId).update({ status: 'revoked' });
await assert.rejects(acceptMemberInvitation({ token: revoked.token, uid: 'revoked', email: 'revoked@example.test', emailVerified: true }), /plus valide/);

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port: 8080, rules } });
await assertFails(updateDoc(doc(env.authenticatedContext(ownerA, { role: 'company' }).firestore(), 'company_memberships', adminId), { displayName: 'Injection' }));
await env.cleanup();

console.log('Company memberships lifecycle emulator tests: OK');
