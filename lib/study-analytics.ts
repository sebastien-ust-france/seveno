import type {
  RespondentType,
  StudyAnswerValue,
  StudyQuestion,
  StudyQuestionCategory,
  StudyQuestionOption,
  StudyResponseRecord,
} from '@/types/study';
import {
  respondentLabelByType,
  studyFinalQuestions,
  studyQuestionnaires,
  valueExpectationOptionsByCode,
} from '@/lib/study-questionnaire';
import {
  getAcquisitionSourceLabel,
  normalizeAcquisitionSourceCode,
} from '@/lib/study-acquisition';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';

const questionCatalog = [...Object.values(studyQuestionnaires).flat(), ...studyFinalQuestions];
const questionByFirestoreKey = new Map<string, StudyQuestion>(
  questionCatalog.map((question) => [question.firestoreKey, question]),
);

export const categoryLabels: Record<StudyQuestionCategory, string> = {
  segmentation: 'Segmentation',
  qualification: 'Qualification',
  market: 'Marché',
  intent: 'Intention',
  barrier: 'Frein',
  conversion: 'Conversion',
  contact: 'Contact',
};

export type IntentBand = 'high' | 'medium' | 'low';

export interface IntentReading {
  band: IntentBand;
  score: number;
}

export interface StudyBreakdownItem {
  value: string;
  label: string;
  count: number;
  rate: number;
}

export interface BinaryCounts {
  'true': number;
  'false': number;
}

export interface StudyStats {
  totalResponses: number;
  byProfile: Record<RespondentType, number>;
  byAcquisitionSource: StudyBreakdownItem[];
  bySectorCode: StudyBreakdownItem[];
  byActiveZoneCode: StudyBreakdownItem[];
  topContractTypeCodes: StudyBreakdownItem[];
  topWorkModePreferenceCodes: StudyBreakdownItem[];
  topSearchBlockerCodes: StudyBreakdownItem[];
  topMarketMissingCodes: StudyBreakdownItem[];
  topValueExpectationCodes: StudyBreakdownItem[];
  dailyAvailabilityConfirmation: StudyBreakdownItem[];
  dailyAvailabilityAcceptanceCount: number;
  dailyAvailabilityAcceptanceRate: number;
  preferredContactChannel: StudyBreakdownItem[];
  wantsBetaAccess: BinaryCounts;
  wantsLaunchNotification: BinaryCounts;
  currentRoleOtherBreakdown: StudyBreakdownItem[];
  currentRoleOtherDistinctCount: number;
  currentRoleOtherResponseCount: number;
}

const TOP_BREAKDOWN_LIMIT = 10;

export function getQuestionByFirestoreKey(key: string): StudyQuestion | undefined {
  return questionByFirestoreKey.get(key);
}

export function getQuestionLabelByFirestoreKey(key: string): string {
  return questionByFirestoreKey.get(key)?.label ?? key;
}

export function getQuestionCategoryByFirestoreKey(key: string): StudyQuestionCategory | undefined {
  return questionByFirestoreKey.get(key)?.category;
}

export function getQuestionOptionsByFirestoreKey(key: string): StudyQuestionOption[] | undefined {
  if (key === 'valueExpectationCode') {
    return valueExpectationOptionsByCode;
  }

  const options = questionByFirestoreKey.get(key)?.options;
  return Array.isArray(options) ? options : undefined;
}

function hasMeaningfulAnswer(value: StudyAnswerValue | undefined): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (value && typeof value === 'object') {
    return Boolean(value.answer?.toString().trim().length);
  }

  return false;
}

function getAnsweredKeys(response: StudyResponseRecord): string[] {
  const answers = response.answers ?? {};
  return Object.entries(answers)
    .filter(([, value]) => hasMeaningfulAnswer(value))
    .map(([key]) => key);
}

function getActiveCategories(response: StudyResponseRecord): StudyQuestionCategory[] {
  const categories = new Set<StudyQuestionCategory>();
  for (const key of getAnsweredKeys(response)) {
    const category = getQuestionCategoryByFirestoreKey(key);
    if (category) {
      categories.add(category);
    }
  }
  return Array.from(categories);
}

export function buildCategoryCounts(responses: StudyResponseRecord[]): Record<StudyQuestionCategory, number> {
  const counts: Record<StudyQuestionCategory, number> = {
    segmentation: 0,
    qualification: 0,
    market: 0,
    intent: 0,
    barrier: 0,
    conversion: 0,
    contact: 0,
  };

  for (const response of responses) {
    for (const category of getActiveCategories(response)) {
      counts[category] += 1;
    }
  }

  return counts;
}

function getAnswerScore(response: StudyResponseRecord): number {
  const answers = response.answers ?? {};
  let score = 0;

  switch (response.respondentType) {
    case 'professional_available': {
      if (answers.startDelayCode === 'immediately') score += 2;
      if (answers.startDelayCode === 'less_than_30_days') score += 1;
      if (hasMeaningfulAnswer(answers.valueExpectationCode) || hasMeaningfulAnswer(answers.valueExpectationCodes)) {
        score += 1;
      }
      break;
    }
    case 'professional_employed': {
      if (answers.openToOpportunity === 'yes') score += 2;
      if (answers.changeHorizonCode === 'immediately') score += 2;
      if (answers.changeHorizonCode === 'less_than_30_days') score += 1;
      if (hasMeaningfulAnswer(answers.valueExpectationCode) || hasMeaningfulAnswer(answers.valueExpectationCodes)) {
        score += 1;
      }
      break;
    }
    case 'company': {
      if (answers.hiringVolumeCode === 'more_than_20') score += 2;
      if (answers.hiringVolumeCode === '11_to_20') score += 1;
      if (answers.needOpenSinceCode === 'less_than_2_weeks') score += 2;
      if (answers.needOpenSinceCode === '2_to_4_weeks') score += 1;
      if (hasMeaningfulAnswer(answers.valueExpectationCode) || hasMeaningfulAnswer(answers.valueExpectationCodes)) {
        score += 1;
      }
      break;
    }
    case 'agency': {
      if (answers.monthlyVolumeCode === 'more_than_50') score += 2;
      if (answers.monthlyVolumeCode === '20_to_50') score += 1;
      if (answers.candidatePoolSizeCode === 'more_than_2000') score += 1;
      if (answers.candidatePoolSizeCode === '500_to_2000') score += 1;
      if (hasMeaningfulAnswer(answers.valueExpectationCode) || hasMeaningfulAnswer(answers.valueExpectationCodes)) {
        score += 1;
      }
      break;
    }
    default:
      break;
  }

  if (response.wantsLaunchNotification) {
    score += 1;
  }

  if (response.wantsBetaAccess) {
    score += 1;
  }

  return score;
}

export function classifyIntent(response: StudyResponseRecord): IntentReading {
  const score = getAnswerScore(response);
  if (score >= 4) return { band: 'high', score };
  if (score >= 2) return { band: 'medium', score };
  return { band: 'low', score };
}

export function getIntentCounts(responses: StudyResponseRecord[]): Record<IntentBand, number> {
  const counts: Record<IntentBand, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const response of responses) {
    counts[classifyIntent(response).band] += 1;
  }

  return counts;
}

export function getConversionRates(responses: StudyResponseRecord[]) {
  const total = responses.length || 1;
  const launchCount = responses.filter((response) => Boolean(response.wantsLaunchNotification)).length;
  const betaCount = responses.filter((response) => Boolean(response.wantsBetaAccess)).length;

  return {
    launchCount,
    betaCount,
    launchRate: launchCount / total,
    betaRate: betaCount / total,
  };
}

function getDisplayLabelForValue(key: string, value: string): string {
  if (key === 'source' || key === 'utmSource' || key === 'discoverySource') {
    return getAcquisitionSourceLabel(value) || value;
  }

  if (key === 'sectorCode') {
    return findSectorLabel(value) ?? value;
  }

  if (key === 'familyCode') {
    return findFamilyLabel(value) ?? value;
  }

  if (
    key === 'currentRoleCode' ||
    key === 'targetRoleCode' ||
    key === 'currentRecruitmentRoleCode' ||
    key === 'hardestRecruitmentRoleCode' ||
    key === 'agencyFrequentRoleCode' ||
    key === 'roleToRecruitCode' ||
    key === 'agencyPrimaryRoleCode'
  ) {
    return findRoleLabel(value) ?? value;
  }

  const options = getQuestionOptionsByFirestoreKey(key);
  const optionLabel = options?.find((option) => option.value === value)?.label;
  return optionLabel ?? value;
}

function getStudyAcquisitionSourceCode(response: StudyResponseRecord): string | undefined {
  return (
    normalizeAcquisitionSourceCode(response.utmSource) ??
    normalizeAcquisitionSourceCode(response.discoverySource) ??
    normalizeAcquisitionSourceCode(response.source)
  );
}

function buildBreakdown(
  key: string,
  counts: Record<string, number>,
  total: number,
  limit?: number,
): StudyBreakdownItem[] {
  return Object.entries(counts)
    .map(([value, count]) => ({
      value,
      label: getDisplayLabelForValue(key, value),
      count,
      rate: total > 0 ? count / total : 0,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, 'fr');
    })
    .slice(0, limit ?? Number.POSITIVE_INFINITY);
}

interface FreeTextBucket {
  key: string;
  label: string;
  count: number;
}

function normalizeFreeTextValue(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function aggregateFreeTextValues(values: Array<string | undefined>): FreeTextBucket[] {
  const buckets = new Map<string, FreeTextBucket>();

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeFreeTextValue(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    buckets.set(key, {
      key,
      label: normalized,
      count: 1,
    });
  }

  return [...buckets.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.label.localeCompare(right.label, 'fr');
  });
}

function buildFreeTextBreakdown(values: Array<string | undefined>): {
  breakdown: StudyBreakdownItem[];
  distinctCount: number;
  responseCount: number;
} {
  const buckets = aggregateFreeTextValues(values);
  const responseCount = buckets.reduce((total, bucket) => total + bucket.count, 0);

  return {
    breakdown: buckets.map((bucket) => ({
      value: bucket.key,
      label: bucket.label,
      count: bucket.count,
      rate: responseCount > 0 ? bucket.count / responseCount : 0,
    })),
    distinctCount: buckets.length,
    responseCount,
  };
}

export function countByValue(values: Array<string | number | boolean | null | undefined>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        continue;
      }

      counts[normalized] = (counts[normalized] ?? 0) + 1;
      continue;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const key = String(value);
      counts[key] = (counts[key] ?? 0) + 1;
      continue;
    }

    if (typeof value === 'boolean') {
      const key = String(value);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return counts;
}

export function countByArrayValues(values: Array<StudyAnswerValue | undefined>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry !== 'string') {
          continue;
        }

        const normalized = entry.trim();
        if (!normalized) {
          continue;
        }

        counts[normalized] = (counts[normalized] ?? 0) + 1;
      }
      continue;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        continue;
      }

      counts[normalized] = (counts[normalized] ?? 0) + 1;
    }
  }

  return counts;
}

export function calculateStudyStats(responses: StudyResponseRecord[]): StudyStats {
  const totalResponses = responses.length;
  const byProfile: Record<RespondentType, number> = {
    professional_available: 0,
    professional_employed: 0,
    company: 0,
    agency: 0,
  };

  for (const response of responses) {
    if (response.respondentType) {
      byProfile[response.respondentType] += 1;
    }
  }

  const sectorCounts = countByValue(responses.map((response) => response.answers?.sectorCode as string | undefined));
  const acquisitionSourceCounts = countByValue(responses.map((response) => getStudyAcquisitionSourceCode(response)));
  const activeZoneCounts = countByValue(responses.map((response) => response.answers?.activeZoneCode as string | undefined));
  const contractTypeCounts = countByArrayValues(responses.map((response) => response.answers?.contractTypeCodes));
  const workModePreferenceCounts = countByArrayValues(
    responses.map((response) => response.answers?.workModePreferenceCodes),
  );
  const searchBlockerCounts = countByArrayValues(responses.map((response) => response.answers?.searchBlockerCodes));
  const marketMissingCounts = countByArrayValues(responses.map((response) => response.answers?.marketMissingCodes));
  const valueExpectationCounts = countByArrayValues(
    responses.map((response) => response.answers?.valueExpectationCodes),
  );
  const dailyAvailabilityCounts = countByValue(
    responses.map((response) => response.answers?.dailyAvailabilityConfirmation as string | undefined),
  );
  const preferredContactCounts = countByValue(
    responses.map((response) => response.answers?.preferredContactChannel as string | undefined),
  );
  const currentRoleOtherStats = buildFreeTextBreakdown(
    responses.map((response) => response.answers?.currentRoleOther as string | undefined),
  );
  const launchCounts = countByValue(responses.map((response) => response.wantsLaunchNotification));
  const betaCounts = countByValue(responses.map((response) => response.wantsBetaAccess));
  const dailyAvailabilityAcceptanceCount =
    (dailyAvailabilityCounts.yes_without_problem ?? 0) +
    (dailyAvailabilityCounts.yes_if_under_10_seconds ?? 0) +
    (dailyAvailabilityCounts.yes_when_actively_searching ?? 0);

  return {
    totalResponses,
    byProfile,
    byAcquisitionSource: buildBreakdown('source', acquisitionSourceCounts, totalResponses),
    bySectorCode: buildBreakdown('sectorCode', sectorCounts, totalResponses),
    byActiveZoneCode: buildBreakdown('activeZoneCode', activeZoneCounts, totalResponses),
    topContractTypeCodes: buildBreakdown('contractTypeCodes', contractTypeCounts, totalResponses, TOP_BREAKDOWN_LIMIT),
    topWorkModePreferenceCodes: buildBreakdown(
      'workModePreferenceCodes',
      workModePreferenceCounts,
      totalResponses,
      TOP_BREAKDOWN_LIMIT,
    ),
    topSearchBlockerCodes: buildBreakdown('searchBlockerCodes', searchBlockerCounts, totalResponses, TOP_BREAKDOWN_LIMIT),
    topMarketMissingCodes: buildBreakdown('marketMissingCodes', marketMissingCounts, totalResponses, TOP_BREAKDOWN_LIMIT),
    topValueExpectationCodes: buildBreakdown(
      'valueExpectationCodes',
      valueExpectationCounts,
      totalResponses,
      TOP_BREAKDOWN_LIMIT,
    ),
    dailyAvailabilityConfirmation: buildBreakdown(
      'dailyAvailabilityConfirmation',
      dailyAvailabilityCounts,
      totalResponses,
    ),
    dailyAvailabilityAcceptanceCount,
    dailyAvailabilityAcceptanceRate: totalResponses > 0 ? dailyAvailabilityAcceptanceCount / totalResponses : 0,
    preferredContactChannel: buildBreakdown('preferredContactChannel', preferredContactCounts, totalResponses),
    wantsBetaAccess: {
      true: betaCounts.true ?? 0,
      false: betaCounts.false ?? 0,
    },
    wantsLaunchNotification: {
      true: launchCounts.true ?? 0,
      false: launchCounts.false ?? 0,
    },
    currentRoleOtherBreakdown: currentRoleOtherStats.breakdown,
    currentRoleOtherDistinctCount: currentRoleOtherStats.distinctCount,
    currentRoleOtherResponseCount: currentRoleOtherStats.responseCount,
  };
}

export function getProfileLabel(respondentType?: RespondentType) {
  if (!respondentType) {
    return 'Profil non défini';
  }

  return respondentLabelByType[respondentType];
}

export function hasAnyAnswer(response: StudyResponseRecord): boolean {
  return getAnsweredKeys(response).length > 0;
}

export function getAnswerCount(response: StudyResponseRecord): number {
  return getAnsweredKeys(response).length;
}

export function getAnsweredSummary(response: StudyResponseRecord, limit = 3): string[] {
  const answers = response.answers ?? {};
  return Object.entries(answers)
    .filter(([, value]) => hasMeaningfulAnswer(value))
    .slice(0, limit)
    .map(([key, value]) => `${getQuestionLabelByFirestoreKey(key)}: ${formatStudyAnswerValue(key, value ?? null)}`);
}

export function formatStudyAnswerValue(key: string, value: StudyAnswerValue): string {
  if (Array.isArray(value)) {
    const labels = value
      .map((entry) => {
        if (key === 'sectorCode') {
          return findSectorLabel(entry) ?? entry;
        }

        if (key === 'familyCode') {
          return findFamilyLabel(entry) ?? entry;
        }

        if (
          key === 'targetRoleCodes' ||
          key === 'secondaryRoleCodes' ||
          key === 'currentRecruitmentRoleCodes' ||
          key === 'hardestRecruitmentRoleCodes' ||
          key === 'mostFrequentRecruitmentRoleCodes' ||
          key === 'agencyFrequentRoleCodes' ||
          key === 'agencyHardestRoleCodes' ||
          key === 'currentRecruitmentRoleCode' ||
          key === 'hardestRecruitmentRoleCode' ||
          key === 'agencyFrequentRoleCode' ||
          key === 'roleToRecruitCode' ||
          key === 'agencyPrimaryRoleCode'
        ) {
          return findRoleLabel(entry) ?? entry;
        }

        const options = getQuestionOptionsByFirestoreKey(key);
        const label = options?.find((option) => option.value === entry)?.label;
        return label ?? entry;
      })
      .filter((entry) => entry.trim().length > 0);

    return labels.join(', ');
  }

  if (typeof value === 'string') {
    if (key === 'sectorCode') {
      return findSectorLabel(value) ?? value;
    }

    if (key === 'familyCode') {
      return findFamilyLabel(value) ?? value;
    }

    if (
      key === 'currentRoleCode' ||
      key === 'targetRoleCode' ||
      key === 'currentRecruitmentRoleCode' ||
      key === 'hardestRecruitmentRoleCode' ||
      key === 'agencyFrequentRoleCode' ||
      key === 'roleToRecruitCode' ||
      key === 'agencyPrimaryRoleCode'
    ) {
      return findRoleLabel(value) ?? value;
    }
  }

  if (typeof value === 'string') {
    const options = getQuestionOptionsByFirestoreKey(key);
    const label = options?.find((option) => option.value === value)?.label;
    return label ?? value;
  }

  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    return value.answer || value.reason || '';
  }

  return '';
}
