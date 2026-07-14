import type { FirestoreDateValue } from '@/types/seveno';
import type { PrerequisiteImportance } from '@/types/seveno-prerequisites';

export type PrerequisiteSuggestionStatus = 'pending' | 'approved' | 'merged' | 'rejected';

export interface PrerequisiteSuggestion {
  id: string;
  label: string;
  normalizedLabel: string;
  groupingKey: string;
  status: PrerequisiteSuggestionStatus;
  statusRank: number;
  usageCount: number;
  companyCount: number;
  requiredCount: number;
  preferredCount: number;
  searchKeys: string[];
  observedSectorIds: string[];
  observedJobFamilyIds: string[];
  observedJobRoleIds: string[];
  canonicalPrerequisiteCode?: string | null;
  mergedIntoSuggestionId?: string | null;
  schemaVersion: number;
  firstSeenAt: FirestoreDateValue;
  lastSeenAt: FirestoreDateValue;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface PrerequisiteSuggestionUsage {
  id: string;
  suggestionId: string;
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
  active: boolean;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  endedAt?: FirestoreDateValue | null;
}

export interface PrerequisiteSuggestionCompany {
  companyUid: string;
  activeUsageCount: number;
  requiredCount: number;
  preferredCount: number;
  active: boolean;
  firstSeenAt: FirestoreDateValue;
  lastSeenAt: FirestoreDateValue;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  endedAt?: FirestoreDateValue | null;
}
