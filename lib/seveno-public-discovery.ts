import { createHash } from 'node:crypto';

import type {
  CandidateAvailability,
  CandidateExperienceLevel,
  CandidateTargetJob,
  DesiredContractTypeCode,
} from '@/types/seveno';
import type {
  JobOfferContractType,
  JobOfferWorkingTime,
  JobOfferWorkMode,
} from '@/types/seveno-job-offers';

export const PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION = '1.0';

const PUBLIC_OFFER_STATUSES = new Set(['published']);
const PUBLIC_CANDIDATE_STATUSES = new Set(['active']);
const WORK_MODES = new Set<JobOfferWorkMode>(['onsite', 'hybrid', 'remote']);
const CONTRACT_TYPES = new Set<JobOfferContractType>([
  'permanent',
  'fixed_term',
  'temporary',
  'freelance',
  'apprenticeship',
  'internship',
  'other',
]);
const WORKING_TIMES = new Set<JobOfferWorkingTime>(['full_time', 'part_time', 'shift', 'flexible', 'other']);
const AVAILABILITIES = new Set<CandidateAvailability>([
  'immediate',
  'less_than_1_month',
  'one_to_three_months',
  'listening',
  'not_available',
]);
const EXPERIENCE_LEVELS = new Set<CandidateExperienceLevel>([
  'beginner',
  'intermediate',
  'confirmed',
  'senior',
  'expert',
]);
const DESIRED_CONTRACT_TYPES = new Set<DesiredContractTypeCode>([
  'CDI',
  'CDD',
  'INTERIM',
  'FREELANCE',
  'ALTERNANCE',
  'STAGE',
  'SAISONNIER',
  'AUTRE',
]);

type PublicSource = Record<string, unknown>;

export type PublicOfferProjection = {
  slug: string;
  title: string;
  jobRoleLabel: string;
  location: string;
  countryCode: string;
  countryName: string;
  administrativeAreaName: string;
  cityName: string;
  workMode: JobOfferWorkMode | '';
  contractType: JobOfferContractType | '';
  workingTime: JobOfferWorkingTime | '';
  description: string;
  missions: string;
  profileSummary: string;
  requiredPrerequisites: string[];
  preferredPrerequisites: string[];
  publishedAt: string;
  updatedAt: string | null;
};

export type PublicCandidateProjection = {
  slug: string;
  targetJobs: Array<Pick<CandidateTargetJob, 'label'>>;
  desiredContractTypeCodes: DesiredContractTypeCode[];
  availability: CandidateAvailability;
  broadLocation: string;
  countryCode: string;
  experienceLevel: CandidateExperienceLevel;
  recommendationVisibleCount: number;
  updatedAt: string | null;
};

function cleanText(value: unknown, maxLength = 6000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isPlainObject(value: unknown): value is PublicSource {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }
  if (isPlainObject(value)) {
    if (typeof value.toDate === 'function') {
      const date = (value.toDate as () => unknown)();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
    }
    if (typeof value.seconds === 'number') {
      const date = new Date(value.seconds * 1000);
      return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    }
  }
  return null;
}

export function slugifyPublicLabel(value: string, fallback: string) {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
  return slug || fallback;
}

function opaqueSuffix(stableSource: string) {
  return createHash('sha256').update(stableSource).digest('hex').slice(0, 12);
}

export function buildPublicOfferSlug(documentId: string, title: string, location: string, descriptive = true) {
  const suffix = opaqueSuffix(`offer:${documentId}`);
  if (!descriptive) return `offre-${suffix}`;
  return `${slugifyPublicLabel(`${title} ${location}`, 'offre')}-${suffix}`;
}

export function buildPublicCandidateSlug(publicCandidateId: string, jobLabel: string, broadLocation: string) {
  const suffix = opaqueSuffix(`candidate:${publicCandidateId}`);
  return `${slugifyPublicLabel(`${jobLabel} ${broadLocation}`, 'talent')}-${suffix}`;
}

function prerequisiteLabels(value: unknown) {
  if (!Array.isArray(value)) return [];
  const labels = value
    .map((item) => isPlainObject(item) ? cleanText(item.companyLabel, 240) : '')
    .filter(Boolean);
  return [...new Set(labels)].slice(0, 30);
}

export function projectPublicOffer(documentId: string, data: PublicSource): PublicOfferProjection | null {
  if (!PUBLIC_OFFER_STATUSES.has(cleanText(data.status, 20))) return null;
  const title = cleanText(data.title, 160);
  const jobRoleLabel = cleanText(data.jobRoleLabel, 200);
  const description = cleanText(data.description);
  const publishedAt = toIso(data.publishedAt);
  if (!documentId || !title || !jobRoleLabel || !description || !publishedAt) return null;

  const location = cleanText(data.location, 360);
  const storedSlug = cleanText(data.publicSlug, 120);
  const workMode = WORK_MODES.has(data.workMode as JobOfferWorkMode)
    ? data.workMode as JobOfferWorkMode
    : '';
  const contractType = CONTRACT_TYPES.has(data.contractType as JobOfferContractType)
    ? data.contractType as JobOfferContractType
    : '';
  const workingTime = WORKING_TIMES.has(data.workingTime as JobOfferWorkingTime)
    ? data.workingTime as JobOfferWorkingTime
    : '';

  return {
    slug: storedSlug || buildPublicOfferSlug(documentId, title, location, false),
    title,
    jobRoleLabel,
    location,
    countryCode: cleanText(data.countryCode, 2).toUpperCase(),
    countryName: cleanText(data.countryName, 120),
    administrativeAreaName: cleanText(data.administrativeAreaName, 160),
    cityName: cleanText(data.cityName, 160),
    workMode,
    contractType,
    workingTime,
    description,
    missions: cleanText(data.missions),
    profileSummary: cleanText(data.profileSummary, 3000),
    requiredPrerequisites: prerequisiteLabels(data.requiredPrerequisites),
    preferredPrerequisites: prerequisiteLabels(data.preferredPrerequisites),
    publishedAt,
    updatedAt: toIso(data.updatedAt),
  };
}

export function isPublicOfferPublicationActive(
  offerData: PublicSource,
  campaignData: PublicSource | null,
  now = new Date(),
) {
  const campaignId = cleanText(offerData.activeCampaignId, 128);
  if (!campaignId) return true;
  if (!campaignData || cleanText(campaignData.status, 20) !== 'active') return false;
  const endsAt = toIso(campaignData.endsAt);
  return Boolean(endsAt && new Date(endsAt).getTime() > now.getTime());
}

function publicTargetJobs(value: unknown): PublicCandidateProjection['targetJobs'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => isPlainObject(item) ? cleanText(item.label, 200) : '')
    .filter(Boolean)
    .slice(0, 3)
    .map((label) => ({ label }));
}

export function resolveBroadCandidateLocation(data: { administrativeAreaName?: unknown; countryName?: unknown }) {
  const administrativeAreaName = cleanText(data.administrativeAreaName, 160);
  const countryName = cleanText(data.countryName, 120);
  return [administrativeAreaName, countryName].filter(Boolean).join(', ');
}

export function projectPublicCandidate(data: PublicSource): PublicCandidateProjection | null {
  if (!PUBLIC_CANDIDATE_STATUSES.has(cleanText(data.profileStatus, 20))) return null;
  if (data.publicSearchVisibilityEnabled !== true) return null;
  if (data.publicSearchVisibilityConsentVersion !== PUBLIC_SEARCH_VISIBILITY_CONSENT_VERSION) return null;

  const slug = cleanText(data.publicSearchSlug, 120);
  const targetJobs = publicTargetJobs(data.targetJobs);
  const broadLocation = resolveBroadCandidateLocation(data);
  const availability = data.availability as CandidateAvailability;
  const experienceLevel = data.experienceLevel as CandidateExperienceLevel;
  if (!slug || targetJobs.length === 0 || !broadLocation) return null;
  if (!AVAILABILITIES.has(availability) || !EXPERIENCE_LEVELS.has(experienceLevel)) return null;

  const desiredContractTypeCodes = Array.isArray(data.desiredContractTypeCodes)
    ? [...new Set(data.desiredContractTypeCodes
      .map((item) => cleanText(item, 20).toUpperCase() as DesiredContractTypeCode)
      .filter((item) => DESIRED_CONTRACT_TYPES.has(item)))]
    : [];
  const recommendationVisibleCount = typeof data.recommendationVisibleCount === 'number'
    && Number.isInteger(data.recommendationVisibleCount)
    && data.recommendationVisibleCount > 0
    ? data.recommendationVisibleCount
    : 0;

  return {
    slug,
    targetJobs,
    desiredContractTypeCodes,
    availability,
    broadLocation,
    countryCode: cleanText(data.countryCode, 2).toUpperCase(),
    experienceLevel,
    recommendationVisibleCount,
    updatedAt: toIso(data.updatedAt),
  };
}

export function buildJobPostingJsonLd(offer: PublicOfferProjection) {
  const employmentType: Partial<Record<JobOfferContractType, string>> = {
    permanent: offer.workingTime === 'part_time' ? 'PART_TIME' : 'FULL_TIME',
    fixed_term: 'CONTRACTOR',
    temporary: 'TEMPORARY',
    freelance: 'CONTRACTOR',
    apprenticeship: 'INTERN',
    internship: 'INTERN',
    other: 'OTHER',
  };
  const addressCountry = offer.countryCode || offer.countryName || 'FR';
  const base = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: offer.title,
    description: [offer.description, offer.missions, offer.profileSummary].filter(Boolean).join('\n\n'),
    datePosted: offer.publishedAt,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'confidential',
    },
    ...(offer.contractType ? { employmentType: employmentType[offer.contractType] } : {}),
  };

  if (offer.workMode === 'remote') {
    return {
      ...base,
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: {
        '@type': 'Country',
        name: addressCountry,
      },
    };
  }

  return {
    ...base,
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(offer.cityName ? { addressLocality: offer.cityName } : {}),
        ...(offer.administrativeAreaName ? { addressRegion: offer.administrativeAreaName } : {}),
        addressCountry,
      },
    },
  };
}

export function buildCandidateProfileJsonLd(candidate: PublicCandidateProjection) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `https://seveno.eu/talents/${candidate.slug}`,
    mainEntity: {
      '@type': 'Person',
      name: 'Candidat anonyme',
      jobTitle: candidate.targetJobs[0]?.label,
      homeLocation: {
        '@type': 'AdministrativeArea',
        name: candidate.broadLocation,
      },
    },
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
