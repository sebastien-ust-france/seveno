import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import {
  getSevenoTestBankTemplateByCode,
  getSevenoGeneralAssessmentTemplate,
  materializeQuestionBank,
  SEVENO_TEST_DEFAULT_DURATION_SECONDS,
  SEVENO_TEST_DEFAULT_THRESHOLD,
  toPublicTestQuestions,
} from '@/lib/seveno-test-banks';
import type {
  CandidateProfile,
  QuestionBank,
  SevenoUser,
  TestQuestion,
  TestQuestionOption,
  TestResult,
  TestSession,
  TestSessionStartResult,
  TestSessionSubmitResult,
  SevenoAssessmentDimension,
  SevenoAssessmentPreparation,
  SevenoAssessmentScores,
} from '@/types/seveno';

type FirestoreRecord = Record<string, unknown>;

export class SevenoTestError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function requireAdminDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoTestError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour gerer les tests SevenO.',
    );
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function toPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function toPercent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.max(0, Math.min(100, Math.round(value)));
  return normalized;
}

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }

  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }

  return null;
}

function toMillis(value: unknown): number | null {
  const timestamp = toTimestamp(value);
  return timestamp ? timestamp.toMillis() : null;
}

function normalizeQuestionOption(value: unknown): TestQuestionOption | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = toTrimmedString(value.id);
  const label = toTrimmedString(value.label);
  if (!id || !label) {
    return null;
  }

  const option: TestQuestionOption = {
    id,
    label,
  };

  if (typeof value.order === 'number' && Number.isFinite(value.order)) {
    option.order = value.order;
  }
  if (typeof value.score === 'number' && Number.isFinite(value.score)) {
    option.score = value.score;
  }

  return option;
}

function normalizeQuestion(value: unknown): TestQuestion | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = toTrimmedString(value.id);
  const question = toTrimmedString(value.question);
  const correctOptionId = toTrimmedString(value.correctOptionId);
  const options = Array.isArray(value.options)
    ? value.options.map((option) => normalizeQuestionOption(option)).filter((option): option is TestQuestionOption => Boolean(option))
    : [];

  if (!id || !question || options.length < 2) {
    return null;
  }

  if (correctOptionId && !options.some((option) => option.id === correctOptionId)) {
    return null;
  }

  const normalizedType: TestQuestion['type'] =
    value.type === 'multi_choice' || value.type === 'boolean' || value.type === 'text' || value.type === 'numeric'
      ? value.type
      : 'single_choice';

  const normalized: TestQuestion = {
    id,
    question,
    options,
    type: normalizedType,
    ...(correctOptionId ? { correctOptionId } : {}),
  };

  if (
    value.dimension === 'collaboration'
    || value.dimension === 'adaptability'
    || value.dimension === 'autonomy'
    || value.dimension === 'problem_solving'
  ) {
    normalized.dimension = value.dimension;
  }

  if (value.difficulty === 'easy' || value.difficulty === 'medium' || value.difficulty === 'hard') {
    normalized.difficulty = value.difficulty;
  }

  if (Array.isArray(value.skillTags)) {
    const tags = value.skillTags
      .map((item) => toTrimmedString(item))
      .filter((item): item is string => Boolean(item));
    if (tags.length > 0) {
      normalized.skillTags = tags;
    }
  }

  const explanation = toTrimmedString(value.explanation);
  if (explanation) {
    normalized.explanation = explanation;
  }

  return normalized;
}

function normalizeQuestionBankRecord(docId: string, data: FirestoreRecord): QuestionBank | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const code = toTrimmedString(data.code) ?? docId;
  const label = toTrimmedString(data.label);
  const assessmentType = data.assessmentType === 'seveno_general' || data.assessmentType === 'company_application'
    ? data.assessmentType
    : 'legacy_job';
  const sectorCode = toTrimmedString(data.sectorCode);
  const familyCode = toTrimmedString(data.familyCode);
  const roleCode = toTrimmedString(data.roleCode);
  const version = toTrimmedString(data.version) ?? '1.0.0';
  const questions = Array.isArray(data.questions)
    ? data.questions.map((item) => normalizeQuestion(item)).filter((item): item is TestQuestion => Boolean(item))
    : [];

  if (
    !label
    || questions.length === 0
    || (assessmentType === 'legacy_job' && (!sectorCode || !familyCode || !roleCode))
  ) {
    return null;
  }

  return {
    code,
    label,
    description: toTrimmedString(data.description) ?? undefined,
    assessmentType,
    ...(sectorCode ? { sectorCode } : {}),
    ...(familyCode ? { familyCode } : {}),
    ...(roleCode ? { roleCode } : {}),
    version,
    isActive: data.isActive !== false,
    durationSeconds: toPositiveInteger(data.durationSeconds) ?? undefined,
    threshold: toPercent(data.threshold) ?? undefined,
    questions,
    createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
    updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
  };
}

async function loadSevenoGeneralQuestionBank(): Promise<QuestionBank> {
  const firestoreBanks = await loadFirestoreQuestionBanks();
  const activeBanks = firestoreBanks.filter(
    (bank) => bank.isActive && bank.assessmentType === 'seveno_general',
  );
  const selected = choosePreferredQuestionBank(activeBanks);
  return selected ?? materializeQuestionBank(getSevenoGeneralAssessmentTemplate());
}

function choosePreferredQuestionBank(banks: QuestionBank[]) {
  if (banks.length === 0) {
    return null;
  }

  return [...banks].sort((left, right) => {
    const rightScore = toMillis(right.updatedAt) ?? toMillis(right.createdAt) ?? 0;
    const leftScore = toMillis(left.updatedAt) ?? toMillis(left.createdAt) ?? 0;
    return rightScore - leftScore;
  })[0] ?? null;
}

async function loadFirestoreQuestionBanks() {
  const firestore = requireAdminDatabase();
  const snapshot = await firestore.collection('question_banks').get();
  return snapshot.docs
    .map((doc) => normalizeQuestionBankRecord(doc.id, doc.data() as FirestoreRecord))
    .filter((bank): bank is QuestionBank => Boolean(bank));
}

async function loadQuestionBankByCodeAndVersion(code: string, version: string): Promise<QuestionBank | null> {
  const firestoreBanks = await loadFirestoreQuestionBanks();
  const matchingBanks = firestoreBanks.filter((bank) => bank.code === code && bank.version === version);
  if (matchingBanks.length > 0) {
    return choosePreferredQuestionBank(matchingBanks);
  }

  const template = getSevenoTestBankTemplateByCode(code);
  if (!template) {
    return null;
  }

  const bank = materializeQuestionBank(template);
  return bank.version === version ? bank : null;
}

function assertQuestionBankMatchesJob(
  bank: QuestionBank,
  job: { sectorId?: string; jobFamilyId?: string; jobRoleId?: string },
) {
  if (
    bank.sectorCode !== job.sectorId
    || bank.familyCode !== job.jobFamilyId
    || bank.roleCode !== job.jobRoleId
  ) {
    throw new SevenoTestError(
      'question_bank_job_mismatch',
      409,
      'La banque de questions ne correspond pas au metier actuel du candidat.',
    );
  }
}

async function loadSevenoUser(uid: string): Promise<SevenoUser | null> {
  const firestore = requireAdminDatabase();
  const snapshot = await firestore.collection('users').doc(uid).get();
  return snapshot.exists ? (snapshot.data() as SevenoUser) : null;
}

async function loadCandidateResults(uid: string) {
  const firestore = requireAdminDatabase();
  const snapshot = await firestore.collection('test_results').where('uid', '==', uid).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data() as TestResult,
  }));
}

function buildStartResult(sessionId: string, session: TestSession, bank: QuestionBank): TestSessionStartResult {
  const durationSeconds = session.durationSeconds ?? bank.durationSeconds ?? SEVENO_TEST_DEFAULT_DURATION_SECONDS;
  const threshold = session.threshold ?? bank.threshold ?? SEVENO_TEST_DEFAULT_THRESHOLD;
  const expiresAt = toTimestamp(session.expiresAt);
  const startedAt = toTimestamp(session.startedAt);

  if (!expiresAt || !startedAt) {
    throw new SevenoTestError('invalid_session_timestamp', 500, 'La session de test contient une date dinvalidation.');
  }

  return {
    sessionId,
    questionBankCode: session.questionBankCode,
    durationSeconds,
    threshold,
    startedAt: startedAt.toDate().toISOString(),
    expiresAt: expiresAt.toDate().toISOString(),
    serverNow: Timestamp.now().toDate().toISOString(),
    questions: toPublicTestQuestions(bank.questions),
    totalQuestions: bank.questions.length,
  };
}

function buildSubmitResult(result: TestResult): TestSessionSubmitResult {
  const verifiedAt = toTimestamp(result.verifiedAt);
  if (!verifiedAt) {
    throw new SevenoTestError('invalid_result_timestamp', 500, 'Le resultat de test contient une date invalide.');
  }

  return {
    sessionId: result.sessionId,
    score: result.score,
    ...(typeof result.overallScore === 'number' ? { overallScore: result.overallScore } : {}),
    ...(result.scoresByDimension ? { scoresByDimension: result.scoresByDimension } : {}),
    correctAnswers: result.correctAnswers,
    totalQuestions: result.totalQuestions,
    passed: result.passed,
    threshold: result.threshold,
    durationSeconds: result.durationSeconds,
    verifiedAt: verifiedAt.toDate().toISOString(),
  };
}

function scoreSevenoGeneralAssessment(
  bank: QuestionBank,
  answers: Record<string, string>,
): { overallScore: number; scoresByDimension: SevenoAssessmentScores } {
  const valuesByDimension = new Map<SevenoAssessmentDimension, number[]>();

  for (const question of bank.questions) {
    if (!question.dimension) {
      throw new SevenoTestError('invalid_questionnaire', 500, "Une question Seven'O ne porte aucune dimension.");
    }

    const selectedOption = question.options.find((option) => option.id === answers[question.id]);
    if (!selectedOption || typeof selectedOption.score !== 'number') {
      throw new SevenoTestError(
        'assessment_incomplete',
        400,
        "Repondez a toutes les questions avant de terminer l'evaluation.",
      );
    }

    const values = valuesByDimension.get(question.dimension) ?? [];
    values.push(selectedOption.score);
    valuesByDimension.set(question.dimension, values);
  }

  const scoresByDimension: SevenoAssessmentScores = {};
  for (const [dimension, values] of valuesByDimension.entries()) {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    scoresByDimension[dimension] = Math.round(((average - 1) / 4) * 100);
  }

  const dimensionScores = Object.values(scoresByDimension);
  const overallScore = dimensionScores.length > 0
    ? Math.round(dimensionScores.reduce((sum, value) => sum + value, 0) / dimensionScores.length)
    : 0;

  return { overallScore, scoresByDimension };
}

async function submitSevenoGeneralAssessment(
  uid: string,
  sessionId: string,
  session: TestSession,
  bank: QuestionBank,
  answers: Record<string, string>,
): Promise<TestSessionSubmitResult> {
  const firestore = requireAdminDatabase();
  const sessionRef = firestore.collection('test_sessions').doc(sessionId);
  const resultRef = firestore.collection('test_results').doc(sessionId);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const summaryRef = firestore.collection('candidate_assessment_summaries').doc(uid);
  const attemptRef = firestore.collection(CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION).doc(uid);
  const questionIds = Array.isArray(session.questionIds) && session.questionIds.length > 0
    ? session.questionIds
    : getQuestionIds(bank);
  const durationSeconds = session.durationSeconds ?? bank.durationSeconds ?? SEVENO_TEST_DEFAULT_DURATION_SECONDS;

  const committedResult = await firestore.runTransaction(async (transaction): Promise<TestResult | null> => {
    const [currentSessionSnapshot, currentResultSnapshot, profileSnapshot, summarySnapshot, attemptSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(resultRef),
      transaction.get(profileRef),
      transaction.get(summaryRef),
      transaction.get(attemptRef),
    ]);
    if (!currentSessionSnapshot.exists) {
      throw new SevenoTestError('session_not_found', 404, 'Session de questionnaire introuvable.');
    }

    const currentSession = currentSessionSnapshot.data() as TestSession;
    if (
      currentSession.uid !== uid
      || currentSession.candidateUid !== uid
      || currentSession.assessmentType !== 'seveno_general'
    ) {
      throw new SevenoTestError('forbidden_session', 403, 'Cette session ne vous appartient pas.');
    }
    if (currentSession.status === 'submitted' && currentResultSnapshot.exists) {
      return currentResultSnapshot.data() as TestResult;
    }
    if (currentSession.status !== 'in_progress') {
      throw new SevenoTestError('session_not_active', 409, 'Cette session de questionnaire n est plus active.');
    }
    const currentExpiresAt = toTimestamp(currentSession.expiresAt);
    const transactionNow = Timestamp.now();
    if (!currentExpiresAt || currentExpiresAt.toMillis() <= transactionNow.toMillis()) {
      transaction.update(sessionRef, {
        status: 'expired',
        expiredAt: transactionNow,
        updatedAt: transactionNow,
      });
      if (attemptSnapshot.exists && attemptSnapshot.get('activeSessionId') === sessionId) {
        transaction.set(attemptRef, {
          activeSessionId: null,
          status: 'expired',
          updatedAt: transactionNow,
        }, { merge: true });
      }
      if (profileSnapshot.exists && !summarySnapshot.exists && profileSnapshot.get('sevenoAssessmentStatus') === 'in_progress') {
        transaction.update(profileRef, {
          sevenoAssessmentStatus: 'not_started',
          updatedAt: transactionNow,
        });
      }
      return null;
    }
    if (attemptSnapshot.exists && attemptSnapshot.get('activeSessionId') !== sessionId) {
      throw new SevenoTestError('session_not_active', 409, 'Cette tentative n est plus la tentative active.');
    }
    if (
      currentSession.questionBankCode !== bank.code
      || currentSession.questionBankVersion !== bank.version
      || currentSession.questionnaireVersion !== bank.version
    ) {
      throw new SevenoTestError('session_integrity_mismatch', 409, 'La version du questionnaire a change.');
    }

    const { overallScore, scoresByDimension } = scoreSevenoGeneralAssessment(bank, answers);
    const completedAt = transactionNow;
    const resultData: TestResult = {
      uid,
      candidateUid: uid,
      ...(profileSnapshot.exists ? { publicCandidateId: profileSnapshot.get('publicCandidateId'), candidateProfileId: uid } : {}),
      sessionId,
      assessmentType: 'seveno_general',
      questionnaireVersion: bank.version,
      questionnaireId: bank.code,
      status: 'completed',
      questionBankCode: bank.code,
      questionBankVersion: bank.version,
      score: overallScore,
      overallScore,
      scoresByDimension,
      correctAnswers: 0,
      totalQuestions: questionIds.length,
      passed: true,
      threshold: 0,
      durationSeconds,
      answersCount: Object.keys(answers).length,
      questionIds,
      answers,
      submittedAt: completedAt,
      createdAt: completedAt,
      verifiedAt: completedAt,
    };

    transaction.create(resultRef, resultData);
    transaction.update(sessionRef, {
      status: 'submitted',
      score: overallScore,
      totalQuestions: questionIds.length,
      passed: true,
      answersCount: Object.keys(answers).length,
      submittedAt: completedAt,
      updatedAt: completedAt,
    });
    transaction.set(summaryRef, {
      candidateUid: uid,
      assessmentType: 'seveno_general',
      status: 'completed',
      overallScore,
      scoresByDimension,
      questionnaireVersion: bank.version,
      sessionId,
      resultId: resultRef.id,
      completedAt,
      updatedAt: completedAt,
    });
    transaction.set(attemptRef, {
      activeSessionId: null,
      status: 'submitted',
      updatedAt: completedAt,
    }, { merge: true });
    if (profileSnapshot.exists) {
      transaction.update(profileRef, {
        sevenoAssessmentStatus: 'completed',
        sevenoAssessmentOverallScore: overallScore,
        sevenoAssessmentDimensions: scoresByDimension,
        sevenoAssessmentVersion: bank.version,
        sevenoAssessmentCompletedAt: completedAt,
        sevenoAssessmentSessionId: sessionId,
        sevenoAssessmentResultId: resultRef.id,
        updatedAt: completedAt,
      });
    }

    return resultData;
  });

  if (!committedResult) {
    throw new SevenoTestError(
      'session_expired',
      409,
      'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
    );
  }

  return buildSubmitResult(committedResult);
}

function normalizeSubmittedAnswers(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) {
    return {};
  }

  const answers: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const trimmed = toTrimmedString(rawValue);
    if (trimmed) {
      answers[key] = trimmed;
    }
  }

  return answers;
}

function getQuestionIds(bank: QuestionBank) {
  return bank.questions.map((question) => question.id);
}

function getCorrectAnswerCount(questionIds: string[], bank: QuestionBank, answers: Record<string, string>) {
  const questionLookup = new Map(bank.questions.map((question) => [question.id, question]));
  let correctAnswers = 0;

  for (const questionId of questionIds) {
    const question = questionLookup.get(questionId);
    if (!question) {
      continue;
    }

    if (answers[questionId] === question.correctOptionId) {
      correctAnswers += 1;
    }
  }

  return correctAnswers;
}

const CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION = 'candidate_assessment_attempts';

async function assertCandidateCanUseAssessment(uid: string) {
  const user = await loadSevenoUser(uid);
  if (!user) {
    throw new SevenoTestError('user_not_found', 404, 'Utilisateur introuvable.');
  }
  if (user.role !== 'candidate') {
    throw new SevenoTestError('forbidden_role', 403, 'Seuls les candidats peuvent lancer ce questionnaire.');
  }
}

export async function prepareSevenoAssessment(uid: string): Promise<{
  preparation: SevenoAssessmentPreparation;
  assessment: Awaited<ReturnType<typeof getSevenoAssessmentSummary>>;
}> {
  await assertCandidateCanUseAssessment(uid);
  const firestore = requireAdminDatabase();
  const sessionsQuery = firestore.collection('test_sessions').where('uid', '==', uid);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const summaryRef = firestore.collection('candidate_assessment_summaries').doc(uid);
  const attemptRef = firestore.collection(CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION).doc(uid);

  await firestore.runTransaction(async (transaction) => {
    const [sessionsSnapshot, profileSnapshot, summarySnapshot, attemptSnapshot] = await Promise.all([
      transaction.get(sessionsQuery),
      transaction.get(profileRef),
      transaction.get(summaryRef),
      transaction.get(attemptRef),
    ]);
    const now = Timestamp.now();
    let closedSession = false;

    for (const document of sessionsSnapshot.docs) {
      const session = document.data() as TestSession;
      if (session.assessmentType !== 'seveno_general' || session.status !== 'in_progress') continue;
      const expiresAt = toTimestamp(session.expiresAt);
      const status: TestSession['status'] = expiresAt && expiresAt.toMillis() <= now.toMillis()
        ? 'expired'
        : 'abandoned';
      transaction.update(document.ref, {
        status,
        ...(status === 'expired' ? { expiredAt: now } : { abandonedAt: now }),
        updatedAt: now,
      });
      closedSession = true;
    }

    if (closedSession || (attemptSnapshot.exists && attemptSnapshot.get('status') === 'active')) {
      transaction.set(attemptRef, {
        uid,
        activeSessionId: null,
        status: 'closed',
        updatedAt: now,
      }, { merge: true });
      if (profileSnapshot.exists && !summarySnapshot.exists && profileSnapshot.get('sevenoAssessmentStatus') === 'in_progress') {
        transaction.update(profileRef, {
          sevenoAssessmentStatus: 'not_started',
          updatedAt: now,
        });
      }
    }
  });

  const bank = await loadSevenoGeneralQuestionBank();
  return {
    preparation: {
      questionBankCode: bank.code,
      questionnaireVersion: bank.version,
      durationSeconds: bank.durationSeconds ?? SEVENO_TEST_DEFAULT_DURATION_SECONDS,
      totalQuestions: bank.questions.length,
    },
    assessment: await getSevenoAssessmentSummary(uid),
  };
}

export async function startSevenoTestSession(uid: string): Promise<TestSessionStartResult> {
  const firestore = requireAdminDatabase();
  await assertCandidateCanUseAssessment(uid);
  const bank = await loadSevenoGeneralQuestionBank();
  const sessionId = firestore.collection('test_sessions').doc().id;
  const sessionRef = firestore.collection('test_sessions').doc(sessionId);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const summaryRef = firestore.collection('candidate_assessment_summaries').doc(uid);
  const attemptRef = firestore.collection(CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION).doc(uid);
  const sessionsQuery = firestore.collection('test_sessions').where('uid', '==', uid);

  const sessionData = await firestore.runTransaction(async (transaction) => {
    const [sessionsSnapshot, profileSnapshot, summarySnapshot] = await Promise.all([
      transaction.get(sessionsQuery),
      transaction.get(profileRef),
      transaction.get(summaryRef),
    ]);
    await transaction.get(attemptRef);
    const now = Timestamp.now();

    const assessmentAlreadyCompleted =
      (summarySnapshot.exists && summarySnapshot.get('status') === 'completed')
      || (
        profileSnapshot.exists
        && profileSnapshot.get('sevenoAssessmentStatus') === 'completed'
        && Boolean(profileSnapshot.get('sevenoAssessmentResultId'))
        && Boolean(profileSnapshot.get('sevenoAssessmentSessionId'))
      );
    if (assessmentAlreadyCompleted) {
      throw new SevenoTestError(
        'assessment_already_completed',
        409,
        'Vous avez deja termine ce questionnaire. Il ne peut etre lance qu une seule fois.',
      );
    }

    const activeSessions = sessionsSnapshot.docs.filter((document) => {
      const session = document.data() as TestSession;
      if (session.assessmentType !== 'seveno_general' || session.status !== 'in_progress') return false;
      const expiresAt = toTimestamp(session.expiresAt);
      return !expiresAt || expiresAt.toMillis() > now.toMillis();
    });

    if (activeSessions.length > 0) {
      throw new SevenoTestError(
        'assessment_already_active',
        409,
        'Une tentative est deja active. Fermez les autres onglets puis revenez sur cette page pour recommencer.',
      );
    }

    for (const document of sessionsSnapshot.docs) {
      const session = document.data() as TestSession;
      if (session.assessmentType === 'seveno_general' && session.status === 'in_progress') {
        transaction.update(document.ref, { status: 'expired', expiredAt: now, updatedAt: now });
      }
    }

    const durationSeconds = bank.durationSeconds ?? SEVENO_TEST_DEFAULT_DURATION_SECONDS;
    const expiresAt = Timestamp.fromMillis(now.toMillis() + durationSeconds * 1000);
    const nextSession: TestSession = {
      uid,
      candidateUid: uid,
      ...(profileSnapshot.exists && profileSnapshot.get('publicCandidateId')
        ? { publicCandidateId: profileSnapshot.get('publicCandidateId') as string, candidateProfileId: uid }
        : {}),
      assessmentType: 'seveno_general',
      questionnaireVersion: bank.version,
      questionBankCode: bank.code,
      questionBankVersion: bank.version,
      status: 'in_progress',
      questionIds: getQuestionIds(bank),
      answersCount: 0,
      durationSeconds,
      threshold: bank.threshold ?? SEVENO_TEST_DEFAULT_THRESHOLD,
      startedAt: now,
      submittedAt: null,
      expiresAt,
      expiredAt: null,
      abandonedAt: null,
      cancelledAt: null,
      lastQuestionId: null,
      answers: {},
      createdAt: now,
      updatedAt: now,
    };

    transaction.create(sessionRef, nextSession);
    transaction.set(attemptRef, {
      uid,
      activeSessionId: sessionId,
      status: 'active',
      startedAt: now,
      expiresAt,
      updatedAt: now,
    });
    if (profileSnapshot.exists && !summarySnapshot.exists) {
      transaction.update(profileRef, { sevenoAssessmentStatus: 'in_progress', updatedAt: now });
    }

    return nextSession;
  });

  return buildStartResult(sessionId, sessionData, bank);
}

export async function abandonSevenoTestSession(uid: string, sessionId: string) {
  const firestore = requireAdminDatabase();
  const sessionRef = firestore.collection('test_sessions').doc(sessionId);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const summaryRef = firestore.collection('candidate_assessment_summaries').doc(uid);
  const attemptRef = firestore.collection(CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION).doc(uid);

  return firestore.runTransaction(async (transaction) => {
    const [sessionSnapshot, profileSnapshot, summarySnapshot, attemptSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(profileRef),
      transaction.get(summaryRef),
      transaction.get(attemptRef),
    ]);
    if (!sessionSnapshot.exists) {
      throw new SevenoTestError('session_not_found', 404, 'Session de questionnaire introuvable.');
    }

    const session = sessionSnapshot.data() as TestSession;
    if (session.uid !== uid || session.assessmentType !== 'seveno_general') {
      throw new SevenoTestError('forbidden_session', 403, 'Cette session ne vous appartient pas.');
    }
    if (session.status !== 'in_progress') return { status: session.status };

    const now = Timestamp.now();
    const expiresAt = toTimestamp(session.expiresAt);
    const status: TestSession['status'] = expiresAt && expiresAt.toMillis() <= now.toMillis()
      ? 'expired'
      : 'abandoned';
    transaction.update(sessionRef, {
      status,
      ...(status === 'expired' ? { expiredAt: now } : { abandonedAt: now }),
      updatedAt: now,
    });
    if (attemptSnapshot.exists && attemptSnapshot.get('activeSessionId') === sessionId) {
      transaction.set(attemptRef, { activeSessionId: null, status, updatedAt: now }, { merge: true });
    }
    if (profileSnapshot.exists && !summarySnapshot.exists && profileSnapshot.get('sevenoAssessmentStatus') === 'in_progress') {
      transaction.update(profileRef, { sevenoAssessmentStatus: 'not_started', updatedAt: now });
    }

    return { status };
  });
}

async function loadExistingResultForSession(sessionId: string) {
  const firestore = requireAdminDatabase();
  const snapshot = await firestore.collection('test_results').doc(sessionId).get();
  return snapshot.exists ? (snapshot.data() as TestResult) : null;
}

export async function submitSevenoTestSession(
  uid: string,
  sessionId: string,
  rawAnswers: unknown,
): Promise<TestSessionSubmitResult> {
  const firestore = requireAdminDatabase();
  const sessionRef = firestore.collection('test_sessions').doc(sessionId);
  const resultRef = firestore.collection('test_results').doc(sessionId);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const sessionSnapshot = await sessionRef.get();
  if (!sessionSnapshot.exists) {
    throw new SevenoTestError('session_not_found', 404, 'Session de test introuvable.');
  }

  const session = sessionSnapshot.data() as TestSession;
  if (session.uid !== uid) {
    throw new SevenoTestError('forbidden_session', 403, 'Cette session ne vous appartient pas.');
  }

  const existingResult = await loadExistingResultForSession(sessionId);
  if (session.status === 'submitted' && existingResult) {
    return buildSubmitResult(existingResult);
  }

  if (session.status !== 'in_progress') {
    throw new SevenoTestError('session_not_active', 409, 'Cette session de test n est plus active.');
  }

  const now = Timestamp.now();
  const expiresAt = toTimestamp(session.expiresAt);
  if (expiresAt && expiresAt.toMillis() <= now.toMillis()) {
    if (session.assessmentType === 'seveno_general') {
      await abandonSevenoTestSession(uid, sessionId);
      throw new SevenoTestError(
        'session_expired',
        409,
        'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
      );
    }
    await sessionRef.update({
      status: 'expired',
      updatedAt: now,
    });
    throw new SevenoTestError('session_expired', 409, 'La session de test a expire.');
  }

  const questionBankVersion = typeof session.questionBankVersion === 'string'
    ? session.questionBankVersion.trim()
    : '';
  if (!questionBankVersion) {
    throw new SevenoTestError(
      'legacy_session_requires_restart',
      409,
      'Cette ancienne session ne peut pas prouver la version du test. Lancez un nouveau test.',
    );
  }

  const bank = await loadQuestionBankByCodeAndVersion(session.questionBankCode, questionBankVersion);
  if (!bank) {
    throw new SevenoTestError('question_bank_missing', 404, 'La banque de questions est indisponible.');
  }

  const answers = normalizeSubmittedAnswers(rawAnswers);
  if (session.assessmentType === 'seveno_general') {
    if (bank.assessmentType !== 'seveno_general') {
      throw new SevenoTestError('question_bank_type_mismatch', 409, 'La banque ne correspond pas au questionnaire SevenO.');
    }
    return submitSevenoGeneralAssessment(uid, sessionId, session, bank, answers);
  }

  assertQuestionBankMatchesJob(bank, session);

  const questionIds = Array.isArray(session.questionIds) && session.questionIds.length > 0 ? session.questionIds : getQuestionIds(bank);
  const totalQuestions = questionIds.length > 0 ? questionIds.length : bank.questions.length;
  const correctAnswers = getCorrectAnswerCount(questionIds, bank, answers);
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const threshold = session.threshold ?? bank.threshold ?? SEVENO_TEST_DEFAULT_THRESHOLD;
  const durationSeconds = session.durationSeconds ?? bank.durationSeconds ?? SEVENO_TEST_DEFAULT_DURATION_SECONDS;
  const passed = score >= threshold;
  const verifiedAt = Timestamp.now();

  const committedResult = await firestore.runTransaction(async (transaction) => {
    const currentSessionSnapshot = await transaction.get(sessionRef);
    if (!currentSessionSnapshot.exists) {
      throw new SevenoTestError('session_not_found', 404, 'Session de test introuvable.');
    }

    const currentSession = currentSessionSnapshot.data() as TestSession;
    if (currentSession.uid !== uid || currentSession.candidateProfileId !== uid) {
      throw new SevenoTestError('forbidden_session', 403, 'Cette session ne vous appartient pas.');
    }

    const currentResultSnapshot = await transaction.get(resultRef);
    if (currentSession.status === 'submitted' && currentResultSnapshot.exists) {
      const currentResult = currentResultSnapshot.data() as TestResult;
      if (currentResult.uid !== uid || currentResult.sessionId !== sessionId) {
        throw new SevenoTestError('result_session_mismatch', 409, 'Le resultat existant est incoherent.');
      }
      return currentResult;
    }

    if (currentSession.status !== 'in_progress') {
      throw new SevenoTestError('session_not_active', 409, 'Cette session de test n est plus active.');
    }

    const currentExpiresAt = toTimestamp(currentSession.expiresAt);
    if (currentExpiresAt && currentExpiresAt.toMillis() <= Timestamp.now().toMillis()) {
      throw new SevenoTestError('session_expired', 409, 'La session de test a expire.');
    }

    if (
      currentSession.publicCandidateId !== session.publicCandidateId
      || currentSession.sectorId !== session.sectorId
      || currentSession.jobFamilyId !== session.jobFamilyId
      || currentSession.jobRoleId !== session.jobRoleId
      || currentSession.questionBankCode !== bank.code
      || currentSession.questionBankVersion !== bank.version
    ) {
      throw new SevenoTestError('session_integrity_mismatch', 409, 'La session de test a change pendant la correction.');
    }

    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists) {
      throw new SevenoTestError('candidate_profile_missing', 404, 'Profil candidat introuvable.');
    }

    const currentProfile = profileSnapshot.data() as CandidateProfile;
    if (
      currentProfile.uid !== uid
      || currentProfile.publicCandidateId !== currentSession.publicCandidateId
      || currentProfile.sectorId !== currentSession.sectorId
      || currentProfile.jobFamilyId !== currentSession.jobFamilyId
      || currentProfile.jobRoleId !== currentSession.jobRoleId
    ) {
      throw new SevenoTestError(
        'candidate_job_changed',
        409,
        'Le metier du candidat a change. Un nouveau test correspondant au profil actuel est requis.',
      );
    }

    const resultData: TestResult = {
      uid,
      publicCandidateId: currentSession.publicCandidateId,
      sessionId,
      candidateProfileId: currentSession.candidateProfileId,
      sectorId: currentSession.sectorId,
      jobFamilyId: currentSession.jobFamilyId,
      jobRoleId: currentSession.jobRoleId,
      questionBankCode: bank.code,
      questionBankVersion: bank.version,
      score,
      correctAnswers,
      totalQuestions,
      passed,
      threshold,
      durationSeconds,
      answersCount: Object.keys(answers).length,
      questionIds,
      submittedAt: verifiedAt,
      createdAt: verifiedAt,
      verifiedAt,
    };

    transaction.create(resultRef, resultData);
    transaction.update(sessionRef, {
      status: 'submitted',
      score,
      correctAnswers,
      totalQuestions,
      passed,
      answersCount: Object.keys(answers).length,
      submittedAt: verifiedAt,
      updatedAt: verifiedAt,
    });
    transaction.update(profileRef, {
      verifiedScore: score,
      testPassed: passed,
      lastTestAt: verifiedAt,
      verifiedTestResultId: resultRef.id,
      verifiedTestSessionId: sessionRef.id,
      verifiedJobRoleId: currentSession.jobRoleId,
      verifiedQuestionBankCode: bank.code,
      verifiedQuestionBankVersion: bank.version,
      updatedAt: verifiedAt,
    });

    return resultData;
  });

  return buildSubmitResult(committedResult);
}

export async function getCandidateLatestTestResult(uid: string): Promise<TestResult | null> {
  const results = await loadCandidateResults(uid);
  if (results.length === 0) {
    return null;
  }

  return (
    results
      .sort((left, right) => {
        const rightScore = toMillis(right.data.verifiedAt) ?? toMillis(right.data.createdAt) ?? 0;
        const leftScore = toMillis(left.data.verifiedAt) ?? toMillis(left.data.createdAt) ?? 0;
        return rightScore - leftScore;
      })[0]?.data ?? null
  );
}

export async function getSevenoAssessmentSummary(uid: string) {
  const snapshot = await requireAdminDatabase().collection('candidate_assessment_summaries').doc(uid).get();
  if (!snapshot.exists || snapshot.get('candidateUid') !== uid || snapshot.get('status') !== 'completed') {
    return null;
  }

  const completedAt = toTimestamp(snapshot.get('completedAt'));
  const overallScore = snapshot.get('overallScore');
  const scoresByDimension = snapshot.get('scoresByDimension');
  if (
    !completedAt
    || typeof overallScore !== 'number'
    || !Number.isFinite(overallScore)
    || !isPlainObject(scoresByDimension)
  ) {
    return null;
  }

  return {
    status: 'completed' as const,
    overallScore,
    scoresByDimension: scoresByDimension as SevenoAssessmentScores,
    questionnaireVersion: toTrimmedString(snapshot.get('questionnaireVersion')) ?? '',
    completedAt: completedAt.toDate().toISOString(),
  };
}
