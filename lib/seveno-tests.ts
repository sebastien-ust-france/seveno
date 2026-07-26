import 'server-only';

import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { buildPreviewBankDocumentFromVersion } from '@/lib/seveno-professional-assessment-admin-server';
import { getSevenoProfessionalAssessmentRepository } from '@/lib/seveno-professional-assessment-admin-repository';
import { calculateProfessionalAssessmentOutcome } from '@/lib/seveno-professional-assessment';
import { buildSevenoProfessionalAssessmentBankDraw } from '@/lib/seveno-professional-assessment-bank';
import {
  getSevenoTestBankTemplateByCode,
  getSevenoGeneralAssessmentTemplate,
  materializeQuestionBank,
  SEVENO_TEST_DEFAULT_DURATION_SECONDS,
  SEVENO_TEST_DEFAULT_THRESHOLD,
  toPublicTestQuestions,
} from '@/lib/seveno-test-banks';
import type {
  AssessmentBehaviorAxisCode,
  AssessmentBehaviorModel,
  AssessmentBehaviorQuestionType,
  AssessmentBehaviorSignalValue,
  AssessmentSignalReliability,
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
  SevenoTestStartState,
  SevenoAssessmentScores,
} from '@/types/seveno';
import type {
  AssessmentQuestion as ProfessionalAssessmentQuestion,
  AssessmentResponse as ProfessionalAssessmentResponse,
  AssessmentVersionDescriptor,
} from '@/types/seveno-assessment';
import type { SevenoAssessmentStoredVersion } from '@/types/seveno-assessment-admin';

type FirestoreRecord = Record<string, unknown>;
const LEGACY_SEVENO_GENERAL_BANK_TEMPLATE = getSevenoGeneralAssessmentTemplate();
const LEGACY_SEVENO_GENERAL_BANK_CODE = LEGACY_SEVENO_GENERAL_BANK_TEMPLATE.code;
const LEGACY_SEVENO_GENERAL_BANK_DURATION_SECONDS =
  LEGACY_SEVENO_GENERAL_BANK_TEMPLATE.durationSeconds ?? SEVENO_TEST_DEFAULT_DURATION_SECONDS;
const LEGACY_SEVENO_GENERAL_BANK_THRESHOLD =
  LEGACY_SEVENO_GENERAL_BANK_TEMPLATE.threshold ?? SEVENO_TEST_DEFAULT_THRESHOLD;
const SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS = 25;

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

  if (typeof value === 'string') {
    const parsed = new Date(value.trim());
    return Number.isNaN(parsed.getTime()) ? null : Timestamp.fromDate(parsed);
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

function isLegacySevenoGeneralBank(bank: QuestionBank) {
  return bank.code === LEGACY_SEVENO_GENERAL_BANK_CODE;
}

function getProfessionalAssessmentDrawSeed(
  version: SevenoAssessmentStoredVersion,
  attemptSeed?: string | null,
) {
  const normalizedAttemptSeed = typeof attemptSeed === 'string' ? attemptSeed.trim() : '';
  const baseSeed = `${version.code}:${version.version}:${version.revisionNumber}:${version.id}`;
  return normalizedAttemptSeed ? `${baseSeed}:${normalizedAttemptSeed}` : baseSeed;
}

function toProfessionalAssessmentVersionDescriptor(
  version: SevenoAssessmentStoredVersion,
): AssessmentVersionDescriptor {
  return {
    ...version,
    createdAt: toTimestamp(version.createdAt) ?? Timestamp.now(),
    updatedAt: toTimestamp(version.updatedAt) ?? Timestamp.now(),
    publishedAt: version.publishedAt ? toTimestamp(version.publishedAt) : null,
    archivedAt: version.archivedAt ? toTimestamp(version.archivedAt) : null,
    activatedAt: version.activatedAt ? toTimestamp(version.activatedAt) : null,
  };
}

function toCandidateQuestionDifficulty(value: ProfessionalAssessmentQuestion['difficulty']): TestQuestion['difficulty'] {
  if (value === 'standard') {
    return 'medium';
  }

  if (value === 'advanced') {
    return 'hard';
  }

  return 'easy';
}

function toCandidateQuestionText(question: ProfessionalAssessmentQuestion) {
  return [question.situation, question.instruction]
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join(' ');
}

function normalizeBehaviorSignals(value: unknown): Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const behaviorSignals: Partial<Record<AssessmentBehaviorAxisCode, AssessmentBehaviorSignalValue>> = {};
  for (const [axisCode, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawValue === 'number' && Number.isInteger(rawValue) && rawValue >= -2 && rawValue <= 2) {
      behaviorSignals[axisCode as AssessmentBehaviorAxisCode] = rawValue as AssessmentBehaviorSignalValue;
    }
  }

  return behaviorSignals;
}

function normalizeBehaviorModel(value: unknown): AssessmentBehaviorModel | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  if (typeof source.primaryAxisCode !== 'string' || typeof source.signalReliability !== 'string') {
    return undefined;
  }

  if (!source.context || typeof source.context !== 'object' || Array.isArray(source.context)) {
    return undefined;
  }

  const secondaryAxisCodes = Array.isArray(source.secondaryAxisCodes)
    ? source.secondaryAxisCodes.filter((item): item is AssessmentBehaviorAxisCode => typeof item === 'string')
    : [];

  return {
    primaryAxisCode: source.primaryAxisCode as AssessmentBehaviorAxisCode,
    secondaryAxisCodes,
    signalReliability: source.signalReliability as AssessmentSignalReliability,
    context: source.context as AssessmentBehaviorModel['context'],
  };
}

function toCandidateQuestion(question: ProfessionalAssessmentQuestion): TestQuestion {
  return {
    id: question.id,
    question: toCandidateQuestionText(question),
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      order: option.position,
      ...(option.behaviorSignals ? { behaviorSignals: { ...option.behaviorSignals } } : {}),
    })),
    type: 'single_choice',
    difficulty: toCandidateQuestionDifficulty(question.difficulty),
    ...(question.questionType ? { questionType: question.questionType as AssessmentBehaviorQuestionType } : {}),
    ...(question.signalReliability ? { signalReliability: question.signalReliability as AssessmentSignalReliability } : {}),
    ...(question.behaviorModel ? { behaviorModel: { ...question.behaviorModel, secondaryAxisCodes: [...question.behaviorModel.secondaryAxisCodes], context: { ...question.behaviorModel.context } } } : {}),
  };
}

function getProfessionalAssessmentQuestionIds(version: SevenoAssessmentStoredVersion, attemptSeed?: string | null) {
  const bankDocument = buildPreviewBankDocumentFromVersion(version);
  const seed = getProfessionalAssessmentDrawSeed(version, attemptSeed);
  const draw = buildSevenoProfessionalAssessmentBankDraw(bankDocument, seed);
  return [...draw.essentialQuestionIds, ...draw.extendedQuestionIds];
}

function getProfessionalAssessmentQuestions(
  version: SevenoAssessmentStoredVersion,
  questionIds?: string[] | null,
) {
  const selectedIds = Array.isArray(questionIds) && questionIds.length > 0
    ? questionIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : getProfessionalAssessmentQuestionIds(version);

  const questionLookup = new Map(version.questions.map((question) => [question.id, question] as const));
  const selectedQuestions = selectedIds
    .map((questionId) => questionLookup.get(questionId))
    .filter((question): question is ProfessionalAssessmentQuestion => {
      if (!question) {
        return false;
      }
      return question.isActive !== false;
    });

  if (selectedQuestions.length !== selectedIds.length) {
    return null;
  }

  return selectedQuestions;
}

function buildProfessionalAssessmentQuestionBank(
  version: SevenoAssessmentStoredVersion,
  questionIds?: string[] | null,
  attemptSeed?: string | null,
): QuestionBank | null {
  const questions = getProfessionalAssessmentQuestions(version, questionIds ?? getProfessionalAssessmentQuestionIds(version, attemptSeed));
  if (!questions) {
    return null;
  }

  return {
    code: version.code,
    label: version.name,
    description: version.description,
    assessmentType: 'seveno_general',
    version: version.version,
    schemaVersion: version.schemaVersion ?? 1,
    isActive: version.status === 'active',
    durationSeconds: Math.max(1, questions.length) * SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS,
    threshold: LEGACY_SEVENO_GENERAL_BANK_THRESHOLD,
    questions: questions.map((question) => toCandidateQuestion(question)),
    createdAt: toTimestamp(version.createdAt) ?? Timestamp.now(),
    updatedAt: toTimestamp(version.updatedAt) ?? Timestamp.now(),
  };
}

async function loadActiveProfessionalAssessmentVersion(): Promise<SevenoAssessmentStoredVersion | null> {
  const repository = getSevenoProfessionalAssessmentRepository();
  const versions = await repository.listVersions();
  return versions.find((version) => version.status === 'active') ?? null;
}

async function loadProfessionalAssessmentVersionByCodeAndVersion(
  code: string,
  version: string,
): Promise<SevenoAssessmentStoredVersion | null> {
  const repository = getSevenoProfessionalAssessmentRepository();
  const versions = await repository.listVersions();
  return versions.find((item) => item.code === code && item.version === version) ?? null;
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

  const behaviorSignals = normalizeBehaviorSignals(value.behaviorSignals);
  if (behaviorSignals) {
    option.behaviorSignals = behaviorSignals;
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

  if (typeof value.questionType === 'string') {
    normalized.questionType = value.questionType as AssessmentBehaviorQuestionType;
  }

  if (value.signalReliability === 'high' || value.signalReliability === 'medium' || value.signalReliability === 'low' || value.signalReliability === 'descriptive') {
    normalized.signalReliability = value.signalReliability;
  }

  const behaviorModel = normalizeBehaviorModel(value.behaviorModel);
  if (behaviorModel) {
    normalized.behaviorModel = behaviorModel;
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
    schemaVersion: typeof data.schemaVersion === 'number' && data.schemaVersion > 0 ? data.schemaVersion : undefined,
    isActive: data.isActive !== false,
    durationSeconds: toPositiveInteger(data.durationSeconds) ?? undefined,
    threshold: toPercent(data.threshold) ?? undefined,
    questions,
    createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
    updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
  };
}

async function loadSevenoGeneralQuestionBank(
  attemptSeed?: string | null,
  questionIds?: string[] | null,
): Promise<QuestionBank> {
  const activeProfessionalVersion = await loadActiveProfessionalAssessmentVersion();
  if (activeProfessionalVersion) {
    const professionalBank = buildProfessionalAssessmentQuestionBank(activeProfessionalVersion, questionIds, attemptSeed);
    if (professionalBank) {
      return professionalBank;
    }
  }

  return materializeQuestionBank(LEGACY_SEVENO_GENERAL_BANK_TEMPLATE);
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

async function loadQuestionBankByCodeAndVersion(
  code: string,
  version: string,
  questionIds?: string[] | null,
): Promise<QuestionBank | null> {
  const professionalVersion = await loadProfessionalAssessmentVersionByCodeAndVersion(code, version);
  if (professionalVersion) {
    return buildProfessionalAssessmentQuestionBank(professionalVersion, questionIds);
  }

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
  const questionStartedAt = toTimestamp(session.questionStartedAt) ?? startedAt;
  const questionExpiresAt = toTimestamp(session.questionExpiresAt);
  const currentQuestionIndex = typeof session.currentQuestionIndex === 'number' && Number.isFinite(session.currentQuestionIndex)
    ? Math.max(0, session.currentQuestionIndex)
    : 0;
  const questionTimeSeconds = typeof session.questionTimeSeconds === 'number' && Number.isFinite(session.questionTimeSeconds) && session.questionTimeSeconds > 0
    ? session.questionTimeSeconds
    : SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS;

  if (!expiresAt || !startedAt) {
    throw new SevenoTestError('invalid_session_timestamp', 500, 'La session de test contient une date dinvalidation.');
  }

  const normalizedQuestionStartedAt = questionStartedAt ?? startedAt;

  return {
    sessionId,
    professionalAssessmentVersionId: session.professionalAssessmentVersionId ?? null,
    attemptSeed: session.attemptSeed ?? null,
    questionBankCode: session.questionBankCode,
    durationSeconds,
    threshold,
    startedAt: startedAt.toDate().toISOString(),
    expiresAt: expiresAt.toDate().toISOString(),
    serverNow: Timestamp.now().toDate().toISOString(),
    currentQuestionIndex,
    questionStartedAt: normalizedQuestionStartedAt.toDate().toISOString(),
    questionExpiresAt: questionExpiresAt ? questionExpiresAt.toDate().toISOString() : null,
    questionTimeSeconds,
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
      throw new SevenoTestError('invalid_questionnaire', 500, "Une question Seven’O ne porte aucune dimension.");
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
      professionalAssessmentVersionId: session.professionalAssessmentVersionId ?? null,
      attemptSeed: session.attemptSeed ?? null,
      score: overallScore,
      totalQuestions: questionIds.length,
      passed: true,
      answersCount: Object.keys(answers).length,
      answers,
      questionIds,
      currentQuestionIndex: questionIds.length,
      questionStartedAt: completedAt,
      questionExpiresAt: null,
      questionTimeSeconds: SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS,
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

async function submitSevenoProfessionalAssessment(
  uid: string,
  sessionId: string,
  session: TestSession,
  bank: QuestionBank,
  professionalVersion: SevenoAssessmentStoredVersion,
  answers: Record<string, string>,
): Promise<TestSessionSubmitResult> {
  const firestore = requireAdminDatabase();
  const sessionRef = firestore.collection('test_sessions').doc(sessionId);
  const resultRef = firestore.collection('test_results').doc(sessionId);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const summaryRef = firestore.collection('candidate_assessment_summaries').doc(uid);
  const attemptRef = firestore.collection(CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION).doc(uid);
  const durationSeconds = session.durationSeconds ?? bank.durationSeconds ?? LEGACY_SEVENO_GENERAL_BANK_DURATION_SECONDS;
  const runtimeVersion = toProfessionalAssessmentVersionDescriptor(professionalVersion);
  const questionLookup = new Map(professionalVersion.questions.map((question) => [question.id, question] as const));

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

    const questionIds = Array.isArray(currentSession.questionIds) && currentSession.questionIds.length > 0
      ? currentSession.questionIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : getProfessionalAssessmentQuestionIds(professionalVersion);
    const selectedQuestions = questionIds
      .map((questionId) => questionLookup.get(questionId))
      .filter((question): question is ProfessionalAssessmentQuestion => {
        if (!question) {
          return false;
        }
        return question.isActive !== false;
      });
    if (selectedQuestions.length !== questionIds.length) {
      throw new SevenoTestError('question_bank_missing', 404, 'La banque de questions est indisponible.');
    }

    const responses: ProfessionalAssessmentResponse[] = [];
    for (const [index, questionId] of questionIds.entries()) {
      const optionId = answers[questionId];
      if (!optionId) {
        continue;
      }

      responses.push({
        questionId,
        optionId,
        answeredAt: transactionNow,
        responseOrder: index + 1,
        sessionId,
      });
    }

    const outcome = calculateProfessionalAssessmentOutcome({
      version: runtimeVersion,
      completedPath: 'extended',
      questions: selectedQuestions,
      responses,
      completedAt: transactionNow,
    });

    const scoresByDimension = Object.fromEntries(
      outcome.report.dimensionResults
        .filter((result) => typeof result.score === 'number')
        .map((result) => [result.dimensionCode, result.score ?? 0] as const),
    ) as SevenoAssessmentScores;
    const scoreValues = Object.values(scoresByDimension).filter((value): value is number => typeof value === 'number');
    const overallScore = scoreValues.length > 0
      ? Math.round(scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length)
      : 0;
    const completedAt = transactionNow;
    const resultData: TestResult = {
      uid,
      candidateUid: uid,
      ...(profileSnapshot.exists ? { publicCandidateId: profileSnapshot.get('publicCandidateId'), candidateProfileId: uid } : {}),
      sessionId,
      assessmentType: 'seveno_general',
      questionnaireVersion: professionalVersion.version,
      questionnaireId: professionalVersion.code,
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
      questionnaireVersion: professionalVersion.version,
      sessionId,
      resultId: resultRef.id,
      completedAt,
      updatedAt: completedAt,
    });
    transaction.set(attemptRef, {
      attemptSeed: session.attemptSeed ?? null,
      professionalAssessmentVersionId: professionalVersion.id,
      questionIds,
      currentQuestionIndex: questionIds.length,
      questionStartedAt: completedAt,
      questionExpiresAt: null,
      activeSessionId: null,
      status: 'submitted',
      updatedAt: completedAt,
    }, { merge: true });
    if (profileSnapshot.exists) {
      transaction.update(profileRef, {
        sevenoAssessmentStatus: 'completed',
        sevenoAssessmentOverallScore: overallScore,
        sevenoAssessmentDimensions: scoresByDimension,
        sevenoAssessmentVersion: professionalVersion.version,
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

function normalizeSevenoGeneralStepSubmission(value: unknown) {
  if (!isPlainObject(value)) {
    return null;
  }

  const questionId = toTrimmedString(value.questionId);
  if (!questionId) {
    return null;
  }

  const answer = toTrimmedString(value.answer);
  return {
    questionId,
    answer: answer && answer.length > 0 ? answer : null,
    timeout: value.timeout === true,
  };
}

async function advanceSevenoGeneralAssessmentQuestion(
  uid: string,
  sessionId: string,
  session: TestSession,
  bank: QuestionBank,
  professionalVersion: SevenoAssessmentStoredVersion,
  submission: ReturnType<typeof normalizeSevenoGeneralStepSubmission>,
): Promise<SevenoTestStartState> {
  if (!submission) {
    throw new SevenoTestError('invalid_submission', 400, 'La reponse du questionnaire est invalide.');
  }

  const firestore = requireAdminDatabase();
  const sessionQuestionIds = Array.isArray(session.questionIds) && session.questionIds.length > 0
    ? session.questionIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : getProfessionalAssessmentQuestionIds(professionalVersion, session.attemptSeed);
  const currentQuestionIndex = typeof session.currentQuestionIndex === 'number' && Number.isFinite(session.currentQuestionIndex)
    ? Math.max(0, session.currentQuestionIndex)
    : 0;
  const currentQuestionId = sessionQuestionIds[currentQuestionIndex] ?? null;
  if (!currentQuestionId) {
    throw new SevenoTestError('question_not_found', 404, 'La question en cours est introuvable.');
  }

  if (currentQuestionId !== submission.questionId) {
    throw new SevenoTestError('question_mismatch', 409, 'La question envoyee ne correspond pas a la question en cours.');
  }

  const currentQuestionTimeSeconds = typeof session.questionTimeSeconds === 'number' && session.questionTimeSeconds > 0
    ? session.questionTimeSeconds
    : SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS;
  const currentQuestionStartedAt = toTimestamp(session.questionStartedAt) ?? toTimestamp(session.startedAt) ?? Timestamp.now();
  const currentQuestionExpiresAt = toTimestamp(session.questionExpiresAt)
    ?? Timestamp.fromMillis(currentQuestionStartedAt.toMillis() + currentQuestionTimeSeconds * 1000);
  const now = Timestamp.now();
  const timedOut = currentQuestionExpiresAt.toMillis() <= now.toMillis();

  if (submission.timeout && !timedOut) {
    throw new SevenoTestError('question_not_expired', 409, 'La question en cours n est pas encore expiree.');
  }
  if (!timedOut && !submission.answer) {
    throw new SevenoTestError('answer_missing', 400, 'Repondez a la question avant de continuer.');
  }

  const nextAnswers = isPlainObject(session.answers) ? { ...session.answers } : {};
  if (!timedOut && submission.answer) {
    nextAnswers[currentQuestionId] = submission.answer;
  } else {
    delete nextAnswers[currentQuestionId];
  }

  const answersCount = Object.values(nextAnswers).filter((value) => value !== null && value !== undefined && value !== '').length;
  const isLastQuestion = currentQuestionIndex >= sessionQuestionIds.length - 1;
  const sessionRef = firestore.collection('test_sessions').doc(sessionId);
  const attemptRef = firestore.collection(CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION).doc(uid);
  const profileRef = firestore.collection('candidate_profiles').doc(uid);
  const summaryRef = firestore.collection('candidate_assessment_summaries').doc(uid);

  if (!isLastQuestion) {
    const nextQuestionStartedAt = now;
    const nextQuestionExpiresAt = Timestamp.fromMillis(now.toMillis() + SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS * 1000);
    const nextSession: TestSession = {
      ...session,
      professionalAssessmentVersionId: professionalVersion.id,
      attemptSeed: session.attemptSeed ?? null,
      questionIds: sessionQuestionIds,
      currentQuestionIndex: currentQuestionIndex + 1,
      questionStartedAt: nextQuestionStartedAt,
      questionExpiresAt: nextQuestionExpiresAt,
      questionTimeSeconds: SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS,
      answers: nextAnswers,
      answersCount,
      lastQuestionId: currentQuestionId,
      updatedAt: now,
    };

    await firestore.runTransaction(async (transaction) => {
      const [currentSessionSnapshot, profileSnapshot, summarySnapshot] = await Promise.all([
        transaction.get(sessionRef),
        transaction.get(profileRef),
        transaction.get(summaryRef),
      ]);

      if (!currentSessionSnapshot.exists) {
        throw new SevenoTestError('session_not_found', 404, 'Session de questionnaire introuvable.');
      }

      const currentSession = currentSessionSnapshot.data() as TestSession;
      if (
        currentSession.uid !== uid
        || currentSession.candidateUid !== uid
        || currentSession.assessmentType !== 'seveno_general'
        || currentSession.status !== 'in_progress'
      ) {
        throw new SevenoTestError('session_not_active', 409, 'Cette session de questionnaire n est plus active.');
      }

      const currentSessionQuestionIds = Array.isArray(currentSession.questionIds)
        ? currentSession.questionIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
      const currentSessionQuestionIndex = typeof currentSession.currentQuestionIndex === 'number' && Number.isFinite(currentSession.currentQuestionIndex)
        ? Math.max(0, currentSession.currentQuestionIndex)
        : 0;
      const currentSessionQuestionId = currentSessionQuestionIds[currentSessionQuestionIndex] ?? null;
      const currentSessionQuestionStartedAt = toTimestamp(currentSession.questionStartedAt) ?? toTimestamp(currentSession.startedAt) ?? null;
      const currentSessionQuestionExpiresAt = toTimestamp(currentSession.questionExpiresAt)
        ?? (currentSessionQuestionStartedAt ? Timestamp.fromMillis(currentSessionQuestionStartedAt.toMillis() + currentQuestionTimeSeconds * 1000) : null);

      if (
        currentSessionQuestionIds.length !== sessionQuestionIds.length
        || currentSessionQuestionIds.some((questionId, index) => questionId !== sessionQuestionIds[index])
        || currentSessionQuestionIndex !== currentQuestionIndex
        || currentSessionQuestionId !== currentQuestionId
        || currentSessionQuestionStartedAt?.toMillis() !== currentQuestionStartedAt.toMillis()
        || currentSessionQuestionExpiresAt?.toMillis() !== currentQuestionExpiresAt.toMillis()
        || currentSession.attemptSeed !== (session.attemptSeed ?? null)
        || currentSession.professionalAssessmentVersionId !== professionalVersion.id
      ) {
        throw new SevenoTestError('session_not_active', 409, 'Cette session de questionnaire n est plus active.');
      }

      transaction.update(sessionRef, {
        professionalAssessmentVersionId: professionalVersion.id,
        attemptSeed: session.attemptSeed ?? null,
        questionIds: sessionQuestionIds,
        currentQuestionIndex: currentQuestionIndex + 1,
        questionStartedAt: nextQuestionStartedAt,
        questionExpiresAt: nextQuestionExpiresAt,
        questionTimeSeconds: SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS,
        answers: nextAnswers,
        answersCount,
        lastQuestionId: currentQuestionId,
        updatedAt: now,
      });
      transaction.set(attemptRef, {
        uid,
        activeSessionId: sessionId,
        status: 'active',
        attemptSeed: session.attemptSeed ?? null,
        professionalAssessmentVersionId: professionalVersion.id,
        questionIds: sessionQuestionIds,
        currentQuestionIndex: currentQuestionIndex + 1,
        questionStartedAt: nextQuestionStartedAt,
        questionExpiresAt: nextQuestionExpiresAt,
        updatedAt: now,
      }, { merge: true });

      if (profileSnapshot.exists && !summarySnapshot.exists && profileSnapshot.get('sevenoAssessmentStatus') === 'in_progress') {
        transaction.update(profileRef, {
          sevenoAssessmentStatus: 'in_progress',
          updatedAt: now,
        });
      }
    });

    return {
      preparation: {
        questionBankCode: bank.code,
        questionnaireVersion: bank.version,
        durationSeconds: bank.durationSeconds ?? SEVENO_TEST_DEFAULT_DURATION_SECONDS,
        totalQuestions: sessionQuestionIds.length,
      },
      assessment: null,
      session: buildStartResult(sessionId, nextSession, bank),
    };
  }

  await submitSevenoProfessionalAssessment(
    uid,
    sessionId,
    {
      ...session,
      professionalAssessmentVersionId: professionalVersion.id,
      attemptSeed: session.attemptSeed ?? null,
      questionIds: sessionQuestionIds,
      currentQuestionIndex,
      questionStartedAt: currentQuestionStartedAt,
      questionExpiresAt: currentQuestionExpiresAt,
      questionTimeSeconds: currentQuestionTimeSeconds,
      answers: nextAnswers,
      answersCount,
      lastQuestionId: currentQuestionId,
    },
    bank,
    professionalVersion,
    Object.fromEntries(
      Object.entries(nextAnswers).filter(([, value]) => typeof value === 'string' && value.length > 0),
    ) as Record<string, string>,
  );

  return getSevenoAssessmentStartState(uid);
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
      transaction.update(document.ref, {
        status: 'abandoned',
        abandonedAt: now,
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

async function loadCurrentSevenoTestSession(uid: string): Promise<TestSessionStartResult | null> {
  const firestore = requireAdminDatabase();
  const attemptRef = firestore.collection(CANDIDATE_ASSESSMENT_ATTEMPTS_COLLECTION).doc(uid);
  const attemptSnapshot = await attemptRef.get();
  const activeSessionId = attemptSnapshot.exists ? toTrimmedString(attemptSnapshot.get('activeSessionId')) : null;
  if (!activeSessionId) {
    return null;
  }

  const sessionSnapshot = await firestore.collection('test_sessions').doc(activeSessionId).get();
  if (!sessionSnapshot.exists) {
    return null;
  }

  const session = sessionSnapshot.data() as TestSession;
  if (
    session.uid !== uid
    || session.candidateUid !== uid
    || session.assessmentType !== 'seveno_general'
    || session.status !== 'in_progress'
  ) {
    return null;
  }

  const questionBankVersion = typeof session.questionBankVersion === 'string'
    ? session.questionBankVersion.trim()
    : '';
  if (!questionBankVersion) {
    return null;
  }

  const bank = await loadQuestionBankByCodeAndVersion(session.questionBankCode, questionBankVersion, session.questionIds);
  if (!bank || bank.assessmentType !== 'seveno_general') {
    return null;
  }

  return buildStartResult(activeSessionId, session, bank);
}

export async function getSevenoAssessmentStartState(uid: string): Promise<SevenoTestStartState> {
  await assertCandidateCanUseAssessment(uid);
  const { preparation, assessment } = await prepareSevenoAssessment(uid);
  return {
    preparation,
    assessment,
    session: await loadCurrentSevenoTestSession(uid),
  };
}

export async function startSevenoTestSession(uid: string): Promise<TestSessionStartResult> {
  const firestore = requireAdminDatabase();
  await assertCandidateCanUseAssessment(uid);
  const activeProfessionalVersion = await loadActiveProfessionalAssessmentVersion();
  const attemptSeed = randomUUID();
  const bank = activeProfessionalVersion
    ? buildProfessionalAssessmentQuestionBank(activeProfessionalVersion, null, attemptSeed)
    : null;
  const resolvedBank = bank ?? materializeQuestionBank(LEGACY_SEVENO_GENERAL_BANK_TEMPLATE);
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
      return session.assessmentType === 'seveno_general' && session.status === 'in_progress';
    });

    for (const document of activeSessions) {
      transaction.update(document.ref, {
        status: 'abandoned',
        abandonedAt: now,
        updatedAt: now,
      });
    }

    for (const document of sessionsSnapshot.docs) {
      const session = document.data() as TestSession;
      if (session.assessmentType === 'seveno_general' && session.status === 'in_progress' && !activeSessions.includes(document)) {
        transaction.update(document.ref, { status: 'abandoned', abandonedAt: now, updatedAt: now });
      }
    }

    const questionIds = getQuestionIds(resolvedBank);
    const questionTimeSeconds = SEVENO_PROFESSIONAL_ASSESSMENT_QUESTION_TIME_SECONDS;
    const firstQuestionExpiresAt = Timestamp.fromMillis(now.toMillis() + questionTimeSeconds * 1000);
    const durationSeconds = questionTimeSeconds * Math.max(1, questionIds.length);
    const expiresAt = Timestamp.fromMillis(now.toMillis() + durationSeconds * 1000);
    const nextSession: TestSession = {
      uid,
      candidateUid: uid,
      ...(profileSnapshot.exists && profileSnapshot.get('publicCandidateId')
        ? { publicCandidateId: profileSnapshot.get('publicCandidateId') as string, candidateProfileId: uid }
        : {}),
      assessmentType: 'seveno_general',
      professionalAssessmentVersionId: activeProfessionalVersion?.id ?? null,
      attemptSeed,
      questionnaireVersion: resolvedBank.version,
      questionBankCode: resolvedBank.code,
      questionBankVersion: resolvedBank.version,
      status: 'in_progress',
      questionIds,
      currentQuestionIndex: 0,
      questionStartedAt: now,
      questionExpiresAt: firstQuestionExpiresAt,
      questionTimeSeconds,
      answersCount: 0,
      durationSeconds,
      threshold: resolvedBank.threshold ?? SEVENO_TEST_DEFAULT_THRESHOLD,
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
      attemptSeed,
      startedAt: now,
      expiresAt: firstQuestionExpiresAt,
      professionalAssessmentVersionId: activeProfessionalVersion?.id ?? null,
      questionIds,
      currentQuestionIndex: 0,
      questionStartedAt: now,
      questionExpiresAt: firstQuestionExpiresAt,
      updatedAt: now,
    });
    if (profileSnapshot.exists && !summarySnapshot.exists) {
      transaction.update(profileRef, { sevenoAssessmentStatus: 'in_progress', updatedAt: now });
    }

    return nextSession;
  });

  return buildStartResult(sessionId, sessionData, resolvedBank);
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
    const status: TestSession['status'] = session.assessmentType === 'seveno_general'
      ? 'abandoned'
      : (toTimestamp(session.expiresAt) && toTimestamp(session.expiresAt)!.toMillis() <= now.toMillis()
        ? 'expired'
        : 'abandoned');
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
): Promise<TestSessionSubmitResult | SevenoTestStartState> {
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
  if (session.assessmentType !== 'seveno_general') {
    const expiresAt = toTimestamp(session.expiresAt);
    if (expiresAt && expiresAt.toMillis() <= now.toMillis()) {
      await sessionRef.update({
        status: 'expired',
        updatedAt: now,
      });
      throw new SevenoTestError('session_expired', 409, 'La session de test a expire.');
    }
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

  const bank = await loadQuestionBankByCodeAndVersion(session.questionBankCode, questionBankVersion, session.questionIds);
  if (!bank) {
    throw new SevenoTestError('question_bank_missing', 404, 'La banque de questions est indisponible.');
  }

  const generalSubmission = normalizeSevenoGeneralStepSubmission(rawAnswers);
  const answers: Record<string, string> = generalSubmission
    ? {}
    : normalizeSubmittedAnswers(isPlainObject(rawAnswers) && isPlainObject((rawAnswers as { answers?: unknown }).answers)
      ? (rawAnswers as { answers: Record<string, unknown> }).answers
      : rawAnswers);
  if (session.assessmentType === 'seveno_general') {
    if (generalSubmission) {
      const professionalVersion = await loadProfessionalAssessmentVersionByCodeAndVersion(bank.code, bank.version);
      if (!professionalVersion) {
        throw new SevenoTestError('question_bank_missing', 404, 'La banque de questions est indisponible.');
      }

      return advanceSevenoGeneralAssessmentQuestion(
        uid,
        sessionId,
        session,
        bank,
        professionalVersion,
        generalSubmission,
      );
    }

    if (isLegacySevenoGeneralBank(bank)) {
      return submitSevenoGeneralAssessment(uid, sessionId, session, bank, answers);
    }

    const professionalVersion = await loadProfessionalAssessmentVersionByCodeAndVersion(bank.code, bank.version);
    if (!professionalVersion) {
      throw new SevenoTestError('question_bank_missing', 404, 'La banque de questions est indisponible.');
    }

    return submitSevenoProfessionalAssessment(uid, sessionId, session, bank, professionalVersion, answers);
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
