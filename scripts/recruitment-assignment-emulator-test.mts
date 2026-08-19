import assert from 'node:assert/strict';
import net from 'node:net';

const projectId = 'demo-seveno-local';
process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
await new Promise<void>((resolve, reject) => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  const socket = net.createConnection({ host, port: Number(port) });
  socket.once('connect', () => { socket.end(); resolve(); });
  socket.once('error', reject);
});

const { adminDb } = await import('@/lib/firebase-admin');
const { Timestamp } = await import('firebase-admin/firestore');
const { assertRecruitmentApplicationAccess, assertRecruitmentCampaignAccess, assertRecruitmentOfferIdAccess, reassignJobOffer } = await import('@/lib/seveno-job-offers-server');
const { buildCompanyMembershipId } = await import('@/lib/seveno-company-memberships-server');
const { prepareApplicationSubmittedNotificationEvent, prepareApplicationQuestionnaireCompletedNotificationEvent, buildApplicationSubmittedNotificationEventId, buildApplicationQuestionnaireCompletedNotificationEventId } = await import('@/lib/seveno-company-notifications-server');
if (!adminDb) throw new Error('Firebase Admin indisponible.');

const companyId = 'assignment-company';
const users = { owner: 'assignment-owner', admin: 'assignment-admin', helene: 'assignment-helene', paul: 'assignment-paul', billing: 'assignment-billing', viewer: 'assignment-viewer' } as const;
const now = Timestamp.now();
await adminDb.collection('company_profiles').doc(companyId).set({ companyId, uid: companyId, ownerUid: users.owner, companyName: 'Entreprise A', profileStatus: 'active', verificationStatus: 'verified', createdAt: now, updatedAt: now });
for (const [roleName, uid] of Object.entries(users)) {
  const role = roleName === 'helene' || roleName === 'paul' ? 'recruiter' : roleName === 'billing' ? 'billing_manager' : roleName;
  await adminDb.collection('users').doc(uid).set({ uid, role: 'company', email: `${uid}@example.test`, activeCompanyId: companyId, createdAt: now, updatedAt: now });
  const membershipId = buildCompanyMembershipId(companyId, uid);
  await adminDb.collection('company_memberships').doc(membershipId).set({ membershipId, companyId, userUid: uid, role, status: 'active', createdAt: now, updatedAt: now });
}
for (const [offerId, assignedToUid] of [['assignment-offer-h', users.helene], ['assignment-offer-p', users.paul]] as const) {
  await adminDb.collection('job_offers').doc(offerId).set({ id: offerId, companyId, companyUid: companyId, title: offerId, status: 'published', createdByUid: users.owner, assignedToUid, assignedAt: now, assignedByUid: users.owner, createdAt: now, updatedAt: now });
  await adminDb.collection('job_applications').doc(`${offerId}-application`).set({ id: `${offerId}-application`, companyId, companyUid: companyId, offerId, status: 'submitted', createdAt: now, updatedAt: now });
  await adminDb.collection('recruitment_campaigns').doc(`${offerId}-campaign`).set({ campaignId: `${offerId}-campaign`, companyId, offerId, status: 'active', createdAt: now, updatedAt: now });
}
const membership = (userUid: string, role: 'owner' | 'admin' | 'recruiter' | 'billing_manager' | 'viewer') => ({ companyId, userUid, role });
await assert.doesNotReject(assertRecruitmentOfferIdAccess('assignment-offer-h', membership(users.helene, 'recruiter')));
await assert.rejects(assertRecruitmentOfferIdAccess('assignment-offer-p', membership(users.helene, 'recruiter')), (error: any) => error?.status === 403);
await assert.doesNotReject(assertRecruitmentApplicationAccess('assignment-offer-h-application', membership(users.helene, 'recruiter')));
await assert.rejects(assertRecruitmentApplicationAccess('assignment-offer-p-application', membership(users.helene, 'recruiter'), true), (error: any) => error?.status === 403);
await assert.doesNotReject(assertRecruitmentCampaignAccess('assignment-offer-h-campaign', membership(users.helene, 'recruiter')));
await assert.rejects(assertRecruitmentCampaignAccess('assignment-offer-p-campaign', membership(users.helene, 'recruiter'), true), (error: any) => error?.status === 403);
await assert.doesNotReject(assertRecruitmentCampaignAccess('assignment-offer-p-campaign', membership(users.paul, 'recruiter'), true));
await assert.doesNotReject(assertRecruitmentOfferIdAccess('assignment-offer-h', membership(users.owner, 'owner'), true));
await assert.doesNotReject(assertRecruitmentOfferIdAccess('assignment-offer-p', membership(users.admin, 'admin'), true));
await assert.rejects(assertRecruitmentOfferIdAccess('assignment-offer-h', membership(users.billing, 'billing_manager')), (error: any) => error?.status === 403);
await assert.doesNotReject(assertRecruitmentOfferIdAccess('assignment-offer-h', membership(users.viewer, 'viewer')));
await assert.rejects(assertRecruitmentOfferIdAccess('assignment-offer-h', membership(users.viewer, 'viewer'), true), (error: any) => error?.status === 403);

await adminDb.runTransaction(async (transaction) => {
  await prepareApplicationSubmittedNotificationEvent(transaction, adminDb, { applicationId: 'assignment-offer-h-application', offerId: 'assignment-offer-h', companyUid: companyId, now: Timestamp.now() });
});
await adminDb.runTransaction(async (transaction) => { await prepareApplicationQuestionnaireCompletedNotificationEvent(transaction, adminDb, { applicationId: 'assignment-offer-h-application', offerId: 'assignment-offer-h', companyUid: companyId, resultId: 'assignment-result-h', now: Timestamp.now() }); });
assert.equal((await adminDb.collection('notification_outbox').doc(buildApplicationSubmittedNotificationEventId('assignment-offer-h-application')).get()).get('recipientUid'), users.helene);
assert.equal((await adminDb.collection('notification_outbox').doc(buildApplicationQuestionnaireCompletedNotificationEventId('assignment-offer-h-application', 'assignment-result-h')).get()).get('recipientUid'), users.helene);

await reassignJobOffer(companyId, 'assignment-offer-h', { uid: users.owner, role: 'owner' }, users.paul);
await assert.rejects(assertRecruitmentOfferIdAccess('assignment-offer-h', membership(users.helene, 'recruiter')), (error: any) => error?.status === 403);
await assert.doesNotReject(assertRecruitmentOfferIdAccess('assignment-offer-h', membership(users.paul, 'recruiter'), true));
assert.equal((await adminDb.collection('job_applications').doc('assignment-offer-h-application').get()).get('offerId'), 'assignment-offer-h');
assert.equal((await adminDb.collection('recruitment_campaigns').doc('assignment-offer-h-campaign').get()).get('offerId'), 'assignment-offer-h');
await adminDb.collection('job_applications').doc('assignment-offer-h-application-after').set({ id: 'assignment-offer-h-application-after', companyId, companyUid: companyId, offerId: 'assignment-offer-h', status: 'submitted', createdAt: now, updatedAt: now });
await adminDb.runTransaction(async (transaction) => { await prepareApplicationSubmittedNotificationEvent(transaction, adminDb, { applicationId: 'assignment-offer-h-application-after', offerId: 'assignment-offer-h', companyUid: companyId, now: Timestamp.now() }); });
assert.equal((await adminDb.collection('notification_outbox').doc(buildApplicationSubmittedNotificationEventId('assignment-offer-h-application-after')).get()).get('recipientUid'), users.paul);
console.log('Recruitment assignment emulator test passed.');
