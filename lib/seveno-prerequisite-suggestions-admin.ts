import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import { normalizeSearchText } from '@/lib/seveno-prerequisites-server';
import { SevenoAdminServiceError } from '@/lib/seveno-admin-service';
import type {
  AdminPrerequisiteSuggestionDetailPayload,
  AdminPrerequisiteSuggestionListPayload,
  AdminPrerequisiteSuggestionSort,
  AdminPrerequisiteSuggestionSummary,
  AdminPrerequisiteSuggestionUsageSummary,
} from '@/types/seveno-admin';
import type {
  PrerequisiteSuggestion,
  PrerequisiteSuggestionStatus,
  PrerequisiteSuggestionUsage,
} from '@/types/seveno-prerequisite-suggestions';

const COLLECTION = 'prerequisite_suggestions';
const DEFINITIONS_COLLECTION = 'prerequisite_definitions';
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;
const DEFAULT_USAGE_LIMIT = 20;

type FirestoreRecord = Record<string, unknown>;

type SuggestionListCursor = {
  sort: AdminPrerequisiteSuggestionSort;
  status?: PrerequisiteSuggestionStatus;
  query?: string;
  primaryValue: number;
  secondaryValue?: number;
  id: string;
};

type SuggestionQueryPlan = {
  queryField?: 'searchKeys';
  status?: PrerequisiteSuggestionStatus;
  sort: AdminPrerequisiteSuggestionSort;
  orderBy: Array<{ field: 'statusRank' | 'lastSeenAt' | 'usageCount' | 'companyCount' | 'id'; direction: 'asc' | 'desc' }>;
};

function requireAdminDatabase() {
  if (!isFirebaseAdminConfigured || !adminDb) {
    throw new SevenoAdminServiceError(
      'firebase_admin_missing',
      500,
      'Firebase Admin n est pas configure pour lire les suggestions de prerequis.',
    );
  }

  return adminDb;
}

function isPlainObject(value: unknown): value is FirestoreRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }

  if (isPlainObject(value) && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return Timestamp.fromMillis((value as { toMillis: () => number }).toMillis());
  }

  return null;
}

function toIsoString(value: unknown) {
  const timestamp = toTimestamp(value);
  if (timestamp) {
    return timestamp.toDate().toISOString();
  }

  return null;
}

function getStatusRank(status: PrerequisiteSuggestionStatus) {
  if (status === 'pending') return 0;
  if (status === 'merged') return 1;
  if (status === 'approved') return 2;
  return 3;
}

function buildSearchKeys(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const keys = new Set<string>();
  const tokens = [normalized, ...normalized.split(' ')];
  for (const token of tokens) {
    if (!token) continue;
    for (let size = 2; size <= Math.min(token.length, 30); size += 1) {
      keys.add(token.slice(0, size));
    }
  }

  return [...keys];
}

function buildSuggestionSearchKeys(label: string, canonicalPrerequisiteCode: string | null) {
  const keys = new Set<string>();
  for (const value of [label, canonicalPrerequisiteCode ?? '']) {
    for (const key of buildSearchKeys(value)) {
      keys.add(key);
    }
  }
  return [...keys].slice(0, 200);
}

function encodeCursor(cursor: SuggestionListCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null | undefined): SuggestionListCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<SuggestionListCursor>;
    const sort = parsed.sort;
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';
    if (
      (sort !== 'recent' && sort !== 'usageCount' && sort !== 'companyCount')
      || !id
      || typeof parsed.primaryValue !== 'number'
      || !Number.isFinite(parsed.primaryValue)
      || (parsed.secondaryValue !== undefined && (!Number.isFinite(parsed.secondaryValue) || parsed.secondaryValue < 0))
    ) {
      throw new Error('invalid_cursor');
    }

    return {
      sort,
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.query ? { query: parsed.query } : {}),
      primaryValue: parsed.primaryValue,
      ...(parsed.secondaryValue !== undefined ? { secondaryValue: parsed.secondaryValue } : {}),
      id,
    };
  } catch {
    throw new SevenoAdminServiceError('invalid_cursor', 400, 'Le curseur de pagination est invalide.');
  }
}

function validateStatus(status: string | null): PrerequisiteSuggestionStatus | null {
  if (status === 'pending' || status === 'merged' || status === 'approved' || status === 'rejected') {
    return status;
  }

  return null;
}

function validateSort(sort: string | null): AdminPrerequisiteSuggestionSort {
  if (sort === 'usageCount' || sort === 'companyCount') {
    return sort;
  }

  return 'recent';
}

function normalizeQuery(query: string | null) {
  return normalizeSearchText(query ?? '');
}

function buildQueryPlan(
  status: PrerequisiteSuggestionStatus | null,
  query: string,
  sort: AdminPrerequisiteSuggestionSort,
): SuggestionQueryPlan {
  const orderBy: SuggestionQueryPlan['orderBy'] = [];

  if (sort === 'usageCount' || sort === 'companyCount') {
    orderBy.push({ field: sort, direction: 'desc' });
    orderBy.push({ field: 'id', direction: 'asc' });
    return {
      ...(query ? { queryField: 'searchKeys' as const } : {}),
      ...(status ? { status } : {}),
      sort,
      orderBy,
    };
  }

  if (status) {
    orderBy.push({ field: 'lastSeenAt', direction: 'desc' });
    orderBy.push({ field: 'id', direction: 'asc' });
    return {
      ...(query ? { queryField: 'searchKeys' as const } : {}),
      status,
      sort: 'recent',
      orderBy,
    };
  }

  orderBy.push({ field: 'statusRank', direction: 'asc' });
  orderBy.push({ field: 'lastSeenAt', direction: 'desc' });
  orderBy.push({ field: 'id', direction: 'asc' });
  return {
    ...(query ? { queryField: 'searchKeys' as const } : {}),
    sort: 'recent',
    orderBy,
  };
}

function normalizeStatusLabel(status: PrerequisiteSuggestionStatus) {
  if (status === 'pending') return 'À examiner';
  if (status === 'merged') return "Rattaché à un prérequis Seven’O";
  if (status === 'approved') return 'Approuvé';
  return 'Rejeté';
}

function toContextSummary(id: string, label: string) {
  return {
    id,
    label,
  };
}

function serializeSuggestionSummary(
  suggestionId: string,
  data: PrerequisiteSuggestion,
  canonicalPrerequisiteLabel: string | null = null,
): AdminPrerequisiteSuggestionSummary {
  return {
    suggestionId,
    label: data.label,
    normalizedLabel: data.normalizedLabel,
    status: data.status,
    statusLabel: normalizeStatusLabel(data.status),
    usageCount: data.usageCount,
    companyCount: data.companyCount,
    requiredCount: data.requiredCount,
    preferredCount: data.preferredCount,
    firstSeenAt: toIsoString(data.firstSeenAt) ?? '',
    lastSeenAt: toIsoString(data.lastSeenAt) ?? '',
    ...(data.canonicalPrerequisiteCode ? { canonicalPrerequisiteCode: data.canonicalPrerequisiteCode } : {}),
    ...(canonicalPrerequisiteLabel ? { canonicalPrerequisiteLabel } : {}),
    schemaVersion: data.schemaVersion,
    observedSectors: data.observedSectorIds.map((sectorId) => toContextSummary(sectorId, findSectorLabel(sectorId) ?? sectorId)),
    observedFamilies: data.observedJobFamilyIds.map((jobFamilyId) => toContextSummary(jobFamilyId, findFamilyLabel(jobFamilyId) ?? jobFamilyId)),
    observedRoles: data.observedJobRoleIds.map((jobRoleId) => toContextSummary(jobRoleId, findRoleLabel(jobRoleId) ?? jobRoleId)),
  };
}

function serializeUsageSummary(data: PrerequisiteSuggestionUsage): AdminPrerequisiteSuggestionUsageSummary {
  return {
    id: data.id,
    sectorId: data.sectorId,
    sectorLabel: findSectorLabel(data.sectorId) ?? data.sectorId,
    jobFamilyId: data.jobFamilyId,
    jobFamilyLabel: findFamilyLabel(data.jobFamilyId) ?? data.jobFamilyId,
    jobRoleId: data.jobRoleId,
    jobRoleLabel: findRoleLabel(data.jobRoleId) ?? data.jobRoleId,
    importance: data.importance,
    active: data.active,
    createdAt: toIsoString(data.createdAt) ?? '',
    updatedAt: toIsoString(data.updatedAt) ?? '',
    endedAt: toIsoString(data.endedAt ?? null),
  };
}

function parseSuggestionRecord(id: string, data: FirestoreRecord | undefined) {
  if (!data) {
    return null;
  }

  const status = validateStatus(typeof data.status === 'string' ? data.status : null) ?? 'pending';
  const canonicalPrerequisiteCode = cleanText(data.canonicalPrerequisiteCode) || null;
  const suggestion: PrerequisiteSuggestion = {
    id,
    label: cleanText(data.label) || id,
    normalizedLabel: cleanText(data.normalizedLabel) || normalizeSearchText(cleanText(data.label) || id),
    groupingKey: cleanText(data.groupingKey) || normalizeSearchText(cleanText(data.label) || id),
    status,
    statusRank: typeof data.statusRank === 'number' && Number.isFinite(data.statusRank)
      ? data.statusRank
      : getStatusRank(status),
    usageCount: typeof data.usageCount === 'number' && Number.isFinite(data.usageCount) ? data.usageCount : 0,
    companyCount: typeof data.companyCount === 'number' && Number.isFinite(data.companyCount) ? data.companyCount : 0,
    requiredCount: typeof data.requiredCount === 'number' && Number.isFinite(data.requiredCount) ? data.requiredCount : 0,
    preferredCount: typeof data.preferredCount === 'number' && Number.isFinite(data.preferredCount) ? data.preferredCount : 0,
    searchKeys: Array.isArray(data.searchKeys)
      ? [...new Set(data.searchKeys.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0))]
      : buildSuggestionSearchKeys(cleanText(data.label) || id, canonicalPrerequisiteCode),
    observedSectorIds: Array.isArray(data.observedSectorIds)
      ? data.observedSectorIds.map((item) => cleanText(item)).filter((item): item is string => Boolean(item))
      : [],
    observedJobFamilyIds: Array.isArray(data.observedJobFamilyIds)
      ? data.observedJobFamilyIds.map((item) => cleanText(item)).filter((item): item is string => Boolean(item))
      : [],
    observedJobRoleIds: Array.isArray(data.observedJobRoleIds)
      ? data.observedJobRoleIds.map((item) => cleanText(item)).filter((item): item is string => Boolean(item))
      : [],
    ...(canonicalPrerequisiteCode ? { canonicalPrerequisiteCode } : {}),
    ...(cleanText(data.mergedIntoSuggestionId) ? { mergedIntoSuggestionId: cleanText(data.mergedIntoSuggestionId) } : {}),
    schemaVersion: typeof data.schemaVersion === 'number' && data.schemaVersion > 0 ? data.schemaVersion : 1,
    firstSeenAt: toTimestamp(data.firstSeenAt) ?? Timestamp.now(),
    lastSeenAt: toTimestamp(data.lastSeenAt) ?? Timestamp.now(),
    createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
    updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
  } satisfies PrerequisiteSuggestion;

  return suggestion;
}

function parseUsageRecord(id: string, data: FirestoreRecord | undefined): PrerequisiteSuggestionUsage | null {
  if (!data) {
    return null;
  }

  const importance = data.importance === 'preferred' ? 'preferred' : 'required';
  const active = data.active === true;
  const suggestionId = cleanText(data.suggestionId) || '';
  const companyUid = cleanText(data.companyUid) || '';
  const offerId = cleanText(data.offerId) || '';
  const prerequisiteId = cleanText(data.prerequisiteId) || '';
  const prerequisiteCode = cleanText(data.prerequisiteCode) || '';
  const normalizedLabel = cleanText(data.normalizedLabel) || '';
  const groupingKey = cleanText(data.groupingKey) || normalizedLabel;

  if (!suggestionId || !companyUid || !offerId || !prerequisiteId || !prerequisiteCode) {
    return null;
  }

  return {
    id,
    suggestionId,
    companyUid,
    offerId,
    prerequisiteId,
    prerequisiteCode,
    prerequisiteVersion: typeof data.prerequisiteVersion === 'number' && Number.isFinite(data.prerequisiteVersion)
      ? data.prerequisiteVersion
      : 1,
    label: cleanText(data.label) || prerequisiteCode,
    normalizedLabel,
    groupingKey,
    sectorId: cleanText(data.sectorId) || '',
    jobFamilyId: cleanText(data.jobFamilyId) || '',
    jobRoleId: cleanText(data.jobRoleId) || '',
    importance,
    active,
    createdAt: toTimestamp(data.createdAt) ?? Timestamp.now(),
    updatedAt: toTimestamp(data.updatedAt) ?? Timestamp.now(),
    endedAt: data.endedAt === null ? null : toTimestamp(data.endedAt),
  } satisfies PrerequisiteSuggestionUsage;
}

function applyCursor(query: FirebaseFirestore.Query, cursor: SuggestionListCursor | null, plan: SuggestionQueryPlan) {
  if (!cursor) {
    return query;
  }

  if (plan.sort !== cursor.sort) {
    throw new SevenoAdminServiceError('invalid_cursor', 400, 'Le curseur de pagination est invalide pour ce tri.');
  }

  if (plan.status !== cursor.status) {
    throw new SevenoAdminServiceError('invalid_cursor', 400, 'Le curseur de pagination ne correspond pas aux filtres.');
  }

  if (plan.queryField && cursor.query !== normalizeQuery(cursor.query ?? null)) {
    throw new SevenoAdminServiceError('invalid_cursor', 400, 'Le curseur de pagination ne correspond pas aux filtres.');
  }

  if (plan.sort === 'usageCount' || plan.sort === 'companyCount') {
    return query.startAfter(cursor.primaryValue, cursor.id);
  }

  if (plan.status) {
    return query.startAfter(Timestamp.fromMillis(cursor.primaryValue), cursor.id);
  }

  return query.startAfter(
    cursor.primaryValue,
    Timestamp.fromMillis(cursor.secondaryValue ?? 0),
    cursor.id,
  );
}

async function loadCanonicalPrerequisiteLabel(code: string | null) {
  if (!code) {
    return null;
  }

  const snapshot = await requireAdminDatabase().collection(DEFINITIONS_COLLECTION).doc(code).get();
  const data = snapshot.exists ? snapshot.data() as FirestoreRecord : null;
  if (!data || typeof data.companyLabel !== 'string') {
    return null;
  }

  return data.companyLabel.trim() || null;
}

export async function loadAdminPrerequisiteSuggestions(options: {
  status?: string | null;
  query?: string | null;
  sort?: string | null;
  limit?: number | null;
  cursor?: string | null;
} = {}): Promise<AdminPrerequisiteSuggestionListPayload> {
  const firestore = requireAdminDatabase();
  const status = validateStatus(options.status ?? null);
  if (options.status && !status) {
    throw new SevenoAdminServiceError('invalid_status', 400, 'Le statut selectionne est invalide.');
  }

  const sort = validateSort(options.sort ?? null);
  const query = normalizeQuery(options.query ?? null);
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIST_LIMIT));
  const plan = buildQueryPlan(status, query, sort);

  let firestoreQuery: FirebaseFirestore.Query = firestore.collection(COLLECTION);
  if (plan.queryField && query) {
    firestoreQuery = firestoreQuery.where(plan.queryField, 'array-contains', query);
  }
  if (plan.status) {
    firestoreQuery = firestoreQuery.where('status', '==', plan.status);
  }

  for (const clause of plan.orderBy) {
    firestoreQuery = firestoreQuery.orderBy(clause.field, clause.direction);
  }

  const cursor = decodeCursor(options.cursor);
  if (cursor) {
    firestoreQuery = applyCursor(firestoreQuery, cursor, plan);
  }

  const snapshot = await firestoreQuery.limit(limit + 1).get();
  const documents = snapshot.docs.slice(0, limit);
  const items = await Promise.all(documents.map(async (document) => {
    const record = parseSuggestionRecord(document.id, document.data() as FirestoreRecord);
    if (!record) {
      return null;
    }

    const canonicalLabel = await loadCanonicalPrerequisiteLabel(record.canonicalPrerequisiteCode ?? null);
    return serializeSuggestionSummary(document.id, record, canonicalLabel);
  }));

  const last = documents.at(-1);
  const lastData = last ? parseSuggestionRecord(last.id, last.data() as FirestoreRecord) : null;
  const nextCursor = snapshot.docs.length > limit && lastData
    ? encodeCursor({
        sort,
        ...(status ? { status } : {}),
        ...(query ? { query } : {}),
        primaryValue: sort === 'recent'
          ? (status ? toTimestamp(lastData.lastSeenAt)?.toMillis() ?? Date.now() : lastData.statusRank)
          : (sort === 'usageCount' ? lastData.usageCount : lastData.companyCount),
        ...(sort === 'recent' && !status
          ? { secondaryValue: toTimestamp(lastData.lastSeenAt)?.toMillis() ?? Date.now() }
          : {}),
        id: last?.id ?? '',
      })
    : null;

  return {
    items: items.filter((item): item is AdminPrerequisiteSuggestionSummary => Boolean(item)),
    nextCursor,
  };
}

export async function getAdminPrerequisiteSuggestionDetail(suggestionId: string): Promise<AdminPrerequisiteSuggestionDetailPayload> {
  const firestore = requireAdminDatabase();
  const normalizedId = cleanText(suggestionId);
  if (!normalizedId) {
    throw new SevenoAdminServiceError('invalid_suggestion_id', 400, 'La suggestion est invalide.');
  }

  const snapshot = await firestore.collection(COLLECTION).doc(normalizedId).get();
  if (!snapshot.exists) {
    throw new SevenoAdminServiceError('suggestion_not_found', 404, 'Suggestion introuvable.');
  }

  const suggestion = parseSuggestionRecord(snapshot.id, snapshot.data() as FirestoreRecord);
  if (!suggestion) {
    throw new SevenoAdminServiceError('suggestion_invalid', 500, 'La suggestion est invalide.');
  }

  const canonicalPrerequisiteLabel = await loadCanonicalPrerequisiteLabel(suggestion.canonicalPrerequisiteCode ?? null);
  const usagesSnapshot = await firestore
    .collection(COLLECTION)
    .doc(snapshot.id)
    .collection('usages')
    .orderBy('updatedAt', 'desc')
    .limit(DEFAULT_USAGE_LIMIT + 1)
    .get();
  const usages = usagesSnapshot.docs
    .slice(0, DEFAULT_USAGE_LIMIT)
    .map((document) => parseUsageRecord(document.id, document.data() as FirestoreRecord))
    .filter((item): item is PrerequisiteSuggestionUsage => Boolean(item))
    .map((usage) => serializeUsageSummary(usage));

  return {
    suggestion: serializeSuggestionSummary(snapshot.id, suggestion, canonicalPrerequisiteLabel),
    canonicalPrerequisiteLabel,
    usages,
    usageLimit: DEFAULT_USAGE_LIMIT,
    hasMoreUsages: usagesSnapshot.docs.length > DEFAULT_USAGE_LIMIT,
  };
}
