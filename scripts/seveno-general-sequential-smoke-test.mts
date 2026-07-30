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
  process.env.SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE = 'memory';
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function buildSequentialQuestionPool(
  sourceQuestions: Array<{ id: string; code: string; path: 'essential' | 'extended'; options: Array<{ id: string; label: string; position?: number; dimensionScores?: Record<string, number>; adminExplanation?: string }>; assessmentVersionId?: string }>,
  path: 'essential' | 'extended',
  totalCount: number,
  versionId: string,
  codePrefix: string,
) {
  const templateQuestions = sourceQuestions.filter((question) => question.path === path);
  if (templateQuestions.length === 0) {
    throw new Error(`Aucune question ${path} disponible pour construire la banque de test.`);
  }

  return Array.from({ length: totalCount }, (_, index) => {
    const template = templateQuestions[index % templateQuestions.length];
    const sequence = String(index + 1).padStart(2, '0');
    const questionId = `${codePrefix}-${path}-${sequence}`;

    return {
      ...cloneValue(template),
      id: questionId,
      code: `${codePrefix}-${path}-${sequence}`,
      assessmentVersionId: versionId,
      path,
      position: path === 'essential' ? index + 1 : 31 + index,
      isActive: true,
      options: template.options.map((option, optionIndex) => ({
        ...cloneValue(option),
        id: `${questionId}-option-${optionIndex + 1}`,
        position: optionIndex + 1,
      })),
    };
  });
}

function buildSequentialProfessionalAssessmentVersion(baseVersionInput: {
  id: string;
  code: string;
  questions: Array<{
    id: string;
    code: string;
    path: 'essential' | 'extended';
    options: Array<{
      id: string;
      label: string;
      position?: number;
      dimensionScores?: Record<string, number>;
      adminExplanation?: string;
    }>;
    assessmentVersionId?: string;
  }>;
  [key: string]: unknown;
}) {
  const baseVersion = cloneValue(baseVersionInput);
  const essentialQuestions = buildSequentialQuestionPool(
    baseVersion.questions,
    'essential',
    30,
    baseVersion.id,
    `${baseVersion.code}-sequential`,
  );
  const extendedQuestions = buildSequentialQuestionPool(
    baseVersion.questions,
    'extended',
    30,
    baseVersion.id,
    `${baseVersion.code}-sequential`,
  );
  const now = new Date().toISOString();

  return {
    ...baseVersion,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    questions: [...essentialQuestions, ...extendedQuestions],
    essentialQuestionCount: 30,
    extendedQuestionCount: 30,
  };
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

    socket.once('error', () => {
      clearTimeout(timeout);
      rejectPromise(new Error(`Firestore emulator inaccessible sur ${host}. Lancez l emulator local avant ce smoke test.`));
    });
  });
}

async function main() {
  loadDotEnvFile(resolve(process.cwd(), '.env.local'));
  configureEmulatorEnvironment();
  await assertEmulatorAvailable();

  const { Timestamp } = await import('firebase-admin/firestore');
  const { adminDb } = await import('@/lib/firebase-admin');
  const { resetSevenoProfessionalAssessmentRepository, createSevenoProfessionalAssessmentSeedVersion } = await import('@/lib/seveno-professional-assessment-admin-repository');
  const {
    startSevenoTestSession,
    submitSevenoTestSession,
  } = await import('@/lib/seveno-tests');

  if (!adminDb) {
    throw new Error('Firebase Admin Firestore is not configured.');
  }

  const firestore = adminDb;
  const now = Timestamp.now();
  const suffix = randomUUID().slice(0, 8);
  const candidateUid = `candidate-${suffix}`;

  const activeVersion = buildSequentialProfessionalAssessmentVersion(createSevenoProfessionalAssessmentSeedVersion());

  resetSevenoProfessionalAssessmentRepository([activeVersion]);

  await firestore.collection('users').doc(candidateUid).set({
    uid: candidateUid,
    role: 'candidate',
    authProvider: 'google',
    email: `${candidateUid}@seveno.test`,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
  });

  resetSevenoProfessionalAssessmentRepository([]);
  await assert.rejects(
    () => startSevenoTestSession(candidateUid),
    (error) => error instanceof Error && (error as { code?: string }).code === 'professional_assessment_version_unavailable',
  );

  resetSevenoProfessionalAssessmentRepository([activeVersion]);

  const startSession = await startSevenoTestSession(candidateUid);
  assert.ok(startSession);
  assert.equal(startSession.professionalAssessmentVersionId, activeVersion.id);
  assert.equal(startSession.currentQuestionIndex, 0);
  assert.equal(startSession.questionTimeSeconds, 15);
  assert.equal(startSession.questions.length, 40);
  assert.equal(
    Date.parse(startSession.questionExpiresAt ?? '') - Date.parse(startSession.questionStartedAt),
    15000,
  );
  const attemptSeed1 = startSession.attemptSeed ?? '';
  const sessionId1 = startSession.sessionId ?? '';
  const question1 = startSession.questions[0];
  assert.ok(question1);

  const firstAnswer = question1?.options[0]?.id ?? '';
  const afterFirstAnswer = await submitSevenoTestSession(candidateUid, sessionId1, {
    sessionId: sessionId1,
    questionId: question1.id,
    answer: firstAnswer,
    timeout: false,
  });
  assert.ok('session' in afterFirstAnswer);
  assert.equal(afterFirstAnswer.session?.currentQuestionIndex, 1);
  assert.equal(afterFirstAnswer.session?.attemptSeed, attemptSeed1);
  assert.equal(afterFirstAnswer.session?.questionTimeSeconds, 15);
  assert.equal(
    Date.parse(afterFirstAnswer.session?.questionExpiresAt ?? '') - Date.parse(afterFirstAnswer.session.questionStartedAt),
    15000,
  );

  const expiredSessionRef = firestore.collection('test_sessions').doc(sessionId1);
  const forcedExpiredAt = Timestamp.fromMillis(Date.now() - 1000);
  const forcedStartedAt = Timestamp.fromMillis(Date.now() - 16000);
  await expiredSessionRef.update({
    questionStartedAt: forcedStartedAt,
    questionExpiresAt: forcedExpiredAt,
  });

  const expiredQuestion = afterFirstAnswer.session?.questions[1];
  assert.ok(expiredQuestion);
  const afterTimeout = await submitSevenoTestSession(candidateUid, sessionId1, {
    sessionId: sessionId1,
    questionId: expiredQuestion.id,
    answer: null,
    timeout: true,
  });
  assert.ok('session' in afterTimeout);
  assert.equal(afterTimeout.session?.currentQuestionIndex, 2);

  const storedAfterTimeout = await expiredSessionRef.get();
  assert.equal(storedAfterTimeout.exists, true);
  assert.equal(storedAfterTimeout.get('currentQuestionIndex'), 2);
  const storedAnswers = storedAfterTimeout.get('answers') as Record<string, string> | undefined;
  assert.equal(storedAnswers?.[expiredQuestion.id], undefined);

  const secondStart = await startSevenoTestSession(candidateUid);
  assert.ok(secondStart);
  assert.notEqual(secondStart.attemptSeed, attemptSeed1);
  assert.equal(secondStart.currentQuestionIndex, 0);
  assert.equal(
    Date.parse(secondStart.questionExpiresAt ?? '') - Date.parse(secondStart.questionStartedAt),
    15000,
  );

  const oldSessionAfterRestart = await expiredSessionRef.get();
  assert.equal(oldSessionAfterRestart.get('status'), 'abandoned');

  console.log('SevenO general sequential smoke test: OK', {
    sessionId: secondStart.sessionId,
    attemptSeed: secondStart.attemptSeed,
    questionCount: secondStart.questions.length,
  });
}

await main();
