import type { FirestoreDateValue } from '@/types/seveno';

export type PrerequisiteCategory =
  | 'license'
  | 'certification'
  | 'language'
  | 'software'
  | 'technical_skill'
  | 'experience'
  | 'education'
  | 'availability'
  | 'mobility'
  | 'schedule'
  | 'work_environment'
  | 'physical_requirement'
  | 'other_professional';

export type PrerequisiteAnswerType =
  | 'boolean'
  | 'single_choice'
  | 'multiple_choice'
  | 'level'
  | 'number'
  | 'date';

export type PrerequisiteCriterionMode = 'fixed' | 'configurable';
export type PrerequisiteComparisonOperator =
  | 'equals'
  | 'one_of'
  | 'minimum'
  | 'maximum'
  | 'contains_any'
  | 'contains_all'
  | 'before'
  | 'after';
export type PrerequisiteResponseScope = 'profile_reusable' | 'application_specific';
export type PrerequisiteEvidencePolicy = 'none' | 'optional' | 'required_after_match';
export type PrerequisiteStatus = 'draft' | 'active' | 'archived';
export type PrerequisiteImportance = 'required' | 'preferred';
export type PrerequisiteFamily = 'job_skill' | 'offer_requirement';
export type OfferRequirementCategory =
  | 'experience' | 'diploma' | 'permit' | 'vehicle' | 'caces' | 'certification'
  | 'habilitation' | 'authorization' | 'professional_card' | 'availability'
  | 'mobility' | 'administrative' | 'other';
export type PrerequisiteSource = 'seveno' | 'company';
export type PrerequisiteLibraryScope = 'library' | 'offer';
export type PrerequisiteApplicabilityLevel = 'global' | 'sector' | 'family' | 'role';
export type PrerequisiteCriterionValue = string | number | boolean | string[];

export interface PrerequisiteAnswerOption {
  value: string;
  candidateLabel: string;
  rank?: number;
}

export interface PrerequisiteApplicability {
  global: boolean;
  sectorIds: string[];
  jobFamilyIds: string[];
  jobRoleIds: string[];
  excludedSectorIds: string[];
  excludedJobFamilyIds: string[];
  excludedJobRoleIds: string[];
}

export interface PrerequisiteDefinitionInput {
  code: string;
  source?: PrerequisiteSource;
  ownerCompanyId?: string;
  originOfferId?: string;
  libraryScope?: PrerequisiteLibraryScope;
  suggestedToSeveno?: boolean;
  category: PrerequisiteCategory;
  prerequisiteFamily?: PrerequisiteFamily;
  offerRequirementCategory?: OfferRequirementCategory;
  companyLabel: string;
  companyDescription?: string;
  candidateQuestion: string;
  candidateHelp?: string;
  answerType: PrerequisiteAnswerType;
  options: PrerequisiteAnswerOption[];
  criterionMode: PrerequisiteCriterionMode;
  defaultCriterion?: PrerequisiteCriterionValue;
  allowedCriterionValues: PrerequisiteCriterionValue[];
  comparisonOperator: PrerequisiteComparisonOperator;
  responseScope: PrerequisiteResponseScope;
  evidencePolicy: PrerequisiteEvidencePolicy;
  freshnessDays?: number;
  applicability: PrerequisiteApplicability;
  status: PrerequisiteStatus;
}

export interface PrerequisiteDefinition extends PrerequisiteDefinitionInput {
  id: string;
  applicabilityKeys: string[];
  exclusionKeys: string[];
  searchKeys: string[];
  version: number;
  createdAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
  createdBy: string;
  updatedBy: string;
}

export interface SerializedPrerequisiteDefinition extends Omit<PrerequisiteDefinition, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface PrerequisiteVersionSnapshot extends SerializedPrerequisiteDefinition {
  recordedAt: string;
  recordedBy: string;
}

/** Public selection projection returned to an authenticated company. */
export interface CompanyPrerequisiteDefinition {
  prerequisiteId: string;
  code: string;
  source: PrerequisiteSource;
  ownerCompanyId?: string;
  originOfferId?: string;
  suggestedToSeveno?: boolean;
  category: PrerequisiteCategory;
  prerequisiteFamily?: PrerequisiteFamily;
  offerRequirementCategory?: OfferRequirementCategory;
  companyLabel: string;
  companyDescription?: string;
  candidateQuestion: string;
  candidateHelp?: string;
  answerType: PrerequisiteAnswerType;
  options: PrerequisiteAnswerOption[];
  criterionMode: PrerequisiteCriterionMode;
  defaultCriterion?: PrerequisiteCriterionValue;
  allowedCriterionValues: PrerequisiteCriterionValue[];
  comparisonOperator: PrerequisiteComparisonOperator;
  responseScope: PrerequisiteResponseScope;
  evidencePolicy: PrerequisiteEvidencePolicy;
  freshnessDays?: number;
  applicability: PrerequisiteApplicability;
  version: number;
  applicabilityLevel?: PrerequisiteApplicabilityLevel;
  applicableToCurrentRole?: boolean;
  alreadySelected?: boolean;
}

/** Frozen copy embedded later in an offer so library updates are never retroactive. */
export interface OfferPrerequisiteSnapshot {
  prerequisiteId: string;
  prerequisiteCode: string;
  prerequisiteVersion: number;
  source: PrerequisiteSource;
  ownerCompanyId?: string;
  originOfferId?: string;
  suggestedToSeveno?: boolean;
  category: PrerequisiteCategory;
  prerequisiteFamily?: PrerequisiteFamily;
  offerRequirementCategory?: OfferRequirementCategory;
  companyLabel: string;
  candidateQuestion: string;
  candidateHelp?: string;
  answerType: PrerequisiteAnswerType;
  options: PrerequisiteAnswerOption[];
  comparisonOperator: PrerequisiteComparisonOperator;
  expectedCriterion: PrerequisiteCriterionValue;
  responseScope: PrerequisiteResponseScope;
  evidencePolicy: PrerequisiteEvidencePolicy;
  freshnessDays?: number;
  importance: PrerequisiteImportance;
}

export interface OfferPrerequisiteSelectionInput {
  prerequisiteId: string;
  expectedCriterion: PrerequisiteCriterionValue;
  importance: PrerequisiteImportance;
}

export interface RequiredPrerequisiteCompatibility {
  total: number;
  satisfied: number;
  unsatisfied: number;
  unanswered: number;
  allSatisfied: boolean;
}

export interface PreferredPrerequisiteCompatibility {
  total: number;
  satisfied: number;
  unanswered: number;
  compatibilityRate: number;
}

export interface PrerequisiteCompatibilityResult {
  required: RequiredPrerequisiteCompatibility;
  preferred: PreferredPrerequisiteCompatibility;
}

export interface PrerequisiteImportRequest {
  dryRun: boolean;
  updateExisting: boolean;
  dryRunToken?: string;
  items: PrerequisiteDefinitionInput[];
}

/** Structured browser payload used by enterprises to create a custom prerequisite. */
export interface CompanyPrerequisiteCreationInput {
  offerId: string;
  prerequisiteFamily: PrerequisiteFamily;
  offerRequirementCategory?: OfferRequirementCategory;
  companyLabel: string;
  candidateQuestion: string;
  candidateHelp?: string;
  answerType: Extract<PrerequisiteAnswerType, 'boolean' | 'single_choice' | 'multiple_choice' | 'number'>;
  options: PrerequisiteAnswerOption[];
  expectedCriterion: PrerequisiteCriterionValue;
  comparisonOperator: Extract<PrerequisiteComparisonOperator, 'equals' | 'one_of' | 'minimum' | 'contains_any' | 'contains_all'>;
  saveToLibrary: boolean;
}

export interface PrerequisiteImportError {
  index: number;
  code?: string;
  message: string;
}

export interface PrerequisiteImportReport {
  dryRun: boolean;
  dryRunToken?: string;
  total: number;
  created: string[];
  updated: string[];
  unchanged: string[];
  errors: PrerequisiteImportError[];
}
