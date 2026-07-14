import 'server-only';

import { createHash } from 'node:crypto';
import { Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { normalizeSearchText } from '@/lib/seveno-prerequisites-server';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';
import type { OfferPrerequisiteSnapshot, PrerequisiteImportance } from '@/types/seveno-prerequisites';
import type {
  PrerequisiteSuggestion,
  PrerequisiteSuggestionCompany,
  PrerequisiteSuggestionStatus,
  PrerequisiteSuggestionUsage,
} from '@/types/seveno-prerequisite-suggestions';

const COLLECTION = 'prerequisite_suggestions';
const DEFINITIONS_COLLECTION = 'prerequisite_definitions';
const SCHEMA_VERSION = 1;
const SEARCH_PREFIX_LENGTH = 30;

type FirestoreRecord = Record<string, unknown>;

export type PrerequisiteSuggestionUsageDescriptor = {
  suggestionId: string;
  usageId: string;
  companyUid: string;
  offerId: string;
  prerequisiteId: string;
  prerequisiteCode: string;
  prerequisiteVersion: number;
  label: string;
  normalizedLabel: string;
  groupingKey: string;
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  importance: PrerequisiteImportance;
  canonicalPrerequisiteCode?: string | null;
};

export type PrerequisiteSuggestionOfferContext = Pick<SerializedJobOffer, 'companyUid' | 'id' | 'sectorId' | 'jobFamilyId' | 'jobRoleId'>;

export type PrerequisiteSuggestionTransitionKind =
  | 'activated'
  | 'deactivated'
  | 'unchanged'
  | 'importance_changed'
  | 'moved';

export interface PrerequisiteSuggestionTransition {
  kind: PrerequisiteSuggestionTransitionKind;
  previous: PrerequisiteSuggestionUsageDescriptor | null;
  current: PrerequisiteSuggestionUsageDescriptor | null;
}

type MutableSuggestionState = {
  ref: DocumentReference;
  data: PrerequisiteSuggestion;
  dirty: boolean;
};

type MutableSuggestionCompanyState = {
  ref: DocumentReference;
  data: PrerequisiteSuggestionCompany;
  dirty: boolean;
};

type MutableSuggestionUsageState = {
  ref: DocumentReference;
  data: PrerequisiteSuggestionUsage;
  dirty: boolean;
};

export type SuggestionStateHandle = MutableSuggestionState | null;
export type CompanyStateHandle = MutableSuggestionCompanyState | null;
export type UsageStateHandle = MutableSuggestionUsageState | null;

function requireDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new Error('Firebase Admin n est pas configure pour la file de suggestions.');
  }
  return adminDb;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0))];
}

function timestampOrNow(value: unknown, now: Timestamp) {
  return value instanceof Timestamp ? value : now;
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function buildSearchKeysFromText(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];
  const keys = new Set<string>();
  const tokens = [normalized, ...normalized.split(' ')];
  for (const token of tokens) {
    if (!token) continue;
    for (let size = 2; size <= Math.min(token.length, SEARCH_PREFIX_LENGTH); size += 1) {
      keys.add(token.slice(0, size));
    }
  }
  return [...keys];
}

function buildSuggestionSearchKeys(label: string, canonicalPrerequisiteCode: string | null) {
  const keys = new Set<string>();
  for (const source of [label, canonicalPrerequisiteCode ?? '']) {
    for (const key of buildSearchKeysFromText(source)) {
      keys.add(key);
    }
  }
  return [...keys].slice(0, 200);
}

function getSuggestionStatusRank(status: PrerequisiteSuggestionStatus) {
  if (status === 'pending') return 0;
  if (status === 'merged') return 1;
  if (status === 'approved') return 2;
  return 3;
}

export function buildPrerequisiteSuggestionGroupingKey(label: string) {
  return normalizeSearchText(label);
}

export function buildPrerequisiteSuggestionId(groupingKey: string) {
  return `suggestion-${createHash('sha256').update(groupingKey).digest('hex').slice(0, 24)}`;
}

export function buildPrerequisiteSuggestionUsageId(companyUid: string, offerId: string, prerequisiteId: string) {
  return `usage-${createHash('sha256').update([companyUid, offerId, prerequisiteId].join('|')).digest('hex').slice(0, 24)}`;
}

function buildSuggestionCompanyId(companyUid: string) {
  return companyUid;
}

function buildSuggestionMainRef(suggestionId: string) {
  return requireDatabase().collection(COLLECTION).doc(suggestionId);
}

function buildSuggestionCompanyRef(suggestionId: string, companyUid: string) {
  return buildSuggestionMainRef(suggestionId).collection('companies').doc(buildSuggestionCompanyId(companyUid));
}

function buildSuggestionUsageRef(suggestionId: string, usageId: string) {
  return buildSuggestionMainRef(suggestionId).collection('usages').doc(usageId);
}

function normalizeSuggestionStatus(value: unknown, canonicalPrerequisiteCode: string | null): PrerequisiteSuggestionStatus {
  if (value === 'approved' || value === 'merged' || value === 'rejected') {
    return value;
  }
  return canonicalPrerequisiteCode ? 'merged' : 'pending';
}

function createDefaultSuggestionState(descriptor: PrerequisiteSuggestionUsageDescriptor, now: Timestamp): PrerequisiteSuggestion {
  return {
    id: descriptor.suggestionId,
    label: descriptor.label,
    normalizedLabel: descriptor.normalizedLabel,
    groupingKey: descriptor.groupingKey,
    status: normalizeSuggestionStatus(null, descriptor.canonicalPrerequisiteCode ?? null),
    statusRank: getSuggestionStatusRank(normalizeSuggestionStatus(null, descriptor.canonicalPrerequisiteCode ?? null)),
    usageCount: 0,
    companyCount: 0,
    requiredCount: 0,
    preferredCount: 0,
    searchKeys: buildSuggestionSearchKeys(descriptor.label, descriptor.canonicalPrerequisiteCode ?? null),
    observedSectorIds: [descriptor.sectorId],
    observedJobFamilyIds: [descriptor.jobFamilyId],
    observedJobRoleIds: [descriptor.jobRoleId],
    ...(descriptor.canonicalPrerequisiteCode ? { canonicalPrerequisiteCode: descriptor.canonicalPrerequisiteCode } : {}),
    schemaVersion: SCHEMA_VERSION,
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function parseSuggestionState(
  suggestionId: string,
  raw: FirestoreRecord | undefined,
  descriptor: PrerequisiteSuggestionUsageDescriptor,
  now: Timestamp,
) {
  if (!raw) return createDefaultSuggestionState(descriptor, now);
  const canonicalPrerequisiteCode = typeof raw.canonicalPrerequisiteCode === 'string' && raw.canonicalPrerequisiteCode
    ? raw.canonicalPrerequisiteCode
    : descriptor.canonicalPrerequisiteCode ?? null;
  const status = normalizeSuggestionStatus(raw.status, canonicalPrerequisiteCode);
  return {
    id: suggestionId,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : descriptor.label,
    normalizedLabel: typeof raw.normalizedLabel === 'string' && raw.normalizedLabel.trim()
      ? raw.normalizedLabel.trim()
      : descriptor.normalizedLabel,
    groupingKey: typeof raw.groupingKey === 'string' && raw.groupingKey.trim()
      ? raw.groupingKey.trim()
      : descriptor.groupingKey,
    status,
    statusRank: typeof raw.statusRank === 'number' && Number.isFinite(raw.statusRank)
      ? raw.statusRank
      : getSuggestionStatusRank(status),
    usageCount: numberOrZero(raw.usageCount),
    companyCount: numberOrZero(raw.companyCount),
    requiredCount: numberOrZero(raw.requiredCount),
    preferredCount: numberOrZero(raw.preferredCount),
    searchKeys: Array.isArray(raw.searchKeys)
      ? [...new Set(raw.searchKeys.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0))]
      : buildSuggestionSearchKeys(descriptor.label, canonicalPrerequisiteCode),
    observedSectorIds: toStringArray(raw.observedSectorIds),
    observedJobFamilyIds: toStringArray(raw.observedJobFamilyIds),
    observedJobRoleIds: toStringArray(raw.observedJobRoleIds),
    ...(canonicalPrerequisiteCode ? { canonicalPrerequisiteCode } : {}),
    ...(typeof raw.mergedIntoSuggestionId === 'string' && raw.mergedIntoSuggestionId ? { mergedIntoSuggestionId: raw.mergedIntoSuggestionId } : {}),
    schemaVersion: typeof raw.schemaVersion === 'number' && raw.schemaVersion > 0 ? raw.schemaVersion : SCHEMA_VERSION,
    firstSeenAt: timestampOrNow(raw.firstSeenAt, now),
    lastSeenAt: timestampOrNow(raw.lastSeenAt, now),
    createdAt: timestampOrNow(raw.createdAt, now),
    updatedAt: timestampOrNow(raw.updatedAt, now),
  } satisfies PrerequisiteSuggestion;
}

function createDefaultCompanyState(companyUid: string, now: Timestamp): PrerequisiteSuggestionCompany {
  return {
    companyUid,
    activeUsageCount: 0,
    requiredCount: 0,
    preferredCount: 0,
    active: false,
    firstSeenAt: now,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    endedAt: null,
  };
}

function parseCompanyState(companyUid: string, raw: FirestoreRecord | undefined, now: Timestamp) {
  if (!raw) return createDefaultCompanyState(companyUid, now);
  return {
    companyUid,
    activeUsageCount: numberOrZero(raw.activeUsageCount),
    requiredCount: numberOrZero(raw.requiredCount),
    preferredCount: numberOrZero(raw.preferredCount),
    active: raw.active === true || numberOrZero(raw.activeUsageCount) > 0,
    firstSeenAt: timestampOrNow(raw.firstSeenAt, now),
    lastSeenAt: timestampOrNow(raw.lastSeenAt, now),
    createdAt: timestampOrNow(raw.createdAt, now),
    updatedAt: timestampOrNow(raw.updatedAt, now),
    endedAt: raw.endedAt instanceof Timestamp || raw.endedAt === null ? raw.endedAt : null,
  } satisfies PrerequisiteSuggestionCompany;
}

function createDefaultUsageState(descriptor: PrerequisiteSuggestionUsageDescriptor, now: Timestamp): PrerequisiteSuggestionUsage {
  return {
    id: descriptor.usageId,
    suggestionId: descriptor.suggestionId,
    companyUid: descriptor.companyUid,
    offerId: descriptor.offerId,
    prerequisiteId: descriptor.prerequisiteId,
    prerequisiteCode: descriptor.prerequisiteCode,
    prerequisiteVersion: descriptor.prerequisiteVersion,
    label: descriptor.label,
    normalizedLabel: descriptor.normalizedLabel,
    groupingKey: descriptor.groupingKey,
    sectorId: descriptor.sectorId,
    jobFamilyId: descriptor.jobFamilyId,
    jobRoleId: descriptor.jobRoleId,
    importance: descriptor.importance,
    active: false,
    createdAt: now,
    updatedAt: now,
    endedAt: now,
  };
}

function parseUsageState(descriptor: PrerequisiteSuggestionUsageDescriptor, raw: FirestoreRecord | undefined, now: Timestamp) {
  if (!raw) return createDefaultUsageState(descriptor, now);
  return {
    id: descriptor.usageId,
    suggestionId: descriptor.suggestionId,
    companyUid: descriptor.companyUid,
    offerId: descriptor.offerId,
    prerequisiteId: descriptor.prerequisiteId,
    prerequisiteCode: descriptor.prerequisiteCode,
    prerequisiteVersion: descriptor.prerequisiteVersion,
    label: descriptor.label,
    normalizedLabel: descriptor.normalizedLabel,
    groupingKey: descriptor.groupingKey,
    sectorId: descriptor.sectorId,
    jobFamilyId: descriptor.jobFamilyId,
    jobRoleId: descriptor.jobRoleId,
    importance: raw.importance === 'preferred' ? 'preferred' : 'required',
    active: raw.active === true,
    createdAt: timestampOrNow(raw.createdAt, now),
    updatedAt: timestampOrNow(raw.updatedAt, now),
    endedAt: raw.endedAt instanceof Timestamp || raw.endedAt === null ? raw.endedAt : null,
  } satisfies PrerequisiteSuggestionUsage;
}

function collectLabels(snapshots: OfferPrerequisiteSnapshot[]) {
  return [...new Set(snapshots
    .filter((snapshot) => snapshot.source === 'company')
    .map((snapshot) => buildPrerequisiteSuggestionGroupingKey(snapshot.companyLabel)))];
}

export async function resolvePrerequisiteSuggestionCanonicalCodes(labels: Iterable<string>) {
  const firestore = requireDatabase();
  const normalizedLabels = [...new Set(Array.from(labels, (label) => buildPrerequisiteSuggestionGroupingKey(label)).filter((label) => label.length > 0))];
  const entries = await Promise.all(normalizedLabels.map(async (groupingKey) => {
    const lookupKey = groupingKey.slice(0, SEARCH_PREFIX_LENGTH);
    if (!lookupKey) return [groupingKey, null] as const;
    const snapshot = await firestore.collection(DEFINITIONS_COLLECTION)
      .where('status', '==', 'active')
      .where('searchKeys', 'array-contains', lookupKey)
      .orderBy('updatedAt', 'desc')
      .orderBy('code', 'asc')
      .limit(20)
      .get();
    const canonical = snapshot.docs
      .map((document) => document.data() as FirestoreRecord)
      .find((data) => data.source === 'seveno'
        && typeof data.companyLabel === 'string'
        && buildPrerequisiteSuggestionGroupingKey(data.companyLabel) === groupingKey);
    return [groupingKey, canonical && typeof canonical.code === 'string' ? canonical.code : null] as const;
  }));
  return new Map(entries);
}

export function buildPrerequisiteSuggestionUsageDescriptors(
  offer: Pick<SerializedJobOffer, 'companyUid' | 'id' | 'sectorId' | 'jobFamilyId' | 'jobRoleId'>,
  snapshots: OfferPrerequisiteSnapshot[],
  canonicalCodesByLabel: Map<string, string | null> = new Map(),
) {
  return snapshots
    .filter((snapshot) => snapshot.source === 'company')
    .map<PrerequisiteSuggestionUsageDescriptor>((snapshot) => {
      const groupingKey = buildPrerequisiteSuggestionGroupingKey(snapshot.companyLabel);
      return {
        suggestionId: buildPrerequisiteSuggestionId(groupingKey),
        usageId: buildPrerequisiteSuggestionUsageId(offer.companyUid, offer.id, snapshot.prerequisiteId),
        companyUid: offer.companyUid,
        offerId: offer.id,
        prerequisiteId: snapshot.prerequisiteId,
        prerequisiteCode: snapshot.prerequisiteCode,
        prerequisiteVersion: snapshot.prerequisiteVersion,
        label: snapshot.companyLabel,
        normalizedLabel: groupingKey,
        groupingKey,
        sectorId: offer.sectorId,
        jobFamilyId: offer.jobFamilyId,
        jobRoleId: offer.jobRoleId,
        importance: snapshot.importance,
        canonicalPrerequisiteCode: canonicalCodesByLabel.get(groupingKey) ?? null,
      };
    });
}

export function summarizePrerequisiteSuggestionUsageDiff(
  previousDescriptors: PrerequisiteSuggestionUsageDescriptor[],
  currentDescriptors: PrerequisiteSuggestionUsageDescriptor[],
) {
  const previousById = new Map(previousDescriptors.map((descriptor) => [descriptor.prerequisiteId, descriptor]));
  const currentById = new Map(currentDescriptors.map((descriptor) => [descriptor.prerequisiteId, descriptor]));
  const prerequisiteIds = new Set([...previousById.keys(), ...currentById.keys()]);
  return [...prerequisiteIds].map<PrerequisiteSuggestionTransition>((prerequisiteId) => {
    const previous = previousById.get(prerequisiteId) ?? null;
    const current = currentById.get(prerequisiteId) ?? null;
    if (!previous && current) return { kind: 'activated', previous: null, current };
    if (previous && !current) return { kind: 'deactivated', previous, current: null };
    if (!previous || !current) return { kind: 'deactivated', previous, current };
    if (previous.suggestionId !== current.suggestionId) return { kind: 'moved', previous, current };
    if (previous.importance !== current.importance) return { kind: 'importance_changed', previous, current };
    return { kind: 'unchanged', previous, current };
  });
}

function ensureSuggestionMetadata(state: PrerequisiteSuggestion, descriptor: PrerequisiteSuggestionUsageDescriptor, now: Timestamp) {
  if (!state.label) state.label = descriptor.label;
  if (!state.normalizedLabel) state.normalizedLabel = descriptor.normalizedLabel;
  if (!state.groupingKey) state.groupingKey = descriptor.groupingKey;
  if (descriptor.canonicalPrerequisiteCode && !state.canonicalPrerequisiteCode) {
    state.canonicalPrerequisiteCode = descriptor.canonicalPrerequisiteCode;
  }
  if (state.status === 'pending' && descriptor.canonicalPrerequisiteCode) {
    state.status = 'merged';
  }
  state.statusRank = getSuggestionStatusRank(state.status);
  state.searchKeys = buildSuggestionSearchKeys(state.label || descriptor.label, state.canonicalPrerequisiteCode ?? descriptor.canonicalPrerequisiteCode ?? null);
  state.observedSectorIds = [...new Set([...state.observedSectorIds, descriptor.sectorId])];
  state.observedJobFamilyIds = [...new Set([...state.observedJobFamilyIds, descriptor.jobFamilyId])];
  state.observedJobRoleIds = [...new Set([...state.observedJobRoleIds, descriptor.jobRoleId])];
  state.lastSeenAt = now;
  state.updatedAt = now;
}

function addActiveUsage(state: PrerequisiteSuggestion, company: PrerequisiteSuggestionCompany, descriptor: PrerequisiteSuggestionUsageDescriptor, now: Timestamp) {
  state.usageCount += 1;
  state.requiredCount += descriptor.importance === 'required' ? 1 : 0;
  state.preferredCount += descriptor.importance === 'preferred' ? 1 : 0;
  if (company.activeUsageCount === 0) {
    state.companyCount += 1;
  }
  company.activeUsageCount += 1;
  company.requiredCount += descriptor.importance === 'required' ? 1 : 0;
  company.preferredCount += descriptor.importance === 'preferred' ? 1 : 0;
  company.active = true;
  company.endedAt = null;
  company.lastSeenAt = now;
  company.updatedAt = now;
}

function removeActiveUsage(state: PrerequisiteSuggestion, company: PrerequisiteSuggestionCompany, descriptor: PrerequisiteSuggestionUsageDescriptor, now: Timestamp) {
  state.usageCount = Math.max(0, state.usageCount - 1);
  if (descriptor.importance === 'required') {
    state.requiredCount = Math.max(0, state.requiredCount - 1);
    company.requiredCount = Math.max(0, company.requiredCount - 1);
  } else {
    state.preferredCount = Math.max(0, state.preferredCount - 1);
    company.preferredCount = Math.max(0, company.preferredCount - 1);
  }
  company.activeUsageCount = Math.max(0, company.activeUsageCount - 1);
  if (company.activeUsageCount === 0) {
    state.companyCount = Math.max(0, state.companyCount - 1);
  }
  company.active = company.activeUsageCount > 0;
  company.endedAt = company.active ? null : now;
  company.lastSeenAt = now;
  company.updatedAt = now;
}

function shiftUsageImportance(state: PrerequisiteSuggestion, company: PrerequisiteSuggestionCompany, previous: PrerequisiteSuggestionUsageDescriptor, current: PrerequisiteSuggestionUsageDescriptor, now: Timestamp) {
  if (previous.importance === current.importance) return;
  if (previous.importance === 'required') {
    state.requiredCount = Math.max(0, state.requiredCount - 1);
    state.preferredCount += 1;
    company.requiredCount = Math.max(0, company.requiredCount - 1);
    company.preferredCount += 1;
  } else {
    state.preferredCount = Math.max(0, state.preferredCount - 1);
    state.requiredCount += 1;
    company.preferredCount = Math.max(0, company.preferredCount - 1);
    company.requiredCount += 1;
  }
  state.lastSeenAt = now;
  state.updatedAt = now;
  company.lastSeenAt = now;
  company.updatedAt = now;
}

function refreshUsage(state: PrerequisiteSuggestion, company: PrerequisiteSuggestionCompany, usage: PrerequisiteSuggestionUsage, descriptor: PrerequisiteSuggestionUsageDescriptor, now: Timestamp) {
  ensureSuggestionMetadata(state, descriptor, now);
  applyUsageDescriptor(usage, descriptor, true, now);
  state.updatedAt = now;
  company.updatedAt = now;
}

function applyUsageDescriptor(
  usage: PrerequisiteSuggestionUsage,
  descriptor: PrerequisiteSuggestionUsageDescriptor,
  active: boolean,
  now: Timestamp,
) {
  usage.suggestionId = descriptor.suggestionId;
  usage.companyUid = descriptor.companyUid;
  usage.offerId = descriptor.offerId;
  usage.prerequisiteId = descriptor.prerequisiteId;
  usage.prerequisiteCode = descriptor.prerequisiteCode;
  usage.prerequisiteVersion = descriptor.prerequisiteVersion;
  usage.label = descriptor.label;
  usage.normalizedLabel = descriptor.normalizedLabel;
  usage.groupingKey = descriptor.groupingKey;
  usage.sectorId = descriptor.sectorId;
  usage.jobFamilyId = descriptor.jobFamilyId;
  usage.jobRoleId = descriptor.jobRoleId;
  usage.importance = descriptor.importance;
  usage.active = active;
  usage.endedAt = active ? null : now;
  usage.updatedAt = now;
}

function deactivateUsage(state: PrerequisiteSuggestion, company: PrerequisiteSuggestionCompany, usage: PrerequisiteSuggestionUsage, descriptor: PrerequisiteSuggestionUsageDescriptor, now: Timestamp) {
  if (!usage.active) return;
  removeActiveUsage(state, company, descriptor, now);
  applyUsageDescriptor(usage, descriptor, false, now);
  state.lastSeenAt = now;
  state.updatedAt = now;
}

async function getSuggestionState(
  transaction: Transaction,
  descriptor: PrerequisiteSuggestionUsageDescriptor,
  now: Timestamp,
  cache: Map<string, MutableSuggestionState>,
) {
  const existing = cache.get(descriptor.suggestionId);
  if (existing) return existing;
  const ref = buildSuggestionMainRef(descriptor.suggestionId);
  const snapshot = await transaction.get(ref);
  const data = parseSuggestionState(descriptor.suggestionId, snapshot.exists ? snapshot.data() as FirestoreRecord : undefined, descriptor, now);
  const state: MutableSuggestionState = { ref, data, dirty: false };
  cache.set(descriptor.suggestionId, state);
  return state;
}

async function getCompanyState(
  transaction: Transaction,
  descriptor: PrerequisiteSuggestionUsageDescriptor,
  now: Timestamp,
  cache: Map<string, MutableSuggestionCompanyState>,
) {
  const cacheKey = `${descriptor.suggestionId}:${descriptor.companyUid}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;
  const ref = buildSuggestionCompanyRef(descriptor.suggestionId, descriptor.companyUid);
  const snapshot = await transaction.get(ref);
  const data = parseCompanyState(descriptor.companyUid, snapshot.exists ? snapshot.data() as FirestoreRecord : undefined, now);
  const state: MutableSuggestionCompanyState = { ref, data, dirty: false };
  cache.set(cacheKey, state);
  return state;
}

async function getUsageState(
  transaction: Transaction,
  descriptor: PrerequisiteSuggestionUsageDescriptor,
  now: Timestamp,
  cache: Map<string, MutableSuggestionUsageState>,
) {
  const existing = cache.get(descriptor.usageId);
  if (existing) return existing;
  const ref = buildSuggestionUsageRef(descriptor.suggestionId, descriptor.usageId);
  const snapshot = await transaction.get(ref);
  const data = parseUsageState(descriptor, snapshot.exists ? snapshot.data() as FirestoreRecord : undefined, now);
  const state: MutableSuggestionUsageState = { ref, data, dirty: false };
  cache.set(descriptor.usageId, state);
  return state;
}

export function applyTransition(
  transaction: Transaction,
  transition: PrerequisiteSuggestionTransition,
  now: Timestamp,
  suggestionCache: Map<string, MutableSuggestionState>,
  companyCache: Map<string, MutableSuggestionCompanyState>,
  usageCache: Map<string, MutableSuggestionUsageState>,
) {
  const getStateForCurrent = async (descriptor: PrerequisiteSuggestionUsageDescriptor) => {
    const suggestion = await getSuggestionState(transaction, descriptor, now, suggestionCache);
    const company = await getCompanyState(transaction, descriptor, now, companyCache);
    const usage = await getUsageState(transaction, descriptor, now, usageCache);
    return { suggestion, company, usage };
  };

  return (async () => {
    if (transition.kind === 'activated') {
      if (!transition.current) return;
      const { suggestion, company, usage } = await getStateForCurrent(transition.current);
      ensureSuggestionMetadata(suggestion.data, transition.current, now);
      if (usage.data.active) {
        refreshUsage(suggestion.data, company.data, usage.data, transition.current, now);
      } else {
        addActiveUsage(suggestion.data, company.data, transition.current, now);
        usage.data.active = true;
        usage.data.endedAt = null;
        usage.data.importance = transition.current.importance;
        usage.data.suggestionId = transition.current.suggestionId;
        usage.data.companyUid = transition.current.companyUid;
        usage.data.offerId = transition.current.offerId;
        usage.data.prerequisiteId = transition.current.prerequisiteId;
        usage.data.prerequisiteCode = transition.current.prerequisiteCode;
        usage.data.prerequisiteVersion = transition.current.prerequisiteVersion;
        usage.data.label = transition.current.label;
        usage.data.normalizedLabel = transition.current.normalizedLabel;
        usage.data.groupingKey = transition.current.groupingKey;
        usage.data.sectorId = transition.current.sectorId;
        usage.data.jobFamilyId = transition.current.jobFamilyId;
        usage.data.jobRoleId = transition.current.jobRoleId;
        usage.data.createdAt = usage.data.createdAt ?? now;
        usage.data.updatedAt = now;
      }
      suggestion.dirty = true;
      company.dirty = true;
      usage.dirty = true;
      return;
    }

    if (transition.kind === 'deactivated') {
      if (!transition.previous) return;
      const { suggestion, company, usage } = await getStateForCurrent(transition.previous);
      ensureSuggestionMetadata(suggestion.data, transition.previous, now);
      if (usage.data.active) {
        deactivateUsage(suggestion.data, company.data, usage.data, transition.previous, now);
        suggestion.dirty = true;
        company.dirty = true;
        usage.dirty = true;
      }
      return;
    }

    if (transition.kind === 'moved') {
      if (transition.previous) {
        const previous = await getStateForCurrent(transition.previous);
        ensureSuggestionMetadata(previous.suggestion.data, transition.previous, now);
        if (previous.usage.data.active) {
          deactivateUsage(previous.suggestion.data, previous.company.data, previous.usage.data, transition.previous, now);
          previous.suggestion.dirty = true;
          previous.company.dirty = true;
          previous.usage.dirty = true;
        }
      }
      if (transition.current) {
        const current = await getStateForCurrent(transition.current);
        ensureSuggestionMetadata(current.suggestion.data, transition.current, now);
        if (current.usage.data.active) {
          refreshUsage(current.suggestion.data, current.company.data, current.usage.data, transition.current, now);
        } else {
          addActiveUsage(current.suggestion.data, current.company.data, transition.current, now);
          current.usage.data.active = true;
          current.usage.data.endedAt = null;
          current.usage.data.importance = transition.current.importance;
          current.usage.data.suggestionId = transition.current.suggestionId;
          current.usage.data.companyUid = transition.current.companyUid;
          current.usage.data.offerId = transition.current.offerId;
          current.usage.data.prerequisiteId = transition.current.prerequisiteId;
          current.usage.data.prerequisiteCode = transition.current.prerequisiteCode;
          current.usage.data.prerequisiteVersion = transition.current.prerequisiteVersion;
          current.usage.data.label = transition.current.label;
          current.usage.data.normalizedLabel = transition.current.normalizedLabel;
          current.usage.data.groupingKey = transition.current.groupingKey;
          current.usage.data.sectorId = transition.current.sectorId;
          current.usage.data.jobFamilyId = transition.current.jobFamilyId;
          current.usage.data.jobRoleId = transition.current.jobRoleId;
          current.usage.data.createdAt = current.usage.data.createdAt ?? now;
          current.usage.data.updatedAt = now;
        }
        current.suggestion.dirty = true;
        current.company.dirty = true;
        current.usage.dirty = true;
      }
      return;
    }

    if (transition.kind === 'importance_changed') {
      if (!transition.current) return;
      const state = await getStateForCurrent(transition.current);
      ensureSuggestionMetadata(state.suggestion.data, transition.current, now);
      if (!state.usage.data.active) {
        addActiveUsage(state.suggestion.data, state.company.data, transition.current, now);
        state.usage.data.active = true;
        state.usage.data.endedAt = null;
      } else {
        shiftUsageImportance(state.suggestion.data, state.company.data, transition.previous ?? transition.current, transition.current, now);
      }
      state.usage.data.importance = transition.current.importance;
      state.usage.data.suggestionId = transition.current.suggestionId;
      state.usage.data.companyUid = transition.current.companyUid;
      state.usage.data.offerId = transition.current.offerId;
      state.usage.data.prerequisiteId = transition.current.prerequisiteId;
      state.usage.data.prerequisiteCode = transition.current.prerequisiteCode;
      state.usage.data.prerequisiteVersion = transition.current.prerequisiteVersion;
      state.usage.data.label = transition.current.label;
      state.usage.data.normalizedLabel = transition.current.normalizedLabel;
      state.usage.data.groupingKey = transition.current.groupingKey;
      state.usage.data.sectorId = transition.current.sectorId;
      state.usage.data.jobFamilyId = transition.current.jobFamilyId;
      state.usage.data.jobRoleId = transition.current.jobRoleId;
      state.usage.data.updatedAt = now;
      state.usage.data.endedAt = null;
      state.suggestion.dirty = true;
      state.company.dirty = true;
      state.usage.dirty = true;
      return;
    }

    if (transition.kind === 'unchanged') {
      if (!transition.current) return;
      const state = await getStateForCurrent(transition.current);
      ensureSuggestionMetadata(state.suggestion.data, transition.current, now);
      if (state.usage.data.active) {
        refreshUsage(state.suggestion.data, state.company.data, state.usage.data, transition.current, now);
      } else {
        addActiveUsage(state.suggestion.data, state.company.data, transition.current, now);
        state.usage.data.active = true;
        state.usage.data.endedAt = null;
        state.usage.data.importance = transition.current.importance;
        state.usage.data.suggestionId = transition.current.suggestionId;
        state.usage.data.companyUid = transition.current.companyUid;
        state.usage.data.offerId = transition.current.offerId;
        state.usage.data.prerequisiteId = transition.current.prerequisiteId;
        state.usage.data.prerequisiteCode = transition.current.prerequisiteCode;
        state.usage.data.prerequisiteVersion = transition.current.prerequisiteVersion;
        state.usage.data.label = transition.current.label;
        state.usage.data.normalizedLabel = transition.current.normalizedLabel;
        state.usage.data.groupingKey = transition.current.groupingKey;
        state.usage.data.sectorId = transition.current.sectorId;
        state.usage.data.jobFamilyId = transition.current.jobFamilyId;
        state.usage.data.jobRoleId = transition.current.jobRoleId;
        state.usage.data.createdAt = state.usage.data.createdAt ?? now;
        state.usage.data.updatedAt = now;
      }
      state.suggestion.dirty = true;
      state.company.dirty = true;
      state.usage.dirty = true;
    }
  })();
}

function writeSuggestionState(transaction: Transaction, state: MutableSuggestionState) {
  transaction.set(state.ref, {
    ...state.data,
    statusRank: state.data.statusRank,
    searchKeys: [...new Set(state.data.searchKeys)],
    observedSectorIds: [...new Set(state.data.observedSectorIds)],
    observedJobFamilyIds: [...new Set(state.data.observedJobFamilyIds)],
    observedJobRoleIds: [...new Set(state.data.observedJobRoleIds)],
  });
}

function writeCompanyState(transaction: Transaction, state: MutableSuggestionCompanyState) {
  transaction.set(state.ref, {
    ...state.data,
    active: state.data.activeUsageCount > 0,
    endedAt: state.data.activeUsageCount > 0 ? null : state.data.endedAt ?? null,
  });
}

function writeUsageState(transaction: Transaction, state: MutableSuggestionUsageState) {
  transaction.set(state.ref, {
    ...state.data,
    active: state.data.active === true,
    endedAt: state.data.active ? null : state.data.endedAt ?? null,
  });
}

export async function syncPrerequisiteSuggestionsForOffer(
  transaction: Transaction,
  previousOffer: PrerequisiteSuggestionOfferContext,
  previousSnapshots: OfferPrerequisiteSnapshot[],
  currentOffer: PrerequisiteSuggestionOfferContext,
  currentSnapshots: OfferPrerequisiteSnapshot[],
) {
  const previousDescriptors = buildPrerequisiteSuggestionUsageDescriptors(previousOffer, previousSnapshots);
  const currentDescriptors = buildPrerequisiteSuggestionUsageDescriptors(currentOffer, currentSnapshots);
  const transitions = summarizePrerequisiteSuggestionUsageDiff(previousDescriptors, currentDescriptors);
  if (transitions.length === 0) return;

  const canonicalCodesByLabel = await resolvePrerequisiteSuggestionCanonicalCodes(collectLabels([...previousSnapshots, ...currentSnapshots]));
  const previousById = new Map(previousDescriptors.map((descriptor) => [descriptor.prerequisiteId, descriptor]));
  const currentById = new Map(currentDescriptors.map((descriptor) => [descriptor.prerequisiteId, descriptor]));
  const suggestionCache = new Map<string, MutableSuggestionState>();
  const companyCache = new Map<string, MutableSuggestionCompanyState>();
  const usageCache = new Map<string, MutableSuggestionUsageState>();
  const now = Timestamp.now();

  const getCurrentDescriptor = (descriptor: PrerequisiteSuggestionUsageDescriptor) => {
    const normalizedLabel = descriptor.normalizedLabel;
    return {
      ...descriptor,
      canonicalPrerequisiteCode: canonicalCodesByLabel.get(normalizedLabel) ?? descriptor.canonicalPrerequisiteCode ?? null,
    };
  };

  const getPreviousDescriptor = (descriptor: PrerequisiteSuggestionUsageDescriptor) => getCurrentDescriptor(descriptor);

  const getStates = async (descriptor: PrerequisiteSuggestionUsageDescriptor) => {
    const suggestionId = descriptor.suggestionId;
    const suggestion = suggestionCache.get(suggestionId) ?? await (async () => {
      const ref = buildSuggestionMainRef(suggestionId);
      const snapshot = await transaction.get(ref);
      const state = parseSuggestionState(suggestionId, snapshot.exists ? snapshot.data() as FirestoreRecord : undefined, descriptor, now);
      const handle: MutableSuggestionState = { ref, data: state, dirty: false };
      suggestionCache.set(suggestionId, handle);
      return handle;
    })();
    const companyKey = `${suggestionId}:${descriptor.companyUid}`;
    const company = companyCache.get(companyKey) ?? await (async () => {
      const ref = buildSuggestionCompanyRef(suggestionId, descriptor.companyUid);
      const snapshot = await transaction.get(ref);
      const state = parseCompanyState(descriptor.companyUid, snapshot.exists ? snapshot.data() as FirestoreRecord : undefined, now);
      const handle: MutableSuggestionCompanyState = { ref, data: state, dirty: false };
      companyCache.set(companyKey, handle);
      return handle;
    })();
    const usage = usageCache.get(descriptor.usageId) ?? await (async () => {
      const ref = buildSuggestionUsageRef(suggestionId, descriptor.usageId);
      const snapshot = await transaction.get(ref);
      const state = parseUsageState(descriptor, snapshot.exists ? snapshot.data() as FirestoreRecord : undefined, now);
      const handle: MutableSuggestionUsageState = { ref, data: state, dirty: false };
      usageCache.set(descriptor.usageId, handle);
      return handle;
    })();
    return { suggestion, company, usage };
  };

  for (const transition of transitions) {
    if (transition.kind === 'activated' && transition.current) {
      const current = getCurrentDescriptor(currentById.get(transition.current.prerequisiteId) ?? transition.current);
      const { suggestion, company, usage } = await getStates(current);
      ensureSuggestionMetadata(suggestion.data, current, now);
      if (!usage.data.active) {
        addActiveUsage(suggestion.data, company.data, current, now);
      } else {
        refreshUsage(suggestion.data, company.data, usage.data, current, now);
      }
      applyUsageDescriptor(usage.data, current, true, now);
      suggestion.dirty = true;
      company.dirty = true;
      usage.dirty = true;
      continue;
    }

    if (transition.kind === 'deactivated' && transition.previous) {
      const previous = getPreviousDescriptor(previousById.get(transition.previous.prerequisiteId) ?? transition.previous);
      const { suggestion, company, usage } = await getStates(previous);
      ensureSuggestionMetadata(suggestion.data, previous, now);
      if (usage.data.active) {
        deactivateUsage(suggestion.data, company.data, usage.data, previous, now);
        suggestion.dirty = true;
        company.dirty = true;
        usage.dirty = true;
      }
      continue;
    }

    if (transition.kind === 'moved' && transition.previous && transition.current) {
      const previous = getPreviousDescriptor(previousById.get(transition.previous.prerequisiteId) ?? transition.previous);
      const current = getCurrentDescriptor(currentById.get(transition.current.prerequisiteId) ?? transition.current);
      const previousStates = await getStates(previous);
      ensureSuggestionMetadata(previousStates.suggestion.data, previous, now);
      if (previousStates.usage.data.active) {
        deactivateUsage(previousStates.suggestion.data, previousStates.company.data, previousStates.usage.data, previous, now);
        previousStates.suggestion.dirty = true;
        previousStates.company.dirty = true;
        previousStates.usage.dirty = true;
      }
      const currentStates = await getStates(current);
      ensureSuggestionMetadata(currentStates.suggestion.data, current, now);
      if (!currentStates.usage.data.active) {
        addActiveUsage(currentStates.suggestion.data, currentStates.company.data, current, now);
      } else {
        refreshUsage(currentStates.suggestion.data, currentStates.company.data, currentStates.usage.data, current, now);
      }
      applyUsageDescriptor(currentStates.usage.data, current, true, now);
      currentStates.suggestion.dirty = true;
      currentStates.company.dirty = true;
      currentStates.usage.dirty = true;
      continue;
    }

    if (transition.kind === 'importance_changed' && transition.current) {
      const current = getCurrentDescriptor(currentById.get(transition.current.prerequisiteId) ?? transition.current);
      const previous = transition.previous ? getPreviousDescriptor(previousById.get(transition.previous.prerequisiteId) ?? transition.previous) : null;
      const { suggestion, company, usage } = await getStates(current);
      ensureSuggestionMetadata(suggestion.data, current, now);
      if (!usage.data.active) {
        addActiveUsage(suggestion.data, company.data, current, now);
      } else if (previous) {
        shiftUsageImportance(suggestion.data, company.data, previous, current, now);
      }
      applyUsageDescriptor(usage.data, current, true, now);
      suggestion.dirty = true;
      company.dirty = true;
      usage.dirty = true;
      continue;
    }

    if (transition.kind === 'unchanged' && transition.current) {
      const current = getCurrentDescriptor(currentById.get(transition.current.prerequisiteId) ?? transition.current);
      const { suggestion, company, usage } = await getStates(current);
      ensureSuggestionMetadata(suggestion.data, current, now);
      if (!usage.data.active) {
        addActiveUsage(suggestion.data, company.data, current, now);
      } else {
        refreshUsage(suggestion.data, company.data, usage.data, current, now);
      }
      applyUsageDescriptor(usage.data, current, true, now);
      suggestion.dirty = true;
      company.dirty = true;
      usage.dirty = true;
    }
  }

  for (const state of suggestionCache.values()) {
    if (!state.dirty) continue;
    writeSuggestionState(transaction, state);
  }
  for (const state of companyCache.values()) {
    if (!state.dirty) continue;
    writeCompanyState(transaction, state);
  }
  for (const state of usageCache.values()) {
    if (!state.dirty) continue;
    writeUsageState(transaction, state);
  }
}
