import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { JOB_SECTORS } from '@/lib/job-taxonomy';
import {
  PREREQUISITE_ANSWER_TYPES,
  PREREQUISITE_CATEGORIES,
  PREREQUISITE_CRITERION_MODES,
  PREREQUISITE_EVIDENCE_POLICIES,
  PREREQUISITE_OPERATOR_COMPATIBILITY,
  PREREQUISITE_OPERATORS,
  PREREQUISITE_RESPONSE_SCOPES,
  PREREQUISITE_STATUSES,
  SEVENO_OFFER_PREREQUISITE_LIMITS,
} from '@/lib/seveno-prerequisite-constants';
import type {
  CompanyPrerequisiteDefinition,
  OfferPrerequisiteSelectionInput,
  OfferPrerequisiteSnapshot,
  CompanyPrerequisiteCreationInput,
  PrerequisiteApplicabilityLevel,
  PrerequisiteAnswerOption,
  PrerequisiteAnswerType,
  PrerequisiteApplicability,
  PrerequisiteCategory,
  PrerequisiteComparisonOperator,
  PrerequisiteCriterionMode,
  PrerequisiteCriterionValue,
  PrerequisiteDefinitionInput,
  PrerequisiteEvidencePolicy,
  PrerequisiteImportError,
  PrerequisiteImportReport,
  PrerequisiteLibraryScope,
  PrerequisiteResponseScope,
  PrerequisiteSource,
  PrerequisiteStatus,
  SerializedPrerequisiteDefinition,
} from '@/types/seveno-prerequisites';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';

const COLLECTION = 'prerequisite_definitions';
const OFFERS_COLLECTION = 'job_offers';
const IMPORT_DRY_RUN_COLLECTION = 'prerequisite_import_dry_runs';
const IMPORT_BATCH_SIZE = 200;
const IMPORT_DRY_RUN_TTL_MS = 30 * 60 * 1000;
const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type FirestoreRecord = Record<string, unknown>;
type PrerequisiteCreateMetadata = {
  source?: PrerequisiteSource;
  ownerCompanyId?: string;
  originOfferId?: string;
  libraryScope?: PrerequisiteLibraryScope;
};

const CATEGORY_VALUES = PREREQUISITE_CATEGORIES.map((item) => item.value);
const ANSWER_TYPE_VALUES = PREREQUISITE_ANSWER_TYPES.map((item) => item.value);
const OPERATOR_VALUES = PREREQUISITE_OPERATORS.map((item) => item.value);
const CRITERION_MODE_VALUES = PREREQUISITE_CRITERION_MODES.map((item) => item.value);
const RESPONSE_SCOPE_VALUES = PREREQUISITE_RESPONSE_SCOPES.map((item) => item.value);
const EVIDENCE_POLICY_VALUES = PREREQUISITE_EVIDENCE_POLICIES.map((item) => item.value);
const STATUS_VALUES = PREREQUISITE_STATUSES.map((item) => item.value);
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

export class SevenoPrerequisiteError extends Error {
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
    throw new SevenoPrerequisiteError('firebase_admin_missing', 500, 'Firebase Admin n est pas configure.');
  }
  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number, required = true) {
  const text = typeof value === 'string' ? value.trim() : '';
  if ((required && !text) || text.length > maxLength) {
    throw new SevenoPrerequisiteError('invalid_prerequisite', 400, 'Un champ texte du prerequis est invalide.');
  }
  return text;
}

export function normalizeSearchText(value: string) {
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
    throw new SevenoPrerequisiteError(
      'prohibited_prerequisite_content',
      400,
      `Le contenu porte sur une information personnelle interdite (${blocked}).`,
    );
  }
}

function uniqueStrings(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  const items = value.map((item) => cleanText(item, 200)).filter(Boolean);
  const unique = [...new Set(items)];
  if (unique.length !== items.length || unique.length > maxItems) {
    throw new SevenoPrerequisiteError('invalid_prerequisite', 400, 'Une liste contient des doublons ou trop de valeurs.');
  }
  return unique;
}

function resolveRoleContext(jobRoleId: string) {
  for (const sector of JOB_SECTORS) {
    for (const family of sector.families) {
      const role = family.roles.find((item) => item.code === jobRoleId);
      if (role) return { sectorId: sector.code, jobFamilyId: family.code, jobRoleId: role.code };
    }
  }
  return null;
}

function resolveFamilyContext(jobFamilyId: string) {
  for (const sector of JOB_SECTORS) {
    const family = sector.families.find((item) => item.code === jobFamilyId);
    if (family) return { sectorId: sector.code, jobFamilyId: family.code };
  }
  return null;
}

function assertApplicabilityHierarchy(
  sectorIds: string[],
  familyIds: string[],
  roleIds: string[],
  scopeLabel: 'applicability' | 'exclusion',
) {
  const sectorSet = new Set(sectorIds);
  const familySet = new Set(familyIds);

  for (const familyId of familyIds) {
    const familyContext = resolveFamilyContext(familyId);
    if (!familyContext) {
      throw new SevenoPrerequisiteError('unknown_taxonomy_id', 400, 'Un rattachement est absent de la taxonomie SevenO.');
    }
    if (sectorSet.size > 0 && !sectorSet.has(familyContext.sectorId)) {
      throw new SevenoPrerequisiteError('invalid_applicability', 400, `La ${scopeLabel} famille ne correspond pas au secteur selectionne.`);
    }
  }

  for (const roleId of roleIds) {
    const roleContext = resolveRoleContext(roleId);
    if (!roleContext) {
      throw new SevenoPrerequisiteError('unknown_taxonomy_id', 400, 'Un rattachement est absent de la taxonomie SevenO.');
    }
    if (sectorSet.size > 0 && !sectorSet.has(roleContext.sectorId)) {
      throw new SevenoPrerequisiteError('invalid_applicability', 400, `Le ${scopeLabel} metier ne correspond pas au secteur selectionne.`);
    }
    if (familySet.size > 0 && !familySet.has(roleContext.jobFamilyId)) {
      throw new SevenoPrerequisiteError('invalid_applicability', 400, `Le ${scopeLabel} metier ne correspond pas a la famille selectionnee.`);
    }
  }
}

function validateApplicability(value: unknown): PrerequisiteApplicability {
  if (!isPlainObject(value)) {
    throw new SevenoPrerequisiteError('invalid_applicability', 400, 'Le rattachement metier est invalide.');
  }
  const global = value.global === true;
  const sectorIds = uniqueStrings(value.sectorIds, 30);
  const jobFamilyIds = uniqueStrings(value.jobFamilyIds, 100);
  const jobRoleIds = uniqueStrings(value.jobRoleIds, 200);
  const excludedSectorIds = uniqueStrings(value.excludedSectorIds, 30);
  const excludedJobFamilyIds = uniqueStrings(value.excludedJobFamilyIds, 100);
  const excludedJobRoleIds = uniqueStrings(value.excludedJobRoleIds, 200);
  const validSectorIds = new Set(JOB_SECTORS.map((sector) => sector.code));
  const validFamilyIds = new Set(JOB_SECTORS.flatMap((sector) => sector.families.map((family) => family.code)));
  const validRoleIds = new Set(JOB_SECTORS.flatMap((sector) => sector.families.flatMap((family) => family.roles.map((role) => role.code))));

  if (
    sectorIds.some((id) => !validSectorIds.has(id))
    || jobFamilyIds.some((id) => !validFamilyIds.has(id))
    || jobRoleIds.some((id) => !validRoleIds.has(id))
    || excludedSectorIds.some((id) => !validSectorIds.has(id))
    || excludedJobFamilyIds.some((id) => !validFamilyIds.has(id))
    || excludedJobRoleIds.some((id) => !validRoleIds.has(id))
  ) {
    throw new SevenoPrerequisiteError('unknown_taxonomy_id', 400, 'Un rattachement est absent de la taxonomie SevenO.');
  }
  if (!global && sectorIds.length + jobFamilyIds.length + jobRoleIds.length === 0) {
    throw new SevenoPrerequisiteError('invalid_applicability', 400, 'Ajoutez au moins un rattachement ou rendez le prerequis global.');
  }
  assertApplicabilityHierarchy(sectorIds, jobFamilyIds, jobRoleIds, 'applicability');
  assertApplicabilityHierarchy(excludedSectorIds, excludedJobFamilyIds, excludedJobRoleIds, 'exclusion');
  return {
    global,
    sectorIds,
    jobFamilyIds,
    jobRoleIds,
    excludedSectorIds,
    excludedJobFamilyIds,
    excludedJobRoleIds,
  };
}

export function buildPrerequisiteApplicabilityKeys(applicability: PrerequisiteApplicability) {
  return [
    ...(applicability.global ? ['global'] : []),
    ...applicability.sectorIds.map((id) => `sector:${id}`),
    ...applicability.jobFamilyIds.map((id) => `family:${id}`),
    ...applicability.jobRoleIds.map((id) => `role:${id}`),
  ];
}

export function buildPrerequisiteExclusionKeys(applicability: PrerequisiteApplicability) {
  return [
    ...applicability.excludedSectorIds.map((id) => `sector:${id}`),
    ...applicability.excludedJobFamilyIds.map((id) => `family:${id}`),
    ...applicability.excludedJobRoleIds.map((id) => `role:${id}`),
  ];
}

export function buildJobApplicabilityKeys(jobRoleId: string) {
  const context = resolveRoleContext(jobRoleId);
  if (!context) {
    throw new SevenoPrerequisiteError('unknown_job_role', 400, 'Le metier est absent de la taxonomie SevenO.');
  }
  return [
    'global',
    `sector:${context.sectorId}`,
    `family:${context.jobFamilyId}`,
    `role:${context.jobRoleId}`,
  ];
}

function resolveApplicabilityLevel(applicability: PrerequisiteApplicability): PrerequisiteApplicabilityLevel {
  if (applicability.jobRoleIds.length > 0) return 'role';
  if (applicability.jobFamilyIds.length > 0) return 'family';
  if (applicability.sectorIds.length > 0) return 'sector';
  return 'global';
}

function applicabilityLevelRank(value: PrerequisiteApplicabilityLevel | null | undefined) {
  if (value === 'role') return 0;
  if (value === 'family') return 1;
  if (value === 'sector') return 2;
  return 3;
}

function getSelectionIds(offer: FirestoreRecord | null | undefined) {
  const required = Array.isArray(offer?.requiredPrerequisites) ? offer?.requiredPrerequisites as Array<Pick<OfferPrerequisiteSnapshot, 'prerequisiteId'>> : [];
  const preferred = Array.isArray(offer?.preferredPrerequisites) ? offer?.preferredPrerequisites as Array<Pick<OfferPrerequisiteSnapshot, 'prerequisiteId'>> : [];
  return new Set([...required, ...preferred].map((item) => String(item.prerequisiteId ?? '').trim()).filter(Boolean));
}

function matchesCurrentRole(item: SerializedPrerequisiteDefinition, currentKeys: Set<string>) {
  return item.applicabilityKeys.some((key) => currentKeys.has(key)) && !item.exclusionKeys.some((key) => currentKeys.has(key));
}

function isSelectableInOffer(
  item: SerializedPrerequisiteDefinition,
  companyUid: string,
  offerId?: string,
) {
  if (item.status !== 'active') return false;
  if (item.source === 'company') {
    if (item.ownerCompanyId !== companyUid) return false;
    if (item.originOfferId && item.originOfferId !== (offerId ?? '')) return false;
  }
  return true;
}

function toPickerProjection(
  item: SerializedPrerequisiteDefinition,
  options: {
    currentKeys?: Set<string>;
    selectedIds?: Set<string>;
  } = {},
): CompanyPrerequisiteDefinition {
  const currentKeys = options.currentKeys ?? null;
  const selectedIds = options.selectedIds ?? null;
  const projection: CompanyPrerequisiteDefinition = {
    prerequisiteId: item.id,
    code: item.code,
    source: item.source ?? 'seveno',
    ...(item.ownerCompanyId ? { ownerCompanyId: item.ownerCompanyId } : {}),
    ...(item.originOfferId ? { originOfferId: item.originOfferId } : {}),
    category: item.category,
    companyLabel: item.companyLabel,
    ...(item.companyDescription ? { companyDescription: item.companyDescription } : {}),
    candidateQuestion: item.candidateQuestion,
    ...(item.candidateHelp ? { candidateHelp: item.candidateHelp } : {}),
    answerType: item.answerType,
    options: item.options,
    criterionMode: item.criterionMode,
    ...(item.defaultCriterion !== undefined ? { defaultCriterion: item.defaultCriterion } : {}),
    allowedCriterionValues: item.allowedCriterionValues,
    comparisonOperator: item.comparisonOperator,
    responseScope: item.responseScope,
    evidencePolicy: item.evidencePolicy,
    ...(item.freshnessDays !== undefined ? { freshnessDays: item.freshnessDays } : {}),
    applicability: item.applicability,
    version: item.version,
    applicabilityLevel: resolveApplicabilityLevel(item.applicability),
    ...(currentKeys ? { applicableToCurrentRole: matchesCurrentRole(item, currentKeys) } : {}),
    ...(selectedIds?.has(item.id) ? { alreadySelected: true } : {}),
  };
  if (projection.applicableToCurrentRole === undefined) {
    projection.applicableToCurrentRole = false;
  }
  if (projection.alreadySelected === undefined) {
    projection.alreadySelected = false;
  }
  return projection;
}

function comparePickerProjections(
  left: CompanyPrerequisiteDefinition,
  right: CompanyPrerequisiteDefinition,
  query: string,
) {
  const leftNormalizedLabel = normalizeSearchText(left.companyLabel);
  const rightNormalizedLabel = normalizeSearchText(right.companyLabel);
  const leftExact = Boolean(query) && leftNormalizedLabel === query;
  const rightExact = Boolean(query) && rightNormalizedLabel === query;
  if (leftExact !== rightExact) return leftExact ? -1 : 1;

  const leftCurrent = left.applicableToCurrentRole === true;
  const rightCurrent = right.applicableToCurrentRole === true;
  if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;

  const leftLevel = applicabilityLevelRank(left.applicabilityLevel);
  const rightLevel = applicabilityLevelRank(right.applicabilityLevel);
  if (leftLevel !== rightLevel) return leftLevel - rightLevel;

  if (left.source !== right.source) return left.source === 'seveno' ? -1 : 1;

  return left.companyLabel.localeCompare(right.companyLabel, 'fr') || left.code.localeCompare(right.code, 'fr');
}

function dedupePickerResults(results: CompanyPrerequisiteDefinition[]) {
  const grouped = new Map<string, CompanyPrerequisiteDefinition[]>();
  for (const result of results) {
    const key = normalizeSearchText(result.companyLabel);
    const bucket = grouped.get(key) ?? [];
    bucket.push(result);
    grouped.set(key, bucket);
  }

  const deduped: CompanyPrerequisiteDefinition[] = [];
  for (const bucket of grouped.values()) {
    const primary = bucket[0];
    if (!primary) continue;
    deduped.push({
      ...primary,
      alreadySelected: bucket.some((item) => item.alreadySelected === true),
      applicableToCurrentRole: bucket.some((item) => item.applicableToCurrentRole === true),
    });
  }

  return deduped;
}

export function buildCompanyPrerequisitePickerResults(
  items: SerializedPrerequisiteDefinition[],
  options: {
    jobRoleId: string;
    companyUid?: string;
    offerId?: string;
    query?: string;
    selectedIds?: Iterable<string>;
    limit?: number;
  },
) {
  const currentKeys = new Set(buildJobApplicabilityKeys(cleanText(options.jobRoleId, 200)));
  const normalizedQuery = normalizeSearchText(options.query ?? '');
  const limit = Math.min(20, Math.max(1, options.limit ?? 20));
  const selectedIds = new Set(Array.from(options.selectedIds ?? [], (value) => String(value).trim()).filter(Boolean));

  const visibleItems = items
    .filter((item) => isSelectableInOffer(item, options.companyUid ?? '', options.offerId))
    .filter((item) => (
      normalizedQuery
        ? item.searchKeys.includes(normalizedQuery)
        : matchesCurrentRole(item, currentKeys)
    ))
    .map((item) => toPickerProjection(item, { currentKeys, selectedIds }));

  visibleItems.sort((left, right) => comparePickerProjections(left, right, normalizedQuery));
  return dedupePickerResults(visibleItems).slice(0, limit);
}

export function buildAdminApplicabilityKeys(filters: {
  sectorId?: string;
  jobFamilyId?: string;
  jobRoleId?: string;
}) {
  const sectorId = filters.sectorId ? cleanText(filters.sectorId, 120) : '';
  const jobFamilyId = filters.jobFamilyId ? cleanText(filters.jobFamilyId, 160) : '';
  const jobRoleId = filters.jobRoleId ? cleanText(filters.jobRoleId, 200) : '';

  if (jobRoleId) {
    const context = resolveRoleContext(jobRoleId);
    if (!context || (sectorId && context.sectorId !== sectorId) || (jobFamilyId && context.jobFamilyId !== jobFamilyId)) {
      throw new SevenoPrerequisiteError('unknown_taxonomy_id', 400, 'Les filtres metier sont invalides ou incompatibles.');
    }
    return buildJobApplicabilityKeys(jobRoleId);
  }
  if (jobFamilyId) {
    const context = resolveFamilyContext(jobFamilyId);
    if (!context || (sectorId && context.sectorId !== sectorId)) {
      throw new SevenoPrerequisiteError('unknown_taxonomy_id', 400, 'Les filtres metier sont invalides ou incompatibles.');
    }
    return ['global', `sector:${context.sectorId}`, `family:${context.jobFamilyId}`];
  }
  if (sectorId) {
    if (!JOB_SECTORS.some((sector) => sector.code === sectorId)) {
      throw new SevenoPrerequisiteError('unknown_taxonomy_id', 400, 'Le secteur est absent de la taxonomie SevenO.');
    }
    return ['global', `sector:${sectorId}`];
  }
  return [];
}

function buildSearchKeys(code: string, companyLabel: string) {
  const keys = new Set<string>();
  for (const source of [normalizeSearchText(code), normalizeSearchText(companyLabel)]) {
    const tokens = [source, ...source.split(' ')];
    for (const token of tokens) {
      if (!token) continue;
      for (let size = 2; size <= Math.min(token.length, 30); size += 1) keys.add(token.slice(0, size));
    }
  }
  return [...keys].slice(0, 200);
}

function normalizeOptions(value: unknown, answerType: PrerequisiteAnswerType): PrerequisiteAnswerOption[] {
  const optionsRequired = ['single_choice', 'multiple_choice', 'level'].includes(answerType);
  if (!Array.isArray(value)) {
    if (optionsRequired) throw new SevenoPrerequisiteError('options_required', 400, 'Des options structurees sont requises.');
    return [];
  }
  const options = value.map((item) => {
    if (!isPlainObject(item)) throw new SevenoPrerequisiteError('invalid_options', 400, 'Une option est invalide.');
    const option: PrerequisiteAnswerOption = {
      value: cleanText(item.value, 80),
      candidateLabel: cleanText(item.candidateLabel, 160),
    };
    if (item.rank !== undefined) {
      if (typeof item.rank !== 'number' || !Number.isInteger(item.rank)) {
        throw new SevenoPrerequisiteError('invalid_options', 400, 'Le rang d une option doit etre un entier.');
      }
      option.rank = item.rank;
    }
    return option;
  });
  if (!optionsRequired && options.length > 0) {
    throw new SevenoPrerequisiteError('invalid_options', 400, 'Ce type de reponse ne doit pas contenir d options.');
  }
  if (optionsRequired && options.length < 2) {
    throw new SevenoPrerequisiteError('invalid_options', 400, 'Au moins deux options sont requises.');
  }
  const values = options.map((option) => option.value);
  if (new Set(values).size !== values.length) {
    throw new SevenoPrerequisiteError('invalid_options', 400, 'Les valeurs d options doivent etre uniques.');
  }
  if (answerType === 'level') {
    const ranks = options.map((option) => option.rank);
    if (ranks.some((rank) => rank === undefined) || new Set(ranks).size !== ranks.length) {
      throw new SevenoPrerequisiteError('invalid_options', 400, 'Chaque niveau doit posseder un rang unique.');
    }
  }
  return options;
}

function normalizeCriterionValue(value: unknown, answerType: PrerequisiteAnswerType): PrerequisiteCriterionValue {
  if (answerType === 'boolean' && typeof value === 'boolean') return value;
  if (answerType === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
  if (answerType === 'date' && typeof value === 'string' && DATE_PATTERN.test(value)) return value;
  if ((answerType === 'single_choice' || answerType === 'level') && typeof value === 'string' && value.trim()) return value.trim();
  if (answerType === 'multiple_choice' && Array.isArray(value)) return uniqueStrings(value, 100);
  throw new SevenoPrerequisiteError('invalid_criterion', 400, 'Une valeur de critere est incompatible avec le type de reponse.');
}

function criterionKey(value: PrerequisiteCriterionValue) {
  return JSON.stringify(value);
}

function assertCriterionUsesOptions(
  criterion: PrerequisiteCriterionValue,
  answerType: PrerequisiteAnswerType,
  options: PrerequisiteAnswerOption[],
) {
  if (!['single_choice', 'multiple_choice', 'level'].includes(answerType)) return;
  const allowed = new Set(options.map((option) => option.value));
  const values = Array.isArray(criterion) ? criterion : [criterion];
  if (values.some((value) => typeof value !== 'string' || !allowed.has(value))) {
    throw new SevenoPrerequisiteError('invalid_criterion', 400, 'Le critere reference une option inconnue.');
  }
}

export function validatePrerequisiteInput(raw: unknown, forcedCode?: string): PrerequisiteDefinitionInput {
  if (!isPlainObject(raw)) throw new SevenoPrerequisiteError('invalid_prerequisite', 400, 'Le prerequis est invalide.');
  const code = (forcedCode ?? cleanText(raw.code, 100)).toLowerCase();
  if (!CODE_PATTERN.test(code)) {
    throw new SevenoPrerequisiteError('invalid_code', 400, 'Le code doit utiliser des lettres minuscules, chiffres et tirets.');
  }
  const sourceValue = raw.source === undefined || raw.source === null || raw.source === ''
    ? 'seveno'
    : cleanText(raw.source, 20);
  if (sourceValue !== 'seveno' && sourceValue !== 'company') {
    throw new SevenoPrerequisiteError('invalid_source', 400, 'La source du prerequis est invalide.');
  }
  const libraryScopeValue = raw.libraryScope === undefined || raw.libraryScope === null || raw.libraryScope === ''
    ? undefined
    : cleanText(raw.libraryScope, 20);
  if (libraryScopeValue !== undefined && libraryScopeValue !== 'library' && libraryScopeValue !== 'offer') {
    throw new SevenoPrerequisiteError('invalid_scope', 400, 'La portee du prerequis est invalide.');
  }
  const category = raw.category as PrerequisiteCategory;
  const answerType = raw.answerType as PrerequisiteAnswerType;
  const criterionMode = raw.criterionMode as PrerequisiteCriterionMode;
  const comparisonOperator = raw.comparisonOperator as PrerequisiteComparisonOperator;
  const responseScope = raw.responseScope as PrerequisiteResponseScope;
  const evidencePolicy = raw.evidencePolicy as PrerequisiteEvidencePolicy;
  const status = raw.status as PrerequisiteStatus;
  if (!CATEGORY_VALUES.includes(category)) throw new SevenoPrerequisiteError('invalid_category', 400, 'La categorie est invalide.');
  if (!ANSWER_TYPE_VALUES.includes(answerType)) throw new SevenoPrerequisiteError('invalid_answer_type', 400, 'Le type de reponse est invalide.');
  if (!CRITERION_MODE_VALUES.includes(criterionMode)) throw new SevenoPrerequisiteError('invalid_criterion_mode', 400, 'Le mode de critere est invalide.');
  if (!OPERATOR_VALUES.includes(comparisonOperator) || !PREREQUISITE_OPERATOR_COMPATIBILITY[answerType].includes(comparisonOperator)) {
    throw new SevenoPrerequisiteError('invalid_operator', 400, 'L operateur est incompatible avec le type de reponse.');
  }
  if (!RESPONSE_SCOPE_VALUES.includes(responseScope)) throw new SevenoPrerequisiteError('invalid_response_scope', 400, 'La portee de reponse est invalide.');
  if (!EVIDENCE_POLICY_VALUES.includes(evidencePolicy)) throw new SevenoPrerequisiteError('invalid_evidence_policy', 400, 'La politique de preuve est invalide.');
  if (!STATUS_VALUES.includes(status)) throw new SevenoPrerequisiteError('invalid_status', 400, 'Le statut est invalide.');

  const companyLabel = cleanText(raw.companyLabel, 200);
  const companyDescription = cleanText(raw.companyDescription, 1000, false);
  const candidateQuestion = cleanText(raw.candidateQuestion, 500);
  const candidateHelp = cleanText(raw.candidateHelp, 1000, false);
  const ownerCompanyId = cleanText(raw.ownerCompanyId, 160, false);
  const originOfferId = cleanText(raw.originOfferId, 100, false);
  assertProfessionalContent([companyLabel, companyDescription, candidateQuestion, candidateHelp]);
  const options = normalizeOptions(raw.options, answerType);
  const allowedCriterionValues = Array.isArray(raw.allowedCriterionValues)
    ? raw.allowedCriterionValues.map((value) => normalizeCriterionValue(value, answerType))
    : [];
  if (new Set(allowedCriterionValues.map(criterionKey)).size !== allowedCriterionValues.length) {
    throw new SevenoPrerequisiteError('invalid_criterion', 400, 'Les valeurs de critere autorisees contiennent des doublons.');
  }
  allowedCriterionValues.forEach((value) => assertCriterionUsesOptions(value, answerType, options));
  const defaultCriterion = raw.defaultCriterion === undefined
    ? undefined
    : normalizeCriterionValue(raw.defaultCriterion, answerType);
  if (defaultCriterion !== undefined) assertCriterionUsesOptions(defaultCriterion, answerType, options);
  if (criterionMode === 'fixed' && defaultCriterion === undefined) {
    throw new SevenoPrerequisiteError('criterion_required', 400, 'Un critere fixe doit definir sa valeur attendue.');
  }
  if (criterionMode === 'configurable' && allowedCriterionValues.length === 0) {
    throw new SevenoPrerequisiteError('allowed_criteria_required', 400, 'Un critere configurable doit definir les valeurs autorisees.');
  }
  if (
    criterionMode === 'configurable'
    && defaultCriterion !== undefined
    && !allowedCriterionValues.some((value) => criterionKey(value) === criterionKey(defaultCriterion))
  ) {
    throw new SevenoPrerequisiteError('invalid_criterion', 400, 'Le critere par defaut doit faire partie des valeurs autorisees.');
  }

  let freshnessDays: number | undefined;
  if (raw.freshnessDays !== undefined && raw.freshnessDays !== null && raw.freshnessDays !== '') {
    if (typeof raw.freshnessDays !== 'number' || !Number.isInteger(raw.freshnessDays) || raw.freshnessDays < 1 || raw.freshnessDays > 3650) {
      throw new SevenoPrerequisiteError('invalid_freshness', 400, 'La fraicheur doit etre comprise entre 1 et 3650 jours.');
    }
    freshnessDays = raw.freshnessDays;
  }
  if (freshnessDays !== undefined && responseScope !== 'profile_reusable') {
    throw new SevenoPrerequisiteError('invalid_freshness', 400, 'La fraicheur concerne uniquement une reponse reutilisable.');
  }

  return {
    code,
    source: sourceValue as PrerequisiteSource,
    ...(ownerCompanyId ? { ownerCompanyId } : {}),
    ...(originOfferId ? { originOfferId } : {}),
    ...(libraryScopeValue ? { libraryScope: libraryScopeValue as PrerequisiteLibraryScope } : {}),
    category,
    companyLabel,
    ...(companyDescription ? { companyDescription } : {}),
    candidateQuestion,
    ...(candidateHelp ? { candidateHelp } : {}),
    answerType,
    options,
    criterionMode,
    ...(defaultCriterion !== undefined ? { defaultCriterion } : {}),
    allowedCriterionValues,
    comparisonOperator,
    responseScope,
    evidencePolicy,
    ...(freshnessDays !== undefined ? { freshnessDays } : {}),
    applicability: validateApplicability(raw.applicability),
    status,
  };
}

function toInput(data: FirestoreRecord): PrerequisiteDefinitionInput {
  return validatePrerequisiteInput(data, String(data.code ?? ''));
}

function functionalSignature(input: PrerequisiteDefinitionInput) {
  return JSON.stringify(input);
}

function timestampToIso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

function serializeDocument(id: string, data: FirestoreRecord): SerializedPrerequisiteDefinition {
  const input = toInput(data);
  return {
    id,
    ...input,
    applicabilityKeys: Array.isArray(data.applicabilityKeys) ? data.applicabilityKeys.map(String) : buildPrerequisiteApplicabilityKeys(input.applicability),
    exclusionKeys: Array.isArray(data.exclusionKeys) ? data.exclusionKeys.map(String) : buildPrerequisiteExclusionKeys(input.applicability),
    searchKeys: Array.isArray(data.searchKeys) ? data.searchKeys.map(String) : buildSearchKeys(input.code, input.companyLabel),
    version: typeof data.version === 'number' ? data.version : 1,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    createdBy: String(data.createdBy ?? ''),
    updatedBy: String(data.updatedBy ?? ''),
  };
}

function buildStoredDefinition(
  input: PrerequisiteDefinitionInput,
  actorUid: string,
  version: number,
  created?: FirestoreRecord,
  metadata?: PrerequisiteCreateMetadata,
) {
  const now = Timestamp.now();
  const source = metadata?.source ?? input.source ?? 'seveno';
  const ownerCompanyId = metadata?.ownerCompanyId ?? input.ownerCompanyId;
  const originOfferId = metadata?.originOfferId ?? input.originOfferId ?? '';
  const libraryScope = metadata?.libraryScope ?? input.libraryScope ?? (source === 'company' ? 'library' : undefined);
  return {
    ...input,
    source,
    ...(ownerCompanyId ? { ownerCompanyId } : {}),
    ...(originOfferId ? { originOfferId } : {}),
    ...(libraryScope ? { libraryScope } : {}),
    id: input.code,
    applicabilityKeys: buildPrerequisiteApplicabilityKeys(input.applicability),
    exclusionKeys: buildPrerequisiteExclusionKeys(input.applicability),
    searchKeys: buildSearchKeys(input.code, input.companyLabel),
    version,
    createdAt: created?.createdAt instanceof Timestamp ? created.createdAt : now,
    updatedAt: now,
    createdBy: typeof created?.createdBy === 'string' ? created.createdBy : actorUid,
    updatedBy: actorUid,
  };
}

function normalizeCompanyPrerequisiteLabel(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function buildCompanyPrerequisiteCode(companyUid: string, offerId: string, label: string, saveToLibrary: boolean) {
  const slug = normalizeSearchText(label).replace(/\s+/g, '-').slice(0, 40) || 'prerequis';
  const scope = saveToLibrary ? 'library' : `offer-${offerId.slice(0, 8)}`;
  const unique = randomUUID().replace(/-/g, '').slice(0, 12);
  const companyFragment = createHash('sha1').update(companyUid).digest('hex').slice(0, 6);
  return `company-${scope}-${slug}-${companyFragment}-${unique}`.slice(0, 100);
}

function versionSnapshotPath(code: string, version: number) {
  return requireDatabase().collection(COLLECTION).doc(code).collection('versions').doc(String(version));
}

export async function createPrerequisite(
  actorUid: string,
  raw: unknown,
  metadata: PrerequisiteCreateMetadata = {},
) {
  const firestore = requireDatabase();
  const input = validatePrerequisiteInput(raw);
  const ref = firestore.collection(COLLECTION).doc(input.code);
  const storedInput: PrerequisiteDefinitionInput = {
    source: metadata.source ?? 'seveno',
    code: input.code,
    category: input.category,
    companyLabel: input.companyLabel,
    ...(input.companyDescription ? { companyDescription: input.companyDescription } : {}),
    candidateQuestion: input.candidateQuestion,
    ...(input.candidateHelp ? { candidateHelp: input.candidateHelp } : {}),
    answerType: input.answerType,
    options: input.options,
    criterionMode: input.criterionMode,
    ...(input.defaultCriterion !== undefined ? { defaultCriterion: input.defaultCriterion } : {}),
    allowedCriterionValues: input.allowedCriterionValues,
    comparisonOperator: input.comparisonOperator,
    responseScope: input.responseScope,
    evidencePolicy: input.evidencePolicy,
    ...(input.freshnessDays !== undefined ? { freshnessDays: input.freshnessDays } : {}),
    applicability: input.applicability,
    status: input.status,
    ...(metadata.ownerCompanyId ? { ownerCompanyId: metadata.ownerCompanyId } : {}),
    ...(metadata.originOfferId ? { originOfferId: metadata.originOfferId } : {}),
    ...(metadata.libraryScope ? { libraryScope: metadata.libraryScope } : {}),
  };
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) throw new SevenoPrerequisiteError('duplicate_code', 409, 'Ce code existe deja.');
    const stored = buildStoredDefinition(storedInput, actorUid, 1, undefined, metadata);
    transaction.create(ref, stored);
    transaction.create(versionSnapshotPath(input.code, 1), { ...stored, recordedAt: stored.updatedAt, recordedBy: actorUid });
    return serializeDocument(input.code, stored);
  });
}

export async function createCompanyPrerequisite(
  actorUid: string,
  offer: SerializedJobOffer,
  raw: CompanyPrerequisiteCreationInput,
) {
  if (raw.offerId !== offer.id) {
    throw new SevenoPrerequisiteError('offer_mismatch', 400, 'L offre selectionnee est invalide.');
  }
  const label = normalizeCompanyPrerequisiteLabel(raw.label);
  const candidateHelp = typeof raw.candidateHelp === 'string' ? raw.candidateHelp.trim().replace(/\s+/g, ' ') : '';
  const normalizedLabel = normalizeSearchText(label);
  if (normalizedLabel.length < 2) {
    throw new SevenoPrerequisiteError('invalid_prerequisite_label', 400, 'Le nom du prerequis doit contenir au moins 2 caracteres utiles.');
  }
  if (label.length > 120) {
    throw new SevenoPrerequisiteError('invalid_prerequisite_label', 400, 'Le nom du prerequis est trop long.');
  }
  if (!/[\p{L}\p{N}]/u.test(label)) {
    throw new SevenoPrerequisiteError('invalid_prerequisite_label', 400, 'Le nom du prerequis ne peut pas etre compose uniquement de ponctuation.');
  }
  if (!offer.jobRoleId) {
    throw new SevenoPrerequisiteError('job_role_required', 400, 'Selectionnez un metier precis avant de creer un prerequis.');
  }
  if (offer.companyUid !== actorUid) {
    throw new SevenoPrerequisiteError('forbidden_prerequisite', 403, 'Ce prerequis ne vous appartient pas.');
  }

  const accessiblePrerequisites = await listApplicablePrerequisites(offer.jobRoleId, {
    companyUid: actorUid,
    offerId: offer.id,
    query: label,
  });
  if (accessiblePrerequisites.some((definition) => normalizeSearchText(definition.companyLabel) === normalizedLabel)) {
    throw new SevenoPrerequisiteError('duplicate_prerequisite', 409, 'Ce prerequis est deja disponible pour cette offre.');
  }

  const code = buildCompanyPrerequisiteCode(actorUid, offer.id, label, raw.saveToLibrary);
  const applicability: PrerequisiteApplicability = {
    global: false,
    sectorIds: [offer.sectorId],
    jobFamilyIds: [offer.jobFamilyId],
    jobRoleIds: [offer.jobRoleId],
    excludedSectorIds: [],
    excludedJobFamilyIds: [],
    excludedJobRoleIds: [],
  };
  const definitionInput: PrerequisiteDefinitionInput = {
    code,
    category: 'other_professional',
    companyLabel: label,
    candidateQuestion: `Le candidat satisfait-il ce prerequis : ${label} ?`,
    ...(candidateHelp ? { candidateHelp } : {}),
    answerType: 'boolean',
    options: [],
    criterionMode: 'fixed',
    defaultCriterion: true,
    allowedCriterionValues: [],
    comparisonOperator: 'equals',
    responseScope: 'profile_reusable',
    evidencePolicy: 'none',
    applicability,
    status: 'active',
  };
  const created = await createPrerequisite(actorUid, definitionInput, {
    source: 'company',
    ownerCompanyId: actorUid,
    ...(raw.saveToLibrary ? { libraryScope: 'library' as const } : { originOfferId: offer.id, libraryScope: 'offer' as const }),
  });
  return toPickerProjection(created, { currentKeys: new Set(buildJobApplicabilityKeys(offer.jobRoleId)) });
}

export async function updatePrerequisite(actorUid: string, code: string, raw: unknown) {
  const firestore = requireDatabase();
  const normalizedCode = cleanText(code, 100).toLowerCase();
  const ref = firestore.collection(COLLECTION).doc(normalizedCode);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new SevenoPrerequisiteError('not_found', 404, 'Prerequis introuvable.');
    const existing = snapshot.data() as FirestoreRecord;
    const input = validatePrerequisiteInput({ ...(isPlainObject(raw) ? raw : {}), status: existing.status }, normalizedCode);
    const preservedInput: PrerequisiteDefinitionInput = {
      ...input,
      source: existing.source === 'company' ? 'company' : 'seveno',
      ...(typeof existing.ownerCompanyId === 'string' && existing.ownerCompanyId ? { ownerCompanyId: existing.ownerCompanyId } : {}),
      ...(typeof existing.originOfferId === 'string' && existing.originOfferId ? { originOfferId: existing.originOfferId } : {}),
      ...(existing.libraryScope === 'offer' ? { libraryScope: 'offer' } : {}),
    };
    if (functionalSignature(preservedInput) === functionalSignature(toInput(existing))) return serializeDocument(normalizedCode, existing);
    const version = (typeof existing.version === 'number' ? existing.version : 1) + 1;
    const stored = buildStoredDefinition(preservedInput, actorUid, version, existing, {
      source: preservedInput.source,
      ...(preservedInput.ownerCompanyId ? { ownerCompanyId: preservedInput.ownerCompanyId } : {}),
      ...(preservedInput.originOfferId ? { originOfferId: preservedInput.originOfferId } : {}),
      ...(preservedInput.libraryScope ? { libraryScope: preservedInput.libraryScope } : {}),
    });
    transaction.set(ref, stored);
    transaction.create(versionSnapshotPath(normalizedCode, version), { ...stored, recordedAt: stored.updatedAt, recordedBy: actorUid });
    return serializeDocument(normalizedCode, stored);
  });
}

export async function updatePrerequisiteStatus(actorUid: string, code: string, status: PrerequisiteStatus) {
  if (!STATUS_VALUES.includes(status)) throw new SevenoPrerequisiteError('invalid_status', 400, 'Le statut est invalide.');
  const firestore = requireDatabase();
  const ref = firestore.collection(COLLECTION).doc(cleanText(code, 100).toLowerCase());
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new SevenoPrerequisiteError('not_found', 404, 'Prerequis introuvable.');
    const now = Timestamp.now();
    transaction.update(ref, { status, updatedAt: now, updatedBy: actorUid });
    return serializeDocument(ref.id, { ...(snapshot.data() as FirestoreRecord), status, updatedAt: now, updatedBy: actorUid });
  });
}

export async function duplicatePrerequisite(actorUid: string, sourceCode: string, newCode: string) {
  const source = await getPrerequisite(sourceCode);
  if (!source) throw new SevenoPrerequisiteError('not_found', 404, 'Prerequis source introuvable.');
  return createPrerequisite(actorUid, {
    ...source,
    code: newCode,
    companyLabel: `${source.companyLabel} (copie)`,
    status: 'draft',
  });
}

type ListFilters = {
  status?: PrerequisiteStatus;
  category?: PrerequisiteCategory;
  search?: string;
  applicabilityKeys?: string[];
  limit?: number;
  cursor?: string;
};

type ListCursor = { updatedAt: number; code: string };

function encodeCursor(cursor: ListCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value?: string): ListCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as ListCursor;
    if (!Number.isFinite(parsed.updatedAt) || !CODE_PATTERN.test(parsed.code)) throw new Error('invalid');
    return parsed;
  } catch {
    throw new SevenoPrerequisiteError('invalid_cursor', 400, 'Le curseur est invalide.');
  }
}

export async function listPrerequisites(filters: ListFilters = {}) {
  const firestore = requireDatabase();
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, filters.limit ?? DEFAULT_LIST_LIMIT));
  let query: Query = firestore.collection(COLLECTION);
  const search = normalizeSearchText(filters.search ?? '');
  const applicabilityKeys = filters.applicabilityKeys?.slice(0, 30) ?? [];
  const specialQuery = Boolean(search || applicabilityKeys.length);

  if (search) query = query.where('searchKeys', 'array-contains', search);
  else if (applicabilityKeys.length) query = query.where('applicabilityKeys', 'array-contains-any', applicabilityKeys);
  else {
    if (filters.status) query = query.where('status', '==', filters.status);
    if (filters.category) query = query.where('category', '==', filters.category);
  }
  query = query.orderBy('updatedAt', 'desc').orderBy('code', 'asc');
  const cursor = decodeCursor(filters.cursor);
  if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.updatedAt), cursor.code);
  const snapshot = await query.limit(limit + 1).get();
  const rawDocuments = snapshot.docs.slice(0, limit);
  const items = rawDocuments
    .map((document) => serializeDocument(document.id, document.data() as FirestoreRecord))
    .filter((item) => !specialQuery || ((!filters.status || item.status === filters.status) && (!filters.category || item.category === filters.category)));
  const last = rawDocuments.at(-1);
  const lastUpdatedAt = last?.get('updatedAt');
  const nextCursor = snapshot.docs.length > limit && lastUpdatedAt instanceof Timestamp
    ? encodeCursor({ updatedAt: lastUpdatedAt.toMillis(), code: last?.id ?? '' })
    : null;
  return { items, nextCursor };
}

export async function getPrerequisite(code: string) {
  const ref = requireDatabase().collection(COLLECTION).doc(cleanText(code, 100).toLowerCase());
  const snapshot = await ref.get();
  return snapshot.exists ? serializeDocument(snapshot.id, snapshot.data() as FirestoreRecord) : null;
}

export async function getPrerequisiteDetail(code: string) {
  const definition = await getPrerequisite(code);
  if (!definition) return null;
  const historySnapshot = await requireDatabase()
    .collection(COLLECTION)
    .doc(definition.code)
    .collection('versions')
    .orderBy('version', 'desc')
    .limit(20)
    .get();
  return {
    definition,
    history: historySnapshot.docs.map((document) => serializeDocument(definition.code, document.data() as FirestoreRecord)),
  };
}

export async function listApplicablePrerequisites(
  jobRoleId: string,
  options: { companyUid?: string; offerId?: string; query?: string; limit?: number } = {},
) {
  const firestore = requireDatabase();
  const limit = Math.min(20, Math.max(1, options.limit ?? 20));
  const fetchLimit = Math.min(100, Math.max(limit * 4, 40));

  let selectedIds = new Set<string>();
  if (options.offerId) {
    const offerSnapshot = await firestore.collection(OFFERS_COLLECTION).doc(cleanText(options.offerId, 100, true)).get();
    if (!offerSnapshot.exists || offerSnapshot.data()?.companyUid !== options.companyUid) {
      throw new SevenoPrerequisiteError('offer_forbidden', 403, 'Cette offre ne vous appartient pas.');
    }
    selectedIds = getSelectionIds(offerSnapshot.data() as FirestoreRecord);
  }

  let query: Query = firestore.collection(COLLECTION).where('status', '==', 'active');
  const normalizedQuery = normalizeSearchText(options.query ?? '');
  if (normalizedQuery) {
    query = query.where('searchKeys', 'array-contains', normalizedQuery);
  } else {
    query = query.where('applicabilityKeys', 'array-contains-any', buildJobApplicabilityKeys(cleanText(jobRoleId, 200)));
  }
  query = query.orderBy('updatedAt', 'desc').orderBy('code', 'asc');

  const snapshot = await query.limit(fetchLimit).get();
  const items = snapshot.docs.map((document) => serializeDocument(document.id, document.data() as FirestoreRecord));
  return buildCompanyPrerequisitePickerResults(items, {
    jobRoleId,
    companyUid: options.companyUid,
    offerId: options.offerId,
    query: options.query,
    selectedIds,
    limit,
  });
}

function validateExpectedCriterion(definition: SerializedPrerequisiteDefinition, value: unknown) {
  const criterion = normalizeCriterionValue(value, definition.answerType);
  assertCriterionUsesOptions(criterion, definition.answerType, definition.options);
  if (
    definition.criterionMode === 'fixed'
    && criterionKey(criterion) !== criterionKey(definition.defaultCriterion as PrerequisiteCriterionValue)
  ) {
    throw new SevenoPrerequisiteError('invalid_expected_criterion', 400, 'Le critere fixe ne peut pas etre modifie.');
  }
  if (
    definition.criterionMode === 'configurable'
    && !definition.allowedCriterionValues.some((allowed) => criterionKey(allowed) === criterionKey(criterion))
  ) {
    throw new SevenoPrerequisiteError('invalid_expected_criterion', 400, 'Le critere ne fait pas partie des valeurs autorisees.');
  }
  return criterion;
}

export function createOfferPrerequisiteSnapshot(
  definition: SerializedPrerequisiteDefinition,
  selection: OfferPrerequisiteSelectionInput,
): OfferPrerequisiteSnapshot {
  if (selection.importance !== 'required' && selection.importance !== 'preferred') {
    throw new SevenoPrerequisiteError('invalid_importance', 400, 'L importance est invalide.');
  }
  return {
    prerequisiteId: definition.id,
    prerequisiteCode: definition.code,
    prerequisiteVersion: definition.version,
    source: definition.source ?? 'seveno',
    ...(definition.ownerCompanyId ? { ownerCompanyId: definition.ownerCompanyId } : {}),
    ...(definition.originOfferId ? { originOfferId: definition.originOfferId } : {}),
    category: definition.category,
    companyLabel: definition.companyLabel,
    candidateQuestion: definition.candidateQuestion,
    ...(definition.candidateHelp ? { candidateHelp: definition.candidateHelp } : {}),
    answerType: definition.answerType,
    options: definition.options.map((option) => ({ ...option })),
    comparisonOperator: definition.comparisonOperator,
    expectedCriterion: validateExpectedCriterion(definition, selection.expectedCriterion),
    responseScope: definition.responseScope,
    evidencePolicy: definition.evidencePolicy,
    ...(definition.freshnessDays !== undefined ? { freshnessDays: definition.freshnessDays } : {}),
    importance: selection.importance,
  };
}

export function assertUniqueOfferPrerequisiteSelections(selections: OfferPrerequisiteSelectionInput[]) {
  const ids = selections.map((selection) => selection.prerequisiteId);
  if (new Set(ids).size !== ids.length) {
    throw new SevenoPrerequisiteError(
      'duplicate_offer_prerequisite',
      400,
      'Un prerequis ne peut pas etre obligatoire et optionnel dans la meme offre.',
    );
  }
}

function countOfferPrerequisites(snapshots: Array<{ importance: OfferPrerequisiteSnapshot['importance'] }>) {
  const required = snapshots.filter((item) => item.importance === 'required').length;
  const preferred = snapshots.length - required;
  return {
    required,
    preferred,
    total: snapshots.length,
  };
}

function arePrerequisiteSelectionsUnchanged(
  selections: OfferPrerequisiteSelectionInput[],
  existingSnapshots: OfferPrerequisiteSnapshot[],
) {
  if (selections.length !== existingSnapshots.length) return false;
  const existingById = new Map(existingSnapshots.map((snapshot) => [snapshot.prerequisiteId, snapshot]));
  return selections.every((selection) => {
    const existing = existingById.get(selection.prerequisiteId);
    if (!existing) return false;
    return existing.importance === selection.importance
      && JSON.stringify(existing.expectedCriterion) === JSON.stringify(selection.expectedCriterion);
  });
}

export async function buildOfferPrerequisiteSnapshots(
  companyUid: string,
  jobRoleId: string,
  selections: OfferPrerequisiteSelectionInput[],
  existingSnapshots: OfferPrerequisiteSnapshot[] = [],
  options: { offerId?: string } = {},
) {
  if (selections.length > 100) {
    throw new SevenoPrerequisiteError('too_many_prerequisites', 400, 'Une offre est limitee a 100 prerequis.');
  }
  assertUniqueOfferPrerequisiteSelections(selections);
  if (selections.length === 0) return [];

  if (arePrerequisiteSelectionsUnchanged(selections, existingSnapshots)) {
    return existingSnapshots;
  }

  const counts = countOfferPrerequisites(selections);
  if (
    counts.required > SEVENO_OFFER_PREREQUISITE_LIMITS.required
    || counts.preferred > SEVENO_OFFER_PREREQUISITE_LIMITS.preferred
    || counts.total > SEVENO_OFFER_PREREQUISITE_LIMITS.total
  ) {
    throw new SevenoPrerequisiteError(
      'too_many_prerequisites',
      400,
      `Une offre est limitee a ${SEVENO_OFFER_PREREQUISITE_LIMITS.required} prerequis obligatoires, ${SEVENO_OFFER_PREREQUISITE_LIMITS.preferred} en valeur ajoutee et ${SEVENO_OFFER_PREREQUISITE_LIMITS.total} au total.`,
    );
  }

  const existingById = new Map(existingSnapshots.map((snapshot) => [snapshot.prerequisiteId, snapshot]));
  const definitionsToLoad = selections.filter((selection) => {
    const existing = existingById.get(selection.prerequisiteId);
    return !existing
      || existing.importance !== selection.importance
      || criterionKey(existing.expectedCriterion) !== criterionKey(selection.expectedCriterion);
  });
  const firestore = requireDatabase();
  const references = definitionsToLoad.map((selection) => firestore.collection(COLLECTION).doc(selection.prerequisiteId));
  const documents = references.length ? await firestore.getAll(...references) : [];
  const definitions = new Map(
    documents
      .filter((document) => document.exists)
      .map((document) => [document.id, serializeDocument(document.id, document.data() as FirestoreRecord)]),
  );

  return selections.map((selection) => {
    const existing = existingById.get(selection.prerequisiteId);
    if (
      existing
      && existing.importance === selection.importance
      && criterionKey(existing.expectedCriterion) === criterionKey(selection.expectedCriterion)
    ) {
      return existing;
    }

    const definition = definitions.get(selection.prerequisiteId);
    if (!definition || definition.status !== 'active') {
      throw new SevenoPrerequisiteError(
        'inactive_prerequisite',
        400,
        'Un prerequis selectionne est introuvable ou n est plus actif.',
      );
    }
    if (definition.source === 'company') {
      if (definition.ownerCompanyId !== companyUid) {
        throw new SevenoPrerequisiteError(
          'forbidden_prerequisite',
          403,
          'Un prerequis selectionne ne vous appartient pas.',
        );
      }
      if (definition.originOfferId && definition.originOfferId !== (options.offerId ?? '')) {
        throw new SevenoPrerequisiteError(
          'forbidden_prerequisite',
          403,
          'Un prerequis personnalise ne peut etre reutilise que sur son offre source.',
        );
      }
    }
    return createOfferPrerequisiteSnapshot(definition, selection);
  });
}

export async function importPrerequisites(actorUid: string, raw: unknown): Promise<PrerequisiteImportReport> {
  if (!isPlainObject(raw) || typeof raw.dryRun !== 'boolean' || typeof raw.updateExisting !== 'boolean' || !Array.isArray(raw.items)) {
    throw new SevenoPrerequisiteError('invalid_import', 400, 'Le format d import est invalide.');
  }
  if (raw.items.length > 5000) throw new SevenoPrerequisiteError('import_too_large', 400, 'Un import est limite a 5000 entrees.');
  const errors: PrerequisiteImportError[] = [];
  const normalized: Array<{ index: number; input: PrerequisiteDefinitionInput }> = [];
  const seenCodes = new Set<string>();
  raw.items.forEach((item, index) => {
    try {
      const input = validatePrerequisiteInput(item);
      if (
        input.source !== 'seveno'
        || input.ownerCompanyId
        || input.originOfferId
        || input.libraryScope
      ) {
        throw new SevenoPrerequisiteError('invalid_import_scope', 400, 'L import administratif ne peut contenir que la bibliotheque SevenO.');
      }
      if (seenCodes.has(input.code)) throw new SevenoPrerequisiteError('duplicate_import_code', 400, 'Code duplique dans le fichier.');
      seenCodes.add(input.code);
      normalized.push({ index, input });
    } catch (error) {
      errors.push({
        index,
        ...(isPlainObject(item) && typeof item.code === 'string' ? { code: item.code } : {}),
        message: error instanceof Error ? error.message : 'Entree invalide.',
      });
    }
  });

  const firestore = requireDatabase();
  const references = normalized.map(({ input }) => firestore.collection(COLLECTION).doc(input.code));
  const snapshots = references.length ? await firestore.getAll(...references) : [];
  const existingByCode = new Map(snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data() as FirestoreRecord]));
  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];
  const operations: Array<{ input: PrerequisiteDefinitionInput; existing?: FirestoreRecord }> = [];

  for (const { index, input } of normalized) {
    const existing = existingByCode.get(input.code);
    if (!existing) {
      created.push(input.code);
      operations.push({ input });
      continue;
    }
    if (functionalSignature(toInput(existing)) === functionalSignature(input)) {
      unchanged.push(input.code);
      continue;
    }
    if (!raw.updateExisting) {
      errors.push({ index, code: input.code, message: 'L entree existe deja. Activez updateExisting pour la modifier.' });
      continue;
    }
    updated.push(input.code);
    operations.push({ input, existing });
  }

  const report: PrerequisiteImportReport = {
    dryRun: raw.dryRun,
    total: raw.items.length,
    created,
    updated,
    unchanged,
    errors,
  };
  if (errors.length > 0) return report;

  const payloadHash = createHash('sha256')
    .update(JSON.stringify({ updateExisting: raw.updateExisting, items: normalized.map(({ input }) => input) }))
    .digest('hex');

  if (raw.dryRun) {
    const dryRunToken = randomUUID();
    await firestore.collection(IMPORT_DRY_RUN_COLLECTION).doc(dryRunToken).set({
      actorUid,
      payloadHash,
      status: 'ready',
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + IMPORT_DRY_RUN_TTL_MS),
    });
    report.dryRunToken = dryRunToken;
    return report;
  }

  const dryRunToken = cleanText(raw.dryRunToken, 100);
  const dryRunRef = firestore.collection(IMPORT_DRY_RUN_COLLECTION).doc(dryRunToken);
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(dryRunRef);
    const data = snapshot.data();
    const expiresAt = data?.expiresAt;
    if (
      !snapshot.exists
      || data?.actorUid !== actorUid
      || data?.payloadHash !== payloadHash
      || !['ready', 'failed'].includes(String(data?.status))
      || !(expiresAt instanceof Timestamp)
      || expiresAt.toMillis() <= Date.now()
    ) {
      throw new SevenoPrerequisiteError(
        'dry_run_required',
        400,
        'Executez un nouveau dry-run valide avant d appliquer cet import.',
      );
    }
    transaction.update(dryRunRef, { status: 'processing', processingAt: Timestamp.now() });
  });

  try {
    for (let offset = 0; offset < operations.length; offset += IMPORT_BATCH_SIZE) {
      const batch = firestore.batch();
      for (const operation of operations.slice(offset, offset + IMPORT_BATCH_SIZE)) {
        const version = operation.existing && typeof operation.existing.version === 'number' ? operation.existing.version + 1 : 1;
        const stored = buildStoredDefinition(operation.input, actorUid, version, operation.existing);
        const ref = firestore.collection(COLLECTION).doc(operation.input.code);
        batch.set(ref, stored);
        batch.set(versionSnapshotPath(operation.input.code, version), { ...stored, recordedAt: stored.updatedAt, recordedBy: actorUid });
      }
      await batch.commit();
    }
    await dryRunRef.update({ status: 'completed', completedAt: Timestamp.now() });
  } catch (error) {
    await dryRunRef.update({ status: 'failed', failedAt: Timestamp.now() });
    throw error;
  }
  return report;
}

export async function exportPrerequisites() {
  const snapshot = await requireDatabase().collection(COLLECTION).orderBy('code', 'asc').get();
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    items: snapshot.docs.map((document) => toInput(document.data() as FirestoreRecord)),
  };
}
