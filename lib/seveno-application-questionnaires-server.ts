import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import {
  COMPANY_QUESTION_POINTS,
  COMPANY_QUESTION_TIME_LIMIT_SECONDS,
  COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT,
  COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
} from '@/lib/seveno-company-questionnaire-constants';
import { normalizeQuestionnaireMinimumPassingScorePercent } from '@/lib/seveno-company-questionnaire-thresholds';
import { calculateCompanyQuestionnaireScorePercent } from '@/lib/seveno-company-questionnaire-scoring';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import {
  buildApplicationQuestionnaireCompletedNotificationEventId,
  dispatchCompanyNotificationEvent,
  prepareApplicationQuestionnaireCompletedNotificationEvent,
} from '@/lib/seveno-company-notifications-server';
import { toCompanyQuestionEditorProjection } from '@/lib/seveno-company-questionnaires-server';
import {
  resolveCompanyQuestionnaireForOffer,
  SevenoCompanyQuestionnaireResolutionError,
  type ResolvedCompanyQuestionnaire,
} from '@/lib/seveno-company-questionnaire-resolver';
import type { CompanyQuestion } from '@/types/seveno-company-questionnaires';
import type {
  CompanyApplicationQuestionnaireAnswerRecord,
  CompanyApplicationQuestionnaireAttemptSummary,
  CompanyApplicationQuestionnaireProjection,
  CompanyApplicationQuestionnaireReviewProjection,
  CompanyApplicationQuestionnaireReviewView,
  CompanyApplicationQuestionnaireManualReviewStatus,
  CompanyApplicationQuestionnaireQuestion,
  CompanyApplicationQuestionnaireSessionStatus,
  CompanyApplicationQuestionnaireView,
  SerializedCompanyApplicationAssessmentSummary,
} from '@/types/seveno-application-questionnaires';
import type {
  CandidateOfferProjection,
  PreferredPrerequisiteResult,
  RequiredPrerequisiteResult,
} from '@/types/seveno-job-applications';

type FirestoreRecord = Record<string, unknown>;
type QuestionnaireApplicationRecord = {
  id: string;
  candidateUid: string;
  publicCandidateId: string;
  companyUid: string;
  offerId: string;
  offerVersion: number;
  jobRoleId: string;
  status: string;
  offerSnapshot: CandidateOfferProjection;
  requiredResult: RequiredPrerequisiteResult;
  preferredResult: PreferredPrerequisiteResult;
  companyAssessment?: FirestoreRecord | null;
};

type AssessmentMetrics = {
  status: CompanyApplicationQuestionnaireSessionStatus;
  automaticScorePercent: number | null;
  autoScoredPoints: number | null;
  autoScoredMaximum: number | null;
  manualReviewRequired: boolean;
  manualReviewStatus: CompanyApplicationQuestionnaireManualReviewStatus;
  finalScore: number | null;
  minimumPassingScorePercent?: number;
  manualQuestionsCount: number;
} & Record<string, unknown>;

const APPLICATIONS_COLLECTION = 'job_applications';
const OFFERS_COLLECTION = 'job_offers';
const SESSIONS_COLLECTION = 'test_sessions';
const RESULTS_COLLECTION = 'test_results';
const ALLOWED_APPLICATION_STATUSES = new Set([
  'eligible',
  'submitted',
  'questionnaire_pending',
  'questionnaire_completed',
]);
const SHORT_TEXT_MAX_LENGTH = 240;
const LONG_TEXT_MAX_LENGTH = 2000;

export class SevenoApplicationQuestionnaireError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function requireDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoApplicationQuestionnaireError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour gerer le questionnaire entreprise.',
    );
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength = 200) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) {
    throw new SevenoApplicationQuestionnaireError('invalid_payload', 400, 'Un champ du questionnaire est invalide.');
  }
  return text;
}

function timestampToIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toTimestamp(value: unknown) {
  if (value instanceof Timestamp) return value;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }
  if (value instanceof Date) return Timestamp.fromDate(value);
  return null;
}

function isApplicationStatusAllowed(status: string) {
  return ALLOWED_APPLICATION_STATUSES.has(status);
}

function serializeAttempt(session: FirestoreRecord, serverNow: Timestamp): CompanyApplicationQuestionnaireAttemptSummary | null {
  const sessionId = cleanText(session.id ?? session.sessionId, 120);
  const startedAt = toTimestamp(session.startedAt);
  if (!sessionId || !startedAt) {
    return null;
  }

  const status = session.status === 'in_progress'
    || session.status === 'submitted'
    || session.status === 'completed'
    || session.status === 'expired'
    || session.status === 'abandoned'
      ? session.status as CompanyApplicationQuestionnaireAttemptSummary['status']
      : null;
  if (!status) {
    return null;
  }

  const questionIds = Array.isArray(session.questionIds)
    ? session.questionIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
  const totalQuestions = typeof session.totalQuestions === 'number' && Number.isFinite(session.totalQuestions)
    ? session.totalQuestions
    : questionIds.length;
  const answeredCount = typeof session.answersCount === 'number' && Number.isFinite(session.answersCount)
    ? session.answersCount
    : isPlainObject(session.answers)
      ? Object.values(session.answers).filter((value) => value !== null && value !== undefined && value !== '').length
      : 0;
  const questionTimeSeconds = typeof session.questionTimeSeconds === 'number' && session.questionTimeSeconds > 0
    ? session.questionTimeSeconds
    : typeof session.durationSeconds === 'number' && session.durationSeconds > 0 && totalQuestions > 0
      ? Math.max(1, Math.round(session.durationSeconds / totalQuestions))
      : null;
  const currentQuestionIndex = typeof session.currentQuestionIndex === 'number' && Number.isFinite(session.currentQuestionIndex)
    ? session.currentQuestionIndex
    : Math.min(answeredCount, Math.max(totalQuestions - 1, 0));
  const currentQuestionStartedAt = toTimestamp(session.questionStartedAt) ?? startedAt;
  const currentQuestionExpiresAt = toTimestamp(session.questionExpiresAt)
    ?? (questionTimeSeconds
      ? Timestamp.fromMillis(currentQuestionStartedAt.toMillis() + questionTimeSeconds * 1000)
      : null);

  return {
    sessionId,
    status,
    startedAt: startedAt.toDate().toISOString(),
    expiresAt: timestampToIso(session.expiresAt),
    submittedAt: timestampToIso(session.submittedAt),
    serverNow: serverNow.toDate().toISOString(),
    durationMinutes: typeof session.durationSeconds === 'number' && session.durationSeconds > 0
      ? Math.round(session.durationSeconds / 60)
      : null,
    totalQuestions,
    answerCount: answeredCount,
    questionTimeSeconds,
    currentQuestionId: typeof session.currentQuestionId === 'string' && session.currentQuestionId
      ? session.currentQuestionId
      : questionIds[Math.min(currentQuestionIndex, Math.max(questionIds.length - 1, 0))] ?? null,
    currentQuestionIndex,
    currentQuestionStartedAt: currentQuestionStartedAt.toDate().toISOString(),
    currentQuestionExpiresAt: currentQuestionExpiresAt ? currentQuestionExpiresAt.toDate().toISOString() : null,
  };
}

function serializeAssessment(value: unknown, questionnaireVersionFallback: string | null): SerializedCompanyApplicationAssessmentSummary | null {
  const data = isPlainObject(value) ? value : null;
  if (!data) {
      return questionnaireVersionFallback
      ? {
          status: 'not_started',
          automaticScorePercent: null,
          autoScoredPoints: null,
          autoScoredMaximum: null,
          manualReviewRequired: false,
          manualReviewStatus: 'not_required',
          finalScore: null,
          minimumPassingScorePercent: null,
          questionnaireVersion: questionnaireVersionFallback,
          completedAt: null,
          startedAt: null,
          submittedAt: null,
          sessionId: null,
          resultId: null,
          manualQuestionsCount: 0,
        }
      : null;
  }

  const questionnaireVersion = typeof data.questionnaireVersion === 'string'
    ? data.questionnaireVersion
    : questionnaireVersionFallback ?? '';
  if (!questionnaireVersion) {
    return null;
  }

  const status = data.status === 'in_progress'
    || data.status === 'submitted'
    || data.status === 'completed'
    || data.status === 'expired'
    || data.status === 'abandoned'
      ? data.status
      : 'not_started';
  const manualReviewStatus = data.manualReviewStatus === 'pending'
    || data.manualReviewStatus === 'in_review'
    || data.manualReviewStatus === 'completed'
      ? data.manualReviewStatus
      : 'not_required';

  return {
    status,
    automaticScorePercent: typeof data.automaticScorePercent === 'number' && Number.isFinite(data.automaticScorePercent)
      ? data.automaticScorePercent
      : null,
    autoScoredPoints: typeof data.autoScoredPoints === 'number' && Number.isFinite(data.autoScoredPoints)
      ? data.autoScoredPoints
      : null,
    autoScoredMaximum: typeof data.autoScoredMaximum === 'number' && Number.isFinite(data.autoScoredMaximum)
      ? data.autoScoredMaximum
      : null,
    manualReviewRequired: data.manualReviewRequired === true,
    manualReviewStatus,
    finalScore: typeof data.finalScore === 'number' && Number.isFinite(data.finalScore)
      ? data.finalScore
      : null,
    minimumPassingScorePercent: typeof data.minimumPassingScorePercent === 'number' && Number.isFinite(data.minimumPassingScorePercent)
      ? data.minimumPassingScorePercent
      : null,
    questionnaireVersion,
    completedAt: timestampToIso(data.completedAt),
    startedAt: timestampToIso(data.startedAt),
    submittedAt: timestampToIso(data.submittedAt),
    sessionId: cleanText(data.sessionId, 120) || null,
    resultId: cleanText(data.resultId, 120) || null,
    manualQuestionsCount: typeof data.manualQuestionsCount === 'number' && Number.isFinite(data.manualQuestionsCount)
      ? data.manualQuestionsCount
      : 0,
  };
}

export function buildPublicQuestion(question: CompanyQuestion): CompanyApplicationQuestionnaireQuestion {
  const editorQuestion = toCompanyQuestionEditorProjection(question);
  const maxLength = editorQuestion.type === 'short_text'
    ? SHORT_TEXT_MAX_LENGTH
    : editorQuestion.type === 'long_text'
      ? LONG_TEXT_MAX_LENGTH
      : null;

  return {
    id: editorQuestion.id,
    prompt: editorQuestion.prompt,
    ...(editorQuestion.help ? { help: editorQuestion.help } : {}),
    type: editorQuestion.type,
    required: editorQuestion.required,
    options: editorQuestion.options.map((option) => ({
      id: option.id,
      label: option.label,
      order: option.order,
    })),
    points: COMPANY_QUESTION_POINTS,
    order: editorQuestion.order,
    ...(maxLength !== null ? { maxLength } : {}),
  };
}

function buildQuestionnaireProjection(questionnaireVersion: string, data: FirestoreRecord): CompanyApplicationQuestionnaireProjection {
  const questions = Array.isArray(data.questions) ? data.questions as CompanyQuestion[] : [];
  const versionValue = data.questionnaireVersion ?? questionnaireVersion;
  const version = typeof versionValue === 'number'
    ? String(versionValue)
    : cleanText(versionValue, 40);
  if (!version) {
    throw new SevenoApplicationQuestionnaireError('questionnaire_invalid', 409, 'La version du questionnaire est invalide.');
  }

  return {
    questionnaireVersion: version,
    title: String(data.title ?? ''),
    instructions: String(data.instructions ?? ''),
    durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : null,
    questionTimeSeconds: COMPANY_QUESTION_TIME_LIMIT_SECONDS,
    status: data.status === 'active' || data.status === 'archived' ? data.status : 'draft',
    questions: questions
      .map((question) => buildPublicQuestion(question))
      .sort((left, right) => left.order - right.order),
  };
}

function buildQuestionnaireReviewProjection(
  questionnaireVersion: string,
  data: FirestoreRecord,
): CompanyApplicationQuestionnaireReviewProjection {
  const questions = Array.isArray(data.questions) ? data.questions as CompanyQuestion[] : [];
  const versionValue = data.questionnaireVersion ?? questionnaireVersion;
  const version = typeof versionValue === 'number'
    ? String(versionValue)
    : cleanText(versionValue, 40);
  if (!version) {
    throw new SevenoApplicationQuestionnaireError('questionnaire_invalid', 409, 'La version du questionnaire est invalide.');
  }

  return {
    questionnaireVersion: version,
    title: String(data.title ?? ''),
    instructions: String(data.instructions ?? ''),
    durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : null,
    questionTimeSeconds: COMPANY_QUESTION_TIME_LIMIT_SECONDS,
    status: data.status === 'active' || data.status === 'archived' ? data.status : 'draft',
    questions: questions
      .map((question) => ({ ...question, options: Array.isArray(question.options) ? question.options.map((option) => ({ ...option })) : [] }))
      .sort((left, right) => left.order - right.order),
  };
}

async function loadApplication(applicationId: string, candidateUid: string) {
  const firestore = requireDatabase();
  const ref = firestore.collection(APPLICATIONS_COLLECTION).doc(cleanText(applicationId, 100));
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new SevenoApplicationQuestionnaireError('application_not_found', 404, 'Candidature introuvable.');
  }

  const data = snapshot.data() as FirestoreRecord;
  if (data.candidateUid !== candidateUid) {
    throw new SevenoApplicationQuestionnaireError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
  }
  if (!isApplicationStatusAllowed(String(data.status ?? ''))) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_unavailable',
      409,
      'Cette candidature n autorise pas encore le questionnaire de l entreprise.',
    );
  }

  if (!isPlainObject(data.offerSnapshot)) {
    throw new SevenoApplicationQuestionnaireError('application_invalid', 409, 'La candidature est invalide.');
  }

  return {
    ref,
    data: {
      id: snapshot.id,
      candidateUid: String(data.candidateUid ?? ''),
      publicCandidateId: String(data.publicCandidateId ?? ''),
      companyUid: String(data.companyUid ?? ''),
      offerId: String(data.offerId ?? ''),
      offerVersion: typeof data.offerVersion === 'number' ? data.offerVersion : 0,
      jobRoleId: String(data.jobRoleId ?? ''),
      status: String(data.status ?? ''),
      offerSnapshot: data.offerSnapshot as unknown as CandidateOfferProjection,
      requiredResult: data.requiredResult as unknown as RequiredPrerequisiteResult,
      preferredResult: data.preferredResult as unknown as PreferredPrerequisiteResult,
      companyAssessment: isPlainObject(data.companyAssessment) ? data.companyAssessment : null,
    } satisfies QuestionnaireApplicationRecord,
  };
}

async function loadCompanyApplication(applicationId: string, companyUid: string) {
  const firestore = requireDatabase();
  const ref = firestore.collection(APPLICATIONS_COLLECTION).doc(cleanText(applicationId, 100));
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new SevenoApplicationQuestionnaireError('application_not_found', 404, 'Candidature introuvable.');
  }

  const data = snapshot.data() as FirestoreRecord;
  if (data.companyUid !== companyUid) {
    throw new SevenoApplicationQuestionnaireError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
  }

  return {
    ref,
    data: {
      id: snapshot.id,
      candidateUid: String(data.candidateUid ?? ''),
      publicCandidateId: String(data.publicCandidateId ?? ''),
      companyUid: String(data.companyUid ?? ''),
      offerId: String(data.offerId ?? ''),
      offerVersion: typeof data.offerVersion === 'number' ? data.offerVersion : 0,
      jobRoleId: String(data.jobRoleId ?? ''),
      status: String(data.status ?? ''),
      offerSnapshot: data.offerSnapshot as unknown as CandidateOfferProjection,
      requiredResult: data.requiredResult as unknown as RequiredPrerequisiteResult,
      preferredResult: data.preferredResult as unknown as PreferredPrerequisiteResult,
      companyAssessment: isPlainObject(data.companyAssessment) ? data.companyAssessment : null,
    } satisfies QuestionnaireApplicationRecord,
  };
}

async function loadQuestionnaireBundle(application: QuestionnaireApplicationRecord) {
  const firestore = requireDatabase();
  const offerSnapshot = await firestore.collection(OFFERS_COLLECTION).doc(application.offerId).get();
  if (!offerSnapshot.exists || offerSnapshot.data()?.companyUid !== application.companyUid) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_forbidden',
      403,
      'L offre associee au questionnaire est introuvable.',
    );
  }
  const liveOffer = offerSnapshot.data() as FirestoreRecord;
  const explicitQuestionnaireId = typeof liveOffer.questionnaireId === 'string'
    ? liveOffer.questionnaireId
    : application.offerSnapshot.questionnaireId;
  let resolved: ResolvedCompanyQuestionnaire | null;
  try {
    resolved = await resolveCompanyQuestionnaireForOffer({
      firestore,
      offerId: application.offerId,
      companyUid: application.companyUid,
      offer: {
        id: application.offerId,
        companyUid: liveOffer.companyUid,
        questionnaireId: explicitQuestionnaireId,
      },
    });
  } catch (error) {
    if (error instanceof SevenoCompanyQuestionnaireResolutionError) {
      throw new SevenoApplicationQuestionnaireError(error.code, error.status, error.message);
    }
    throw error;
  }
  if (!resolved) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_not_configured',
      409,
      'Cette candidature ne dispose pas de questionnaire entreprise actif.',
    );
  }
  const questionnaireId = resolved.questionnaireId;
  const questionnaireVersionValue = typeof liveOffer.questionnaireVersion === 'number'
    && explicitQuestionnaireId === questionnaireId
    ? liveOffer.questionnaireVersion
    : resolved.data.version ?? application.offerSnapshot.questionnaireVersion;
  const questionnaireVersion = typeof questionnaireVersionValue === 'number'
    ? String(questionnaireVersionValue)
    : '';
  if (!questionnaireId || !questionnaireVersion) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_not_configured',
      409,
      'Cette candidature ne dispose pas de questionnaire entreprise actif.',
    );
  }

  const questionnaireRef = resolved.ref;
  const currentSnapshot = resolved.snapshot;
  const versionSnapshot = await questionnaireRef.collection('versions').doc(questionnaireVersion).get();
  if (!versionSnapshot.exists) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_version_missing',
      409,
      'La version du questionnaire entreprise est indisponible.',
    );
  }
  const versionData = versionSnapshot.data() as FirestoreRecord;
  const expectedVersionOfferIds = new Set([
    application.offerId,
    ...(resolved.legacySourceOfferId ? [resolved.legacySourceOfferId] : []),
  ]);
  if (versionData.companyUid !== application.companyUid || !expectedVersionOfferIds.has(String(versionData.offerId ?? ''))) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_forbidden',
      403,
      'Ce questionnaire ne correspond pas a cette candidature.',
    );
  }

  const versionQuestions = Array.isArray(versionData.questions) ? versionData.questions as CompanyQuestion[] : [];
  if (
    versionQuestions.length !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT
    || versionQuestions.some((question) => (
      !question
      || typeof question.id !== 'string'
      || !question.id.trim()
      || (question.correctionMode === 'automatic' && question.expectedAnswer === undefined)
    ))
  ) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_invalid',
      409,
      'Le questionnaire entreprise n est pas exploitable.',
    );
  }

  const currentData = currentSnapshot.exists ? currentSnapshot.data() as FirestoreRecord : null;
  return {
    questionnaireId,
    questionnaireVersion,
    minimumPassingScorePercent: (() => {
      try {
        return normalizeQuestionnaireMinimumPassingScorePercent(versionData.minimumPassingScorePercent);
      } catch {
        return COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT;
      }
    })(),
    currentStatus: currentData?.status === 'active' || currentData?.status === 'archived' ? currentData.status as 'active' | 'archived' : 'draft',
    projection: buildQuestionnaireProjection(questionnaireVersion, versionData),
    rawQuestions: versionQuestions.map((question) => ({ ...question, points: COMPANY_QUESTION_POINTS })),
  };
}

function buildQuestionnaireAvailability(
  application: QuestionnaireApplicationRecord,
  questionnaireStatus: string,
  assessment: SerializedCompanyApplicationAssessmentSummary | null,
  attempt: CompanyApplicationQuestionnaireAttemptSummary | null,
) {
  if (!assessment) {
    return {
      available: false,
      status: 'unavailable' as const,
      reasonCode: 'questionnaire_not_configured',
      reason: 'Cette candidature ne dispose pas encore de questionnaire entreprise.',
    };
  }

  if (!isApplicationStatusAllowed(application.status) || !application.requiredResult?.allSatisfied) {
    return {
      available: false,
      status: 'unavailable' as const,
      reasonCode: 'application_not_ready',
      reason: 'La candidature doit etre eligibile avant de repondre au questionnaire.',
    };
  }

  if (assessment.status === 'submitted' || assessment.status === 'completed') {
    return {
      available: false,
      status: 'completed' as const,
    };
  }

  if (attempt?.status === 'expired') {
    return {
      available: false,
      status: 'unavailable' as const,
      reasonCode: 'questionnaire_expired',
      reason: 'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
    };
  }

  if (attempt?.status === 'in_progress') {
    return {
      available: false,
      status: 'in_progress' as const,
    };
  }

  if (questionnaireStatus !== 'active') {
    if (assessment.status === 'expired' || assessment.status === 'abandoned') {
      return {
        available: false,
        status: 'unavailable' as const,
        reasonCode: 'questionnaire_expired',
        reason: 'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
      };
    }

    return {
      available: false,
      status: 'unavailable' as const,
      reasonCode: 'questionnaire_inactive',
      reason: 'Le questionnaire de cette entreprise n est pas actif.',
    };
  }

  if (assessment.status === 'expired' || assessment.status === 'abandoned') {
    return {
      available: true,
      status: 'available' as const,
    };
  }

  return {
    available: true,
    status: 'available' as const,
  };
}

function normalizeSubmissionAnswers(
  raw: unknown,
  questions: CompanyQuestion[],
) {
  if (!isPlainObject(raw)) {
    throw new SevenoApplicationQuestionnaireError('invalid_payload', 400, 'Le contenu envoye est invalide.');
  }

  const questionIds = new Set(questions.map((question) => question.id));
  const entries = Object.entries(raw);
  if (entries.some(([key]) => !questionIds.has(key))) {
    throw new SevenoApplicationQuestionnaireError('invalid_payload', 400, 'Une reponse ne correspond pas au questionnaire.');
  }

  return new Map(entries);
}

function normalizeAnswerValue(question: CompanyQuestion, rawValue: unknown) {
  const empty = rawValue === null || rawValue === undefined || rawValue === '';
  if (question.type === 'single_choice') {
    if (empty) return null;
    const value = cleanText(rawValue, 80);
    if (!value) return null;
    if (!Array.isArray(question.options) || !question.options.some((option) => option.id === value)) {
      throw new SevenoApplicationQuestionnaireError('invalid_answer', 400, `La reponse a ${question.id} est invalide.`);
    }
    return value;
  }
  if (question.type === 'multiple_choice') {
    if (empty) return null;
    if (!Array.isArray(rawValue)) {
      throw new SevenoApplicationQuestionnaireError('invalid_answer', 400, `La reponse a ${question.id} est invalide.`);
    }
    const values = rawValue.map((item) => cleanText(item, 80)).filter(Boolean);
    if (values.length === 0) return null;
    if (new Set(values).size !== values.length || values.some((item) => !question.options.some((option) => option.id === item))) {
      throw new SevenoApplicationQuestionnaireError('invalid_answer', 400, `La reponse a ${question.id} est invalide.`);
    }
    return values;
  }
  if (question.type === 'boolean') {
    if (empty) return null;
    if (typeof rawValue !== 'boolean') {
      throw new SevenoApplicationQuestionnaireError('invalid_answer', 400, `La reponse a ${question.id} est invalide.`);
    }
    return rawValue;
  }
  if (question.type === 'number') {
    if (empty) return null;
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      throw new SevenoApplicationQuestionnaireError('invalid_answer', 400, `La reponse a ${question.id} est invalide.`);
    }
    return rawValue;
  }
  if (question.type === 'short_text' || question.type === 'long_text') {
    if (empty) return null;
    const text = typeof rawValue === 'string' ? rawValue.trim() : '';
    const maxLength = question.type === 'short_text' ? SHORT_TEXT_MAX_LENGTH : LONG_TEXT_MAX_LENGTH;
    if (!text || text.length > maxLength) {
      throw new SevenoApplicationQuestionnaireError('invalid_answer', 400, `La reponse a ${question.id} est invalide.`);
    }
    return text;
  }
  throw new SevenoApplicationQuestionnaireError('invalid_questionnaire', 409, 'Le questionnaire contient un type de question invalide.');
}

function compareArrayValues(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && left.every((value) => rightSet.has(value));
}

function evaluateQuestion(question: CompanyQuestion, value: unknown, timedOut = false): {
  record: CompanyApplicationQuestionnaireAnswerRecord;
  autoScoredPoints: number;
  autoScoredMaximum: number;
  manualQuestionsCount: number;
} {
  const answeredAt = Timestamp.now();
  const normalized = normalizeAnswerValue(question, value);
  const baseRecord: CompanyApplicationQuestionnaireAnswerRecord = {
    questionId: question.id,
    questionType: question.type,
    answerValue: normalized ?? null,
    answeredAt: normalized === null ? null : answeredAt.toDate().toISOString(),
    ...(timedOut ? { timedOutAt: answeredAt.toDate().toISOString() } : {}),
  };

  if (timedOut) {
    const canAutoScore = question.correctionMode === 'automatic'
      && (question.type === 'single_choice'
        || question.type === 'multiple_choice'
        || question.type === 'boolean'
        || question.type === 'number');
    return {
      record: {
        ...baseRecord,
        automaticResult: 'incorrect',
        awardedPoints: 0,
      },
      autoScoredPoints: 0,
      autoScoredMaximum: canAutoScore ? COMPANY_QUESTION_POINTS : 0,
      manualQuestionsCount: 0,
    };
  }

  if (normalized === null) {
    return { record: baseRecord, autoScoredPoints: 0, autoScoredMaximum: 0, manualQuestionsCount: 0 };
  }

  const canAutoScore = question.correctionMode === 'automatic'
    && (question.type === 'single_choice'
      || question.type === 'multiple_choice'
      || question.type === 'boolean'
      || question.type === 'number');
  if (!canAutoScore) {
    return {
      record: {
        ...baseRecord,
        automaticResult: 'manual',
        awardedPoints: null,
        manualReviewStatus: 'pending',
      },
      autoScoredPoints: 0,
      autoScoredMaximum: 0,
      manualQuestionsCount: 1,
    };
  }

  let correct = false;
  if (question.type === 'single_choice' && typeof question.expectedAnswer === 'string') {
    correct = normalized === question.expectedAnswer;
  } else if (question.type === 'multiple_choice' && Array.isArray(question.expectedAnswer) && Array.isArray(normalized)) {
    correct = compareArrayValues(normalized, question.expectedAnswer);
  } else if (question.type === 'boolean' && typeof question.expectedAnswer === 'boolean' && typeof normalized === 'boolean') {
    correct = normalized === question.expectedAnswer;
  } else if (question.type === 'number' && typeof question.expectedAnswer === 'number' && typeof normalized === 'number' && question.numberOperator) {
    if (question.numberOperator === 'equals') {
      correct = normalized === question.expectedAnswer;
    } else if (question.numberOperator === 'minimum') {
      correct = normalized >= question.expectedAnswer;
    } else if (question.numberOperator === 'maximum') {
      correct = normalized <= question.expectedAnswer;
    }
  } else {
    throw new SevenoApplicationQuestionnaireError('questionnaire_invalid', 409, 'Une correction automatique est invalide.');
  }

  return {
    record: {
      ...baseRecord,
      automaticResult: correct ? 'correct' : 'incorrect',
      awardedPoints: correct ? COMPANY_QUESTION_POINTS : 0,
    },
    autoScoredPoints: correct ? COMPANY_QUESTION_POINTS : 0,
    autoScoredMaximum: COMPANY_QUESTION_POINTS,
    manualQuestionsCount: 0,
  };
}

function computeAssessment(
  questions: CompanyQuestion[],
  providedAnswers: Map<string, unknown>,
  timedOutQuestionIds: Set<string> = new Set(),
) {
  const answerRecords: CompanyApplicationQuestionnaireAnswerRecord[] = [];
  let autoScoredPoints = 0;
  let autoScoredMaximum = 0;
  let manualQuestionsCount = 0;

  for (const question of [...questions].sort((left, right) => left.order - right.order)) {
    const provided = providedAnswers.has(question.id);
    const value = provided ? providedAnswers.get(question.id) : null;
    const timedOut = timedOutQuestionIds.has(question.id);
    const effectiveValue = timedOut ? null : value;
    if (!timedOut && question.required && (effectiveValue === null || effectiveValue === undefined || effectiveValue === '' || (Array.isArray(effectiveValue) && effectiveValue.length === 0))) {
      throw new SevenoApplicationQuestionnaireError('question_required', 400, `La question ${question.id} doit etre renseignee.`);
    }
    const scored = evaluateQuestion(question, effectiveValue, timedOut);
    answerRecords.push(scored.record);
    autoScoredPoints += scored.autoScoredPoints;
    autoScoredMaximum += scored.autoScoredMaximum;
    manualQuestionsCount += scored.manualQuestionsCount;
  }

  const automaticScorePercent = calculateCompanyQuestionnaireScorePercent(autoScoredPoints, autoScoredMaximum);
  const manualReviewRequired = manualQuestionsCount > 0;
  const finalScore = manualReviewRequired ? null : automaticScorePercent;
  const status: CompanyApplicationQuestionnaireSessionStatus = manualReviewRequired ? 'submitted' : 'completed';

  return {
    answerRecords,
    automaticScorePercent,
    autoScoredPoints,
    autoScoredMaximum,
    manualReviewRequired,
    manualReviewStatus: manualReviewRequired ? 'pending' as const : 'not_required' as const,
    finalScore,
    status,
    manualQuestionsCount,
    questionCount: questions.length,
    correctAnswerCount: answerRecords.filter((item) => item.automaticResult === 'correct').length,
  };
}

function buildStoredAssessmentSummary(
  questionnaireVersion: string,
  sessionId: string | null,
  resultId: string | null,
  minimumPassingScorePercent: number,
  metrics: AssessmentMetrics,
  startedAt: Timestamp | null,
  submittedAt: Timestamp | null,
) {
  return {
    status: metrics.status,
    automaticScorePercent: metrics.automaticScorePercent,
    autoScoredPoints: metrics.autoScoredPoints,
    autoScoredMaximum: metrics.autoScoredMaximum,
    manualReviewRequired: metrics.manualReviewRequired,
    manualReviewStatus: metrics.manualReviewStatus,
    finalScore: metrics.finalScore,
    minimumPassingScorePercent,
    questionnaireVersion,
    completedAt: submittedAt,
    startedAt,
    submittedAt,
    sessionId,
    resultId,
    manualQuestionsCount: metrics.manualQuestionsCount,
  };
}

export function shuffleQuestionIds(questionIds: string[], rng: () => number = Math.random) {
  const shuffled = [...questionIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function orderQuestionsByIds<T extends { id: string }>(questions: T[], questionIds: string[]) {
  if (!questionIds.length) {
    return [...questions];
  }

  const byId = new Map(questions.map((question) => [question.id, question] as const));
  const ordered = questionIds.map((questionId) => byId.get(questionId)).filter((question): question is T => Boolean(question));
  return ordered.length === questions.length ? ordered : [...questions];
}

function getSessionOrderedQuestions<T extends { id: string }>(session: FirestoreRecord, questions: T[]) {
  if (!Array.isArray(session.questionIds)) {
    return [...questions];
  }

  const questionIds = session.questionIds.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return orderQuestionsByIds(questions, questionIds);
}

function buildSessionRecord(params: {
  candidateUid: string;
  publicCandidateId: string;
  companyUid: string;
  applicationId: string;
  offerId: string;
  offerVersion: number;
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  questionnaireId: string;
  questionnaireVersion: string;
  questionnaireQuestions: CompanyApplicationQuestionnaireProjection['questions'];
  questionTimeSeconds: number;
  minimumPassingScorePercent: number;
  startedAt: Timestamp;
}) {
  const questionIds = shuffleQuestionIds(params.questionnaireQuestions.map((question) => question.id));
  const durationSeconds = questionIds.length > 0 ? params.questionTimeSeconds * questionIds.length : 0;
  const expiresAt = durationSeconds > 0
    ? Timestamp.fromMillis(params.startedAt.toMillis() + durationSeconds * 1000)
    : params.startedAt;
  const firstQuestionExpiresAt = questionIds.length > 0
    ? Timestamp.fromMillis(params.startedAt.toMillis() + params.questionTimeSeconds * 1000)
    : null;

  return {
    uid: params.candidateUid,
    candidateUid: params.candidateUid,
    publicCandidateId: params.publicCandidateId,
    candidateProfileId: params.candidateUid,
    assessmentType: 'company_application',
    questionnaireVersion: params.questionnaireVersion,
    applicationId: params.applicationId,
    offerId: params.offerId,
    companyUid: params.companyUid,
    questionnaireId: params.questionnaireId,
    sectorId: params.sectorId,
    jobFamilyId: params.jobFamilyId,
    jobRoleId: params.jobRoleId,
    questionBankCode: params.questionnaireId,
    questionBankVersion: params.questionnaireVersion,
    status: 'in_progress',
    questionIds,
    answersCount: 0,
    durationSeconds,
    questionTimeSeconds: params.questionTimeSeconds,
    threshold: params.minimumPassingScorePercent,
    score: null,
    correctAnswers: 0,
    totalQuestions: questionIds.length,
    timedOutQuestionIds: [],
    passed: false,
    startedAt: params.startedAt,
    questionStartedAt: params.startedAt,
    questionExpiresAt: firstQuestionExpiresAt,
    currentQuestionIndex: 0,
    currentQuestionId: questionIds[0] ?? null,
    submittedAt: null,
    expiresAt,
    expiredAt: null,
    cancelledAt: null,
    abandonedAt: null,
    lastQuestionId: null,
    answers: {},
    createdAt: params.startedAt,
    updatedAt: params.startedAt,
  };
}

function buildApplicationAccessMessage(code: string) {
  switch (code) {
    case 'application_not_ready':
      return 'La candidature doit etre eligibile avant de repondre au questionnaire.';
    case 'questionnaire_not_configured':
      return 'Cette candidature ne dispose pas encore de questionnaire entreprise.';
    case 'questionnaire_version_missing':
      return 'La version du questionnaire entreprise est indisponible.';
    case 'questionnaire_inactive':
      return 'Le questionnaire de cette entreprise n est pas actif.';
    case 'questionnaire_expired':
      return 'Le temps imparti est depasse. Vous devez recommencer le questionnaire.';
    default:
      return 'Le questionnaire entreprise est temporairement indisponible.';
  }
}

export async function getCandidateApplicationQuestionnaireView(
  candidateUid: string,
  applicationId: string,
): Promise<CompanyApplicationQuestionnaireView> {
  const application = await loadApplication(applicationId, candidateUid);
  const bundle = await loadQuestionnaireBundle(application.data);
  const assessment = serializeAssessment(application.data.companyAssessment, bundle.questionnaireVersion);
  const serverNow = Timestamp.now();
  const firestore = requireDatabase();
  let attempt: CompanyApplicationQuestionnaireAttemptSummary | null = null;
  let orderedQuestions = bundle.projection.questions;
  if (assessment?.sessionId) {
    const sessionSnapshot = await firestore.collection(SESSIONS_COLLECTION).doc(assessment.sessionId).get();
    if (sessionSnapshot.exists) {
      const sessionData = sessionSnapshot.data() as FirestoreRecord;
      attempt = serializeAttempt({ id: sessionSnapshot.id, ...sessionData }, serverNow);
      orderedQuestions = getSessionOrderedQuestions(sessionData, bundle.projection.questions);
    }
  }

  const access = buildQuestionnaireAvailability(application.data, bundle.currentStatus, assessment, attempt);
  return {
    questionnaire:
      access.available || access.status === 'in_progress' || access.status === 'completed'
        ? { ...bundle.projection, questions: orderedQuestions }
        : attempt?.status === 'expired' || assessment?.status === 'expired' || assessment?.status === 'abandoned'
          ? { ...bundle.projection, questions: orderedQuestions }
          : null,
    access,
    assessment,
    attempt,
    applicationStatus: application.data.status,
    serverNow: serverNow.toDate().toISOString(),
  };
}

export async function getCompanyApplicationQuestionnaireReview(
  companyUid: string,
  applicationId: string,
): Promise<CompanyApplicationQuestionnaireReviewView> {
  const firestore = requireDatabase();
  const companyUser = await getSevenoUserByUid(companyUid);
  if (!companyUser || companyUser.role !== 'company') {
    throw new SevenoApplicationQuestionnaireError('forbidden_role', 403, 'Seules les entreprises peuvent consulter les reponses du questionnaire.');
  }
  if (!companyUser.emailVerified) {
    throw new SevenoApplicationQuestionnaireError('email_not_verified', 403, 'Verifiez votre adresse email avant de consulter un questionnaire.');
  }

  const application = await loadCompanyApplication(applicationId, companyUid);
  const bundle = await loadQuestionnaireBundle(application.data);
  const assessment = serializeAssessment(application.data.companyAssessment, bundle.questionnaireVersion);
  const resultId = assessment?.resultId ?? assessment?.sessionId ?? '';
  if (!resultId) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_unavailable',
      409,
      'Le questionnaire du candidat n est pas encore disponible.',
    );
  }

  const resultSnapshot = await firestore.collection(RESULTS_COLLECTION).doc(resultId).get();
  if (!resultSnapshot.exists) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_result_missing',
      404,
      'Le resultat du questionnaire est introuvable.',
    );
  }

  const resultData = resultSnapshot.data() as FirestoreRecord;
  if (
    resultData.companyUid !== companyUid
    || resultData.applicationId !== applicationId
    || resultData.candidateUid !== application.data.candidateUid
    || resultData.questionnaireId !== bundle.questionnaireId
    || String(resultData.questionnaireVersion ?? '') !== bundle.questionnaireVersion
    || resultData.assessmentType !== 'company_application'
  ) {
    throw new SevenoApplicationQuestionnaireError(
      'forbidden_questionnaire',
      403,
      'Ce questionnaire ne vous appartient pas.',
    );
  }

  const sessionSnapshot = assessment?.sessionId
    ? await firestore.collection(SESSIONS_COLLECTION).doc(assessment.sessionId).get()
    : null;
  const attempt = sessionSnapshot?.exists && assessment?.sessionId
    ? serializeAttempt({ id: sessionSnapshot.id, ...sessionSnapshot.data() as FirestoreRecord }, Timestamp.now())
    : null;

  return {
    questionnaire: buildQuestionnaireReviewProjection(bundle.questionnaireVersion, {
      title: bundle.projection.title,
      instructions: bundle.projection.instructions,
      durationMinutes: bundle.projection.durationMinutes,
      questionTimeSeconds: bundle.projection.questionTimeSeconds,
      status: bundle.projection.status,
      questionnaireVersion: bundle.questionnaireVersion,
      questions: bundle.rawQuestions,
    }),
    assessment,
    attempt,
    answers: Array.isArray(resultData.companyApplicationAnswers)
      ? resultData.companyApplicationAnswers as CompanyApplicationQuestionnaireAnswerRecord[]
      : [],
    applicationStatus: application.data.status,
    serverNow: Timestamp.now().toDate().toISOString(),
  };
}

export async function startCandidateApplicationQuestionnaire(
  candidateUid: string,
  applicationId: string,
): Promise<CompanyApplicationQuestionnaireView> {
  const firestore = requireDatabase();
  const user = await getSevenoUserByUid(candidateUid);
  if (!user || user.role !== 'candidate') {
    throw new SevenoApplicationQuestionnaireError('forbidden_role', 403, 'Seuls les candidats peuvent repondre au questionnaire de l entreprise.');
  }

  const application = await loadApplication(applicationId, candidateUid);
  const bundle = await loadQuestionnaireBundle(application.data);
  const questionnaireProjection = bundle.projection;
  const questionnaireVersion = bundle.questionnaireVersion;
  const questionnaireId = bundle.questionnaireId;
  const minimumPassingScorePercent = bundle.minimumPassingScorePercent;

  const appRef = application.ref;
  const sessionRef = firestore.collection(SESSIONS_COLLECTION).doc();
  const publicCandidateId = cleanText(application.data.publicCandidateId, 40);
  if (!publicCandidateId) {
    throw new SevenoApplicationQuestionnaireError('application_invalid', 409, 'La candidature est invalide.');
  }

  const currentAttempt = serializeAssessment(application.data.companyAssessment, questionnaireVersion);
  if (currentAttempt?.status === 'submitted' || currentAttempt?.status === 'completed') {
    return getCandidateApplicationQuestionnaireView(candidateUid, applicationId);
  }

  if (currentAttempt?.status === 'in_progress' && currentAttempt.sessionId) {
    const currentSessionSnapshot = await firestore.collection(SESSIONS_COLLECTION).doc(currentAttempt.sessionId).get();
    if (currentSessionSnapshot.exists && currentSessionSnapshot.get('status') === 'in_progress') {
      const currentSession = currentSessionSnapshot.data() as FirestoreRecord;
      const serializedAttempt = serializeAttempt({ id: currentSessionSnapshot.id, ...currentSession }, Timestamp.now());
      if (serializedAttempt?.status === 'in_progress') {
        return getCandidateApplicationQuestionnaireView(candidateUid, applicationId);
      }
    }
  }

  const currentAttemptStatus = currentAttempt?.status as CompanyApplicationQuestionnaireSessionStatus | undefined;
  if (bundle.currentStatus !== 'active' && !(currentAttemptStatus === 'in_progress' || currentAttemptStatus === 'submitted' || currentAttemptStatus === 'completed')) {
    throw new SevenoApplicationQuestionnaireError(
      'questionnaire_inactive',
      409,
      buildApplicationAccessMessage('questionnaire_inactive'),
    );
  }

  const now = Timestamp.now();
  await firestore.runTransaction(async (transaction) => {
    const [appSnapshot, currentSessionSnapshot] = await Promise.all([
      transaction.get(appRef),
      currentAttempt?.sessionId ? transaction.get(firestore.collection(SESSIONS_COLLECTION).doc(currentAttempt.sessionId)) : Promise.resolve(null),
    ]);

    if (!appSnapshot.exists || appSnapshot.get('candidateUid') !== candidateUid) {
      throw new SevenoApplicationQuestionnaireError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
    }

    const appData = appSnapshot.data() as FirestoreRecord;
    if (!isApplicationStatusAllowed(String(appData.status ?? ''))) {
      throw new SevenoApplicationQuestionnaireError(
        'questionnaire_unavailable',
        409,
        'Cette candidature n autorise pas encore le questionnaire de l entreprise.',
      );
    }

    if (!isPlainObject(appData.requiredResult) || appData.requiredResult.allSatisfied !== true) {
      throw new SevenoApplicationQuestionnaireError(
        'questionnaire_unavailable',
        409,
        'Les prerequis obligatoires doivent etre satisfaits avant de repondre au questionnaire.',
      );
    }

    const storedAssessment = serializeAssessment(appData.companyAssessment, questionnaireVersion);
    if (storedAssessment?.status === 'submitted' || storedAssessment?.status === 'completed') {
      return;
    }

    if (currentSessionSnapshot && currentSessionSnapshot.exists) {
      const session = currentSessionSnapshot.data() as FirestoreRecord;
      const currentSessionId = currentSessionSnapshot.id;
      const sessionStatus = session.status === 'in_progress' || session.status === 'submitted' || session.status === 'expired' || session.status === 'abandoned'
        ? session.status
        : 'in_progress';
      if (sessionStatus === 'in_progress') {
        const serializedAttempt = serializeAttempt({ id: currentSessionId, ...session }, now);
        if (serializedAttempt?.status === 'expired') {
          transaction.update(currentSessionSnapshot.ref, {
            status: 'expired',
            expiredAt: now,
            updatedAt: now,
          });
          transaction.update(appRef, {
            companyAssessment: buildStoredAssessmentSummary(
              questionnaireVersion,
              currentSessionId,
              currentAttempt?.resultId ?? null,
              minimumPassingScorePercent,
              {
                status: 'expired',
                automaticScorePercent: null,
                autoScoredPoints: null,
                autoScoredMaximum: null,
                manualReviewRequired: false,
                manualReviewStatus: 'not_required',
                finalScore: null,
                questionnaireVersion,
                completedAt: null,
                startedAt: session.startedAt instanceof Timestamp ? session.startedAt : now,
                submittedAt: null,
                sessionId: currentSessionId,
                resultId: currentAttempt?.resultId ?? null,
                minimumPassingScorePercent,
                manualQuestionsCount: 0,
              },
              session.startedAt instanceof Timestamp ? session.startedAt : now,
              null,
            ),
            updatedAt: now,
          });
        } else {
          return;
        }
      }
    }

    const sessionRecord = buildSessionRecord({
      candidateUid,
      publicCandidateId,
      companyUid: application.data.companyUid,
      applicationId,
      offerId: application.data.offerId,
      offerVersion: application.data.offerVersion,
      sectorId: application.data.offerSnapshot.sectorId,
      jobFamilyId: application.data.offerSnapshot.jobFamilyId,
      jobRoleId: application.data.offerSnapshot.jobRoleId,
      questionnaireId,
      questionnaireVersion,
      questionnaireQuestions: questionnaireProjection.questions,
      questionTimeSeconds: COMPANY_QUESTION_TIME_LIMIT_SECONDS,
      minimumPassingScorePercent,
      startedAt: now,
    });

    transaction.create(sessionRef, sessionRecord);
    transaction.update(appRef, {
      status: 'questionnaire_pending',
      companyAssessment: buildStoredAssessmentSummary(
        questionnaireVersion,
        sessionRef.id,
        null,
        minimumPassingScorePercent,
        {
          status: 'in_progress',
          automaticScorePercent: null,
          autoScoredPoints: null,
          autoScoredMaximum: null,
          manualReviewRequired: false,
          manualReviewStatus: 'not_required',
          finalScore: null,
          questionnaireVersion,
          completedAt: null,
          startedAt: now,
          submittedAt: null,
          sessionId: sessionRef.id,
          resultId: null,
          minimumPassingScorePercent,
          manualQuestionsCount: 0,
        },
        now,
        null,
      ),
      updatedAt: now,
    });
  });

  return getCandidateApplicationQuestionnaireView(candidateUid, applicationId);
}

async function dispatchQuestionnaireCompletedNotification(eventId: string | null) {
  if (!eventId) {
    return;
  }
  try {
    await dispatchCompanyNotificationEvent(eventId);
  } catch (error) {
    console.error('[SevenO company notifications] Questionnaire completion delivery deferred', {
      eventId,
      code: error instanceof Error && 'code' in error
        ? String((error as { code?: unknown }).code ?? 'unknown')
        : 'unknown',
    });
  }
}

export async function submitCandidateApplicationQuestionnaire(
  candidateUid: string,
  applicationId: string,
  sessionId: string,
  rawAnswers: unknown,
): Promise<CompanyApplicationQuestionnaireView> {
  const firestore = requireDatabase();
  const user = await getSevenoUserByUid(candidateUid);
  if (!user || user.role !== 'candidate') {
    throw new SevenoApplicationQuestionnaireError('forbidden_role', 403, 'Seuls les candidats peuvent repondre au questionnaire de l entreprise.');
  }

  const application = await loadApplication(applicationId, candidateUid);
  const bundle = await loadQuestionnaireBundle(application.data);
  const appRef = application.ref;
  const sessionRef = firestore.collection(SESSIONS_COLLECTION).doc(cleanText(sessionId, 120));
  const resultRef = firestore.collection(RESULTS_COLLECTION).doc(cleanText(sessionId, 120));
  const questions = bundle.rawQuestions;
  const minimumPassingScorePercent = bundle.minimumPassingScorePercent;
  const now = Timestamp.now();
  const payload = isPlainObject(rawAnswers) ? rawAnswers : null;

  if (payload && typeof payload.questionId === 'string') {
    const questionId = cleanText(payload.questionId, 120);
    const providedAnswer = 'answer' in payload ? payload.answer : null;

    const transactionResult = await firestore.runTransaction(async (transaction) => {
      const [appSnapshot, sessionSnapshot, resultSnapshot] = await Promise.all([
        transaction.get(appRef),
        transaction.get(sessionRef),
        transaction.get(resultRef),
      ]);

      if (!appSnapshot.exists || appSnapshot.get('candidateUid') !== candidateUid) {
        throw new SevenoApplicationQuestionnaireError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
      }

      const appData = appSnapshot.data() as FirestoreRecord;
      const summary = serializeAssessment(appData.companyAssessment, bundle.questionnaireVersion);
      if (!summary?.sessionId || summary.sessionId !== sessionId) {
        throw new SevenoApplicationQuestionnaireError('forbidden_session', 403, 'Cette tentative ne vous appartient pas.');
      }

      if (!sessionSnapshot.exists) {
        throw new SevenoApplicationQuestionnaireError('session_not_found', 404, 'Tentative de questionnaire introuvable.');
      }

      const session = sessionSnapshot.data() as FirestoreRecord;
      if (session.applicationId !== applicationId || session.candidateUid !== candidateUid) {
        throw new SevenoApplicationQuestionnaireError('forbidden_session', 403, 'Cette tentative ne vous appartient pas.');
      }

      if (session.status !== 'in_progress') {
        if (session.status === 'expired') {
          throw new SevenoApplicationQuestionnaireError(
            'session_expired',
            409,
            'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
          );
        }
        if ((session.status === 'submitted' || session.status === 'completed') && resultSnapshot.exists) {
          return {
            committed: true,
            notificationEventId: buildApplicationQuestionnaireCompletedNotificationEventId(applicationId, sessionId),
          };
        }
        throw new SevenoApplicationQuestionnaireError('session_not_active', 409, 'Cette tentative de questionnaire n est plus active.');
      }

      const serializedAttempt = serializeAttempt({ id: sessionSnapshot.id, ...session }, now);
      if (serializedAttempt?.status === 'expired') {
        transaction.update(sessionRef, {
          status: 'expired',
          expiredAt: now,
          updatedAt: now,
        });
        transaction.update(appRef, {
          companyAssessment: buildStoredAssessmentSummary(
            summary.questionnaireVersion,
            sessionId,
            summary.resultId,
            minimumPassingScorePercent,
            {
              status: 'expired',
              automaticScorePercent: null,
              autoScoredPoints: null,
              autoScoredMaximum: null,
              manualReviewRequired: false,
              manualReviewStatus: 'not_required',
              finalScore: null,
              questionnaireVersion: summary.questionnaireVersion,
              completedAt: null,
              startedAt: toTimestamp(session.startedAt),
              submittedAt: null,
              sessionId,
              resultId: summary.resultId,
              minimumPassingScorePercent,
              manualQuestionsCount: 0,
            },
            toTimestamp(session.startedAt),
            null,
          ),
          updatedAt: now,
        });
        throw new SevenoApplicationQuestionnaireError(
          'session_expired',
          409,
          'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
        );
      }

      const sessionQuestions = getSessionOrderedQuestions(session, questions);
      const currentQuestionId = typeof session.currentQuestionId === 'string' && session.currentQuestionId
        ? session.currentQuestionId
        : sessionQuestions[Math.max(0, typeof session.currentQuestionIndex === 'number' ? session.currentQuestionIndex : 0)]?.id ?? '';
      const currentQuestionIndex = typeof session.currentQuestionIndex === 'number' && Number.isFinite(session.currentQuestionIndex)
        ? session.currentQuestionIndex
        : sessionQuestions.findIndex((item) => item.id === currentQuestionId);
      const question = sessionQuestions[currentQuestionIndex] ?? sessionQuestions.find((item) => item.id === currentQuestionId);
      if (!question) {
        throw new SevenoApplicationQuestionnaireError('question_not_found', 404, 'La question en cours est introuvable.');
      }
      if (question.id !== questionId) {
        throw new SevenoApplicationQuestionnaireError('question_mismatch', 409, 'La question envoyee ne correspond pas a la question en cours.');
      }

      const questionExpiresAt = toTimestamp(session.questionExpiresAt);
      const timedOut = payload.timeout === true
        || Boolean(questionExpiresAt && questionExpiresAt.toMillis() <= now.toMillis());
      const normalizedAnswer = timedOut ? null : normalizeAnswerValue(question, providedAnswer);
      if (!timedOut && question.required && (normalizedAnswer === null || normalizedAnswer === undefined || normalizedAnswer === '' || (Array.isArray(normalizedAnswer) && normalizedAnswer.length === 0))) {
        throw new SevenoApplicationQuestionnaireError('question_required', 400, `La question ${question.id} doit etre renseignee.`);
      }

      const storedAnswers = isPlainObject(session.answers) ? { ...session.answers } : {};
      storedAnswers[question.id] = normalizedAnswer;
      const timedOutQuestionIds = Array.isArray(session.timedOutQuestionIds)
        ? session.timedOutQuestionIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [];
      if (timedOut && !timedOutQuestionIds.includes(question.id)) {
        timedOutQuestionIds.push(question.id);
      }
      const answersCount = Object.values(storedAnswers).filter((value) => value !== null && value !== undefined && value !== '').length;
      const isLastQuestion = currentQuestionIndex >= sessionQuestions.length - 1;

      if (!isLastQuestion) {
        const nextQuestion = sessionQuestions[currentQuestionIndex + 1];
        transaction.update(sessionRef, {
          status: 'in_progress',
          answers: storedAnswers,
          timedOutQuestionIds,
          answersCount,
          lastQuestionId: question.id,
          currentQuestionIndex: currentQuestionIndex + 1,
          currentQuestionId: nextQuestion.id,
          questionStartedAt: now,
          questionExpiresAt: Timestamp.fromMillis(now.toMillis() + COMPANY_QUESTION_TIME_LIMIT_SECONDS * 1000),
          updatedAt: now,
        });
        return { committed: true, notificationEventId: null };
      }

      const fullAnswers = new Map(Object.entries(storedAnswers));
      const assessment = computeAssessment(sessionQuestions, fullAnswers, new Set(timedOutQuestionIds));
      const startedAt = toTimestamp(session.startedAt) ?? now;
      const submittedAt = now;
      const questionnaireVersion = summary.questionnaireVersion;
      const totalDurationSeconds = sessionQuestions.length > 0 ? COMPANY_QUESTION_TIME_LIMIT_SECONDS * sessionQuestions.length : 0;
      const scorePercent = assessment.finalScore ?? assessment.automaticScorePercent ?? 0;
      const resultPayload = {
        uid: candidateUid,
        candidateUid,
        publicCandidateId: cleanText(session.publicCandidateId ?? application.data.publicCandidateId, 40),
        sessionId,
        candidateProfileId: candidateUid,
        assessmentType: 'company_application',
        questionnaireVersion,
        applicationId,
        offerId: application.data.offerId,
        companyUid: application.data.companyUid,
        questionnaireId: bundle.questionnaireId,
        status: 'completed',
        sectorId: application.data.offerSnapshot.sectorId,
        jobFamilyId: application.data.offerSnapshot.jobFamilyId,
        jobRoleId: application.data.offerSnapshot.jobRoleId,
        questionBankCode: bundle.questionnaireId,
        questionBankVersion: questionnaireVersion,
        score: scorePercent,
        overallScore: assessment.finalScore ?? assessment.automaticScorePercent ?? null,
        correctAnswers: assessment.answerRecords.filter((item) => item.automaticResult === 'correct').length,
        totalQuestions: assessment.questionCount,
        passed: scorePercent >= minimumPassingScorePercent,
        threshold: minimumPassingScorePercent,
        durationSeconds: totalDurationSeconds,
        answersCount: assessment.answerRecords.filter((item) => item.answeredAt !== null).length,
        submittedAt,
        questionIds: sessionQuestions.map((item) => item.id),
        answers: Object.fromEntries(assessment.answerRecords.map((item) => [item.questionId, item.answerValue])),
        companyApplicationAnswers: assessment.answerRecords,
        autoScoredPoints: assessment.autoScoredPoints,
        autoScoredMaximum: assessment.autoScoredMaximum,
        automaticScorePercent: assessment.automaticScorePercent,
        manualReviewRequired: assessment.manualReviewRequired,
        manualReviewStatus: assessment.manualReviewStatus,
        finalScore: assessment.finalScore,
        manualQuestionsCount: assessment.manualQuestionsCount,
        timedOutQuestionIds,
        startedAt,
        createdAt: submittedAt,
        verifiedAt: submittedAt,
      };

      const notificationEvent = await prepareApplicationQuestionnaireCompletedNotificationEvent(
        transaction,
        firestore,
        {
          applicationId,
          offerId: cleanText(appData.offerId, 120),
          companyUid: cleanText(appData.companyUid, 120),
          resultId: resultRef.id,
          now: submittedAt,
        },
      );
      transaction.create(resultRef, resultPayload);
      transaction.update(sessionRef, {
        status: assessment.status,
        score: scorePercent,
        overallScore: assessment.finalScore ?? assessment.automaticScorePercent ?? null,
        correctAnswers: assessment.answerRecords.filter((item) => item.automaticResult === 'correct').length,
        totalQuestions: assessment.questionCount,
        passed: scorePercent >= minimumPassingScorePercent,
        threshold: minimumPassingScorePercent,
        answersCount: assessment.answerRecords.filter((item) => item.answeredAt !== null).length,
        answers: storedAnswers,
        timedOutQuestionIds,
        lastQuestionId: question.id,
        currentQuestionIndex: currentQuestionIndex + 1,
        currentQuestionId: null,
        questionStartedAt: now,
        questionExpiresAt: null,
        submittedAt,
        updatedAt: submittedAt,
      });
      transaction.update(appRef, {
        status: 'questionnaire_completed',
        companyAssessment: buildStoredAssessmentSummary(
          questionnaireVersion,
          sessionId,
          resultRef.id,
          minimumPassingScorePercent,
          assessment,
          startedAt,
          submittedAt,
        ),
        updatedAt: submittedAt,
      });
      return { committed: true, notificationEventId: notificationEvent.eventId };
    });

    if (!transactionResult.committed) {
      throw new SevenoApplicationQuestionnaireError('submission_failed', 409, 'La soumission du questionnaire a echoue.');
    }

    await dispatchQuestionnaireCompletedNotification(transactionResult.notificationEventId);
    return getCandidateApplicationQuestionnaireView(candidateUid, applicationId);
  }

  const providedAnswers = normalizeSubmissionAnswers(rawAnswers, questions);

  const transactionResult = await firestore.runTransaction(async (transaction) => {
    const [appSnapshot, sessionSnapshot, resultSnapshot] = await Promise.all([
      transaction.get(appRef),
      transaction.get(sessionRef),
      transaction.get(resultRef),
    ]);

    if (!appSnapshot.exists || appSnapshot.get('candidateUid') !== candidateUid) {
      throw new SevenoApplicationQuestionnaireError('forbidden_application', 403, 'Cette candidature ne vous appartient pas.');
    }

    const appData = appSnapshot.data() as FirestoreRecord;
    const summary = serializeAssessment(appData.companyAssessment, bundle.questionnaireVersion);
    if (!summary?.sessionId || summary.sessionId !== sessionId) {
      throw new SevenoApplicationQuestionnaireError('forbidden_session', 403, 'Cette tentative ne vous appartient pas.');
    }

    if (resultSnapshot.exists && sessionSnapshot.exists && (sessionSnapshot.get('status') === 'submitted' || sessionSnapshot.get('status') === 'completed')) {
      return {
        committed: true,
        notificationEventId: buildApplicationQuestionnaireCompletedNotificationEventId(applicationId, sessionId),
      };
    }

    if (!sessionSnapshot.exists) {
      throw new SevenoApplicationQuestionnaireError('session_not_found', 404, 'Tentative de questionnaire introuvable.');
    }

    const session = sessionSnapshot.data() as FirestoreRecord;
    if (session.applicationId !== applicationId || session.candidateUid !== candidateUid) {
      throw new SevenoApplicationQuestionnaireError('forbidden_session', 403, 'Cette tentative ne vous appartient pas.');
    }
    if (session.status !== 'in_progress') {
      if (session.status === 'expired') {
        throw new SevenoApplicationQuestionnaireError(
          'session_expired',
          409,
          'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
        );
      }
      if ((session.status === 'submitted' || session.status === 'completed') && resultSnapshot.exists) {
        return {
          committed: true,
          notificationEventId: buildApplicationQuestionnaireCompletedNotificationEventId(applicationId, sessionId),
        };
      }
      throw new SevenoApplicationQuestionnaireError('session_not_active', 409, 'Cette tentative de questionnaire n est plus active.');
    }

    const expiresAt = toTimestamp(session.expiresAt);
    if (typeof session.durationSeconds === 'number' && session.durationSeconds > 0 && expiresAt && expiresAt.toMillis() <= now.toMillis()) {
      transaction.update(sessionRef, {
        status: 'expired',
        expiredAt: now,
        updatedAt: now,
      });
      transaction.update(appRef, {
        companyAssessment: buildStoredAssessmentSummary(
          summary.questionnaireVersion,
          sessionId,
          summary.resultId,
          minimumPassingScorePercent,
          {
            status: 'expired',
            automaticScorePercent: null,
            autoScoredPoints: null,
            autoScoredMaximum: null,
            manualReviewRequired: false,
            manualReviewStatus: 'not_required',
            finalScore: null,
            questionnaireVersion: summary.questionnaireVersion,
            completedAt: null,
            startedAt: toTimestamp(session.startedAt),
            submittedAt: null,
            sessionId,
            resultId: summary.resultId,
            minimumPassingScorePercent,
            manualQuestionsCount: 0,
          },
          toTimestamp(session.startedAt),
          null,
        ),
        updatedAt: now,
      });
      throw new SevenoApplicationQuestionnaireError(
        'session_expired',
        409,
        'Le temps imparti est depasse. Vous devez recommencer le questionnaire.',
      );
    }

    const sessionQuestions = getSessionOrderedQuestions(session, questions);
    const timedOutQuestionIds = new Set(
      Array.isArray(session.timedOutQuestionIds)
        ? session.timedOutQuestionIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : [],
    );
      const assessment = computeAssessment(sessionQuestions, providedAnswers, timedOutQuestionIds);
      const startedAt = toTimestamp(session.startedAt) ?? now;
      const submittedAt = now;
      const questionnaireVersion = summary.questionnaireVersion;
      const scorePercent = assessment.finalScore ?? assessment.automaticScorePercent ?? 0;
      const resultPayload = {
      uid: candidateUid,
      candidateUid,
      publicCandidateId: cleanText(session.publicCandidateId ?? application.data.publicCandidateId, 40),
      sessionId,
      candidateProfileId: candidateUid,
      assessmentType: 'company_application',
      questionnaireVersion,
      applicationId,
      offerId: application.data.offerId,
      companyUid: application.data.companyUid,
      questionnaireId: bundle.questionnaireId,
      status: 'completed',
      sectorId: application.data.offerSnapshot.sectorId,
      jobFamilyId: application.data.offerSnapshot.jobFamilyId,
        jobRoleId: application.data.offerSnapshot.jobRoleId,
        questionBankCode: bundle.questionnaireId,
        questionBankVersion: questionnaireVersion,
        score: scorePercent,
        overallScore: assessment.finalScore ?? assessment.automaticScorePercent ?? null,
        correctAnswers: assessment.answerRecords.filter((item) => item.automaticResult === 'correct').length,
        totalQuestions: assessment.questionCount,
        passed: scorePercent >= minimumPassingScorePercent,
        threshold: minimumPassingScorePercent,
        durationSeconds: session.durationSeconds ?? 0,
      answersCount: assessment.answerRecords.filter((item) => item.answeredAt !== null).length,
      submittedAt,
      questionIds: sessionQuestions.map((question) => question.id),
      answers: Object.fromEntries(assessment.answerRecords.map((item) => [item.questionId, item.answerValue])),
      companyApplicationAnswers: assessment.answerRecords,
      autoScoredPoints: assessment.autoScoredPoints,
      autoScoredMaximum: assessment.autoScoredMaximum,
      automaticScorePercent: assessment.automaticScorePercent,
      manualReviewRequired: assessment.manualReviewRequired,
      manualReviewStatus: assessment.manualReviewStatus,
      finalScore: assessment.finalScore,
      manualQuestionsCount: assessment.manualQuestionsCount,
      timedOutQuestionIds: [...timedOutQuestionIds],
      startedAt,
      createdAt: submittedAt,
      verifiedAt: submittedAt,
    };

    const notificationEvent = await prepareApplicationQuestionnaireCompletedNotificationEvent(
      transaction,
      firestore,
      {
        applicationId,
        offerId: cleanText(appData.offerId, 120),
        companyUid: cleanText(appData.companyUid, 120),
        resultId: resultRef.id,
        now: submittedAt,
      },
    );
    transaction.create(resultRef, resultPayload);
      transaction.update(sessionRef, {
        status: assessment.status,
        score: scorePercent,
        overallScore: assessment.finalScore ?? assessment.automaticScorePercent ?? null,
        correctAnswers: assessment.answerRecords.filter((item) => item.automaticResult === 'correct').length,
        totalQuestions: assessment.questionCount,
        passed: scorePercent >= minimumPassingScorePercent,
        threshold: minimumPassingScorePercent,
        answersCount: assessment.answerRecords.filter((item) => item.answeredAt !== null).length,
      submittedAt,
      timedOutQuestionIds: [...timedOutQuestionIds],
      updatedAt: submittedAt,
      ...(assessment.status === 'completed' ? { lastQuestionId: sessionQuestions.at(-1)?.id ?? null } : {}),
    });
    transaction.update(appRef, {
      status: 'questionnaire_completed',
      companyAssessment: buildStoredAssessmentSummary(
        questionnaireVersion,
        sessionId,
        resultRef.id,
        minimumPassingScorePercent,
        assessment,
        startedAt,
        submittedAt,
      ),
      updatedAt: submittedAt,
    });
    return { committed: true, notificationEventId: notificationEvent.eventId };
  });

  if (!transactionResult.committed) {
    throw new SevenoApplicationQuestionnaireError('submission_failed', 409, 'La soumission du questionnaire a echoue.');
  }

  await dispatchQuestionnaireCompletedNotification(transactionResult.notificationEventId);
  return getCandidateApplicationQuestionnaireView(candidateUid, applicationId);
}
