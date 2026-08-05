import assert from 'node:assert/strict';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function configureEmulatorEnvironment() {
  const projectId = process.env.SEVENO_EMULATOR_PROJECT_ID ?? 'seveno-emulator';
  process.env.GCLOUD_PROJECT = projectId;
  process.env.PROJECT_ID = projectId;
  process.env.FIREBASE_ADMIN_PROJECT_ID = projectId;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
}

async function assertEmulatorAvailable() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const [hostname, portValue] = host.split(':');
  const port = Number(portValue);
  if (!hostname || !Number.isFinite(port)) {
    throw new Error(`Firestore emulator host invalide: ${host}`);
  }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host: hostname, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}. Lancez l emulator local avant ce smoke test.`));
    }, 1000);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolvePromise();
    });

    socket.once('error', (error) => {
      clearTimeout(timeout);
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}. Lancez l emulator local avant ce smoke test.`));
    });
  });
}

function buildQuestion(index: number) {
  const isMultipleChoice = index % 2 === 1;
  const options = isMultipleChoice
    ? [
        { id: 'option-1', label: 'Reponse A', order: 1 },
        { id: 'option-2', label: 'Reponse B', order: 2 },
        { id: 'option-3', label: 'Reponse C', order: 3 },
        { id: 'option-4', label: 'Reponse D', order: 4 },
      ]
    : [
        { id: 'option-1', label: 'Reponse A', order: 1 },
        { id: 'option-2', label: 'Reponse B', order: 2 },
      ];

  return {
    id: `question-${index + 1}`,
    prompt: `Question ${index + 1}`,
    help: `Aide ${index + 1}`,
    type: isMultipleChoice ? 'multiple_choice' : 'single_choice',
    required: true,
    options,
    points: 1,
    correctionMode: 'automatic' as const,
    expectedAnswer: isMultipleChoice ? ['option-1', 'option-3'] : 'option-2',
    order: index,
    difficulty: 'medium' as const,
    explanation: `Explication ${index + 1}`,
  };
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  await assertEmulatorAvailable();

  const { Timestamp } = await import('firebase-admin/firestore');
  const { adminDb } = await import('@/lib/firebase-admin');
  const {
    getCandidateApplicationQuestionnaireView,
    startCandidateApplicationQuestionnaire,
    submitCandidateApplicationQuestionnaire,
  } = await import('@/lib/seveno-application-questionnaires-server');

  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const firestore = adminDb;
  const now = Timestamp.now();
  const suffix = randomUUID().slice(0, 8);
  const candidateUid = `candidate-${suffix}`;
  const companyUid = `company-${suffix}`;
  const offerId = `offer-${suffix}`;
  const questionnaireId = `questionnaire-${suffix}`;
  const applicationId = `application-${suffix}`;
  const questions = Array.from({ length: 20 }, (_, index) => buildQuestion(index));

  const originalRandom = Math.random;
  Math.random = () => 0.999999;

  try {
    await firestore.collection('users').doc(candidateUid).set({
      uid: candidateUid,
      role: 'candidate',
      authProvider: 'password',
      email: `${candidateUid}@seveno.test`,
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: now,
      updatedAt: now,
    });

    await Promise.all([
      firestore.collection('job_offers').doc(offerId).set({
        id: offerId,
        companyUid,
        companyPublicId: `SEV-CO-${suffix.toUpperCase()}`,
        companyNameSnapshot: 'Entreprise de test',
        title: 'Maçon coffreur',
        sectorId: 'construction-btp',
        jobFamilyId: 'gros-oeuvre',
        jobRoleId: 'macon-coffreur',
        jobRoleLabel: 'Maçon coffreur',
        location: 'Gironde',
        workMode: 'onsite',
        contractType: 'permanent',
        workingTime: 'full_time',
        description: 'Offre de test',
        missions: 'Missions de test',
        profileSummary: 'Profil de test',
        questionnaireRequired: true,
        questionnaireId,
        questionnaireVersion: 1,
        requiredPrerequisites: [],
        preferredPrerequisites: [],
        status: 'published',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        closedAt: null,
        version: 1,
      }),
      firestore.collection('job_offers').doc(offerId).collection('versions').doc('1').set({
        id: offerId,
        companyUid,
        title: 'Maçon coffreur',
        sectorId: 'construction-btp',
        jobFamilyId: 'gros-oeuvre',
        jobRoleId: 'macon-coffreur',
        questionnaireId,
        questionnaireVersion: 1,
        status: 'published',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        questions: [],
      }),
      firestore.collection('company_questionnaires').doc(questionnaireId).set({
        id: questionnaireId,
        companyUid,
        offerId,
        title: 'Questionnaire entreprise',
        instructions: 'Répondez à chaque question dans le délai imparti.',
        status: 'active',
        questionnaireVersion: 1,
        createdAt: now,
        updatedAt: now,
      }),
      firestore.collection('company_questionnaires').doc(questionnaireId).collection('versions').doc('1').set({
        companyUid,
        offerId,
        questionnaireVersion: 1,
        title: 'Questionnaire entreprise',
        instructions: 'Répondez à chaque question dans le délai imparti.',
        status: 'active',
        durationMinutes: null,
        questions,
        createdAt: now,
        updatedAt: now,
      }),
      firestore.collection('job_applications').doc(applicationId).set({
        id: applicationId,
        candidateUid,
        publicCandidateId: 'SEV-CAND-TEST01',
        companyUid,
        offerId,
        offerVersion: 1,
        jobRoleId: 'macon-coffreur',
        status: 'eligible',
        offerSnapshot: {
          offerId,
          offerVersion: 1,
          companyPublicId: `SEV-CO-${suffix.toUpperCase()}`,
          companyName: 'Entreprise de test',
          title: 'Maçon coffreur',
          sectorId: 'construction-btp',
          jobFamilyId: 'gros-oeuvre',
          jobRoleId: 'macon-coffreur',
          jobRoleLabel: 'Maçon coffreur',
          location: 'Gironde',
          workMode: 'onsite',
          contractType: 'permanent',
          workingTime: 'full_time',
          description: 'Offre de test',
          missions: 'Missions de test',
          profileSummary: 'Profil de test',
          questionnaireRequired: true,
          questionnaireId,
          questionnaireVersion: 1,
          requiredPrerequisites: [],
          preferredPrerequisites: [],
          publishedAt: now.toDate().toISOString(),
        },
        requiredResult: { total: 0, satisfied: 0, unsatisfied: 0, unanswered: 0, allSatisfied: true },
        preferredResult: { total: 0, satisfied: 0, unsatisfied: 0, unanswered: 0, compatibilityRate: 100 },
        companyAssessment: null,
        createdAt: now,
        updatedAt: now,
      }),
    ]);

    const startedView = await startCandidateApplicationQuestionnaire(candidateUid, applicationId);
    assert.equal(startedView.questionnaire?.questions.length, 20);
    assert.equal(startedView.attempt?.currentQuestionIndex, 0);
    assert.equal(startedView.attempt?.questionTimeSeconds, 30);
    assert.equal(
      Date.parse(startedView.attempt?.currentQuestionExpiresAt ?? '') - Date.parse(startedView.attempt?.currentQuestionStartedAt ?? ''),
      30000,
    );
    assert.equal('expectedAnswer' in (startedView.questionnaire?.questions[0] ?? {}), false);

    const firstQuestion = startedView.questionnaire?.questions[0];
    assert.ok(firstQuestion);
    assert.equal(firstQuestion?.type, 'single_choice');
    const firstAnswer = firstQuestion?.options[1]?.id ?? '';
    const afterFirstAnswer = await submitCandidateApplicationQuestionnaire(candidateUid, applicationId, startedView.attempt?.sessionId ?? '', {
      sessionId: startedView.attempt?.sessionId ?? '',
      questionId: firstQuestion.id,
      answer: firstAnswer,
      finish: false,
    });
    assert.equal(afterFirstAnswer.attempt?.currentQuestionIndex, 1);
    assert.equal(afterFirstAnswer.attempt?.currentQuestionId, afterFirstAnswer.questionnaire?.questions[1]?.id ?? null);
    assert.equal(afterFirstAnswer.attempt?.questionTimeSeconds, 30);

    const legacyQuestionStartedAt = Timestamp.now();
    await firestore.collection('test_sessions').doc(afterFirstAnswer.attempt?.sessionId ?? '').update({
      questionTimeSeconds: 15,
      questionStartedAt: legacyQuestionStartedAt,
      questionExpiresAt: Timestamp.fromMillis(legacyQuestionStartedAt.toMillis() + 15000),
    });

    const secondQuestion = afterFirstAnswer.questionnaire?.questions[1];
    assert.ok(secondQuestion);
    assert.equal(secondQuestion?.type, 'multiple_choice');
    const multipleAnswer = ['option-1', 'option-3'];
    const afterSecondAnswer = await submitCandidateApplicationQuestionnaire(candidateUid, applicationId, afterFirstAnswer.attempt?.sessionId ?? '', {
      sessionId: afterFirstAnswer.attempt?.sessionId ?? '',
      questionId: secondQuestion.id,
      answer: multipleAnswer,
      finish: false,
    });
    assert.equal(afterSecondAnswer.attempt?.currentQuestionIndex, 2);
    assert.equal(afterSecondAnswer.attempt?.questionTimeSeconds, 15);
    assert.equal(
      Date.parse(afterSecondAnswer.attempt?.currentQuestionExpiresAt ?? '') - Date.parse(afterSecondAnswer.attempt?.currentQuestionStartedAt ?? ''),
      15000,
    );

    const thirdQuestion = afterSecondAnswer.questionnaire?.questions[2];
    assert.ok(thirdQuestion);
    const afterTimeout = await submitCandidateApplicationQuestionnaire(candidateUid, applicationId, afterSecondAnswer.attempt?.sessionId ?? '', {
      sessionId: afterSecondAnswer.attempt?.sessionId ?? '',
      questionId: thirdQuestion.id,
      answer: null,
      timeout: true,
      finish: false,
    });
    assert.equal(afterTimeout.attempt?.currentQuestionIndex, 3);
    assert.equal(afterTimeout.attempt?.currentQuestionId, afterTimeout.questionnaire?.questions[3]?.id ?? null);

    const refreshedView = await getCandidateApplicationQuestionnaireView(candidateUid, applicationId);
    assert.equal(refreshedView.attempt?.currentQuestionIndex, 3);
    assert.equal(refreshedView.attempt?.currentQuestionId, refreshedView.questionnaire?.questions[3]?.id ?? null);

    console.log('Questionnaire progress smoke test: OK', {
      sessionId: refreshedView.attempt?.sessionId,
      currentQuestionIndex: refreshedView.attempt?.currentQuestionIndex,
      currentQuestionId: refreshedView.attempt?.currentQuestionId,
    });
  } finally {
    Math.random = originalRandom;
  }
}

await main();
