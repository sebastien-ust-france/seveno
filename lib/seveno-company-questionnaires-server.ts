import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { getJobOffer } from '@/lib/seveno-job-offers-server';
import { buildCompanyQuestionnaireAiPrompt } from '@/lib/seveno-company-questionnaire-ai';
import { classifyOfferPrerequisites } from '@/lib/seveno-prerequisite-families';
import { getSevenoUserByUid } from '@/lib/seveno-match-requests';
import {
  COMPANY_QUESTION_POINTS,
  COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT,
  COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION,
  COMPANY_QUESTIONNAIRE_QUESTION_COUNT,
} from '@/lib/seveno-company-questionnaire-constants';
import { normalizeQuestionnaireMinimumPassingScorePercent } from '@/lib/seveno-company-questionnaire-thresholds';
import {
  resolveCompanyQuestionnaireForOffer,
  SevenoCompanyQuestionnaireResolutionError,
} from '@/lib/seveno-company-questionnaire-resolver';
import type {
  CompanyQuestion,
  CompanyQuestionCorrectionMode,
  CompanyQuestionDifficulty,
  CompanyQuestionEditorProjection,
  CompanyQuestionExpectedAnswer,
  CompanyQuestionnaireCreationMode,
  CompanyQuestionnaireListItem,
  CompanyQuestionnaireEditorProjection,
  CompanyQuestionnaireInput,
  CompanyQuestionType,
} from '@/types/seveno-company-questionnaires';

const COLLECTION = 'company_questionnaires';
const OFFERS_COLLECTION = 'job_offers';
const QUESTION_TYPES: CompanyQuestionType[] = [
  'single_choice',
  'multiple_choice',
  'boolean',
  'number',
  'short_text',
  'long_text',
];
const AUTOMATIC_TYPES: CompanyQuestionType[] = ['single_choice', 'multiple_choice', 'boolean', 'number'];
const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

type FirestoreRecord = Record<string, unknown>;

export class SevenoCompanyQuestionnaireError extends Error {
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
    throw new SevenoCompanyQuestionnaireError('firebase_admin_missing', 500, 'Firebase Admin n est pas configure pour les questionnaires.');
  }
  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number, required = false) {
  const text = typeof value === 'string' ? value.trim() : '';
  if ((required && !text) || text.length > maxLength) {
    throw new SevenoCompanyQuestionnaireError('invalid_questionnaire', 400, 'Un champ du questionnaire est invalide.');
  }
  return text;
}

function timestampToIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function normalizeOptionLabel(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeOptions(raw: unknown, type: CompanyQuestionType) {
  const choice = type === 'single_choice' || type === 'multiple_choice';
  if (!Array.isArray(raw)) {
    if (choice) throw new SevenoCompanyQuestionnaireError('options_required', 400, 'Les choix de reponse sont obligatoires.');
    return [];
  }
  const options = raw.map((item, index) => {
    if (!isPlainObject(item)) throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'Une option est invalide.');
    const order = item.order === undefined
      ? index + 1
      : typeof item.order === 'number' && Number.isInteger(item.order) && item.order >= 1
        ? item.order
        : null;
    if (order === null) throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'L ordre d une option est invalide.');
    return {
      id: cleanText(item.id ?? item.value, 80, true),
      label: cleanText(item.label, 160, true),
      order,
    };
  }).sort((left, right) => left.order - right.order);
  if (!choice && options.length > 0) throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'Ce type de question ne doit pas contenir d options.');
  if (choice && (options.length < 2 || options.length > 4)) throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'Une question a choix doit proposer entre 2 et 4 options.');
  if (options.some((item) => !QUESTION_ID_PATTERN.test(item.id))) throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'L identifiant d une option est invalide.');
  if (new Set(options.map((item) => item.id)).size !== options.length) throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'Les identifiants des options doivent etre uniques.');
  if (new Set(options.map((item) => item.order)).size !== options.length) throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'Les ordres des options doivent etre uniques.');
  if (new Set(options.map((item) => normalizeOptionLabel(item.label))).size !== options.length) {
    throw new SevenoCompanyQuestionnaireError('invalid_options', 400, 'Les libellés des options doivent être différents.');
  }
  return options;
}

function normalizeExpectedAnswer(
  raw: unknown,
  type: CompanyQuestionType,
  options: Array<{ id: string; label: string; order: number }>,
): CompanyQuestionExpectedAnswer {
  if (type === 'boolean' && typeof raw === 'boolean') return raw;
  if (type === 'number' && typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (type === 'single_choice' && typeof raw === 'string' && options.some((item) => item.id === raw)) return raw;
  if (type === 'multiple_choice' && Array.isArray(raw) && raw.length > 0 && raw.every((item) => typeof item === 'string' && options.some((option) => option.id === item)) && new Set(raw).size === raw.length) return [...raw];
  throw new SevenoCompanyQuestionnaireError('invalid_expected_answer', 400, 'La correction automatique est invalide.');
}

function normalizeDifficulty(raw: unknown, existing?: CompanyQuestion): CompanyQuestion['difficulty'] {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') {
    return raw;
  }
  return existing?.difficulty;
}

function normalizeCreationMode(raw: unknown): CompanyQuestionnaireCreationMode {
  return raw === 'ai_import' ? 'ai_import' : 'manual';
}

function aiQuestionnaireContractSignature(questions: CompanyQuestion[]) {
  return JSON.stringify(questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    help: question.help ?? '',
    explanation: question.explanation ?? '',
    type: question.type,
    required: question.required,
    options: question.options,
    correctionMode: question.correctionMode,
    expectedAnswer: question.expectedAnswer,
    order: question.order,
    difficulty: question.difficulty,
  })));
}

function assertAiQuestionnaireContract(questions: CompanyQuestion[], existingQuestions: CompanyQuestion[]) {
  const difficultyCounts = questions.reduce<Record<CompanyQuestionDifficulty, number>>((counts, question) => {
    if (question.difficulty) counts[question.difficulty] += 1;
    return counts;
  }, { easy: 0, medium: 0, hard: 0 });
  const valid = questions.length === COMPANY_QUESTIONNAIRE_QUESTION_COUNT
    && questions.every((question) => (
      (question.type === 'single_choice' || question.type === 'multiple_choice')
      && question.required === true
      && question.correctionMode === 'automatic'
      && Boolean(question.explanation?.trim())
      && question.points === COMPANY_QUESTION_POINTS
    ))
    && difficultyCounts.easy === COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy
    && difficultyCounts.medium === COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.medium
    && difficultyCounts.hard === COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.hard;
  if (valid) return;

  const unchangedLegacy = existingQuestions.length > 0
    && aiQuestionnaireContractSignature(questions) === aiQuestionnaireContractSignature(existingQuestions);
  if (unchangedLegacy) return;

  throw new SevenoCompanyQuestionnaireError(
    'invalid_ai_questionnaire_contract',
    400,
    `Un questionnaire IA doit contenir exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions automatiques obligatoires, `
      + `réparties en ${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.easy} faciles, `
      + `${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.medium} moyennes et ${COMPANY_QUESTIONNAIRE_DIFFICULTY_DISTRIBUTION.hard} difficiles.`,
  );
}

function normalizeQuestion(raw: unknown, existing?: CompanyQuestion): CompanyQuestion {
  if (!isPlainObject(raw)) throw new SevenoCompanyQuestionnaireError('invalid_question', 400, 'Une question est invalide.');
  const id = cleanText(raw.id, 80, true);
  if (!QUESTION_ID_PATTERN.test(id)) throw new SevenoCompanyQuestionnaireError('invalid_question_id', 400, 'L identifiant de question est invalide.');
  const type = raw.type as CompanyQuestionType;
  if (!QUESTION_TYPES.includes(type)) throw new SevenoCompanyQuestionnaireError('invalid_question_type', 400, 'Le type de question est invalide.');
  const options = normalizeOptions(raw.options, type);
  const correctionMode: CompanyQuestionCorrectionMode = raw.correctionMode === 'automatic' ? 'automatic' : 'manual';
  if (correctionMode === 'automatic' && !AUTOMATIC_TYPES.includes(type)) {
    throw new SevenoCompanyQuestionnaireError('invalid_correction_mode', 400, 'Une reponse libre ne peut pas etre corrigee automatiquement.');
  }
  const points = raw.points === undefined || raw.points === COMPANY_QUESTION_POINTS
    ? COMPANY_QUESTION_POINTS
    : null;
  const order = typeof raw.order === 'number' && Number.isInteger(raw.order) && raw.order >= 0
    ? raw.order
    : null;
  if (points === null) {
    throw new SevenoCompanyQuestionnaireError(
      'custom_question_weight_not_allowed',
      400,
      'La pondération personnalisée n’est pas autorisée. Chaque question compte de manière identique.',
    );
  }
  if (order === null) throw new SevenoCompanyQuestionnaireError('invalid_question', 400, 'L ordre de la question est invalide.');
  const help = cleanText(raw.help, 1000);
  const explanation = cleanText(raw.explanation, 2000) || existing?.explanation;
  const question: CompanyQuestion = {
    id,
    prompt: cleanText(raw.prompt, 500, true),
    ...(help ? { help } : {}),
    ...(explanation ? { explanation } : {}),
    type,
    required: raw.required === true,
    options,
    correctionMode,
    points,
    order,
    ...(normalizeDifficulty(raw.difficulty, existing) ? { difficulty: normalizeDifficulty(raw.difficulty, existing) } : {}),
  };
  if (correctionMode === 'automatic') {
    const existingOptions = existing ? normalizeOptions(existing.options, existing.type) : [];
    const canPreserve = raw.expectedAnswer === undefined
      && existing?.correctionMode === 'automatic'
      && existing.type === type
      && existing.expectedAnswer !== undefined
      && JSON.stringify(existingOptions) === JSON.stringify(options);
    question.expectedAnswer = canPreserve
      ? existing.expectedAnswer
      : normalizeExpectedAnswer(raw.expectedAnswer, type, options);
    if (type === 'number') {
      const operator = raw.numberOperator === 'minimum' || raw.numberOperator === 'maximum' || raw.numberOperator === 'equals'
        ? raw.numberOperator
        : canPreserve ? existing?.numberOperator : null;
      if (!operator) throw new SevenoCompanyQuestionnaireError('invalid_number_operator', 400, 'Le critere numerique est invalide.');
      question.numberOperator = operator;
    }
  }
  return question;
}

export function validateCompanyQuestionnaireInput(
  raw: unknown,
  existingQuestions: CompanyQuestion[] = [],
  existingMinimumPassingScorePercent: number | null | undefined = undefined,
): CompanyQuestionnaireInput & {
  questions: CompanyQuestion[];
  minimumPassingScorePercent: number;
} {
  if (!isPlainObject(raw)) throw new SevenoCompanyQuestionnaireError('invalid_questionnaire', 400, 'Le questionnaire est invalide.');
  if (!Array.isArray(raw.questions) || raw.questions.length > 50) throw new SevenoCompanyQuestionnaireError('invalid_questions', 400, 'Le questionnaire est limite a 50 questions.');
  const existingById = new Map(existingQuestions.map((item) => [item.id, item]));
  const questions = raw.questions.map((item) => normalizeQuestion(item, isPlainObject(item) ? existingById.get(String(item.id)) : undefined));
  if (new Set(questions.map((item) => item.id)).size !== questions.length || new Set(questions.map((item) => item.order)).size !== questions.length) {
    throw new SevenoCompanyQuestionnaireError('duplicate_question', 400, 'Les identifiants et ordres des questions doivent etre uniques.');
  }
  const durationMinutes = raw.durationMinutes === null || raw.durationMinutes === '' || raw.durationMinutes === undefined
    ? null
    : typeof raw.durationMinutes === 'number' && Number.isInteger(raw.durationMinutes) && raw.durationMinutes >= 1 && raw.durationMinutes <= 240
      ? raw.durationMinutes
      : NaN;
  if (Number.isNaN(durationMinutes)) throw new SevenoCompanyQuestionnaireError('invalid_duration', 400, 'La duree doit etre comprise entre 1 et 240 minutes.');
  let minimumPassingScorePercent: number;
  try {
    minimumPassingScorePercent = normalizeQuestionnaireMinimumPassingScorePercent(
      raw.minimumPassingScorePercent,
      existingMinimumPassingScorePercent,
    );
  } catch {
    throw new SevenoCompanyQuestionnaireError(
      'invalid_threshold',
      400,
      'Le seuil minimum doit etre compris entre 50 et 100 par paliers de 5.',
    );
  }
  const creationMode = normalizeCreationMode(raw.creationMode);
  const sortedQuestions = questions.sort((left, right) => left.order - right.order);
  if (creationMode === 'ai_import') {
    assertAiQuestionnaireContract(sortedQuestions, existingQuestions);
  }
  return {
    title: cleanText(raw.title, 200),
    instructions: cleanText(raw.instructions, 3000),
    creationMode,
    minimumPassingScorePercent,
    durationMinutes,
    questions: sortedQuestions,
  };
}

export function toCompanyQuestionEditorProjection(question: CompanyQuestion): CompanyQuestionEditorProjection {
  const options = normalizeOptions(question.options, question.type);
  const correctOptionIds = question.type === 'single_choice' && typeof question.expectedAnswer === 'string'
    ? [question.expectedAnswer]
    : question.type === 'multiple_choice' && Array.isArray(question.expectedAnswer)
      ? question.expectedAnswer.filter((item): item is string => typeof item === 'string')
      : [];
  return {
    id: question.id,
    prompt: question.prompt,
    ...(question.help ? { help: question.help } : {}),
    ...(question.explanation ? { explanation: question.explanation } : {}),
    type: question.type,
    required: question.required,
    options,
    correctionMode: question.correctionMode,
    points: COMPANY_QUESTION_POINTS,
    order: question.order,
    ...(question.difficulty ? { difficulty: question.difficulty } : {}),
    hasExpectedAnswer: question.expectedAnswer !== undefined,
    hasNumberCriterion: question.numberOperator !== undefined,
    correctOptionIds,
  };
}

function toProjection(id: string, data: FirestoreRecord): CompanyQuestionnaireEditorProjection {
  const questions = Array.isArray(data.questions) ? data.questions as CompanyQuestion[] : [];
  return {
    id,
    offerId: String(data.offerId ?? ''),
    offerVersion: typeof data.offerVersion === 'number' ? data.offerVersion : 0,
    title: String(data.title ?? ''),
    instructions: String(data.instructions ?? ''),
    creationMode: data.creationMode === 'ai_import' ? 'ai_import' : 'manual',
    status: data.status === 'active' || data.status === 'archived' ? data.status : 'draft',
    minimumPassingScorePercent: (() => {
      try {
        return normalizeQuestionnaireMinimumPassingScorePercent(data.minimumPassingScorePercent);
      } catch {
        return COMPANY_QUESTIONNAIRE_MINIMUM_PASSING_SCORE_PERCENT_DEFAULT;
      }
    })(),
    durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : null,
    questions: questions.map(toCompanyQuestionEditorProjection),
    version: typeof data.version === 'number' ? data.version : 1,
    createdAt: timestampToIso(data.createdAt) ?? '',
    updatedAt: timestampToIso(data.updatedAt) ?? '',
    publishedAt: timestampToIso(data.publishedAt),
  };
}

function toListItem(id: string, data: FirestoreRecord): CompanyQuestionnaireListItem {
  const projection = toProjection(id, data);
  return {
    id: projection.id,
    offerId: projection.offerId,
    title: projection.title,
    questionCount: projection.questions.length,
    status: projection.status,
    minimumPassingScorePercent: projection.minimumPassingScorePercent,
    version: projection.version,
    updatedAt: projection.updatedAt,
    publishedAt: projection.publishedAt,
  };
}

async function assertCompanyQuestionnaireOwner(companyUid: string) {
  const user = await getSevenoUserByUid(companyUid);
  if (!user || user.role !== 'company') {
    throw new SevenoCompanyQuestionnaireError('forbidden_role', 403, 'Seules les entreprises peuvent gerer des questionnaires.');
  }
  if (!user.emailVerified) {
    throw new SevenoCompanyQuestionnaireError('email_not_verified', 403, 'Verifiez votre adresse email avant de gerer un questionnaire.');
  }
}

async function resolveQuestionnaireDocument(
  offer: Awaited<ReturnType<typeof getJobOffer>>,
  companyUid: string,
) {
  try {
    return await resolveCompanyQuestionnaireForOffer({
      firestore: requireDatabase(),
      offerId: offer.id,
      companyUid,
      offer,
    });
  } catch (error) {
    if (error instanceof SevenoCompanyQuestionnaireResolutionError) {
      throw new SevenoCompanyQuestionnaireError(error.code, error.status, error.message);
    }
    throw error;
  }
}

export async function getCompanyQuestionnaire(companyUid: string, offerId: string) {
  return (await getCompanyQuestionnairePromptContext(companyUid, offerId)).questionnaire;
}

export async function getCompanyQuestionnairePromptContext(companyUid: string, offerId: string) {
  const offer = await getJobOffer(companyUid, offerId);
  const resolved = await resolveQuestionnaireDocument(offer, companyUid);
  const questionnaire = resolved ? toProjection(resolved.questionnaireId, resolved.data) : null;
  const groups = classifyOfferPrerequisites([...offer.requiredPrerequisites, ...offer.preferredPrerequisites]);
  const promptOffer = {
    ...offer,
    requiredPrerequisites: groups.requiredJobSkills,
    preferredPrerequisites: groups.preferredJobSkills,
  };
  const promptQuestionnaire = questionnaire && resolved?.legacySourceOfferId
    ? { ...questionnaire, offerId: offer.id }
    : questionnaire;
  if (process.env.NODE_ENV === 'development') {
    console.info('[SevenO company questionnaire context]', {
      step: 'company_questionnaire_prompt_context',
      requestedOfferId: offerId,
      loadedOfferId: offer.id,
      questionnaireOfferId: questionnaire?.offerId ?? null,
      companyIdChecked: companyUid,
      requiredPrerequisiteCount: offer.requiredPrerequisites.length,
      preferredPrerequisiteCount: offer.preferredPrerequisites.length,
    });
    console.info('[SevenO company questionnaire context]', {
      step: 'company_questionnaire_job_skill_filter',
      offerId: offer.id,
      requiredJobSkillCount: groups.requiredJobSkills.length,
      preferredJobSkillCount: groups.preferredJobSkills.length,
      requiredOfferRequirementCount: groups.requiredOfferRequirements.length,
      preferredOfferRequirementCount: groups.preferredOfferRequirements.length,
    });
  }
  return {
    offer,
    questionnaire,
    aiPrompt: buildCompanyQuestionnaireAiPrompt(promptOffer, promptQuestionnaire),
  };
}

export async function saveCompanyQuestionnaire(companyUid: string, offerId: string, raw: unknown) {
  const offer = await getJobOffer(companyUid, offerId);
  if (offer.status === 'closed' || offer.status === 'archived') {
    throw new SevenoCompanyQuestionnaireError('offer_not_editable', 409, 'Le questionnaire d une offre fermee ne peut plus etre modifie.');
  }
  const firestore = requireDatabase();
  const resolved = await resolveQuestionnaireDocument(offer, companyUid);
  const ref = resolved?.ref ?? firestore.collection(COLLECTION).doc(offer.id);
  const questionnaireOfferId = resolved?.legacySourceOfferId ?? offer.id;
  const offerRef = firestore.collection(OFFERS_COLLECTION).doc(offer.id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists && (snapshot.data()?.companyUid !== companyUid || snapshot.data()?.offerId !== questionnaireOfferId)) {
      throw new SevenoCompanyQuestionnaireError('forbidden_questionnaire', 403, 'Ce questionnaire ne vous appartient pas.');
    }
    const existingQuestions = snapshot.exists && Array.isArray(snapshot.data()?.questions)
      ? snapshot.data()?.questions as CompanyQuestion[]
      : [];
    const existingMinimumPassingScorePercent = snapshot.exists && typeof snapshot.data()?.minimumPassingScorePercent === 'number'
      ? snapshot.data()!.minimumPassingScorePercent
      : undefined;
    const input = validateCompanyQuestionnaireInput(raw, existingQuestions, existingMinimumPassingScorePercent);
    const now = Timestamp.now();
    const version = snapshot.exists && typeof snapshot.data()?.version === 'number' ? snapshot.data()!.version + 1 : 1;
    const stored = {
      companyUid,
      offerId: questionnaireOfferId,
      offerVersion: offer.version,
      ...input,
      creationMode: input.creationMode ?? 'manual',
      status: snapshot.data()?.status === 'archived' ? 'archived' : 'draft',
      version,
      createdAt: snapshot.exists && snapshot.get('createdAt') instanceof Timestamp ? snapshot.get('createdAt') : now,
      updatedAt: now,
      publishedAt: snapshot.exists && snapshot.get('publishedAt') instanceof Timestamp ? snapshot.get('publishedAt') : null,
    };
    transaction.set(ref, stored);
    transaction.update(offerRef, {
      questionnaireId: ref.id,
      questionnaireVersion: version,
      questionnaireTitleSnapshot: input.title,
      questionnaireQuestionCountSnapshot: input.questions.length,
      updatedAt: now,
    });
    return toProjection(ref.id, stored);
  });
}

export async function activateCompanyQuestionnaire(companyUid: string, offerId: string) {
  const offer = await getJobOffer(companyUid, offerId);
  const firestore = requireDatabase();
  const resolved = await resolveQuestionnaireDocument(offer, companyUid);
  if (!resolved) {
    throw new SevenoCompanyQuestionnaireError('questionnaire_not_found', 404, 'Questionnaire introuvable.');
  }
  const ref = resolved.ref;
  const questionnaireOfferId = resolved.legacySourceOfferId ?? offer.id;
  const offerRef = firestore.collection(OFFERS_COLLECTION).doc(offer.id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.companyUid !== companyUid || snapshot.data()?.offerId !== questionnaireOfferId) {
      throw new SevenoCompanyQuestionnaireError('questionnaire_not_found', 404, 'Questionnaire introuvable.');
    }
    const data = snapshot.data() as FirestoreRecord;
    if (data.status === 'archived') {
      throw new SevenoCompanyQuestionnaireError('questionnaire_archived', 409, 'Un questionnaire archive ne peut pas etre envoye.');
    }
    const questions = Array.isArray(data.questions) ? data.questions as CompanyQuestion[] : [];
    if (!cleanText(data.title, 200)) {
      throw new SevenoCompanyQuestionnaireError('questionnaire_incomplete', 409, 'Completez le titre avant activation.');
    }
    if (questions.length !== COMPANY_QUESTIONNAIRE_QUESTION_COUNT) {
      throw new SevenoCompanyQuestionnaireError(
        'questionnaire_incomplete',
        409,
        `Le questionnaire doit contenir exactement ${COMPANY_QUESTIONNAIRE_QUESTION_COUNT} questions avant activation.`,
      );
    }
    if (questions.some((item) => item.correctionMode === 'automatic' && item.expectedAnswer === undefined)) {
      throw new SevenoCompanyQuestionnaireError('questionnaire_incomplete', 409, 'Completez les corrections avant activation.');
    }
    const now = Timestamp.now();
    const stored = { ...data, offerVersion: offer.version, status: 'active', updatedAt: now, publishedAt: now };
    transaction.set(ref, stored);
    transaction.update(offerRef, {
      questionnaireId: ref.id,
      questionnaireVersion: data.version,
      questionnaireTitleSnapshot: cleanText(data.title, 200, true),
      questionnaireQuestionCountSnapshot: questions.length,
      updatedAt: now,
    });
    transaction.set(ref.collection('versions').doc(String(data.version)), {
      ...stored,
      questionnaireVersion: data.version,
      recordedAt: now,
    });
    return toProjection(ref.id, stored);
  });
}

export async function listCompanyQuestionnaires(companyUid: string) {
  await assertCompanyQuestionnaireOwner(companyUid);
  const snapshot = await requireDatabase()
    .collection(COLLECTION)
    .where('companyUid', '==', companyUid)
    .get();

  return {
    questionnaires: snapshot.docs
      .map((doc) => {
        try {
          const data = doc.data() as FirestoreRecord;
          const projection = toProjection(doc.id, data);
          if (projection.questions.length === 0 || !projection.offerId) {
            return null;
          }
          return toListItem(doc.id, data);
        } catch {
          return null;
        }
      })
      .filter((item): item is CompanyQuestionnaireListItem => Boolean(item))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.title.localeCompare(right.title)),
  };
}
