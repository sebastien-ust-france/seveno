import { NextRequest, NextResponse } from 'next/server';
import type { RespondentType, StudyAnswerValue, StudyAnswers, StudyResponseRecord } from '@/types/study';
import {
  calculateStudyStats,
  formatStudyAnswerValue,
  getIntentCounts,
  type StudyStats,
} from '@/lib/study-analytics';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SerializedStudyResponse = {
  id: string;
  respondentType?: RespondentType;
  answers?: Partial<Record<string, unknown>>;
  wantsLaunchNotification?: boolean;
  wantsBetaAccess?: boolean;
  wantsProjectUpdates?: boolean;
  email?: string;
  phone?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  discoverySource?: string;
  logoFeedback?: 'yes' | 'no';
  visitorFingerprint?: string;
  createdAtMs: number | null;
};

type RespondentFilterValue = 'all' | 'yes' | 'no';

type AdminStudyMetrics = {
  totalResponses: number;
  byProfile: Record<RespondentType, number>;
  launchCount: number;
  betaCount: number;
  launchRate: number;
  betaRate: number;
  intentCounts: Record<'high' | 'medium' | 'low', number>;
  projectUpdatesYesCount: number;
  projectUpdatesNoCount: number;
  projectUpdatesRate: number;
  projectUpdatesBaseCount: number;
};

type AdminStudyQualityStats = {
  totalResponses: number;
  uniqueEmails: number;
  uniquePhones: number;
  uniqueFingerprints: number;
  duplicateEmailResponses: number;
  duplicatePhoneResponses: number;
  duplicateFingerprintResponses: number;
  burstResponses: number;
  suspectResponses: number;
  projectUpdatesYesCount: number;
  projectUpdatesNoCount: number;
  projectUpdatesBaseCount: number;
};

type AdminStudyPayload = {
  metrics: AdminStudyMetrics;
  studyStats: StudyStats;
  qualityStats: AdminStudyQualityStats;
  responses?: SerializedStudyResponse[];
  responseCount?: number;
  responsePage?: number;
  responsePageSize?: number;
  responseTotalPages?: number;
};

function toMillis(value: unknown): number | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof candidate.toMillis === 'function') {
      return candidate.toMillis();
    }

    if (typeof candidate.seconds === 'number') {
      return candidate.seconds * 1000 + Math.floor((candidate.nanoseconds ?? 0) / 1_000_000);
    }
  }

  return null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function toPlainAnswers(value: unknown): Partial<Record<string, unknown>> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toSerializedResponse(id: string, data: Record<string, unknown>): SerializedStudyResponse {
  return {
    id,
    respondentType: data.respondentType as RespondentType | undefined,
    answers: toPlainAnswers(data.answers),
    wantsLaunchNotification: toBoolean(data.wantsLaunchNotification),
    wantsBetaAccess: toBoolean(data.wantsBetaAccess),
    wantsProjectUpdates:
      data.wantsProjectUpdates === true || data.wantsProjectUpdates === false ? data.wantsProjectUpdates : undefined,
    email: typeof data.email === 'string' ? data.email : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    source: typeof data.source === 'string' ? data.source : '',
    utmSource: typeof data.utmSource === 'string' ? data.utmSource : '',
    utmMedium: typeof data.utmMedium === 'string' ? data.utmMedium : '',
    utmCampaign: typeof data.utmCampaign === 'string' ? data.utmCampaign : '',
    discoverySource: typeof data.discoverySource === 'string' ? data.discoverySource : '',
    logoFeedback: data.logoFeedback === 'yes' || data.logoFeedback === 'no' ? data.logoFeedback : undefined,
    visitorFingerprint: typeof data.visitorFingerprint === 'string' ? data.visitorFingerprint : '',
    createdAtMs: toMillis(data.createdAt),
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/\D+/g, '');
}

function normalizeFingerprint(value: string) {
  return value.trim().toLowerCase();
}

function calculateQualityStats(responses: SerializedStudyResponse[]): AdminStudyQualityStats {
  const emailCounts = new Map<string, number>();
  const phoneCounts = new Map<string, number>();
  const fingerprintCounts = new Map<string, number>();

  for (const response of responses) {
    const email = normalizeEmail(response.email ?? '');
    const phone = normalizePhone(response.phone ?? '');
    const fingerprint = normalizeFingerprint(response.visitorFingerprint ?? '');

    if (email) {
      emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
    }

    if (phone) {
      phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
    }

    if (fingerprint) {
      fingerprintCounts.set(fingerprint, (fingerprintCounts.get(fingerprint) ?? 0) + 1);
    }
  }

  const suspectIds = new Set<string>();

  for (const response of responses) {
    const email = normalizeEmail(response.email ?? '');
    const phone = normalizePhone(response.phone ?? '');
    const fingerprint = normalizeFingerprint(response.visitorFingerprint ?? '');

    if (email && (emailCounts.get(email) ?? 0) > 1) {
      suspectIds.add(response.id);
    }

    if (phone && (phoneCounts.get(phone) ?? 0) > 1) {
      suspectIds.add(response.id);
    }

    if (fingerprint && (fingerprintCounts.get(fingerprint) ?? 0) > 1) {
      suspectIds.add(response.id);
    }
  }

  const orderedResponses = [...responses].sort((left, right) => (left.createdAtMs ?? 0) - (right.createdAtMs ?? 0));
  const burstIds = new Set<string>();
  for (let index = 0; index < orderedResponses.length; index += 1) {
    const start = orderedResponses[index];
    const startMs = start.createdAtMs;
    if (startMs === null) {
      continue;
    }

    const windowIds = [start.id];
    for (let cursor = index + 1; cursor < orderedResponses.length; cursor += 1) {
      const candidate = orderedResponses[cursor];
      const candidateMs = candidate.createdAtMs;
      if (candidateMs === null || candidateMs - startMs > 10 * 60 * 1000) {
        break;
      }
      windowIds.push(candidate.id);
    }

    if (windowIds.length > 3) {
      for (const id of windowIds) {
        burstIds.add(id);
      }
    }
  }

  const recruiterResponses = responses.filter(
    (response) =>
      (response.respondentType === 'company' || response.respondentType === 'agency') &&
      typeof response.wantsProjectUpdates === 'boolean',
  );
  const projectUpdatesYesCount = recruiterResponses.filter((response) => response.wantsProjectUpdates === true).length;
  const projectUpdatesNoCount = recruiterResponses.filter((response) => response.wantsProjectUpdates === false).length;
  const projectUpdatesBaseCount = recruiterResponses.length;

  return {
    totalResponses: responses.length,
    uniqueEmails: emailCounts.size,
    uniquePhones: phoneCounts.size,
    uniqueFingerprints: fingerprintCounts.size,
    duplicateEmailResponses: responses.filter((response) => {
      const email = normalizeEmail(response.email ?? '');
      return email && (emailCounts.get(email) ?? 0) > 1;
    }).length,
    duplicatePhoneResponses: responses.filter((response) => {
      const phone = normalizePhone(response.phone ?? '');
      return phone && (phoneCounts.get(phone) ?? 0) > 1;
    }).length,
    duplicateFingerprintResponses: responses.filter((response) => {
      const fingerprint = normalizeFingerprint(response.visitorFingerprint ?? '');
      return fingerprint && (fingerprintCounts.get(fingerprint) ?? 0) > 1;
    }).length,
    burstResponses: burstIds.size,
    suspectResponses: new Set([...suspectIds, ...burstIds]).size,
    projectUpdatesYesCount,
    projectUpdatesNoCount,
    projectUpdatesBaseCount,
  };
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function responseMatchesSearch(response: SerializedStudyResponse, search: string) {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch) {
    return true;
  }

  const answerText = Object.entries(response.answers ?? {})
    .map(([key, value]) => `${key}:${formatStudyAnswerValue(key, (value ?? null) as StudyAnswerValue)}`)
    .join(' ');
  const haystack = [
    response.id,
    response.respondentType ?? '',
    response.email ?? '',
    response.phone ?? '',
    response.logoFeedback ?? '',
    response.source ?? '',
    response.utmSource ?? '',
    response.utmMedium ?? '',
    response.utmCampaign ?? '',
    response.discoverySource ?? '',
    answerText,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

function responseMatchesFilters(
  response: SerializedStudyResponse,
  filters: {
    profile: 'all' | RespondentType;
    launch: RespondentFilterValue;
    beta: RespondentFilterValue;
    search: string;
  },
) {
  if (filters.profile !== 'all' && response.respondentType !== filters.profile) {
    return false;
  }

  if (filters.launch !== 'all' && (response.wantsLaunchNotification ? 'yes' : 'no') !== filters.launch) {
    return false;
  }

  if (filters.beta !== 'all' && (response.wantsBetaAccess ? 'yes' : 'no') !== filters.beta) {
    return false;
  }

  return responseMatchesSearch(response, filters.search);
}

function getAdminCode(request: NextRequest) {
  return request.headers.get('x-admin-code')?.trim() ?? '';
}

export async function GET(request: NextRequest) {
  const expectedCode = process.env.NEXT_PUBLIC_ADMIN_CODE?.trim();
  const providedCode = getAdminCode(request);

  if (!expectedCode) {
    return NextResponse.json(
      {
        error: 'admin_code_missing',
        message: 'NEXT_PUBLIC_ADMIN_CODE doit etre defini pour lire le dashboard admin.',
      },
      { status: 500 },
    );
  }

  if (!providedCode || providedCode !== expectedCode) {
    return NextResponse.json(
      {
        error: 'forbidden',
        message: 'Code admin invalide.',
      },
      { status: 401 },
    );
  }

  if (!isFirebaseAdminConfigured || !adminDb) {
    return NextResponse.json(
      {
        error: 'firebase_admin_missing',
        message:
          'Firebase Admin n est pas configure. Ajoutez FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL et FIREBASE_ADMIN_PRIVATE_KEY.',
      },
      { status: 500 },
    );
  }

  try {
    const snapshot = await adminDb.collection('study_responses').get();
    const responses = snapshot.docs.map((doc) => toSerializedResponse(doc.id, doc.data() as Record<string, unknown>));
    const analyticsResponses: StudyResponseRecord[] = responses.map((response) => ({
      id: response.id,
      respondentType: response.respondentType,
      answers: response.answers as StudyAnswers,
      wantsLaunchNotification: response.wantsLaunchNotification,
      wantsBetaAccess: response.wantsBetaAccess,
      wantsProjectUpdates: response.wantsProjectUpdates,
      email: response.email,
      phone: response.phone,
      visitorFingerprint: response.visitorFingerprint,
      createdAt: null,
    }));
    const studyStats = calculateStudyStats(analyticsResponses);
    const qualityStats = calculateQualityStats(responses);

    const metrics: AdminStudyMetrics = {
      totalResponses: studyStats.totalResponses,
      byProfile: studyStats.byProfile,
      launchCount: studyStats.wantsLaunchNotification.true,
      betaCount: studyStats.wantsBetaAccess.true,
      launchRate: studyStats.totalResponses > 0 ? studyStats.wantsLaunchNotification.true / studyStats.totalResponses : 0,
      betaRate: studyStats.totalResponses > 0 ? studyStats.wantsBetaAccess.true / studyStats.totalResponses : 0,
      intentCounts: getIntentCounts(analyticsResponses),
      projectUpdatesYesCount: qualityStats.projectUpdatesYesCount,
      projectUpdatesNoCount: qualityStats.projectUpdatesNoCount,
      projectUpdatesBaseCount: qualityStats.projectUpdatesBaseCount,
      projectUpdatesRate:
        qualityStats.projectUpdatesBaseCount > 0
          ? qualityStats.projectUpdatesYesCount / qualityStats.projectUpdatesBaseCount
          : 0,
    };

    responses.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

    const payload: AdminStudyPayload = {
      metrics,
      studyStats,
      qualityStats,
    };

    const includeResponses = request.nextUrl.searchParams.get('includeResponses') === '1';
    if (includeResponses) {
      const pageSizeRaw = Number.parseInt(request.nextUrl.searchParams.get('pageSize') ?? '10', 10);
      const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 50) : 10;
      const pageRaw = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
      const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1;
      const filters = {
        profile: (request.nextUrl.searchParams.get('profile') ?? 'all') as 'all' | RespondentType,
        launch: (request.nextUrl.searchParams.get('launch') ?? 'all') as RespondentFilterValue,
        beta: (request.nextUrl.searchParams.get('beta') ?? 'all') as RespondentFilterValue,
        search: request.nextUrl.searchParams.get('search') ?? '',
      };

      const filteredResponses = responses.filter((response) => responseMatchesFilters(response, filters));
      const totalResponses = filteredResponses.length;
      const totalPages = totalResponses > 0 ? Math.ceil(totalResponses / pageSize) : 0;
      const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
      const startIndex = totalPages > 0 ? (safePage - 1) * pageSize : 0;

      payload.responses = filteredResponses.slice(startIndex, startIndex + pageSize);
      payload.responseCount = totalResponses;
      payload.responsePage = safePage;
      payload.responsePageSize = pageSize;
      payload.responseTotalPages = totalPages;
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'fetch_failed',
        message: error instanceof Error ? error.message : 'Impossible de lire les réponses.',
      },
      { status: 500 },
    );
  }
}
