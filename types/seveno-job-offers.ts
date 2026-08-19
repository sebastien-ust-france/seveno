import type { FirestoreDateValue } from '@/types/seveno';
import type {
  OfferPrerequisiteSnapshot,
  PrerequisiteCriterionValue,
} from '@/types/seveno-prerequisites';

export type JobOfferStatus = 'draft' | 'published' | 'paused' | 'closed' | 'archived';
export type JobOfferWorkMode = 'onsite' | 'hybrid' | 'remote';
export type JobOfferContractType =
  | 'permanent'
  | 'fixed_term'
  | 'temporary'
  | 'freelance'
  | 'apprenticeship'
  | 'internship'
  | 'other';
export type JobOfferWorkingTime = 'full_time' | 'part_time' | 'shift' | 'flexible' | 'other';
export type JobOfferStatusAction = 'publish' | 'pause' | 'reactivate' | 'close' | 'archive' | 'restore';

export interface JobOfferDependencyCounts {
  applications: number;
  questionnaire: number;
  sessions: number;
  results: number;
  applicationGuards: number;
  capacityLocks: number;
  matchRequests: number;
  suggestionUsages: number;
  versions: number;
}

export interface JobOfferPrerequisiteSelectionInput {
  prerequisiteId: string;
  expectedCriterion: PrerequisiteCriterionValue;
}

export interface JobOfferInput {
  title: string;
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  questionnaireId: string;
  location: string;
  countryCode?: string;
  countryName?: string;
  administrativeAreaCode?: string;
  administrativeAreaName?: string;
  city?: string;
  cityName?: string;
  workMode: JobOfferWorkMode | '';
  contractType: JobOfferContractType | '';
  workingTime: JobOfferWorkingTime | '';
  description: string;
  missions: string;
  profileSummary: string;
  questionnaireRequired: boolean;
  requiredPrerequisites: JobOfferPrerequisiteSelectionInput[];
  preferredPrerequisites: JobOfferPrerequisiteSelectionInput[];
}

export interface JobOffer {
  id: string;
  companyUid: string;
  companyId: string;
  createdByUid: string;
  assignedToUid: string;
  assignedAt: FirestoreDateValue;
  assignedByUid: string;
  updatedByUid: string;
  activeCampaignId: string | null;
  companyPublicId: string;
  companyNameSnapshot: string;
  title: string;
  sectorId: string;
  jobFamilyId: string;
  jobRoleId: string;
  jobRoleLabel: string;
  location: string;
  countryCode?: string;
  countryName?: string;
  administrativeAreaCode?: string;
  administrativeAreaName?: string;
  city?: string;
  cityName?: string;
  workMode: JobOfferWorkMode | '';
  contractType: JobOfferContractType | '';
  workingTime: JobOfferWorkingTime | '';
  description: string;
  missions: string;
  profileSummary: string;
  questionnaireRequired: boolean;
  questionnaireId: string | null;
  questionnaireVersion: number | null;
  questionnaireTitleSnapshot: string | null;
  questionnaireQuestionCountSnapshot: number | null;
  requiredPrerequisites: OfferPrerequisiteSnapshot[];
  preferredPrerequisites: OfferPrerequisiteSnapshot[];
  status: JobOfferStatus;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  publishedAt: FirestoreDateValue | null;
  closedAt: FirestoreDateValue | null;
  version: number;
}

export interface SerializedJobOffer extends Omit<JobOffer, 'createdAt' | 'updatedAt' | 'publishedAt' | 'closedAt' | 'assignedAt'> {
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  assignedAt: string;
  activeCandidateFilesCount?: number;
}

export interface JobOfferListPage {
  offers: SerializedJobOffer[];
  nextCursor: string | null;
}

/** Future public projection. Internal company ownership is intentionally excluded. */
export type PublicJobOffer = Omit<SerializedJobOffer, 'companyUid' | 'companyId' | 'createdByUid' | 'updatedByUid' | 'assignedToUid' | 'assignedAt' | 'assignedByUid'>;
