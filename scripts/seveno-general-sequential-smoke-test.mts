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
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8081';
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

  const draftBaseVersion = createSevenoProfessionalAssessmentSeedVersion();
  const activeVersion = {
    ...buildSequentialProfessionalAssessmentVersion(draftBaseVersion),
    status: 'active' as const,
  };
  const nextVersion = {
    ...buildSequentialProfessionalAssessmentVersion({
      ...draftBaseVersion,
      id: `${activeVersion.id}-b`,
      version: `${activeVersion.version}-b`,
      name: `${activeVersion.name} B`,
    }),
    status: 'draft' as const,
  };

  resetSevenoProfessionalAssessmentRepository([activeVersion, nextVersion]);

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

  resetSevenoProfessionalAssessmentRepository([activeVersion, nextVersion]);

  const startSession = await startSevenoTestSession(candidateUid);
  assert.ok(startSession);
  assert.equal(startSession.professionalAssessmentVersionId, activeVersion.id);
  assert.equal(startSession.currentQuestionIndex, 0);
  assert.equal(startSession.questionTimeSeconds, 30);
  assert.equal(startSession.questions.length, 40);
  assert.equal(
    Date.parse(startSession.questionExpiresAt ?? '') - Date.parse(startSession.questionStartedAt),
    30000,
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
  assert.equal(afterFirstAnswer.session?.questionTimeSeconds, 30);
  assert.equal(
    Date.parse(afterFirstAnswer.session?.questionExpiresAt ?? '') - Date.parse(afterFirstAnswer.session.questionStartedAt),
    30000,
  );

  const expiredSessionRef = firestore.collection('test_sessions').doc(sessionId1);
  const forcedExpiredAt = Timestamp.fromMillis(Date.now() - 1000);
  await expiredSessionRef.update({
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
  assert.equal(afterTimeout.session?.questionTimeSeconds, 30);
  assert.equal(
    Date.parse(afterTimeout.session?.questionExpiresAt ?? '') - Date.parse(afterTimeout.session?.questionStartedAt ?? ''),
    30000,
  );

  const storedAfterTimeout = await expiredSessionRef.get();
  assert.equal(storedAfterTimeout.exists, true);
  assert.equal(storedAfterTimeout.get('currentQuestionIndex'), 2);
  const storedAnswers = storedAfterTimeout.get('answers') as Record<string, string> | undefined;
  assert.equal(storedAnswers?.[expiredQuestion.id], undefined);

  const productionLikeQuestions = activeVersion.questions.slice(0, 40);
  const productionLikeQuestionIds = productionLikeQuestions.map((question) => question.id);
  const productionLikeReplacement = activeVersion.questions.find((question) => question.path === 'extended' && question.id !== 'extended_profile_15' && question.id !== 'extended_profile_05');
  assert.ok(productionLikeReplacement);
  const productionLikeNow = Timestamp.now();
  const productionLikeInitialAnswers = Object.fromEntries(
    productionLikeQuestionIds.slice(0, 39).map((questionId, index) => [questionId, productionLikeQuestions[index]?.options[0]?.id ?? `${questionId}-option-1`]),
  );

  const productionLikeSessionId = `prod-like-${suffix}`;
  const productionLikeSessionRef = firestore.collection('test_sessions').doc(productionLikeSessionId);
  await productionLikeSessionRef.set({
    uid: candidateUid,
    candidateUid,
    assessmentType: 'seveno_general',
    professionalAssessmentVersionId: activeVersion.id,
    attemptSeed: `prod-like-${suffix}`,
    questionnaireVersion: activeVersion.version,
    questionBankCode: activeVersion.code,
    questionBankVersion: activeVersion.version,
    status: 'in_progress',
    questionIds: [...productionLikeQuestionIds],
    currentQuestionIndex: 39,
    questionStartedAt: productionLikeNow,
    questionExpiresAt: Timestamp.fromMillis(productionLikeNow.toMillis() + 900000),
    questionTimeSeconds: 30,
    answers: productionLikeInitialAnswers,
    answersCount: 39,
    totalQuestions: 40,
    questionsPresentedCount: 40,
    timedOutQuestionIds: [],
    lastQuestionId: productionLikeQuestionIds[38],
    startedAt: productionLikeNow,
    updatedAt: productionLikeNow,
    expiresAt: Timestamp.fromMillis(productionLikeNow.toMillis() + 1200000),
  });

  const productionLikeBeforeTimeout = await productionLikeSessionRef.get();
  console.log('productionLike before timeout', {
    answersCount: productionLikeBeforeTimeout.get('answersCount'),
    answerKeys: Object.keys((productionLikeBeforeTimeout.get('answers') as Record<string, string>) ?? {}).length,
    currentQuestionIndex: productionLikeBeforeTimeout.get('currentQuestionIndex'),
    questionIdsLength: (productionLikeBeforeTimeout.get('questionIds') as string[] | undefined)?.length ?? null,
    currentQuestionId: (productionLikeBeforeTimeout.get('questionIds') as string[] | undefined)?.[productionLikeBeforeTimeout.get('currentQuestionIndex') as number] ?? null,
  });

  const productionLikeTimeoutQuestionId = productionLikeQuestionIds[39];
  assert.ok(productionLikeTimeoutQuestionId);
  await productionLikeSessionRef.update({
    questionExpiresAt: Timestamp.fromMillis(Date.now() - 1000),
  });
  const productionLikeTimeoutSubmit = await submitSevenoTestSession(candidateUid, productionLikeSessionId, {
    sessionId: productionLikeSessionId,
    questionId: productionLikeTimeoutQuestionId,
    answer: null,
    timeout: true,
  });
  assert.ok('session' in productionLikeTimeoutSubmit);
  const productionLikeAfterTimeout = await productionLikeSessionRef.get();
  const productionLikeTimedOutQuestionIds = (productionLikeAfterTimeout.get('timedOutQuestionIds') as string[] | undefined) ?? [];
  console.log('productionLike after timeout', {
    answersCount: productionLikeAfterTimeout.get('answersCount'),
    answerKeys: Object.keys((productionLikeAfterTimeout.get('answers') as Record<string, string>) ?? {}).length,
    currentQuestionIndex: productionLikeAfterTimeout.get('currentQuestionIndex'),
    questionIdsLength: (productionLikeAfterTimeout.get('questionIds') as string[] | undefined)?.length ?? null,
    replacementQuestionId: (productionLikeAfterTimeout.get('questionIds') as string[] | undefined)?.[40] ?? null,
    timedOutQuestionIds: productionLikeTimedOutQuestionIds,
  });

  const productionLikeReplacementId = (productionLikeAfterTimeout.get('questionIds') as string[] | undefined)?.[40];
  assert.ok(productionLikeReplacementId);
  const productionLikeBeforeReplacement = await productionLikeSessionRef.get();
  console.log('productionLike before replacement', {
    answersCount: productionLikeBeforeReplacement.get('answersCount'),
    currentQuestionId: (productionLikeBeforeReplacement.get('questionIds') as string[] | undefined)?.[productionLikeBeforeReplacement.get('currentQuestionIndex') as number] ?? null,
    replacementQuestionId: productionLikeReplacementId,
  });

  const productionLikeReplacementAnswer = `${productionLikeReplacementId}-option-1`;
  const productionLikeFinalSubmit = await submitSevenoTestSession(candidateUid, productionLikeSessionId, {
    sessionId: productionLikeSessionId,
    questionId: productionLikeReplacementId,
    answer: productionLikeReplacementAnswer,
    timeout: false,
  });
  assert.ok('session' in productionLikeFinalSubmit);
  const productionLikeResult = await firestore.collection('test_results').doc(productionLikeSessionId).get();
  const productionLikeAfterReplacement = await productionLikeSessionRef.get();
  const productionLikeResultAnswers = (productionLikeResult.get('answers') as Record<string, string> | undefined) ?? {};
  console.log('productionLike after replacement', {
    answersCount: productionLikeAfterReplacement.get('answersCount'),
    answerKeys: Object.keys((productionLikeAfterReplacement.get('answers') as Record<string, string>) ?? {}).length,
    status: productionLikeAfterReplacement.get('status'),
    currentQuestionIndex: productionLikeAfterReplacement.get('currentQuestionIndex'),
    questionIdsLength: (productionLikeAfterReplacement.get('questionIds') as string[] | undefined)?.length ?? null,
    testResultExists: productionLikeResult.exists,
  });
  assert.equal(productionLikeResult.exists, true);
  const productionLikeStoredSession = await productionLikeSessionRef.get();
  assert.equal(productionLikeStoredSession.get('status'), 'submitted');
  assert.equal(productionLikeStoredSession.get('answersCount'), 40);
  assert.equal(productionLikeStoredSession.get('currentQuestionIndex') < productionLikeStoredSession.get('questionIds').length, true);
  assert.equal(Object.keys((productionLikeStoredSession.get('answers') as Record<string, string>) ?? {}).length, 40);
  assert.equal(
    (productionLikeStoredSession.get('answers') as Record<string, string> | undefined)?.[productionLikeReplacementId] ?? null,
    productionLikeReplacementAnswer,
  );
  assert.equal(Object.keys(productionLikeResultAnswers).length, 40);
  assert.equal(productionLikeResultAnswers[productionLikeReplacementId] ?? null, productionLikeReplacementAnswer);
  assert.deepEqual(
    Object.fromEntries(Object.entries((productionLikeStoredSession.get('answers') as Record<string, string>) ?? {}).sort()),
    Object.fromEntries(Object.entries(productionLikeResultAnswers).sort()),
  );
  assert.equal(
    !(productionLikeStoredSession.get('status') === 'in_progress' && productionLikeStoredSession.get('currentQuestionIndex') >= productionLikeStoredSession.get('questionIds').length),
    true,
  );

  console.log('SevenO general sequential smoke test: productionLike OK', {
    sessionId: productionLikeSessionId,
    questionTimeoutId: productionLikeTimeoutQuestionId,
    replacementQuestionId: productionLikeReplacementId,
  });
  const productionLikeRetry = await submitSevenoTestSession(candidateUid, productionLikeSessionId, {
    sessionId: productionLikeSessionId,
    questionId: productionLikeReplacementId,
    answer: productionLikeReplacementAnswer,
    timeout: false,
  });
  assert.ok(productionLikeRetry);
  const productionLikeRetryResult = await firestore.collection('test_results').doc(productionLikeSessionId).get();
  const productionLikeRetrySession = await productionLikeSessionRef.get();
  assert.equal(productionLikeRetryResult.exists, true);
  assert.equal(productionLikeRetrySession.get('status'), 'submitted');
  assert.equal(productionLikeRetrySession.get('answersCount'), 40);
  assert.equal(Object.keys((productionLikeRetrySession.get('answers') as Record<string, string>) ?? {}).length, 40);
  assert.equal(
    (productionLikeRetrySession.get('answers') as Record<string, string> | undefined)?.[productionLikeReplacementId] ?? null,
    productionLikeReplacementAnswer,
  );

  const submittedSessionId = `submitted-${suffix}`;
  await firestore.collection('test_sessions').doc(submittedSessionId).set({
    uid: candidateUid,
    candidateUid,
    assessmentType: 'seveno_general',
    professionalAssessmentVersionId: activeVersion.id,
    attemptSeed: `submitted-${suffix}`,
    questionnaireVersion: activeVersion.version,
    questionBankCode: activeVersion.code,
    questionBankVersion: activeVersion.version,
    status: 'submitted',
    questionIds: productionLikeQuestionIds,
    currentQuestionIndex: 40,
    questionStartedAt: productionLikeNow,
    questionExpiresAt: null,
    questionTimeSeconds: 30,
    answers: Object.fromEntries(
      productionLikeQuestionIds.map((questionId, index) => [questionId, activeVersion.questions[index]?.options[0]?.id ?? `${questionId}-option-1`]),
    ),
    answersCount: 40,
    totalQuestions: 40,
    questionsPresentedCount: 40,
    timedOutQuestionIds: [],
    lastQuestionId: productionLikeQuestionIds[39],
    startedAt: productionLikeNow,
    updatedAt: productionLikeNow,
    expiresAt: Timestamp.fromMillis(productionLikeNow.toMillis() + 1200000),
  });
  await firestore.collection('test_results').doc(submittedSessionId).set({
    uid: candidateUid,
    candidateUid,
    sessionId: submittedSessionId,
    assessmentType: 'seveno_general',
    questionnaireVersion: activeVersion.version,
    questionnaireId: activeVersion.code,
    status: 'completed',
    questionBankCode: activeVersion.code,
    questionBankVersion: activeVersion.version,
    score: 100,
    overallScore: 100,
    scoresByDimension: {},
    professionalAssessmentVersionId: activeVersion.id,
    professionalAssessmentSchemaVersion: activeVersion.schemaVersion ?? 1,
    behavioralProfile: null,
    correctAnswers: 0,
    totalQuestions: 40,
    passed: true,
    threshold: 0,
    durationSeconds: 1200,
    answersCount: 40,
    questionsPresentedCount: 40,
    questionIds: productionLikeQuestionIds,
    timedOutQuestionIds: [],
    answers: Object.fromEntries(
      productionLikeQuestionIds.map((questionId, index) => [questionId, activeVersion.questions[index]?.options[0]?.id ?? `${questionId}-option-1`]),
    ),
    submittedAt: productionLikeNow,
    createdAt: productionLikeNow,
    verifiedAt: productionLikeNow,
  });
  const submittedRetry = await submitSevenoTestSession(candidateUid, submittedSessionId, {
    sessionId: submittedSessionId,
    questionId: productionLikeQuestionIds[39],
    answer: productionLikeQuestionIds[39] ? `${productionLikeQuestionIds[39]}-option-1` : '',
    timeout: false,
  });
  assert.ok(submittedRetry);
  const submittedRetryResult = await firestore.collection('test_results').doc(submittedSessionId).get();
  assert.equal(submittedRetryResult.exists, true);

  const candidateUidRestart = `candidate-restart-${suffix}`;
  await firestore.collection('users').doc(candidateUidRestart).set({
    uid: candidateUidRestart,
    role: 'candidate',
    authProvider: 'google',
    email: `${candidateUidRestart}@seveno.test`,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now,
  });

  const secondStart = await startSevenoTestSession(candidateUidRestart);
  assert.ok(secondStart);
  assert.notEqual(secondStart.attemptSeed, attemptSeed1);
  assert.equal(secondStart.currentQuestionIndex, 0);
  assert.equal(
    Date.parse(secondStart.questionExpiresAt ?? '') - Date.parse(secondStart.questionStartedAt),
    30000,
  );

  const oldSessionAfterRestart = await expiredSessionRef.get();
  assert.equal(oldSessionAfterRestart.get('status'), 'abandoned');

  resetSevenoProfessionalAssessmentRepository([
    { ...nextVersion, status: 'active' },
    { ...activeVersion, status: 'draft' },
  ]);
  const versionBStart = await startSevenoTestSession(candidateUidRestart);
  assert.ok(versionBStart);
  assert.equal(versionBStart.professionalAssessmentVersionId, nextVersion.id);

  console.log('SevenO general sequential smoke test: OK', {
    sessionId: secondStart.sessionId,
    attemptSeed: secondStart.attemptSeed,
    questionCount: secondStart.questions.length,
  });
}

await main();
