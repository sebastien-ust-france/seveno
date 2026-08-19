import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
process.env.NODE_ENV = 'test';
process.env.GCLOUD_PROJECT = projectId;
process.env.PROJECT_ID = projectId;
process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

const { adminDb } = await import('@/lib/firebase-admin');
if (!adminDb) {
  throw new Error('Firebase Admin Firestore is not configured for the emulator.');
}

const rulesTestEnv = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1',
    port: 8080,
    rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
  },
});

const suffix = randomUUID().slice(0, 6).toUpperCase();
const candidateUid = `geo-candidate-${suffix}`;
const companyUid = `geo-company-${suffix}`;
const offerId = `geo-offer-${suffix}`;
const now = new Date('2026-08-19T10:00:00.000Z');

function candidateProfile(uid: string, structured = false) {
  return {
    uid,
    publicCandidateId: `SEV-CAND-${suffix.replaceAll('0', 'A').replaceAll('1', 'B').padEnd(6, 'C').slice(0, 6)}`,
    role: 'candidate',
    targetJobRoleIds: ['sante-medical-paramedical-medico-social-aide-a-domicile'],
    targetJobs: [{
      sectorId: 'sante-medical-paramedical',
      jobFamilyId: 'sante-medical-paramedical-medico-social',
      jobRoleId: 'sante-medical-paramedical-medico-social-aide-a-domicile',
      label: 'Aide à domicile',
    }],
    sectorId: 'sante-medical-paramedical',
    jobFamilyId: 'sante-medical-paramedical-medico-social',
    jobRoleId: 'sante-medical-paramedical-medico-social-aide-a-domicile',
    availability: 'listening',
    locationArea: structured ? 'France > Meuse > Verdun' : 'Meuse',
    ...(structured ? {
      countryCode: 'FR',
      countryName: 'France',
      administrativeAreaCode: '55',
      administrativeAreaName: 'Meuse',
      city: '29734',
      cityName: 'Verdun',
    } : {}),
    experienceLevel: 'intermediate',
    verifiedScore: null,
    testPassed: false,
    lastTestAt: null,
    sevenoAssessmentStatus: 'not_started',
    sevenoAssessmentOverallScore: null,
    sevenoAssessmentDimensions: {},
    sevenoAssessmentVersion: null,
    sevenoAssessmentCompletedAt: null,
    profileStatus: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

try {
  await adminDb.collection('users').doc(candidateUid).set({
    uid: candidateUid,
    role: 'candidate',
    authProvider: 'password',
    email: `${candidateUid}@seveno.local`,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
  });
  await adminDb.collection('users').doc(companyUid).set({
    uid: companyUid,
    role: 'company',
    authProvider: 'password',
    email: `${companyUid}@seveno.local`,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
  });

  const profileRef = adminDb.collection('candidate_profiles').doc(candidateUid);
  await profileRef.set(candidateProfile(candidateUid));

  const candidateDb = rulesTestEnv.authenticatedContext(candidateUid, {
    email: `${candidateUid}@seveno.local`,
    email_verified: true,
  }).firestore();
  const candidateClientRef = candidateDb.collection('candidate_profiles').doc(candidateUid);

  // Historical documents without structured geography remain readable and
  // retain the pre-existing candidate update permissions.
  await assertSucceeds(candidateClientRef.get());
  await assertSucceeds(candidateClientRef.update({
    experienceLevel: 'confirmed',
    updatedAt: new Date('2026-08-19T10:01:00.000Z'),
  }));

  const forbiddenGeographicUpdates: Record<string, string>[] = [
    { countryCode: 'BE' },
    { countryName: 'Belgique' },
    { administrativeAreaCode: '55' },
    { administrativeAreaName: 'Meuse' },
    { city: '29734' },
    { cityName: 'Verdun' },
  ];
  for (const update of forbiddenGeographicUpdates) {
    await assertFails(candidateClientRef.update({
      ...update,
      updatedAt: new Date('2026-08-19T10:02:00.000Z'),
    }));
  }

  await assertFails(
    candidateDb.collection('candidate_profiles').doc(`direct-create-${suffix}`).set(
      candidateProfile(`direct-create-${suffix}`, true),
    ),
  );

  // The Admin SDK is the authoritative server path and bypasses client Rules.
  await profileRef.update({
    countryCode: 'FR',
    countryName: 'France',
    administrativeAreaCode: '55',
    administrativeAreaName: 'Meuse',
    city: '29734',
    cityName: 'Verdun',
    locationArea: 'France > Meuse > Verdun',
    updatedAt: new Date('2026-08-19T10:03:00.000Z'),
  });
  const serverWrittenProfile = await profileRef.get();
  assert.equal(serverWrittenProfile.get('countryCode'), 'FR');
  assert.equal(serverWrittenProfile.get('administrativeAreaCode'), '55');
  assert.equal(serverWrittenProfile.get('cityName'), 'Verdun');

  const offerRef = adminDb.collection('job_offers').doc(offerId);
  await offerRef.set({
    id: offerId,
    companyUid,
    location: 'France > Meuse > Verdun',
    countryCode: 'FR',
    countryName: 'France',
    administrativeAreaCode: '55',
    administrativeAreaName: 'Meuse',
    city: '29734',
    cityName: 'Verdun',
    createdAt: now,
    updatedAt: now,
  });
  assert.equal((await offerRef.get()).get('cityName'), 'Verdun');

  const companyDb = rulesTestEnv.authenticatedContext(companyUid, {
    email: `${companyUid}@seveno.local`,
    email_verified: true,
  }).firestore();
  await assertFails(
    companyDb.collection('job_offers').doc(offerId).update({ countryCode: 'BE' }),
  );
  await assertFails(
    companyDb.collection('job_offers').doc(`direct-offer-${suffix}`).set({
      countryCode: 'FR',
      administrativeAreaCode: '55',
      city: '29734',
    }),
  );

  console.log('Geography Firestore Rules emulator test: OK', {
    projectId,
    candidateUid,
    companyUid,
    offerId,
  });
} finally {
  await Promise.all([
    adminDb.collection('candidate_profiles').doc(candidateUid).delete(),
    adminDb.collection('candidate_profiles').doc(`direct-create-${suffix}`).delete(),
    adminDb.collection('job_offers').doc(offerId).delete(),
    adminDb.collection('job_offers').doc(`direct-offer-${suffix}`).delete(),
    adminDb.collection('users').doc(candidateUid).delete(),
    adminDb.collection('users').doc(companyUid).delete(),
  ]);
  await rulesTestEnv.cleanup();
}
