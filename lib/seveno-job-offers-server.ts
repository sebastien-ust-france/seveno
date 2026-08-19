import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { buildCompanyMembershipId } from '@/lib/seveno-company-memberships-server';
import type { CompanyMembershipRole } from '@/types/seveno-billing';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import {
  countActiveCandidateFilesForOffer,
} from '@/lib/seveno-active-candidate-files-server';
import { syncPrerequisiteSuggestionsForOffer } from '@/lib/seveno-prerequisite-suggestions-server';
import {
  buildOfferPrerequisiteSnapshots,
  assertOfferPrerequisiteLimits,
  SevenoPrerequisiteError,
} from '@/lib/seveno-prerequisites-server';
import type {
  JobOfferContractType,
  JobOfferDependencyCounts,
  JobOfferInput,
  JobOfferListPage,
  JobOfferPrerequisiteSelectionInput,
  JobOfferStatus,
  JobOfferStatusAction,
  JobOfferWorkingTime,
  JobOfferWorkMode,
  PublicJobOffer,
  SerializedJobOffer,
} from '@/types/seveno-job-offers';
import type {
  OfferPrerequisiteSelectionInput,
  OfferPrerequisiteSnapshot,
  PrerequisiteCriterionValue,
} from '@/types/seveno-prerequisites';
import { resolvePrerequisiteFamily } from '@/lib/seveno-prerequisite-families';
import {
  buildCandidateOfferFanoutId,
  OFFER_NOTIFICATION_FANOUTS_COLLECTION,
  prepareCandidateOfferFanout,
  processCandidateOfferFanout,
} from '@/lib/seveno-candidate-offer-notifications-server';
import { activateCampaignInTransaction } from '@/lib/seveno-billing-server';
import {
  SevenoGeographyError,
  normalizeGeographicLocation,
} from '@/lib/seveno-geography-server';
import { formatGeographicLocation, type GeographicLocation } from '@/lib/seveno-geography';

const COLLECTION = 'job_offers';
const COMPANY_PROFILES_COLLECTION = 'company_profiles';
const COMPANY_QUESTIONNAIRES_COLLECTION = 'company_questionnaires';
const APPLICATIONS_COLLECTION = 'job_applications';
const APPLICATION_GUARDS_COLLECTION = 'job_application_guards';
const OFFER_CAPACITY_LOCKS_COLLECTION = 'job_application_offer_locks';
const TEST_SESSIONS_COLLECTION = 'test_sessions';
const TEST_RESULTS_COLLECTION = 'test_results';
const MATCH_REQUESTS_COLLECTION = 'match_requests';
const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 50;
const WORK_MODES: JobOfferWorkMode[] = ['onsite', 'hybrid', 'remote'];
const CONTRACT_TYPES: JobOfferContractType[] = [
  'permanent',
  'fixed_term',
  'temporary',
  'freelance',
  'apprenticeship',
  'internship',
  'other',
];
const WORKING_TIMES: JobOfferWorkingTime[] = ['full_time', 'part_time', 'shift', 'flexible', 'other'];
const OFFER_STATUSES: JobOfferStatus[] = ['draft', 'published', 'paused', 'closed', 'archived'];
const BLOCKED_CONTENT = [
  'origine ethnique',
  'origine raciale',
  'situation familiale',
  'opinion politique',
  'opinions politiques',
  'religion',
  'orientation sexuelle',
  'apparence physique',
  'etat de sante',
  'grossesse',
  'age du candidat',
];

type FirestoreRecord = Record<string, unknown>;

type CompanyContext = {
  uid: string;
  companyName: string;
  companyPublicId: string;
  profileStatus: 'draft' | 'active' | 'suspended';
  complete: boolean;
};

type QuestionnaireAttachment = {
  questionnaireId: string;
  questionnaireVersion: number;
  questionnaireTitleSnapshot: string;
  questionnaireQuestionCountSnapshot: number;
};

type OfferCursor = { updatedAt: number; id: string };

export class SevenoJobOfferError extends Error {
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
    throw new SevenoJobOfferError('firebase_admin_missing', 500, 'Firebase Admin n est pas configure pour les offres.');
  }
  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number, required = false) {
  const text = typeof value === 'string' ? value.trim() : '';
  if ((required && !text) || text.length > maxLength) {
    throw new SevenoJobOfferError('invalid_offer', 400, 'Un champ texte de l offre est invalide.');
  }
  return text;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function assertProfessionalContent(parts: string[]) {
  const normalized = ` ${normalizeSearchText(parts.join(' '))} `;
  const blocked = BLOCKED_CONTENT.find((term) => normalized.includes(` ${normalizeSearchText(term)} `));
  if (blocked) {
    throw new SevenoJobOfferError(
      'prohibited_offer_content',
      400,
      `Le contenu de l offre comporte un critere personnel interdit (${blocked}).`,
    );
  }
}

function timestampToIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function normalizeOfferPrerequisiteSnapshot(value: unknown): OfferPrerequisiteSnapshot | null {
  if (!isPlainObject(value)) return null;
  const importance = value.importance === 'preferred' ? 'preferred' : 'required';
  const base: OfferPrerequisiteSnapshot = {
    prerequisiteId: String(value.prerequisiteId ?? ''),
    prerequisiteCode: String(value.prerequisiteCode ?? ''),
    prerequisiteVersion: typeof value.prerequisiteVersion === 'number' ? value.prerequisiteVersion : 1,
    source: value.source === 'company' ? 'company' : 'seveno',
    ...(typeof value.ownerCompanyId === 'string' && value.ownerCompanyId ? { ownerCompanyId: value.ownerCompanyId } : {}),
    ...(typeof value.originOfferId === 'string' && value.originOfferId ? { originOfferId: value.originOfferId } : {}),
    category: String(value.category ?? 'other_professional') as OfferPrerequisiteSnapshot['category'],
    companyLabel: String(value.companyLabel ?? ''),
    candidateQuestion: String(value.candidateQuestion ?? ''),
    ...(typeof value.candidateHelp === 'string' && value.candidateHelp ? { candidateHelp: value.candidateHelp } : {}),
    answerType: String(value.answerType ?? 'boolean') as OfferPrerequisiteSnapshot['answerType'],
    options: Array.isArray(value.options) ? value.options as OfferPrerequisiteSnapshot['options'] : [],
    comparisonOperator: String(value.comparisonOperator ?? 'equals') as OfferPrerequisiteSnapshot['comparisonOperator'],
    expectedCriterion: value.expectedCriterion as OfferPrerequisiteSnapshot['expectedCriterion'],
    responseScope: String(value.responseScope ?? 'profile_reusable') as OfferPrerequisiteSnapshot['responseScope'],
    evidencePolicy: String(value.evidencePolicy ?? 'none') as OfferPrerequisiteSnapshot['evidencePolicy'],
    ...(typeof value.freshnessDays === 'number' ? { freshnessDays: value.freshnessDays } : {}),
    importance,
  };
  return { ...base, ...resolvePrerequisiteFamily(base) };
}

function cloneCriterion(value: unknown): PrerequisiteCriterionValue {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return [...value];
  throw new SevenoJobOfferError('invalid_prerequisite_criterion', 400, 'Un critere de prerequis est invalide.');
}

function normalizeSelections(value: unknown): JobOfferPrerequisiteSelectionInput[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 100) throw new SevenoJobOfferError('too_many_prerequisites', 400, 'Une offre est limitee a 100 prerequis.');
  const selections = value.map((item) => {
    if (!isPlainObject(item)) throw new SevenoJobOfferError('invalid_prerequisite', 400, 'Un prerequis est invalide.');
    return {
      prerequisiteId: cleanText(item.prerequisiteId, 100, true),
      expectedCriterion: cloneCriterion(item.expectedCriterion),
    };
  });
  const ids = selections.map((selection) => selection.prerequisiteId);
  if (new Set(ids).size !== ids.length) {
    throw new SevenoJobOfferError('duplicate_prerequisite', 400, 'Un prerequis est present plusieurs fois.');
  }
  return selections;
}

function normalizeQuestionnaireId(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new SevenoJobOfferError('invalid_questionnaire', 400, 'Le questionnaire selectionne est invalide.');
  }
  const questionnaireId = value.trim();
  if (!questionnaireId) {
    return '';
  }
  if (questionnaireId.length > 100) {
    throw new SevenoJobOfferError('invalid_questionnaire', 400, 'Le questionnaire selectionne est invalide.');
  }
  return questionnaireId;
}

function resolveJobContext(sectorId: string, jobFamilyId: string, jobRoleId: string) {
  if (!sectorId && !jobFamilyId && !jobRoleId) return null;
  if (!sectorId || !jobFamilyId || !jobRoleId) {
    throw new SevenoJobOfferError('incomplete_job', 400, 'Le secteur, la famille et le metier doivent etre renseignes ensemble.');
  }
  const sector = JOB_SECTORS.find((item) => item.code === sectorId);
  const family = sector?.families.find((item) => item.code === jobFamilyId);
  const role = family?.roles.find((item) => item.code === jobRoleId);
  if (!sector || !family || !role) {
    throw new SevenoJobOfferError('invalid_job', 400, 'Le metier ne correspond pas a la taxonomie SevenO.');
  }
  return { sectorId: sector.code, jobFamilyId: family.code, jobRoleId: role.code, jobRoleLabel: role.label };
}

export function validateJobOfferInput(raw: unknown): JobOfferInput & { jobRoleLabel: string } {
  if (!isPlainObject(raw)) throw new SevenoJobOfferError('invalid_offer', 400, 'Le contenu de l offre est invalide.');
  const title = cleanText(raw.title, 160);
  const sectorId = cleanText(raw.sectorId, 120);
  const jobFamilyId = cleanText(raw.jobFamilyId, 160);
  const jobRoleId = cleanText(raw.jobRoleId, 200);
  const context = resolveJobContext(sectorId, jobFamilyId, jobRoleId);
  const location = cleanText(raw.location, 360);
  const countryCode = cleanText(raw.countryCode, 2);
  const countryName = cleanText(raw.countryName, 120);
  const administrativeAreaCode = cleanText(raw.administrativeAreaCode, 20);
  const administrativeAreaName = cleanText(raw.administrativeAreaName, 160);
  const city = cleanText(raw.city, 40);
  const cityName = cleanText(raw.cityName, 160);
  const workMode = raw.workMode === '' || raw.workMode == null
    ? ''
    : WORK_MODES.includes(raw.workMode as JobOfferWorkMode) ? raw.workMode as JobOfferWorkMode : null;
  const contractType = raw.contractType === '' || raw.contractType == null
    ? ''
    : CONTRACT_TYPES.includes(raw.contractType as JobOfferContractType) ? raw.contractType as JobOfferContractType : null;
  const workingTime = raw.workingTime === '' || raw.workingTime == null
    ? ''
    : WORKING_TIMES.includes(raw.workingTime as JobOfferWorkingTime) ? raw.workingTime as JobOfferWorkingTime : null;
  if (workMode === null || contractType === null || workingTime === null) {
    throw new SevenoJobOfferError('invalid_conditions', 400, 'Une condition de travail est invalide.');
  }
  const description = cleanText(raw.description, 6000);
  const missions = cleanText(raw.missions, 6000);
  const profileSummary = cleanText(raw.profileSummary, 3000);
  const questionnaireRequired = raw.questionnaireRequired === true;
  const questionnaireId = normalizeQuestionnaireId(raw.questionnaireId);
  assertProfessionalContent([title, description, missions, profileSummary]);
  const requiredPrerequisites = normalizeSelections(raw.requiredPrerequisites);
  const preferredPrerequisites = normalizeSelections(raw.preferredPrerequisites);
  const allIds = [...requiredPrerequisites, ...preferredPrerequisites].map((item) => item.prerequisiteId);
  if (new Set(allIds).size !== allIds.length) {
    throw new SevenoJobOfferError(
      'duplicate_prerequisite',
      400,
      'Un prerequis ne peut pas etre obligatoire et optionnel simultanement.',
    );
  }
  if (!context && allIds.length > 0) {
    throw new SevenoJobOfferError('job_required_for_prerequisites', 400, 'Selectionnez un metier avant les prerequis.');
  }
  return {
    title,
    sectorId: context?.sectorId ?? '',
    jobFamilyId: context?.jobFamilyId ?? '',
    jobRoleId: context?.jobRoleId ?? '',
    jobRoleLabel: context?.jobRoleLabel ?? '',
    location,
    countryCode,
    countryName,
    administrativeAreaCode,
    administrativeAreaName,
    city,
    cityName,
    workMode,
    contractType,
    workingTime,
    description,
    missions,
    profileSummary,
    questionnaireRequired,
    questionnaireId,
    requiredPrerequisites,
    preferredPrerequisites,
  };
}

async function normalizeOfferGeographicLocation(input: JobOfferInput): Promise<GeographicLocation> {
  try {
    return await normalizeGeographicLocation(input, { allowEmpty: true });
  } catch (error) {
    if (error instanceof SevenoGeographyError) {
      throw new SevenoJobOfferError(error.code, error.status, error.message);
    }
    throw error;
  }
}

function toSnapshotSelections(input: JobOfferInput): OfferPrerequisiteSelectionInput[] {
  return [
    ...input.requiredPrerequisites.map((item) => ({ ...item, importance: 'required' as const })),
    ...input.preferredPrerequisites.map((item) => ({ ...item, importance: 'preferred' as const })),
  ];
}

function splitSnapshots(snapshots: OfferPrerequisiteSnapshot[]) {
  return {
    requiredPrerequisites: snapshots.filter((item) => item.importance === 'required'),
    preferredPrerequisites: snapshots.filter((item) => item.importance === 'preferred'),
  };
}

async function syncOfferPrerequisiteSuggestions(
  companyUid: string,
  previousOffer: Pick<SerializedJobOffer, 'companyUid' | 'id' | 'sectorId' | 'jobFamilyId' | 'jobRoleId'>,
  previousSnapshots: OfferPrerequisiteSnapshot[],
  currentOffer: Pick<SerializedJobOffer, 'companyUid' | 'id' | 'sectorId' | 'jobFamilyId' | 'jobRoleId'>,
  currentSnapshots: OfferPrerequisiteSnapshot[],
) {
  if (currentSnapshots.length === 0 && previousSnapshots.length === 0) return;
  try {
    await requireDatabase().runTransaction(async (transaction) => {
      await syncPrerequisiteSuggestionsForOffer(transaction, previousOffer, previousSnapshots, currentOffer, currentSnapshots);
    });
  } catch (error) {
    console.error('[POST /job_offers] Suggestion queue sync failed', {
      companyUid,
      offerId: currentOffer.id,
      error,
    });
  }
}

function deterministicCompanyPublicId(uid: string) {
  return `SEV-ENT-${createHash('sha256').update(uid).digest('hex').slice(0, 10).toUpperCase()}`;
}

async function loadCompanyContext(companyUid: string, requirePublishable = false): Promise<CompanyContext> {
  const firestore = requireDatabase();
  const profileSnapshot = await firestore.collection(COMPANY_PROFILES_COLLECTION).doc(companyUid).get();
  const data = profileSnapshot.data();
  if (!profileSnapshot.exists || !data || typeof data.companyName !== 'string') {
    throw new SevenoJobOfferError('company_profile_missing', 404, 'Profil entreprise introuvable.');
  }
  const profileStatus = data.profileStatus;
  if (profileStatus !== 'draft' && profileStatus !== 'active' && profileStatus !== 'suspended') {
    throw new SevenoJobOfferError('company_profile_invalid', 409, 'Le statut du profil entreprise est invalide.');
  }
  if (profileStatus === 'suspended') {
    throw new SevenoJobOfferError('company_suspended', 403, 'Le profil entreprise est suspendu.');
  }
  const complete = [
    data.companyName,
    data.companyType,
    data.businessSector,
    data.headquartersArea,
    data.contactRole,
  ].every((value) => typeof value === 'string' && value.trim().length > 0)
    && Array.isArray(data.recruitmentAreas)
    && data.recruitmentAreas.length > 0;
  if (requirePublishable && (profileStatus !== 'active' || !complete)) {
    throw new SevenoJobOfferError('company_not_publishable', 409, 'Le profil entreprise doit etre actif et complet.');
  }
  return {
    uid: companyUid,
    companyName: data.companyName.trim(),
    companyPublicId: deterministicCompanyPublicId(companyUid),
    profileStatus,
    complete,
  };
}

async function loadQuestionnaireAttachment(companyUid: string, questionnaireId: string): Promise<QuestionnaireAttachment> {
  const firestore = requireDatabase();
  const id = cleanText(questionnaireId, 100, true);
  const snapshot = await firestore.collection(COMPANY_QUESTIONNAIRES_COLLECTION).doc(id).get();
  if (!snapshot.exists) {
    throw new SevenoJobOfferError('questionnaire_not_found', 404, 'Questionnaire introuvable.');
  }
  const data = snapshot.data() as FirestoreRecord;
  if (data.companyUid !== companyUid) {
    throw new SevenoJobOfferError('questionnaire_forbidden', 403, 'Ce questionnaire ne vous appartient pas.');
  }
  if (data.offerId !== id) {
    throw new SevenoJobOfferError('questionnaire_invalid', 409, 'Le questionnaire selectionne est invalide.');
  }
  const questions = Array.isArray(data.questions) ? data.questions : [];
  if (questions.length === 0) {
    throw new SevenoJobOfferError('questionnaire_not_usable', 409, 'Le questionnaire selectionne n est pas utilisable.');
  }
  const version = typeof data.version === 'number' && Number.isInteger(data.version) && data.version > 0
    ? data.version
    : null;
  if (!version) {
    throw new SevenoJobOfferError('questionnaire_version_missing', 409, 'La version du questionnaire est introuvable.');
  }
  const versionSnapshot = await snapshot.ref.collection('versions').doc(String(version)).get();
  if (!versionSnapshot.exists) {
    throw new SevenoJobOfferError('questionnaire_version_missing', 409, 'La version du questionnaire est introuvable.');
  }
  return {
    questionnaireId: id,
    questionnaireVersion: version,
    questionnaireTitleSnapshot: cleanText(data.title, 200, true),
    questionnaireQuestionCountSnapshot: questions.length,
  };
}

async function resolveQuestionnaireAttachment(
  companyUid: string,
  questionnaireId: string,
  existing: SerializedJobOffer | null,
): Promise<QuestionnaireAttachment> {
  if (!questionnaireId) {
    return {
      questionnaireId: '',
      questionnaireVersion: 0,
      questionnaireTitleSnapshot: '',
      questionnaireQuestionCountSnapshot: 0,
    };
  }
  if (existing && existing.questionnaireId === questionnaireId) {
    return {
      questionnaireId: existing.questionnaireId ?? '',
      questionnaireVersion: existing.questionnaireVersion ?? 0,
      questionnaireTitleSnapshot: existing.questionnaireTitleSnapshot ?? '',
      questionnaireQuestionCountSnapshot: existing.questionnaireQuestionCountSnapshot ?? 0,
    };
  }
  return loadQuestionnaireAttachment(companyUid, questionnaireId);
}

async function hydrateQuestionnaireSnapshot(companyUid: string, offer: SerializedJobOffer) {
  if (
    offer.questionnaireId
    && offer.questionnaireVersion !== null
    && offer.questionnaireTitleSnapshot !== null
    && offer.questionnaireQuestionCountSnapshot !== null
  ) {
    return offer;
  }
  try {
    const attachment = await loadQuestionnaireAttachment(companyUid, offer.id);
    return {
      ...offer,
      questionnaireId: attachment.questionnaireId || offer.questionnaireId,
      questionnaireVersion: attachment.questionnaireVersion || offer.questionnaireVersion,
      questionnaireTitleSnapshot: attachment.questionnaireTitleSnapshot || offer.questionnaireTitleSnapshot,
      questionnaireQuestionCountSnapshot:
        attachment.questionnaireQuestionCountSnapshot || offer.questionnaireQuestionCountSnapshot,
    };
  } catch (error) {
    if (error instanceof SevenoJobOfferError && error.code === 'questionnaire_not_found') {
      return offer;
    }
    throw error;
  }
}

function serializeOffer(id: string, data: FirestoreRecord): SerializedJobOffer {
  const status = OFFER_STATUSES.includes(data.status as JobOfferStatus) ? data.status as JobOfferStatus : 'draft';
  const requiredPrerequisites = Array.isArray(data.requiredPrerequisites)
    ? data.requiredPrerequisites.map(normalizeOfferPrerequisiteSnapshot).filter((item): item is OfferPrerequisiteSnapshot => Boolean(item))
    : [];
  const preferredPrerequisites = Array.isArray(data.preferredPrerequisites)
    ? data.preferredPrerequisites.map(normalizeOfferPrerequisiteSnapshot).filter((item): item is OfferPrerequisiteSnapshot => Boolean(item))
    : [];
  return {
    id,
    companyUid: String(data.companyUid ?? ''),
    companyId: String(data.companyId ?? data.companyUid ?? ''),
    createdByUid: String(data.createdByUid ?? data.createdBy ?? data.companyUid ?? ''),
    assignedToUid: String(data.assignedToUid ?? ''),
    assignedAt: timestampToIso(data.assignedAt) ?? '',
    assignedByUid: String(data.assignedByUid ?? ''),
    updatedByUid: String(data.updatedByUid ?? data.createdByUid ?? data.createdBy ?? data.companyUid ?? ''),
    activeCampaignId: typeof data.activeCampaignId === 'string' && data.activeCampaignId ? data.activeCampaignId : null,
    companyPublicId: String(data.companyPublicId ?? ''),
    companyNameSnapshot: String(data.companyNameSnapshot ?? ''),
    title: String(data.title ?? ''),
    sectorId: String(data.sectorId ?? ''),
    jobFamilyId: String(data.jobFamilyId ?? ''),
    jobRoleId: String(data.jobRoleId ?? ''),
    jobRoleLabel: String(data.jobRoleLabel ?? ''),
    location: String(data.location ?? ''),
    countryCode: String(data.countryCode ?? ''),
    countryName: String(data.countryName ?? ''),
    administrativeAreaCode: String(data.administrativeAreaCode ?? ''),
    administrativeAreaName: String(data.administrativeAreaName ?? ''),
    city: String(data.city ?? ''),
    cityName: String(data.cityName ?? ''),
    workMode: WORK_MODES.includes(data.workMode as JobOfferWorkMode) ? data.workMode as JobOfferWorkMode : '',
    contractType: CONTRACT_TYPES.includes(data.contractType as JobOfferContractType) ? data.contractType as JobOfferContractType : '',
    workingTime: WORKING_TIMES.includes(data.workingTime as JobOfferWorkingTime) ? data.workingTime as JobOfferWorkingTime : '',
    description: String(data.description ?? ''),
    missions: String(data.missions ?? ''),
    profileSummary: String(data.profileSummary ?? ''),
    questionnaireRequired: data.questionnaireRequired === true,
    questionnaireId: typeof data.questionnaireId === 'string' ? data.questionnaireId : null,
    questionnaireVersion: typeof data.questionnaireVersion === 'number' ? data.questionnaireVersion : null,
    questionnaireTitleSnapshot: typeof data.questionnaireTitleSnapshot === 'string' ? data.questionnaireTitleSnapshot : null,
    questionnaireQuestionCountSnapshot: typeof data.questionnaireQuestionCountSnapshot === 'number'
      ? data.questionnaireQuestionCountSnapshot
      : null,
    requiredPrerequisites,
    preferredPrerequisites,
    status,
    createdAt: timestampToIso(data.createdAt) ?? '',
    updatedAt: timestampToIso(data.updatedAt) ?? '',
    publishedAt: timestampToIso(data.publishedAt),
    closedAt: timestampToIso(data.closedAt),
    version: typeof data.version === 'number' ? data.version : 1,
  };
}

export function assertOfferOwner(offer: SerializedJobOffer | null, companyUid: string): asserts offer is SerializedJobOffer {
  if (!offer) throw new SevenoJobOfferError('offer_not_found', 404, 'Offre introuvable.');
  if (offer.companyUid !== companyUid) throw new SevenoJobOfferError('forbidden_offer', 403, 'Cette offre ne vous appartient pas.');
}

function assertPublishable(offer: SerializedJobOffer, context: CompanyContext) {
  if (context.profileStatus !== 'active' || !context.complete) {
    throw new SevenoJobOfferError('company_not_publishable', 409, 'Le profil entreprise doit etre actif et complet.');
  }
  if (
    !offer.title
    || !offer.sectorId
    || !offer.jobFamilyId
    || !offer.jobRoleId
    || (!offer.location && !offer.workMode)
    || !offer.contractType
    || !offer.description
    || offer.requiredPrerequisites.length === 0
  ) {
    throw new SevenoJobOfferError('offer_incomplete', 409, 'Completez les informations obligatoires avant publication.');
  }
  resolveJobContext(offer.sectorId, offer.jobFamilyId, offer.jobRoleId);
  assertProfessionalContent([offer.title, offer.description, offer.missions, offer.profileSummary]);
  const snapshots = [...offer.requiredPrerequisites, ...offer.preferredPrerequisites];
  try {
    assertOfferPrerequisiteLimits(snapshots);
  } catch (error) {
    throw new SevenoJobOfferError(
      'offer_prerequisite_limit',
      409,
      error instanceof Error ? error.message : 'Les limites de prérequis sont dépassées.',
    );
  }
  const ids = snapshots.map((item) => item.prerequisiteId);
  if (new Set(ids).size !== ids.length || snapshots.some((item) => !item.prerequisiteVersion || !item.candidateQuestion)) {
    throw new SevenoJobOfferError('invalid_snapshots', 409, 'Les snapshots de prerequis sont invalides.');
  }
}

function functionalSignature(offer: Pick<SerializedJobOffer,
  'title' | 'sectorId' | 'jobFamilyId' | 'jobRoleId' | 'jobRoleLabel' | 'location' | 'workMode' | 'contractType'
  | 'workingTime' | 'description' | 'missions' | 'profileSummary' | 'requiredPrerequisites' | 'preferredPrerequisites'
  | 'questionnaireRequired' | 'questionnaireId' | 'questionnaireVersion' | 'questionnaireTitleSnapshot'
  | 'questionnaireQuestionCountSnapshot'
>) {
  return JSON.stringify(offer);
}

async function buildSnapshots(
  companyUid: string,
  input: JobOfferInput,
  existing: SerializedJobOffer | null,
  offerId?: string,
) {
  const selections = toSnapshotSelections(input);
  if (selections.length === 0) return splitSnapshots([]);
  try {
    const snapshots = await buildOfferPrerequisiteSnapshots(
      companyUid,
      input.jobRoleId,
      selections,
      existing && existing.jobRoleId === input.jobRoleId
        ? [...existing.requiredPrerequisites, ...existing.preferredPrerequisites]
        : [],
      offerId ? { offerId } : {},
    );
    return splitSnapshots(snapshots);
  } catch (error) {
    if (error instanceof SevenoPrerequisiteError) {
      throw new SevenoJobOfferError(error.code, error.status, error.message);
    }
    throw error;
  }
}

export async function createJobOffer(companyUid: string, raw: unknown, actorUid = companyUid) {
  const context = await loadCompanyContext(companyUid);
  const input = validateJobOfferInput(raw);
  const structuredLocation = await normalizeOfferGeographicLocation(input);
  const id = randomUUID();
  const snapshots = await buildSnapshots(companyUid, input, null, id);
  const questionnaire = await resolveQuestionnaireAttachment(companyUid, input.questionnaireId, null);
  const now = Timestamp.now();
  const stored: FirestoreRecord = {
    id,
    companyUid,
    companyId: companyUid,
    createdByUid: actorUid,
    assignedToUid: actorUid,
    assignedAt: now,
    assignedByUid: actorUid,
    updatedByUid: actorUid,
    activeCampaignId: null,
    companyPublicId: context.companyPublicId,
    companyNameSnapshot: context.companyName,
    title: input.title,
    sectorId: input.sectorId,
    jobFamilyId: input.jobFamilyId,
    jobRoleId: input.jobRoleId,
    jobRoleLabel: input.jobRoleLabel,
    location: structuredLocation.countryCode ? formatGeographicLocation(structuredLocation) : input.location,
    ...structuredLocation,
    workMode: input.workMode,
    contractType: input.contractType,
    workingTime: input.workingTime,
    description: input.description,
    missions: input.missions,
    profileSummary: input.profileSummary,
    questionnaireRequired: input.questionnaireRequired,
    questionnaireId: questionnaire.questionnaireId || null,
    questionnaireVersion: questionnaire.questionnaireVersion || null,
    questionnaireTitleSnapshot: questionnaire.questionnaireTitleSnapshot || null,
    questionnaireQuestionCountSnapshot: questionnaire.questionnaireQuestionCountSnapshot || null,
    ...snapshots,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    closedAt: null,
    version: 1,
  };
  await requireDatabase().collection(COLLECTION).doc(id).create(stored);
  await syncOfferPrerequisiteSuggestions(
    companyUid,
    {
      companyUid,
      id,
      sectorId: input.sectorId,
      jobFamilyId: input.jobFamilyId,
      jobRoleId: input.jobRoleId,
    },
    [],
    {
      companyUid,
      id,
      sectorId: input.sectorId,
      jobFamilyId: input.jobFamilyId,
      jobRoleId: input.jobRoleId,
    },
    [...snapshots.requiredPrerequisites, ...snapshots.preferredPrerequisites],
  );
  return hydrateQuestionnaireSnapshot(companyUid, serializeOffer(id, stored));
}

export function buildDuplicatedJobOfferData(
  source: SerializedJobOffer,
  company: { uid: string; companyName: string; companyPublicId: string },
) {
  return {
    companyUid: company.uid,
    companyPublicId: company.companyPublicId,
    companyNameSnapshot: company.companyName,
    title: `Copie de ${source.title}`.slice(0, 200),
    sectorId: source.sectorId,
    jobFamilyId: source.jobFamilyId,
    jobRoleId: source.jobRoleId,
    jobRoleLabel: source.jobRoleLabel,
    location: source.location,
    countryCode: source.countryCode ?? '',
    countryName: source.countryName ?? '',
    administrativeAreaCode: source.administrativeAreaCode ?? '',
    administrativeAreaName: source.administrativeAreaName ?? '',
    city: source.city ?? '',
    cityName: source.cityName ?? '',
    workMode: source.workMode,
    contractType: source.contractType,
    workingTime: source.workingTime,
    description: source.description,
    missions: source.missions,
    profileSummary: source.profileSummary,
    questionnaireRequired: source.questionnaireRequired,
    questionnaireId: null,
    questionnaireVersion: null,
    questionnaireTitleSnapshot: null,
    questionnaireQuestionCountSnapshot: null,
    requiredPrerequisites: source.requiredPrerequisites.map((item) => ({
      ...item,
      options: item.options.map((option) => ({ ...option })),
      expectedCriterion: Array.isArray(item.expectedCriterion) ? [...item.expectedCriterion] : item.expectedCriterion,
    })),
    preferredPrerequisites: source.preferredPrerequisites.map((item) => ({
      ...item,
      options: item.options.map((option) => ({ ...option })),
      expectedCriterion: Array.isArray(item.expectedCriterion) ? [...item.expectedCriterion] : item.expectedCriterion,
    })),
    status: 'draft' as const,
    publishedAt: null,
    closedAt: null,
    version: 1,
  };
}

export async function duplicateJobOffer(companyUid: string, offerId: string, actorUid = companyUid) {
  const context = await loadCompanyContext(companyUid);
  const source = await getJobOffer(companyUid, offerId);
  const id = randomUUID();
  const now = Timestamp.now();
  const content = buildDuplicatedJobOfferData(source, {
    uid: companyUid,
    companyName: context.companyName,
    companyPublicId: context.companyPublicId,
  });
  const stored: FirestoreRecord = {
    id,
    ...content,
    duplicatedFromOfferId: source.id,
    createdBy: actorUid,
    createdByUid: actorUid,
    updatedByUid: actorUid,
    assignedToUid: actorUid,
    assignedAt: now,
    assignedByUid: actorUid,
    createdAt: now,
    updatedAt: now,
  };
  await requireDatabase().collection(COLLECTION).doc(id).create(stored);
  await syncOfferPrerequisiteSuggestions(
    companyUid,
    { companyUid, id, sectorId: source.sectorId, jobFamilyId: source.jobFamilyId, jobRoleId: source.jobRoleId },
    [],
    { companyUid, id, sectorId: source.sectorId, jobFamilyId: source.jobFamilyId, jobRoleId: source.jobRoleId },
    [...content.requiredPrerequisites, ...content.preferredPrerequisites],
  );
  return serializeOffer(id, stored);
}

export function assertJobOfferDeletionAllowed(status: JobOfferStatus, dependencies: JobOfferDependencyCounts) {
  if (status !== 'draft' && status !== 'archived') {
    throw new SevenoJobOfferError(
      'offer_deletion_status_forbidden',
      409,
      `Une offre au statut ${status} ne peut pas être supprimée définitivement. Archivez-la d’abord.`,
    );
  }
  if (Object.values(dependencies).some((count) => count > 0)) {
    throw new SevenoJobOfferError(
      'offer_has_dependencies',
      409,
      'Cette offre possède déjà des candidatures, des questionnaires ou des échanges. Elle ne peut pas être supprimée définitivement, mais vous pouvez l’archiver.',
    );
  }
}

async function countQuery(query: Query) {
  const snapshot = await query.limit(1).get();
  return snapshot.empty ? 0 : 1;
}

async function loadJobOfferDependencyCounts(offerId: string): Promise<JobOfferDependencyCounts> {
  const firestore = requireDatabase();
  const [applications, questionnaire, sessions, results, applicationGuards, capacityLocks, matchRequests, suggestionUsages, versions] = await Promise.all([
    countQuery(firestore.collection(APPLICATIONS_COLLECTION).where('offerId', '==', offerId)),
    firestore.collection(COMPANY_QUESTIONNAIRES_COLLECTION).doc(offerId).get().then((snapshot) => snapshot.exists ? 1 : 0),
    countQuery(firestore.collection(TEST_SESSIONS_COLLECTION).where('offerId', '==', offerId)),
    countQuery(firestore.collection(TEST_RESULTS_COLLECTION).where('offerId', '==', offerId)),
    countQuery(firestore.collection(APPLICATION_GUARDS_COLLECTION).where('offerId', '==', offerId)),
    countQuery(firestore.collection(OFFER_CAPACITY_LOCKS_COLLECTION).where('offerId', '==', offerId)),
    countQuery(firestore.collection(MATCH_REQUESTS_COLLECTION).where('offerId', '==', offerId)),
    countQuery(firestore.collectionGroup('usages').where('offerId', '==', offerId)),
    countQuery(firestore.collection(COLLECTION).doc(offerId).collection('versions')),
  ]);
  return { applications, questionnaire, sessions, results, applicationGuards, capacityLocks, matchRequests, suggestionUsages, versions };
}

export async function deleteJobOffer(companyUid: string, offerId: string) {
  await loadCompanyContext(companyUid);
  const firestore = requireDatabase();
  const id = cleanText(offerId, 100, true);
  const ref = firestore.collection(COLLECTION).doc(id);
  const snapshot = await ref.get();
  const offer = snapshot.exists ? serializeOffer(snapshot.id, snapshot.data() as FirestoreRecord) : null;
  assertOfferOwner(offer, companyUid);
  const dependencies = await loadJobOfferDependencyCounts(id);
  assertJobOfferDeletionAllowed(offer.status, dependencies);
  await firestore.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(ref);
    const current = currentSnapshot.exists ? serializeOffer(currentSnapshot.id, currentSnapshot.data() as FirestoreRecord) : null;
    assertOfferOwner(current, companyUid);
    assertJobOfferDeletionAllowed(current.status, dependencies);
    const questionnaire = await transaction.get(firestore.collection(COMPANY_QUESTIONNAIRES_COLLECTION).doc(id));
    if (questionnaire.exists) {
      throw new SevenoJobOfferError('offer_has_dependencies', 409, 'Cette offre possède déjà des candidatures, des questionnaires ou des échanges. Elle ne peut pas être supprimée définitivement, mais vous pouvez l’archiver.');
    }
    transaction.delete(ref);
  });
}

export async function getJobOffer(companyUid: string, offerId: string) {
  await loadCompanyContext(companyUid);
  const id = cleanText(offerId, 100, true);
  const snapshot = await requireDatabase().collection(COLLECTION).doc(id).get();
  const offer = snapshot.exists ? await hydrateQuestionnaireSnapshot(companyUid, serializeOffer(snapshot.id, snapshot.data() as FirestoreRecord)) : null;
  assertOfferOwner(offer, companyUid);
  return offer;
}

export async function updateJobOffer(companyUid: string, offerId: string, raw: unknown) {
  const context = await loadCompanyContext(companyUid);
  const firestore = requireDatabase();
  const ref = firestore.collection(COLLECTION).doc(cleanText(offerId, 100, true));
  const initialSnapshot = await ref.get();
  const existing = initialSnapshot.exists ? serializeOffer(initialSnapshot.id, initialSnapshot.data() as FirestoreRecord) : null;
  assertOfferOwner(existing, companyUid);
  if (existing.status === 'closed' || existing.status === 'archived') {
    throw new SevenoJobOfferError('offer_not_editable', 409, 'Une offre fermee ou archivee ne peut plus etre modifiee.');
  }
  const input = validateJobOfferInput(raw);
  const structuredLocation = await normalizeOfferGeographicLocation(input);
  const snapshots = await buildSnapshots(companyUid, input, existing, existing.id);
  const questionnaire = await resolveQuestionnaireAttachment(companyUid, input.questionnaireId, existing);
  const content = {
    title: input.title,
    sectorId: input.sectorId,
    jobFamilyId: input.jobFamilyId,
    jobRoleId: input.jobRoleId,
    jobRoleLabel: input.jobRoleLabel,
    location: structuredLocation.countryCode ? formatGeographicLocation(structuredLocation) : input.location,
    ...structuredLocation,
    workMode: input.workMode,
    contractType: input.contractType,
    workingTime: input.workingTime,
    description: input.description,
    missions: input.missions,
    profileSummary: input.profileSummary,
    questionnaireRequired: input.questionnaireRequired,
    questionnaireId: questionnaire.questionnaireId || null,
    questionnaireVersion: questionnaire.questionnaireVersion || null,
    questionnaireTitleSnapshot: questionnaire.questionnaireTitleSnapshot || null,
    questionnaireQuestionCountSnapshot: questionnaire.questionnaireQuestionCountSnapshot || null,
    ...snapshots,
  };
  if (functionalSignature(existing) === functionalSignature(content)) return hydrateQuestionnaireSnapshot(companyUid, existing);

  const updatedOffer = await firestore.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(ref);
    const current = currentSnapshot.exists ? serializeOffer(currentSnapshot.id, currentSnapshot.data() as FirestoreRecord) : null;
    assertOfferOwner(current, companyUid);
    if (current.version !== existing.version) {
      throw new SevenoJobOfferError('offer_conflict', 409, 'L offre a ete modifiee. Rechargez la page.');
    }
    const now = Timestamp.now();
    const version = current.version + 1;
    const stored = {
      ...(currentSnapshot.data() as FirestoreRecord),
      ...content,
      companyPublicId: context.companyPublicId,
      companyNameSnapshot: context.companyName,
      updatedAt: now,
      version,
    };
    const serialized = serializeOffer(ref.id, stored);
    if (current.status === 'published') {
      assertPublishable(serialized, context);
      transaction.set(ref.collection('versions').doc(String(version)), {
        ...stored,
        offerVersion: version,
        recordedAt: now,
      });
    }
    transaction.set(ref, stored);
    return hydrateQuestionnaireSnapshot(companyUid, serialized);
  });

  await syncOfferPrerequisiteSuggestions(
    companyUid,
    {
      companyUid,
      id: existing!.id,
      sectorId: existing!.sectorId,
      jobFamilyId: existing!.jobFamilyId,
      jobRoleId: existing!.jobRoleId,
    },
    [...existing!.requiredPrerequisites, ...existing!.preferredPrerequisites],
    {
      companyUid,
      id: existing!.id,
      sectorId: input.sectorId,
      jobFamilyId: input.jobFamilyId,
      jobRoleId: input.jobRoleId,
    },
    [...snapshots.requiredPrerequisites, ...snapshots.preferredPrerequisites],
  );
  return updatedOffer;
}

function encodeCursor(cursor: OfferCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value?: string): OfferCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as OfferCursor;
    if (!Number.isFinite(parsed.updatedAt) || typeof parsed.id !== 'string' || !parsed.id) throw new Error('invalid');
    return parsed;
  } catch {
    throw new SevenoJobOfferError('invalid_cursor', 400, 'Le curseur de pagination est invalide.');
  }
}

export async function listJobOffers(companyUid: string, options: {
  status?: JobOfferStatus;
  assignedToUid?: string;
  limit?: number;
  cursor?: string;
} = {}): Promise<JobOfferListPage> {
  await loadCompanyContext(companyUid);
  if (options.status && !OFFER_STATUSES.includes(options.status)) {
    throw new SevenoJobOfferError('invalid_status', 400, 'Le statut demande est invalide.');
  }
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIST_LIMIT));
  let query: Query = requireDatabase().collection(COLLECTION).where('companyUid', '==', companyUid);
  if (options.assignedToUid) query = query.where('assignedToUid', '==', options.assignedToUid);
  if (options.status) query = query.where('status', '==', options.status);
  query = query.orderBy('updatedAt', 'desc').orderBy('id', 'asc');
  const cursor = decodeCursor(options.cursor);
  if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.updatedAt), cursor.id);
  const snapshot = await query.limit(limit + 1).get();
  const documents = snapshot.docs.slice(0, limit);
  const last = documents.at(-1);
  const updatedAt = last?.get('updatedAt');
  const offers = await Promise.all(documents.map(async (document) => {
    const offer = await hydrateQuestionnaireSnapshot(companyUid, serializeOffer(document.id, document.data() as FirestoreRecord));
    const activeCandidateFilesCount = await countActiveCandidateFilesForOffer(companyUid, offer.id).catch(() => 0);
    return {
      ...offer,
      activeCandidateFilesCount,
    };
  }));
  return {
    offers,
    nextCursor: snapshot.docs.length > limit && updatedAt instanceof Timestamp
      ? encodeCursor({ updatedAt: updatedAt.toMillis(), id: last?.id ?? '' })
      : null,
  };
}

export function assertRecruitmentOfferAccess(offer: SerializedJobOffer, membership: { companyId: string; userUid: string; role: CompanyMembershipRole }, mutation = false) {
  if (offer.companyId !== membership.companyId && offer.companyUid !== membership.companyId) throw new SevenoJobOfferError('forbidden_offer', 403, 'Accès à ce recrutement refusé.');
  if (membership.role === 'billing_manager') throw new SevenoJobOfferError('forbidden_recruitment_role', 403, 'Votre rôle ne permet pas d’accéder aux recrutements.');
  if (mutation && membership.role === 'viewer') throw new SevenoJobOfferError('read_only_membership', 403, 'Votre rôle permet uniquement la consultation.');
  if (membership.role === 'recruiter' && offer.assignedToUid !== membership.userUid) throw new SevenoJobOfferError('recruitment_not_assigned', 403, 'Ce recrutement est attribué à un autre membre.');
}

export type RecruitmentMembership = { companyId: string; userUid: string; role: CompanyMembershipRole };

export async function assertRecruitmentOfferIdAccess(
  offerId: string,
  membership: RecruitmentMembership,
  mutation = false,
) {
  const offer = await getJobOffer(membership.companyId, offerId);
  assertRecruitmentOfferAccess(offer, membership, mutation);
  return offer;
}

export async function assertRecruitmentApplicationAccess(
  applicationId: string,
  membership: RecruitmentMembership,
  mutation = false,
) {
  const snapshot = await requireDatabase().collection('job_applications').doc(cleanText(applicationId, 100, true)).get();
  if (!snapshot.exists) throw new SevenoJobOfferError('application_not_found', 404, 'Candidature introuvable.');
  const companyId = String(snapshot.get('companyId') ?? snapshot.get('companyUid') ?? '');
  if (companyId !== membership.companyId) throw new SevenoJobOfferError('forbidden_application', 403, 'Accès à cette candidature refusé.');
  const offerId = String(snapshot.get('offerId') ?? '').trim();
  if (!offerId) throw new SevenoJobOfferError('application_offer_missing', 409, 'Cette candidature n’est reliée à aucune offre.');
  const offer = await assertRecruitmentOfferIdAccess(offerId, membership, mutation);
  return { applicationId: snapshot.id, offerId, offer };
}

export async function assertRecruitmentCampaignAccess(
  campaignId: string,
  membership: RecruitmentMembership,
  mutation = false,
) {
  const campaign = await requireDatabase().collection('recruitment_campaigns').doc(cleanText(campaignId, 128, true)).get();
  if (!campaign.exists) throw new SevenoJobOfferError('campaign_not_found', 404, 'Campagne introuvable.');
  if (String(campaign.get('companyId') ?? '') !== membership.companyId) throw new SevenoJobOfferError('forbidden_campaign', 403, 'Accès à cette campagne refusé.');
  const offerId = String(campaign.get('offerId') ?? '').trim();
  if (!offerId) throw new SevenoJobOfferError('campaign_offer_missing', 409, 'Cette campagne n’est reliée à aucune offre.');
  const offer = await assertRecruitmentOfferIdAccess(offerId, membership, mutation);
  return { campaignId: campaign.id, offerId, offer };
}

export async function reassignJobOffer(companyId: string, offerId: string, actor: { uid: string; role: CompanyMembershipRole }, targetUid: string) {
  if (!['owner', 'admin'].includes(actor.role)) throw new SevenoJobOfferError('reassignment_forbidden', 403, 'Seul un owner ou un administrateur peut réattribuer un recrutement.');
  const firestore = requireDatabase(); const ref = firestore.collection(COLLECTION).doc(offerId); const targetRef = firestore.collection('company_memberships').doc(buildCompanyMembershipId(companyId, targetUid));
  await firestore.runTransaction(async (transaction) => {
    const [offer, target] = await Promise.all([transaction.get(ref), transaction.get(targetRef)]);
    if (!offer.exists || (offer.get('companyId') ?? offer.get('companyUid')) !== companyId) throw new SevenoJobOfferError('offer_not_found', 404, 'Offre introuvable.');
    if (!target.exists || target.get('companyId') !== companyId || target.get('userUid') !== targetUid || target.get('status') !== 'active' || !['owner', 'admin', 'recruiter'].includes(String(target.get('role')))) throw new SevenoJobOfferError('invalid_assignee', 400, 'Le responsable doit être un membre actif autorisé de cette entreprise.');
    const previousAssignedToUid = String(offer.get('assignedToUid') ?? '');
    if (!previousAssignedToUid) throw new SevenoJobOfferError('offer_assignment_missing', 409, 'Cette offre ne fait pas partie du nouveau modèle de responsabilité.');
    if (previousAssignedToUid === targetUid) return;
    const now = Timestamp.now();
    transaction.update(ref, { assignedToUid: targetUid, assignedAt: now, assignedByUid: actor.uid, updatedAt: now });
    transaction.create(firestore.collection('admin_logs').doc(), { actorUserId: actor.uid, actorRole: actor.role, action: 'offer_reassigned', targetCollection: COLLECTION, targetId: offerId, metadata: { offerId, companyId, previousAssignedToUid, newAssignedToUid: targetUid }, createdAt: now });
  });
  return getJobOffer(companyId, offerId);
}

export async function changeJobOfferStatus(companyUid: string, offerId: string, action: JobOfferStatusAction, actor?: { uid: string; membershipRole: CompanyMembershipRole }) {
  const context = await loadCompanyContext(companyUid, action === 'publish' || action === 'reactivate');
  const firestore = requireDatabase();
  const ref = firestore.collection(COLLECTION).doc(cleanText(offerId, 100, true));
  const result = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? serializeOffer(snapshot.id, snapshot.data() as FirestoreRecord) : null;
    assertOfferOwner(current, companyUid);
    const publishedVersionSnapshot = action === 'publish'
      ? await transaction.get(ref.collection('versions').doc(String(current.version)))
      : null;
    const status = resolveJobOfferStatus(current.status, action);
    const isFirstPublication = isFirstCandidateOfferPublication(
      current.status,
      action,
      snapshot.get('publishedAt') != null
        || Boolean(publishedVersionSnapshot?.exists && publishedVersionSnapshot.get('status') === 'published'),
    );

    if (status === 'published') assertPublishable(current, context);
    let questionnaireId = current.questionnaireId;
    let questionnaireVersion = current.questionnaireVersion;
    let questionnaireTitleSnapshot = current.questionnaireTitleSnapshot;
    let questionnaireQuestionCountSnapshot = current.questionnaireQuestionCountSnapshot;
    if (status === 'published') {
      if (current.questionnaireRequired && !current.questionnaireId) {
        throw new SevenoJobOfferError(
          'active_questionnaire_required',
          409,
          'Associez un questionnaire avant de publier cette offre.',
        );
      }
      if (current.questionnaireId) {
        const questionnaireAttachment = await loadQuestionnaireAttachment(companyUid, current.questionnaireId);
        questionnaireId = questionnaireAttachment.questionnaireId;
        questionnaireVersion = questionnaireAttachment.questionnaireVersion;
        questionnaireTitleSnapshot = questionnaireAttachment.questionnaireTitleSnapshot;
        questionnaireQuestionCountSnapshot = questionnaireAttachment.questionnaireQuestionCountSnapshot;
      }
    }
    const now = Timestamp.now();
    const fanoutSnapshot = isFirstPublication
      ? await transaction.get(
          firestore.collection(OFFER_NOTIFICATION_FANOUTS_COLLECTION).doc(buildCandidateOfferFanoutId(current.id)),
        )
      : undefined;
    const lifecycleCampaignRef = current.activeCampaignId
      ? firestore.collection('recruitment_campaigns').doc(current.activeCampaignId)
      : null;
    const lifecycleCampaign = lifecycleCampaignRef ? await transaction.get(lifecycleCampaignRef) : null;
    if (action === 'reactivate' && lifecycleCampaign?.exists) {
      const endsAt = lifecycleCampaign.get('endsAt');
      if (!(endsAt instanceof Timestamp) || endsAt.toMillis() <= now.toMillis()) {
        throw new SevenoJobOfferError('campaign_expired', 409, 'La campagne est expirée. Une prolongation est nécessaire.');
      }
    }
    const campaign = isFirstPublication
      ? await activateCampaignInTransaction(transaction, firestore, {
          companyId: current.companyId || companyUid,
          offerId: current.id,
          actorUid: actor?.uid ?? companyUid,
          actorMembershipRole: actor?.membershipRole ?? 'owner',
          now,
        })
      : null;
    const stored = {
      ...(snapshot.data() as FirestoreRecord),
      status,
      updatedAt: now,
      ...(status === 'published'
        ? { publishedAt: snapshot.get('publishedAt') instanceof Timestamp ? snapshot.get('publishedAt') : now, closedAt: null }
        : {}),
      ...(status === 'closed' ? { closedAt: now } : {}),
      ...(action === 'restore' ? { publishedAt: null, closedAt: null } : {}),
      questionnaireId,
      questionnaireVersion,
      questionnaireTitleSnapshot,
      questionnaireQuestionCountSnapshot,
      companyId: current.companyId || companyUid,
      updatedByUid: actor?.uid ?? companyUid,
      ...(campaign ? { activeCampaignId: campaign.campaignId } : {}),
    };
    const fanout = isFirstPublication
      ? await prepareCandidateOfferFanout(transaction, firestore, {
          offerId: current.id,
          companyUid,
          jobRoleId: current.jobRoleId,
          contractType: current.contractType as JobOfferContractType,
          now,
          existingSnapshot: fanoutSnapshot,
        })
      : null;
    if (status === 'published') {
      transaction.set(ref.collection('versions').doc(String(current.version)), {
        ...stored,
        offerVersion: current.version,
        recordedAt: now,
      });
    }
    if (lifecycleCampaignRef && lifecycleCampaign?.exists) {
      if (action === 'pause') transaction.update(lifecycleCampaignRef, { status: 'paused', lastUpdatedByUid: actor?.uid ?? companyUid, updatedAt: now });
      if (action === 'reactivate') transaction.update(lifecycleCampaignRef, { status: 'active', lastUpdatedByUid: actor?.uid ?? companyUid, updatedAt: now });
      if (action === 'close' || action === 'archive') transaction.update(lifecycleCampaignRef, { status: 'closed', lastUpdatedByUid: actor?.uid ?? companyUid, updatedAt: now });
    }
    transaction.set(ref, stored);
    return {
      offer: await hydrateQuestionnaireSnapshot(companyUid, serializeOffer(ref.id, stored)),
      fanout,
    };
  });
  if (result.fanout?.created) {
    await processCandidateOfferFanout(result.fanout.fanoutId).catch(() => undefined);
  }
  return result.offer;
}

export function isFirstCandidateOfferPublication(
  status: JobOfferStatus,
  action: JobOfferStatusAction,
  hasPublishedAt: boolean,
) {
  return action === 'publish' && status === 'draft' && !hasPublishedAt;
}

export function resolveJobOfferStatus(status: JobOfferStatus, action: JobOfferStatusAction): JobOfferStatus {
  if (action === 'publish' && status === 'draft') return 'published';
  if (action === 'pause' && status === 'published') return 'paused';
  if (action === 'reactivate' && status === 'paused') return 'published';
  if (action === 'close' && (status === 'published' || status === 'paused')) return 'closed';
  if (action === 'archive' && (status === 'paused' || status === 'closed')) return 'archived';
  if (action === 'restore' && (status === 'closed' || status === 'archived')) return 'draft';
  const allowed = status === 'draft' ? ['publish']
    : status === 'published' ? ['pause', 'close']
      : status === 'paused' ? ['reactivate', 'close', 'archive']
        : status === 'closed' ? ['archive', 'restore']
          : ['restore'];
  throw new SevenoJobOfferError(
    'invalid_status_transition',
    409,
    `Action ${action} impossible depuis le statut ${status}. Actions autorisées : ${allowed.join(', ')}.`,
  );
}

export function toPublicJobOffer(offer: SerializedJobOffer): PublicJobOffer {
  const publicOffer: Partial<SerializedJobOffer> = { ...offer };
  delete publicOffer.companyUid;
  delete publicOffer.companyId;
  delete publicOffer.createdByUid;
  delete publicOffer.updatedByUid;
  return publicOffer as PublicJobOffer;
}

export function jobOfferToInput(offer: SerializedJobOffer): JobOfferInput {
  const toSelections = (snapshots: OfferPrerequisiteSnapshot[]) => snapshots.map((snapshot) => ({
    prerequisiteId: snapshot.prerequisiteId,
    expectedCriterion: snapshot.expectedCriterion,
  }));
  return {
    title: offer.title,
    sectorId: offer.sectorId,
    jobFamilyId: offer.jobFamilyId,
    jobRoleId: offer.jobRoleId,
    location: offer.location,
    countryCode: offer.countryCode ?? '',
    countryName: offer.countryName ?? '',
    administrativeAreaCode: offer.administrativeAreaCode ?? '',
    administrativeAreaName: offer.administrativeAreaName ?? '',
    city: offer.city ?? '',
    cityName: offer.cityName ?? '',
    workMode: offer.workMode,
    contractType: offer.contractType,
    workingTime: offer.workingTime,
    description: offer.description,
    missions: offer.missions,
    profileSummary: offer.profileSummary,
    questionnaireId: offer.questionnaireId ?? '',
    questionnaireRequired: offer.questionnaireRequired,
    requiredPrerequisites: toSelections(offer.requiredPrerequisites),
    preferredPrerequisites: toSelections(offer.preferredPrerequisites),
  };
}
