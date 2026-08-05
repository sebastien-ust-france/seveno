import { Timestamp } from 'firebase-admin/firestore';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
process.env.FIREBASE_ADMIN_PROJECT_ID = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const { adminDb } = await import('@/lib/firebase-admin');
const { buildCompanyMembershipId } = await import('@/lib/seveno-company-memberships-server');
if (!adminDb) throw new Error('Firebase Admin indisponible.');

const apply = process.argv.includes('--apply');
const requestedCompanyId = process.argv.find((value) => value.startsWith('--company-id='))?.slice('--company-id='.length) ?? '';
const profileSnapshot = requestedCompanyId
  ? await adminDb.collection('company_profiles').where('__name__', '==', requestedCompanyId).get()
  : await adminDb.collection('company_profiles').get();
const reports: Array<Record<string, unknown>> = [];
let usefulWrites = 0;

for (const profile of profileSnapshot.docs) {
  const data = profile.data();
  const companyId = typeof data.companyId === 'string' && data.companyId ? data.companyId : profile.id;
  const ownerUid = typeof data.ownerUid === 'string' && data.ownerUid ? data.ownerUid : profile.id;
  const membershipRef = adminDb.collection('company_memberships').doc(buildCompanyMembershipId(companyId, ownerUid));
  const accountRef = adminDb.collection('company_billing_accounts').doc(companyId);
  const [membership, account, offers, applications, campaigns, paidOrders] = await Promise.all([
    membershipRef.get(), accountRef.get(),
    adminDb.collection('job_offers').where('companyUid', '==', profile.id).get(),
    adminDb.collection('job_applications').where('companyUid', '==', profile.id).get(),
    adminDb.collection('recruitment_campaigns').where('companyId', '==', companyId).get(),
    adminDb.collection('billing_orders').where('companyId', '==', companyId).where('status', '==', 'paid').get(),
  ]);
  const profileNeedsUpdate = data.companyId !== companyId || data.ownerUid !== ownerUid;
  const offersToUpdate = offers.docs.filter((doc) => doc.get('companyId') !== companyId);
  const applicationsToUpdate = applications.docs.filter((doc) => doc.get('companyId') !== companyId);
  const plannedWrites = Number(profileNeedsUpdate) + Number(!membership.exists) + Number(!account.exists) + offersToUpdate.length + applicationsToUpdate.length;
  reports.push({
    companyIdMasked: `${companyId.slice(0, 4)}…${companyId.slice(-4)}`,
    ownerUidMasked: `${ownerUid.slice(0, 4)}…${ownerUid.slice(-4)}`,
    membershipsToCreate: Number(!membership.exists), walletsToCreate: Number(!account.exists),
    offers: offers.size, offerStatuses: offers.docs.map((doc) => ({ id: doc.id, status: doc.get('status') ?? null })),
    applications: applications.size, campaigns: campaigns.size, paidOrders: paidOrders.size,
    resourcesToAttach: offersToUpdate.length + applicationsToUpdate.length, plannedWrites,
  });
  usefulWrites += plannedWrites;
  if (!apply || plannedWrites === 0) continue;
  const now = Timestamp.now();
  const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  if (profileNeedsUpdate) writes.push((batch) => batch.set(profile.ref, { companyId, ownerUid, updatedAt: now }, { merge: true }));
  if (!membership.exists) writes.push((batch) => batch.create(membershipRef, {
    membershipId: membershipRef.id, companyId, userUid: ownerUid, role: 'owner', status: 'active', invitedByUid: null,
    joinedAt: data.createdAt instanceof Timestamp ? data.createdAt : now,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : now, updatedAt: now,
  }));
  if (!account.exists) writes.push((batch) => batch.create(accountRef, {
    companyId, availableCredits: 0, lifetimeGrantedCredits: 0, lifetimePurchasedCredits: 0,
    lifetimeConsumedCredits: 0, lifetimeRestoredCredits: 0, activeCampaignCount: campaigns.docs.filter((doc) => ['active', 'paused'].includes(String(doc.get('status')))).length,
    createdAt: now, updatedAt: now,
  }));
  for (const offer of offersToUpdate) writes.push((batch) => batch.set(offer.ref, { companyId, createdByUid: offer.get('createdByUid') ?? ownerUid, updatedByUid: offer.get('updatedByUid') ?? ownerUid }, { merge: true }));
  for (const application of applicationsToUpdate) writes.push((batch) => batch.set(application.ref, { companyId }, { merge: true }));
  for (let index = 0; index < writes.length; index += 400) {
    const batch = adminDb.batch();
    writes.slice(index, index + 400).forEach((write) => write(batch));
    await batch.commit();
  }
}

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', companies: profileSnapshot.size, usefulWrites, reports }));
