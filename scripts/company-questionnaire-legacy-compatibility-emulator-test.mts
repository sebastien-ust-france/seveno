import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';

function configureEmulatorEnvironment() {
  const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'demo-seveno-local';
  if (projectId !== 'demo-seveno-local') {
    throw new Error(`Projet emulateur interdit: ${projectId}`);
  }
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SEVENO_USE_FIREBASE_EMULATORS = 'true';
  process.env.SEVENO_EMULATOR_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_SEVENO_EMULATOR_PROJECT_ID = projectId;
  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
}

async function assertFirestoreEmulatorAvailable() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host: hostname, port: Number(portValue) });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore Emulator inaccessible sur ${host}.`));
    }, 1000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });
    socket.once('error', rejectPromise);
  });
}

configureEmulatorEnvironment();
await assertFirestoreEmulatorAvailable();

const { Timestamp } = await import('firebase-admin/firestore');
const { adminDb } = await import('@/lib/firebase-admin');
const {
  resolveCompanyQuestionnaireForOffer,
  SevenoCompanyQuestionnaireResolutionError,
} = await import('@/lib/seveno-company-questionnaire-resolver');
const {
  activateCompanyQuestionnaire,
  getCompanyQuestionnaire,
  listCompanyQuestionnaires,
  saveCompanyQuestionnaire,
} = await import('@/lib/seveno-company-questionnaires-server');
const { startCandidateApplicationQuestionnaire } = await import('@/lib/seveno-application-questionnaires-server');

if (!adminDb) {
  throw new Error('Firebase Admin Firestore is not configured.');
}

const runId = randomUUID().slice(0, 8);
const now = Timestamp.fromDate(new Date('2026-08-05T08:00:00.000Z'));

function buildQuestions(count = 20) {
  return Array.from({ length: count }, (_, index) => ({
    id: `question-${index + 1}`,
    prompt: `Question professionnelle ${index + 1}`,
    explanation: `Explication ${index + 1}`,
    type: 'single_choice',
    required: true,
    options: [
      { id: 'option-a', label: 'Reponse A', order: 1 },
      { id: 'option-b', label: 'Reponse B', order: 2 },
    ],
    correctionMode: 'automatic',
    expectedAnswer: 'option-b',
    difficulty: index < 6 ? 'easy' : index < 16 ? 'medium' : 'hard',
    points: 1,
    order: index,
  }));
}

function buildQuestionnaireInput(title: string) {
  return {
    title,
    instructions: 'Repondez aux questions.',
    creationMode: 'manual',
    minimumPassingScorePercent: 60,
    durationMinutes: null,
    questions: buildQuestions(),
  };
}

async function seedCompany(companyUid: string, role = 'company') {
  await adminDb.collection('users').doc(companyUid).set({
    uid: companyUid,
    role,
    authProvider: 'password',
    email: `${companyUid}@seveno.local`,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
  });
  await adminDb.collection('company_profiles').doc(companyUid).set({
    uid: companyUid,
    companyName: `Entreprise ${companyUid}`,
    companyType: 'company',
    businessSector: 'technology',
    headquartersArea: 'France',
    contactRole: 'RH',
    recruitmentAreas: ['France'],
    profileStatus: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

async function seedOffer(input: {
  offerId: string;
  companyUid: string;
  questionnaireId?: string | null;
  questionnaireVersion?: number | null;
}) {
  await adminDb.collection('job_offers').doc(input.offerId).set({
    id: input.offerId,
    companyUid: input.companyUid,
    companyPublicId: `SEV-${input.companyUid}`,
    companyNameSnapshot: 'Entreprise test',
    title: 'Developpeur full stack',
    sectorId: 'technology',
    jobFamilyId: 'engineering',
    jobRoleId: 'developer',
    jobRoleLabel: 'Developpeur',
    location: 'France',
    workMode: 'remote',
    contractType: 'permanent',
    workingTime: 'full_time',
    description: 'Description',
    missions: 'Missions',
    profileSummary: 'Profil',
    questionnaireRequired: true,
    questionnaireId: input.questionnaireId ?? null,
    questionnaireVersion: input.questionnaireVersion ?? null,
    questionnaireTitleSnapshot: input.questionnaireId ? 'Questionnaire historique' : null,
    questionnaireQuestionCountSnapshot: input.questionnaireId ? 20 : null,
    requiredPrerequisites: [],
    preferredPrerequisites: [],
    status: 'published',
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    closedAt: null,
    version: 1,
  });
}

async function seedQuestionnaire(input: {
  questionnaireId: string;
  offerId: string;
  companyUid: string;
  status?: 'draft' | 'active' | 'archived';
  questionCount?: number;
}) {
  const questions = buildQuestions(input.questionCount ?? 20);
  const data = {
    companyUid: input.companyUid,
    offerId: input.offerId,
    offerVersion: 1,
    title: 'Questionnaire historique',
    instructions: 'Repondez aux questions.',
    creationMode: 'manual',
    status: input.status ?? 'active',
    minimumPassingScorePercent: 60,
    durationMinutes: null,
    questions,
    version: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
  const ref = adminDb.collection('company_questionnaires').doc(input.questionnaireId);
  await ref.set(data);
  await ref.collection('versions').doc('1').set({ ...data, questionnaireVersion: 1, recordedAt: now });
  return ref;
}

function hasResolutionCode(code: string) {
  return (error: unknown) => error instanceof SevenoCompanyQuestionnaireResolutionError && error.code === code;
}

const companyUid = `company-legacy-${runId}`;
const candidateUid = `candidate-legacy-${runId}`;
const offerId = `offer-legacy-${runId}`;
const questionnaireId = `questionnaire-uuid-${runId}`;
await seedCompany(companyUid);
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
await seedOffer({ offerId, companyUid, questionnaireId, questionnaireVersion: 1 });
await seedQuestionnaire({ questionnaireId, offerId, companyUid });

const topLevelBefore = await adminDb.collection('company_questionnaires').get();
const historical = await resolveCompanyQuestionnaireForOffer({
  firestore: adminDb,
  offerId,
  companyUid,
  offer: { id: offerId, companyUid, questionnaireId },
});
assert.equal(historical?.questionnaireId, questionnaireId);
assert.equal(historical?.source, 'explicit_reference');
assert.equal(historical?.conflictDetected, false);
assert.equal((await getCompanyQuestionnaire(companyUid, offerId))?.id, questionnaireId);
assert.equal((await getCompanyQuestionnaire(companyUid, offerId))?.questions.length, 20);
assert.equal((await listCompanyQuestionnaires(companyUid)).questionnaires.some((item) => item.id === questionnaireId), true);
assert.equal((await adminDb.collection('company_questionnaires').get()).size, topLevelBefore.size);
assert.equal((await adminDb.collection('company_questionnaires').doc(offerId).get()).exists, false);

const legacySourceOfferId = `questionnaire-shared-${runId}`;
const legacyTargetOfferId = `offer-shared-${runId}`;
await seedOffer({
  offerId: legacySourceOfferId,
  companyUid,
  questionnaireId: legacySourceOfferId,
  questionnaireVersion: 1,
});
await seedQuestionnaire({
  questionnaireId: legacySourceOfferId,
  offerId: legacySourceOfferId,
  companyUid,
});
await seedOffer({
  offerId: legacyTargetOfferId,
  companyUid,
  questionnaireId: legacySourceOfferId,
  questionnaireVersion: 1,
});
const sharedLegacy = await resolveCompanyQuestionnaireForOffer({
  firestore: adminDb,
  offerId: legacyTargetOfferId,
  companyUid,
  offer: { id: legacyTargetOfferId, companyUid, questionnaireId: legacySourceOfferId },
});
assert.equal(sharedLegacy?.questionnaireId, legacySourceOfferId);
assert.equal(sharedLegacy?.source, 'explicit_legacy_reference');
assert.equal(sharedLegacy?.legacySourceOfferId, legacySourceOfferId);
assert.equal((await getCompanyQuestionnaire(companyUid, legacyTargetOfferId))?.id, legacySourceOfferId);
const sharedLegacySaved = await saveCompanyQuestionnaire(
  companyUid,
  legacyTargetOfferId,
  buildQuestionnaireInput('Questionnaire historique partage'),
);
assert.equal(sharedLegacySaved.id, legacySourceOfferId);
assert.equal(sharedLegacySaved.offerId, legacySourceOfferId);
assert.equal((await adminDb.collection('company_questionnaires').doc(legacyTargetOfferId).get()).exists, false);
assert.equal(
  (await adminDb.collection('job_offers').doc(legacyTargetOfferId).get()).get('questionnaireId'),
  legacySourceOfferId,
);
await activateCompanyQuestionnaire(companyUid, legacyTargetOfferId);

const sharedLegacyApplicationId = `application-shared-${runId}`;
await adminDb.collection('job_applications').doc(sharedLegacyApplicationId).set({
  id: sharedLegacyApplicationId,
  candidateUid,
  companyUid,
  offerId: legacyTargetOfferId,
  offerVersion: 1,
  publicCandidateId: `SEV-CAND-SHARED-${runId}`,
  jobRoleId: 'developer',
  status: 'submitted',
  offerSnapshot: {
    title: 'Developpeur full stack',
    sectorId: 'technology',
    jobFamilyId: 'engineering',
    jobRoleId: 'developer',
    questionnaireRequired: true,
    questionnaireId: legacySourceOfferId,
    questionnaireVersion: 2,
  },
  requiredResult: { allSatisfied: true, total: 0, satisfied: 0, answers: [] },
  preferredResult: { total: 0, satisfied: 0, answers: [] },
  createdAt: now,
  updatedAt: now,
});
const sharedLegacyStarted = await startCandidateApplicationQuestionnaire(candidateUid, sharedLegacyApplicationId);
assert.equal(sharedLegacyStarted.questionnaire?.questions.length, 20);
const sharedLegacySessions = await adminDb.collection('test_sessions')
  .where('applicationId', '==', sharedLegacyApplicationId)
  .get();
assert.equal(sharedLegacySessions.size, 1);
assert.equal(sharedLegacySessions.docs[0]?.get('questionnaireId'), legacySourceOfferId);

const currentOfferId = `offer-current-${runId}`;
await seedOffer({ offerId: currentOfferId, companyUid });
await seedQuestionnaire({ questionnaireId: currentOfferId, offerId: currentOfferId, companyUid });
const current = await resolveCompanyQuestionnaireForOffer({
  firestore: adminDb,
  offerId: currentOfferId,
  companyUid,
  offer: { id: currentOfferId, companyUid, questionnaireId: null },
});
assert.equal(current?.questionnaireId, currentOfferId);
assert.equal(current?.source, 'offer_id');

const coherent = await resolveCompanyQuestionnaireForOffer({
  firestore: adminDb,
  offerId: currentOfferId,
  companyUid,
  offer: { id: currentOfferId, companyUid, questionnaireId: currentOfferId },
});
assert.equal(coherent?.questionnaireId, currentOfferId);
assert.equal(coherent?.conflictDetected, false);

const conflictOfferId = `offer-conflict-${runId}`;
const conflictExplicitId = `questionnaire-conflict-${runId}`;
await seedOffer({ offerId: conflictOfferId, companyUid, questionnaireId: conflictExplicitId, questionnaireVersion: 1 });
await seedQuestionnaire({ questionnaireId: conflictExplicitId, offerId: conflictOfferId, companyUid });
await seedQuestionnaire({ questionnaireId: conflictOfferId, offerId: conflictOfferId, companyUid });
const conflict = await resolveCompanyQuestionnaireForOffer({
  firestore: adminDb,
  offerId: conflictOfferId,
  companyUid,
  offer: { id: conflictOfferId, companyUid, questionnaireId: conflictExplicitId },
});
assert.equal(conflict?.questionnaireId, conflictExplicitId);
assert.equal(conflict?.source, 'explicit_reference');
assert.equal(conflict?.conflictDetected, true);

const missingOfferId = `offer-missing-${runId}`;
await seedOffer({ offerId: missingOfferId, companyUid, questionnaireId: `missing-${runId}`, questionnaireVersion: 1 });
assert.equal(await resolveCompanyQuestionnaireForOffer({
  firestore: adminDb,
  offerId: missingOfferId,
  companyUid,
  offer: { id: missingOfferId, companyUid, questionnaireId: `missing-${runId}` },
}), null);

const fallbackOfferId = `offer-stale-${runId}`;
await seedOffer({ offerId: fallbackOfferId, companyUid, questionnaireId: `stale-${runId}`, questionnaireVersion: 1 });
await seedQuestionnaire({ questionnaireId: fallbackOfferId, offerId: fallbackOfferId, companyUid });
const staleFallback = await resolveCompanyQuestionnaireForOffer({
  firestore: adminDb,
  offerId: fallbackOfferId,
  companyUid,
  offer: { id: fallbackOfferId, companyUid, questionnaireId: `stale-${runId}` },
});
assert.equal(staleFallback?.source, 'offer_id_fallback');
assert.equal(staleFallback?.explicitReferenceMissing, true);

const otherCompanyUid = `company-other-${runId}`;
await seedCompany(otherCompanyUid);
const otherCompanyQuestionnaireId = `questionnaire-other-company-${runId}`;
await seedQuestionnaire({ questionnaireId: otherCompanyQuestionnaireId, offerId, companyUid: otherCompanyUid });
await assert.rejects(
  resolveCompanyQuestionnaireForOffer({
    firestore: adminDb,
    offerId,
    companyUid,
    offer: { id: offerId, companyUid, questionnaireId: otherCompanyQuestionnaireId },
  }),
  hasResolutionCode('questionnaire_company_mismatch'),
);

const otherOfferQuestionnaireId = `questionnaire-other-offer-${runId}`;
await seedQuestionnaire({
  questionnaireId: otherOfferQuestionnaireId,
  offerId: `other-offer-${runId}`,
  companyUid,
});
await assert.rejects(
  resolveCompanyQuestionnaireForOffer({
    firestore: adminDb,
    offerId,
    companyUid,
    offer: { id: offerId, companyUid, questionnaireId: otherOfferQuestionnaireId },
  }),
  hasResolutionCode('questionnaire_offer_mismatch'),
);

const input = buildQuestionnaireInput('Questionnaire historique conserve');
const saved = await saveCompanyQuestionnaire(companyUid, offerId, input);
assert.equal(saved.id, questionnaireId);
assert.equal(saved.version, 2);
assert.equal((await adminDb.collection('company_questionnaires').doc(offerId).get()).exists, false);
assert.equal((await adminDb.collection('job_offers').doc(offerId).get()).get('questionnaireId'), questionnaireId);
const activated = await activateCompanyQuestionnaire(companyUid, offerId);
assert.equal(activated.id, questionnaireId);
assert.equal(activated.status, 'active');

const archivedOfferId = `offer-archived-${runId}`;
const archivedQuestionnaireId = `questionnaire-archived-${runId}`;
await seedOffer({ offerId: archivedOfferId, companyUid, questionnaireId: archivedQuestionnaireId, questionnaireVersion: 1 });
await seedQuestionnaire({ questionnaireId: archivedQuestionnaireId, offerId: archivedOfferId, companyUid, status: 'archived' });
await assert.rejects(activateCompanyQuestionnaire(companyUid, archivedOfferId), (error: unknown) => (
  error instanceof Error && 'code' in error && error.code === 'questionnaire_archived'
));

const incompleteOfferId = `offer-incomplete-${runId}`;
const incompleteQuestionnaireId = `questionnaire-incomplete-${runId}`;
await seedOffer({ offerId: incompleteOfferId, companyUid, questionnaireId: incompleteQuestionnaireId, questionnaireVersion: 1 });
await seedQuestionnaire({ questionnaireId: incompleteQuestionnaireId, offerId: incompleteOfferId, companyUid, questionCount: 19 });
await assert.rejects(activateCompanyQuestionnaire(companyUid, incompleteOfferId), (error: unknown) => (
  error instanceof Error && 'code' in error && error.code === 'questionnaire_incomplete'
));

const wrongRoleUid = `wrong-role-${runId}`;
await seedCompany(wrongRoleUid, 'candidate');
await seedOffer({ offerId: `offer-wrong-role-${runId}`, companyUid: wrongRoleUid });
await assert.rejects(getCompanyQuestionnaire(wrongRoleUid, `offer-wrong-role-${runId}`), (error: unknown) => (
  error instanceof Error && 'code' in error && error.code === 'forbidden_role'
));

const applicationId = `application-legacy-${runId}`;
await adminDb.collection('job_applications').doc(applicationId).set({
  id: applicationId,
  candidateUid,
  companyUid,
  offerId,
  offerVersion: 1,
  publicCandidateId: `SEV-CAND-${runId}`,
  jobRoleId: 'developer',
  status: 'submitted',
  offerSnapshot: {
    title: 'Developpeur full stack',
    sectorId: 'technology',
    jobFamilyId: 'engineering',
    jobRoleId: 'developer',
    questionnaireRequired: true,
    questionnaireId,
    questionnaireVersion: 2,
  },
  requiredResult: { allSatisfied: true, total: 0, satisfied: 0, answers: [] },
  preferredResult: { total: 0, satisfied: 0, answers: [] },
  createdAt: now,
  updatedAt: now,
});
const started = await startCandidateApplicationQuestionnaire(candidateUid, applicationId);
assert.equal(started.questionnaire?.questions.length, 20);
assert.equal(started.attempt?.totalQuestions, 20);
const sessions = await adminDb.collection('test_sessions').where('applicationId', '==', applicationId).get();
assert.equal(sessions.size, 1);
assert.equal(sessions.docs[0]?.get('questionnaireId'), questionnaireId);
assert.equal((await adminDb.collection('company_questionnaires').doc(offerId).get()).exists, false);

const companyApplicationPageSource = readFileSync(
  resolve(process.cwd(), 'app/entreprise/demandes/[applicationId]/page.tsx'),
  'utf8',
);
assert.match(
  companyApplicationPageSource,
  /const questionnaireSendLabel = application\?\.companyAssessment\s*\? 'Renvoyer le questionnaire'\s*: 'Envoyer le questionnaire';/,
);

console.log('Company questionnaire legacy compatibility emulator test: OK');
