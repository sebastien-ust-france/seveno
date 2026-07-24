import 'server-only';

import { randomUUID } from 'node:crypto';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import {
  SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION,
  SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_ID,
} from '@/lib/seveno-professional-assessment-fixtures';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase-admin';
import {
  AssessmentModelError,
  SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES,
  calculateProfessionalAssessmentOutcome,
  projectAssessmentReportForCandidate,
  projectAssessmentReportForCompany,
  validateAssessmentVersion,
} from '@/lib/seveno-professional-assessment';
import {
  buildSevenoProfessionalAssessmentBankPrompt,
  buildSevenoProfessionalAssessmentDraftFromBankDocument,
  parseSevenoProfessionalAssessmentBankDocument,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
} from '@/lib/seveno-professional-assessment-bank';
import type {
  AssessmentDimensionCode,
  AssessmentDimensionDefinition,
  AssessmentQuestion,
  AssessmentQuestionOption,
  AssessmentResponse,
  AssessmentVersionDescriptor,
  AssessmentScoreValue,
} from '@/types/seveno-assessment';
import type { SevenoAssessmentHumanReviewStatus } from '@/types/seveno-assessment-review';
import type {
  SevenoAssessmentPreviewMode,
  SevenoAssessmentPreviewPayload,
  SevenoAssessmentStoredDate,
  SevenoAssessmentStoredVersion,
  SevenoAssessmentVersionSummary,
} from '@/types/seveno-assessment-admin';

type StoredVersionInput = Partial<SevenoAssessmentStoredVersion> & {
  dimensions?: AssessmentDimensionDefinition[];
  questions?: AssessmentQuestion[];
};

export type ProfessionalAssessmentAdminRepositoryMode = 'memory' | 'firestore';

export interface ProfessionalAssessmentAdminRepository {
  listVersions(): MaybePromise<SevenoAssessmentStoredVersion[]>;
  readVersion(versionId: string): MaybePromise<SevenoAssessmentStoredVersion | null>;
  getDefaultVersionId(): MaybePromise<string | null>;
  createDraft(options?: { sourceVersionId?: string | null; blank?: boolean }): MaybePromise<SevenoAssessmentStoredVersion>;
  duplicateVersion(versionId: string): MaybePromise<SevenoAssessmentStoredVersion>;
  updateDraft(versionId: string, input: StoredVersionInput): MaybePromise<SevenoAssessmentStoredVersion>;
  deleteUnusedDraft(versionId: string, expectedRevisionNumber?: number): MaybePromise<void>;
  validateDraft(versionId: string): MaybePromise<ReturnType<typeof collectEngineValidation>>;
  markAsPilot(versionId: string, expectedRevisionNumber?: number): MaybePromise<SevenoAssessmentStoredVersion>;
  publishVersion(versionId: string, expectedRevisionNumber?: number): MaybePromise<SevenoAssessmentStoredVersion>;
  archiveVersion(versionId: string, expectedRevisionNumber?: number): MaybePromise<SevenoAssessmentStoredVersion>;
  markVersionUsed(versionId: string): MaybePromise<SevenoAssessmentStoredVersion>;
  importDraftFromJson(jsonText: string): MaybePromise<SevenoAssessmentStoredVersion>;
  buildPrompt(versionId: string): MaybePromise<string>;
  buildPreview(versionId: string, mode: SevenoAssessmentPreviewMode): MaybePromise<SevenoAssessmentPreviewPayload>;
}

type MaybePromise<T> = T | Promise<T>;

type RuntimeVersionLike = Omit<AssessmentVersionDescriptor, 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt'> & {
  createdAt: unknown;
  updatedAt: unknown;
  publishedAt: unknown;
  archivedAt: unknown;
};

const PROFESSIONAL_ASSESSMENT_VERSIONS_COLLECTION = 'professional_assessment_versions';
const PROFESSIONAL_ASSESSMENT_SCHEMA_VERSION = 1;
const PROFESSIONAL_ASSESSMENT_REPOSITORY_STORE_ENV = 'SEVENO_PROFESSIONAL_ASSESSMENT_ADMIN_STORE';

function getFirestoreEmulatorHost() {
  return process.env.FIRESTORE_EMULATOR_HOST?.trim() ?? '';
}

function requiresLocalFirestoreEmulator() {
  return process.env.NODE_ENV !== 'production'
    && process.env[PROFESSIONAL_ASSESSMENT_REPOSITORY_STORE_ENV] === 'firestore';
}

function assertLocalFirestoreRepositoryCanStart() {
  if (requiresLocalFirestoreEmulator() && !getFirestoreEmulatorHost()) {
    throw new SevenoProfessionalAssessmentRepositoryError(
      'firestore_emulator_required',
      500,
      'Le stockage Firestore local de l analyse professionnelle nécessite l émulateur Firestore.',
    );
  }
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableString(value: unknown): string | null {
  const trimmed = cleanString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanNullableString(item))
    .filter((item): item is string => Boolean(item));
}

function cleanRecord(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) {
    return {};
  }

  const entries = Object.entries(value)
    .map(([key, entryValue]) => [cleanString(key), cleanString(entryValue)] as const)
    .filter(([key, entryValue]) => key && entryValue);

  return Object.fromEntries(entries);
}

const HUMAN_REVIEW_STATUSES: SevenoAssessmentHumanReviewStatus[] = [
  'pending',
  'reviewed_with_changes',
  'approved_for_pilot',
  'rejected',
];

function normalizeHumanReviewStatus(value: unknown): SevenoAssessmentHumanReviewStatus {
  return HUMAN_REVIEW_STATUSES.includes(value as SevenoAssessmentHumanReviewStatus)
    ? value as SevenoAssessmentHumanReviewStatus
    : 'pending';
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

function toIsoDate(value: unknown): SevenoAssessmentStoredDate {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (value && typeof value === 'object') {
    const candidate = value as { toDate?: unknown; toMillis?: unknown };
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
    }

    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
    }
  }

  return null;
}

function toRuntimeDate(value: SevenoAssessmentStoredDate): Date {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function generateTechnicalId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function parseSemver(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function incrementVersionNumber(version: string) {
  const parsed = parseSemver(version);
  if (!parsed) {
    return '1.0.0';
  }

  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function toRuntimeVersion(stored: SevenoAssessmentStoredVersion): AssessmentVersionDescriptor {
  return {
    ...cloneValue(stored),
    createdAt: toRuntimeDate(stored.createdAt) as unknown as AssessmentVersionDescriptor['createdAt'],
    updatedAt: toRuntimeDate(stored.updatedAt) as unknown as AssessmentVersionDescriptor['updatedAt'],
    publishedAt: stored.publishedAt ? (toRuntimeDate(stored.publishedAt) as unknown as AssessmentVersionDescriptor['publishedAt']) : null,
    archivedAt: stored.archivedAt ? (toRuntimeDate(stored.archivedAt) as unknown as AssessmentVersionDescriptor['archivedAt']) : null,
    activatedAt: stored.activatedAt ? (toRuntimeDate(stored.activatedAt) as unknown as AssessmentVersionDescriptor['activatedAt']) : null,
  };
}

function fromRuntimeVersion(version: RuntimeVersionLike, options: { sourceVersionId?: string | null; hasStartedSessions?: boolean } = {}): SevenoAssessmentStoredVersion {
  return {
    id: version.id,
    code: version.code,
    version: version.version,
    status: version.status,
    name: version.name,
    description: version.description,
    createdAt: toIsoDate(version.createdAt),
    updatedAt: toIsoDate(version.updatedAt),
    publishedAt: toIsoDate(version.publishedAt),
    archivedAt: toIsoDate(version.archivedAt),
    createdBy: version.createdBy,
    dimensions: cloneValue(version.dimensions),
    questions: cloneValue(version.questions),
    essentialQuestionCount: version.essentialQuestionCount,
    extendedQuestionCount: version.extendedQuestionCount,
    estimatedEssentialDurationMinutes: version.estimatedEssentialDurationMinutes,
    estimatedExtendedDurationMinutes: version.estimatedExtendedDurationMinutes,
    scoringEngineVersion: version.scoringEngineVersion,
    interpretationEngineVersion: version.interpretationEngineVersion,
    legalNoticeVersion: version.legalNoticeVersion,
    activatedAt: version.activatedAt ? toIsoDate(version.activatedAt) : null,
    generatedPromptVersion: cleanNullableString(version.generatedPromptVersion) ?? 'seveno_professional_assessment_bank_v1',
    essentialPoolSize: isFiniteInteger(version.essentialPoolSize) ? version.essentialPoolSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
    extendedPoolSize: isFiniteInteger(version.extendedPoolSize) ? version.extendedPoolSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
    essentialDrawSize: isFiniteInteger(version.essentialDrawSize) ? version.essentialDrawSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
    extendedDrawSize: isFiniteInteger(version.extendedDrawSize) ? version.extendedDrawSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
    revisionNotes: [...version.revisionNotes],
    revisionNumber: 1,
    schemaVersion: PROFESSIONAL_ASSESSMENT_SCHEMA_VERSION,
    ...(version.interviewQuestionCatalog ? { interviewQuestionCatalog: { ...version.interviewQuestionCatalog } } : {}),
    ...(options.sourceVersionId ? { sourceVersionId: options.sourceVersionId } : {}),
    ...(typeof options.hasStartedSessions === 'boolean' ? { hasStartedSessions: options.hasStartedSessions } : {}),
  };
}

function createStoredSeedVersion() {
  const runtimeVersion = cloneValue(SEVENO_PROFESSIONAL_ASSESSMENT_TEST_ONLY_VERSION);
  const seedId = `${SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_ID}-draft`;
  return fromRuntimeVersion(
    {
      ...runtimeVersion,
      id: seedId,
      status: 'draft',
      publishedAt: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'phase-3-seed',
      questions: runtimeVersion.questions.map((question) => ({
        ...cloneValue(question),
        assessmentVersionId: seedId,
      })),
      revisionNotes: [
        ...runtimeVersion.revisionNotes,
        'Seeded for the phase 3 local admin editor.',
      ],
    },
    {
      sourceVersionId: SEVENO_PROFESSIONAL_ASSESSMENT_FIXTURE_VERSION_ID,
      hasStartedSessions: false,
    },
  );
}

function buildDefaultBlankVersion() {
  return createStoredSeedVersion();
}

function createBlankDraftTemplate(source: SevenoAssessmentStoredVersion) {
  const blankQuestions: AssessmentQuestion[] = [];
  const blankDimensions = cloneValue(source.dimensions);
  const now = new Date().toISOString();

  return {
    ...cloneValue(source),
    id: generateTechnicalId('seveno-professional-assessment'),
    code: `seveno_professional_${source.version.replaceAll('.', '_')}_${generateTechnicalId('draft').slice(-8)}`,
    version: source.version,
    status: 'draft' as const,
    name: 'Nouveau brouillon',
    description: '',
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    archivedAt: null,
    createdBy: 'phase-3-admin-ui',
    dimensions: blankDimensions,
    questions: blankQuestions,
    essentialQuestionCount: 0,
    extendedQuestionCount: 0,
    revisionNumber: 1,
    schemaVersion: PROFESSIONAL_ASSESSMENT_SCHEMA_VERSION,
    revisionNotes: ['Brouillon vide créé depuis le socle Phase 2.'],
    interviewQuestionCatalog: {},
    sourceVersionId: null,
    hasStartedSessions: false,
  } satisfies SevenoAssessmentStoredVersion;
}

function alignQuestionsToVersionId(questions: AssessmentQuestion[], versionId: string) {
  return questions.map((question) => ({
    ...cloneValue(question),
    assessmentVersionId: versionId,
  }));
}

function normalizeQuestionOption(
  input: unknown,
  questionId: string,
  position: number,
  knownOptionIds: Set<string>,
) {
  const source = isPlainObject(input) ? input : {};
  let id = cleanString(source.id);
  if (!id || knownOptionIds.has(id)) {
    id = `${questionId}-option-${position}-${generateTechnicalId('option').slice(-6)}`;
  }
  knownOptionIds.add(id);

  const dimensionScores: Partial<Record<AssessmentDimensionCode, AssessmentScoreValue>> = {};
  if (isPlainObject(source.dimensionScores)) {
    for (const [rawKey, rawValue] of Object.entries(source.dimensionScores)) {
      const key = cleanString(rawKey);
      if (!SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.includes(key as AssessmentDimensionCode)) {
        continue;
      }

      const normalizedScore = typeof rawValue === 'number' && Number.isInteger(rawValue) && rawValue >= 0 && rawValue <= 4
        ? (rawValue as AssessmentScoreValue)
        : 0;
      dimensionScores[key as AssessmentDimensionCode] = normalizedScore;
    }
  }

  return {
    id,
    label: cleanString(source.label),
    position: isFiniteInteger(source.position) ? source.position : position + 1,
    dimensionScores,
    adminExplanation: cleanString(source.adminExplanation),
  } satisfies AssessmentQuestionOption;
}

function normalizeQuestion(
  input: unknown,
  index: number,
  knownQuestionIds: Set<string>,
  knownQuestionCodes: Set<string>,
) {
  const source = isPlainObject(input) ? input : {};
  let id = cleanString(source.id);
  if (!id || knownQuestionIds.has(id)) {
    id = generateTechnicalId(`question-${index + 1}`);
  }
  knownQuestionIds.add(id);

  let code = cleanString(source.code);
  if (!code || knownQuestionCodes.has(code)) {
    code = `${id}-code`;
  }
  knownQuestionCodes.add(code);

  const rawOptions = Array.isArray(source.options) ? source.options : [];
  const knownOptionIds = new Set<string>();
  const options = rawOptions.length > 0
    ? rawOptions.map((option, optionIndex) => normalizeQuestionOption(option, id, optionIndex, knownOptionIds))
    : [
        {
          id: `${id}-option-1`,
          label: 'Réponse A',
          position: 1,
          dimensionScores: {},
          adminExplanation: '',
        },
        {
          id: `${id}-option-2`,
          label: 'Réponse B',
          position: 2,
          dimensionScores: {},
          adminExplanation: '',
        },
      ];

  return {
    id,
    code,
    assessmentVersionId: cleanString(source.assessmentVersionId),
    path: source.path === 'extended' ? 'extended' : 'essential',
    position: isFiniteInteger(source.position) ? source.position : index + 1,
    situation: cleanString(source.situation),
    instruction: cleanString(source.instruction),
    options,
    primaryDimensionCodes: Array.isArray(source.primaryDimensionCodes)
      ? source.primaryDimensionCodes
          .map((item) => cleanString(item))
          .filter((item): item is AssessmentDimensionCode => SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.includes(item as AssessmentDimensionCode))
      : [],
    secondaryDimensionCodes: Array.isArray(source.secondaryDimensionCodes)
      ? source.secondaryDimensionCodes
          .map((item) => cleanString(item))
          .filter((item): item is AssessmentDimensionCode => SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.includes(item as AssessmentDimensionCode))
      : [],
    difficulty: source.difficulty === 'standard' || source.difficulty === 'advanced' ? source.difficulty : 'introductory',
    estimatedReadingSeconds: isFiniteInteger(source.estimatedReadingSeconds) ? source.estimatedReadingSeconds : 30,
    adminRationale: cleanString(source.adminRationale),
    isActive: typeof source.isActive === 'boolean' ? source.isActive : true,
    humanReviewStatus: normalizeHumanReviewStatus(source.humanReviewStatus),
  } satisfies AssessmentQuestion;
}

function normalizeDimensions(
  input: unknown,
  fallbackDimensions: AssessmentDimensionDefinition[],
) {
  const source = Array.isArray(input) ? input : [];
  const knownCodes = new Set<string>();

  if (source.length === 0) {
    return cloneValue(fallbackDimensions);
  }

  return source.map((dimension, index) => {
    const fallback = fallbackDimensions[index] ?? fallbackDimensions.find((item) => item.code === SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES[index]);
    const raw = isPlainObject(dimension) ? dimension : {};
    const rawCode = cleanString(raw.code);
    const canonicalCode = SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES[index % SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.length];
    const code = rawCode && SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.includes(rawCode as AssessmentDimensionCode)
      ? (rawCode as AssessmentDimensionCode)
      : fallback?.code ?? canonicalCode;
    if (knownCodes.has(code) && fallback?.code && fallback.code !== code) {
      return cloneValue(fallback);
    }
    knownCodes.add(code);

    return {
      code,
      label: cleanString(raw.label) || fallback?.label || '',
      description: cleanString(raw.description) || fallback?.description || '',
      weight: isFiniteInteger(raw.weight) ? raw.weight : (fallback?.weight ?? 0),
      displayOrder: isFiniteInteger(raw.displayOrder) ? raw.displayOrder : (fallback?.displayOrder ?? index + 1),
      minimumEssentialObservations: isFiniteInteger(raw.minimumEssentialObservations) ? raw.minimumEssentialObservations : (fallback?.minimumEssentialObservations ?? 1),
      minimumExtendedObservations: isFiniteInteger(raw.minimumExtendedObservations) ? raw.minimumExtendedObservations : (fallback?.minimumExtendedObservations ?? 1),
      interpretationThresholds: Array.isArray(raw.interpretationThresholds)
        ? cloneValue(raw.interpretationThresholds)
        : cloneValue(fallback?.interpretationThresholds ?? []),
      interviewQuestionIds: Array.isArray(raw.interviewQuestionIds)
        ? raw.interviewQuestionIds.map((item) => cleanString(item)).filter(Boolean)
        : [...(fallback?.interviewQuestionIds ?? [])],
      isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (fallback?.isActive ?? true),
    } satisfies AssessmentDimensionDefinition;
  });
}

function normalizeStoredVersionInput(
  input: StoredVersionInput,
  fallback: SevenoAssessmentStoredVersion,
) {
  const fallbackDimensions = cloneValue(fallback.dimensions);
  const now = new Date().toISOString();
  const dimensions = normalizeDimensions(input.dimensions ?? fallback.dimensions, fallbackDimensions);
  const knownQuestionIds = new Set<string>();
  const knownQuestionCodes = new Set<string>();
  const questions = Array.isArray(input.questions) ? input.questions.map((question, index) => normalizeQuestion(question, index, knownQuestionIds, knownQuestionCodes)) : cloneValue(fallback.questions);
  const alignedQuestions = alignQuestionsToVersionId(questions, fallback.id);
  const essentialQuestionCount = isFiniteInteger(input.essentialQuestionCount) ? input.essentialQuestionCount : alignedQuestions.filter((question) => question.path === 'essential').length;
  const extendedQuestionCount = isFiniteInteger(input.extendedQuestionCount) ? input.extendedQuestionCount : alignedQuestions.filter((question) => question.path === 'extended').length;

  return {
    ...cloneValue(fallback),
    name: cleanString(input.name) || fallback.name,
    description: cleanString(input.description),
    dimensions,
    questions: alignedQuestions,
    essentialQuestionCount,
    extendedQuestionCount,
    estimatedEssentialDurationMinutes: isFiniteInteger(input.estimatedEssentialDurationMinutes)
      ? input.estimatedEssentialDurationMinutes
      : fallback.estimatedEssentialDurationMinutes,
    estimatedExtendedDurationMinutes: isFiniteInteger(input.estimatedExtendedDurationMinutes)
      ? input.estimatedExtendedDurationMinutes
      : fallback.estimatedExtendedDurationMinutes,
    revisionNotes: Array.isArray(input.revisionNotes) ? cleanStringArray(input.revisionNotes) : [...fallback.revisionNotes],
    interviewQuestionCatalog: input.interviewQuestionCatalog ? cleanRecord(input.interviewQuestionCatalog) : fallback.interviewQuestionCatalog,
    createdBy: fallback.createdBy,
    createdAt: fallback.createdAt,
    updatedAt: now,
    publishedAt: fallback.publishedAt,
    archivedAt: fallback.archivedAt,
    sourceVersionId: fallback.sourceVersionId ?? null,
    hasStartedSessions: fallback.hasStartedSessions ?? false,
    scoringEngineVersion: fallback.scoringEngineVersion,
    interpretationEngineVersion: fallback.interpretationEngineVersion,
    legalNoticeVersion: fallback.legalNoticeVersion,
    revisionNumber: fallback.revisionNumber + 1,
    schemaVersion: fallback.schemaVersion ?? PROFESSIONAL_ASSESSMENT_SCHEMA_VERSION,
  } satisfies SevenoAssessmentStoredVersion;
}

function sortVersions(left: SevenoAssessmentStoredVersion, right: SevenoAssessmentStoredVersion) {
  const leftUpdated = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
  const rightUpdated = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
  if (rightUpdated !== leftUpdated) {
    return rightUpdated - leftUpdated;
  }

  return right.version.localeCompare(left.version, 'fr-FR', { numeric: true, sensitivity: 'base' });
}

function collectEngineValidation(version: SevenoAssessmentStoredVersion) {
  const runtimeVersion = toRuntimeVersion(version);
  return validateAssessmentVersion(runtimeVersion, {
    mode: 'edit',
    hasStartedSessions: Boolean(version.hasStartedSessions),
  });
}

export function buildSevenoAssessmentDraftFromJson(jsonText: string) {
  const importedBank = parseSevenoProfessionalAssessmentBankDocument(jsonText);
  return buildSevenoProfessionalAssessmentDraftFromBankDocument(importedBank, {
    createdBy: 'phase-4d-bank-import',
    now: new Date(),
  });
}

function calculateValidationStatus(validation: ReturnType<typeof collectEngineValidation>) {
  const errorCount = validation.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = validation.issues.filter((issue) => issue.severity === 'warning').length;
  return {
    validationStatus: errorCount > 0 ? 'needs_attention' : 'ready',
    errorCount,
    warningCount,
  } as const;
}

function buildSummary(version: SevenoAssessmentStoredVersion): SevenoAssessmentVersionSummary {
  const validation = collectEngineValidation(version);
  const { validationStatus, errorCount, warningCount } = calculateValidationStatus(validation);

  return {
    id: version.id,
    code: version.code,
    version: version.version,
    status: version.status,
    name: version.name,
    questionCount: version.questions.length,
    essentialQuestionCount: version.essentialQuestionCount,
    extendedQuestionCount: version.extendedQuestionCount,
    updatedAt: version.updatedAt,
    publishedAt: version.publishedAt ?? null,
    archivedAt: version.archivedAt ?? null,
    activatedAt: version.activatedAt ?? null,
    generatedPromptVersion: version.generatedPromptVersion,
    essentialPoolSize: version.essentialPoolSize,
    extendedPoolSize: version.extendedPoolSize,
    essentialDrawSize: version.essentialDrawSize,
    extendedDrawSize: version.extendedDrawSize,
    ...(version.sourceVersionId ? { sourceVersionId: version.sourceVersionId } : {}),
    hasStartedSessions: Boolean(version.hasStartedSessions),
    validationStatus,
    errorCount,
    warningCount,
  };
}

function createPreviewResponses(questions: AssessmentQuestion[], versionId: string) {
  return questions
    .filter((question) => question.isActive)
    .map((question, index): AssessmentResponse => ({
      questionId: question.id,
      optionId: question.options[Math.min(question.options.length - 1, index % Math.max(1, question.options.length))]?.id ?? question.options[0]?.id ?? `${question.id}-option-1`,
      answeredAt: new Date(Date.UTC(2026, 6, 18, 10, index, 0, 0)) as unknown as AssessmentResponse['answeredAt'],
      responseOrder: index + 1,
      sessionId: `${versionId}-preview-session`,
    }));
}

export class SevenoProfessionalAssessmentRepositoryError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'SevenoProfessionalAssessmentRepositoryError';
    this.code = code;
    this.status = status;
  }
}

export class SevenoProfessionalAssessmentRepository implements ProfessionalAssessmentAdminRepository {
  private versions: SevenoAssessmentStoredVersion[];

  constructor(seedVersions: SevenoAssessmentStoredVersion[] = [createStoredSeedVersion()]) {
    this.versions = seedVersions.map((version) => cloneValue(version));
  }

  reset(seedVersions: SevenoAssessmentStoredVersion[] = [createStoredSeedVersion()]) {
    this.versions = seedVersions.map((version) => cloneValue(version));
  }

  private findVersionIndex(versionId: string) {
    return this.versions.findIndex((version) => version.id === versionId);
  }

  private requireVersion(versionId: string) {
    const index = this.findVersionIndex(versionId);
    if (index < 0) {
      throw new SevenoProfessionalAssessmentRepositoryError('version_not_found', 404, 'Version introuvable.');
    }

    return { index, version: this.versions[index]! };
  }

  private requireDraftVersion(versionId: string) {
    const entry = this.requireVersion(versionId);
    if (entry.version.status !== 'draft') {
      throw new SevenoProfessionalAssessmentRepositoryError('version_locked', 409, 'Seul un brouillon peut etre modifie.');
    }

    if (entry.version.hasStartedSessions) {
      throw new SevenoProfessionalAssessmentRepositoryError('pilot_version_locked', 409, 'Une version pilote deja utilisee est immuable.');
    }

    return entry;
  }

  private requireExpectedRevisionNumber(expectedRevisionNumber: number | undefined, action: string) {
    if (!Number.isInteger(expectedRevisionNumber) || (expectedRevisionNumber ?? 0) < 1) {
      throw new SevenoProfessionalAssessmentRepositoryError(
        'invalid_revision',
        422,
        `La revision attendue est manquante pour ${action}.`,
      );
    }

    return expectedRevisionNumber;
  }

  private requireRevisionMatch(version: SevenoAssessmentStoredVersion, expectedRevisionNumber: number | undefined, action: string) {
    const expected = this.requireExpectedRevisionNumber(expectedRevisionNumber, action);
    if (version.revisionNumber !== expected) {
      throw new SevenoProfessionalAssessmentRepositoryError(
        'revision_conflict',
        409,
        'Cette version a ete modifiee depuis son ouverture. Rechargez la page avant d enregistrer vos changements.',
      );
    }
  }

  private replaceVersion(versionId: string, nextVersion: SevenoAssessmentStoredVersion) {
    const index = this.findVersionIndex(versionId);
    if (index < 0) {
      throw new SevenoProfessionalAssessmentRepositoryError('version_not_found', 404, 'Version introuvable.');
    }

    this.versions[index] = cloneValue(nextVersion);
    return cloneValue(nextVersion);
  }

  listVersions() {
    return [...this.versions].sort(sortVersions).map((version) => cloneValue(version));
  }

  readVersion(versionId: string) {
    const found = this.versions.find((version) => version.id === versionId);
    return found ? cloneValue(found) : null;
  }

  getDefaultVersionId() {
    const draftVersions = this.versions.filter((version) => version.status === 'draft').sort(sortVersions);
    return draftVersions[0]?.id ?? [...this.versions].sort(sortVersions)[0]?.id ?? null;
  }

  createDraft(options: { sourceVersionId?: string | null; blank?: boolean } = {}) {
    const source = options.sourceVersionId ? this.requireVersion(options.sourceVersionId).version : [...this.versions].sort(sortVersions)[0] ?? buildDefaultBlankVersion();
    const now = new Date().toISOString();
    const nextVersionNumber = incrementVersionNumber([...this.versions].sort(sortVersions)[0]?.version ?? source.version);
    const duplicateSource = cloneValue(source);

    const next: SevenoAssessmentStoredVersion = options.blank
      ? {
          ...createBlankDraftTemplate(source),
          version: nextVersionNumber,
          code: `seveno_professional_assessment_${nextVersionNumber.replaceAll('.', '_')}_${generateTechnicalId('draft').slice(-6)}`,
          createdAt: now,
          updatedAt: now,
          sourceVersionId: source.id,
          hasStartedSessions: false,
          revisionNumber: 1,
          schemaVersion: PROFESSIONAL_ASSESSMENT_SCHEMA_VERSION,
        }
      : {
          ...duplicateSource,
          id: generateTechnicalId('seveno-professional-assessment'),
          code: `seveno_professional_assessment_${nextVersionNumber.replaceAll('.', '_')}_${generateTechnicalId('draft').slice(-6)}`,
          version: nextVersionNumber,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
          archivedAt: null,
          createdBy: 'phase-3-admin-ui',
          sourceVersionId: source.id,
          hasStartedSessions: false,
          revisionNumber: 1,
          schemaVersion: PROFESSIONAL_ASSESSMENT_SCHEMA_VERSION,
          questions: [],
        };

    if (!options.blank) {
      next.questions = alignQuestionsToVersionId(duplicateSource.questions, next.id);
    }

    this.versions.push(next);
    return cloneValue(next);
  }

  duplicateVersion(versionId: string) {
    return this.createDraft({ sourceVersionId: versionId });
  }

  updateDraft(versionId: string, input: StoredVersionInput) {
    const { version } = this.requireDraftVersion(versionId);
    this.requireRevisionMatch(version, input.revisionNumber, 'la sauvegarde du brouillon');
    const next = normalizeStoredVersionInput(input, version);
    return this.replaceVersion(versionId, next);
  }

  deleteUnusedDraft(versionId: string, expectedRevisionNumber?: number) {
    const { version, index } = this.requireDraftVersion(versionId);
    this.requireRevisionMatch(version, expectedRevisionNumber, 'la suppression du brouillon');
    if (version.hasStartedSessions) {
      throw new SevenoProfessionalAssessmentRepositoryError('draft_in_use', 409, 'Ce brouillon a deja ete utilise et ne peut pas etre supprime.');
    }

    this.versions.splice(index, 1);
  }

  validateDraft(versionId: string) {
    const { version } = this.requireVersion(versionId);
    return collectEngineValidation(version);
  }

  markAsPilot(versionId: string, expectedRevisionNumber?: number) {
    const { version } = this.requireDraftVersion(versionId);
    this.requireRevisionMatch(version, expectedRevisionNumber, 'le passage en pilote');
    const validation = this.validateDraft(versionId);
    if (validation.issues.some((issue) => issue.severity === 'error')) {
      throw new SevenoProfessionalAssessmentRepositoryError('pilot_validation_failed', 422, 'Le brouillon doit etre corrige avant le passage en pilote.');
    }

    const now = new Date().toISOString();
    return this.replaceVersion(versionId, {
      ...cloneValue(version),
      status: 'pilot',
      updatedAt: now,
      publishedAt: null,
      archivedAt: null,
      revisionNumber: version.revisionNumber + 1,
    });
  }

  publishVersion(versionId: string, expectedRevisionNumber?: number) {
    const { version } = this.requireVersion(versionId);
    if (version.status !== 'pilot') {
      throw new SevenoProfessionalAssessmentRepositoryError('publish_requires_pilot', 409, 'Seule une version pilote peut etre publiee.');
    }

    this.requireRevisionMatch(version, expectedRevisionNumber, 'la publication');
    const validation = this.validateDraft(versionId);
    if (validation.issues.some((issue) => issue.severity === 'error')) {
      throw new SevenoProfessionalAssessmentRepositoryError('publish_validation_failed', 422, 'La version doit etre corrigee avant publication.');
    }

    const now = new Date().toISOString();
    const nextActiveVersion: SevenoAssessmentStoredVersion = {
      ...cloneValue(version),
      status: 'active',
      updatedAt: now,
      publishedAt: now,
      archivedAt: null,
      revisionNumber: version.revisionNumber + 1,
    };

    this.versions = this.versions.map((current) => {
      if (current.id === versionId) {
        return cloneValue(nextActiveVersion);
      }

      if (current.status !== 'active') {
        return current;
      }

      return {
        ...cloneValue(current),
        status: 'archived',
        archivedAt: now,
        updatedAt: now,
        revisionNumber: current.revisionNumber + 1,
      };
    });

    return cloneValue(nextActiveVersion);
  }

  archiveVersion(versionId: string, expectedRevisionNumber?: number) {
    const { version } = this.requireVersion(versionId);
    this.requireRevisionMatch(version, expectedRevisionNumber, 'l archivage');
    const now = new Date().toISOString();
    return this.replaceVersion(versionId, {
      ...cloneValue(version),
      status: 'archived',
      updatedAt: now,
      archivedAt: now,
      revisionNumber: version.revisionNumber + 1,
    });
  }

  markVersionUsed(versionId: string) {
    const { version } = this.requireVersion(versionId);
    return this.replaceVersion(versionId, {
      ...cloneValue(version),
      hasStartedSessions: true,
      updatedAt: new Date().toISOString(),
      revisionNumber: version.revisionNumber + 1,
    });
  }

  importDraftFromJson(jsonText: string) {
    const imported = buildSevenoAssessmentDraftFromJson(jsonText);

    const validation = collectEngineValidation(imported);
    if (validation.issues.some((issue) => issue.severity === 'error')) {
      throw new AssessmentModelError('Le JSON importé ne respecte pas le modèle Phase 4D.', validation.issues);
    }

    this.versions.push(imported);
    return cloneValue(imported);
  }

  buildPrompt(versionId: string) {
    const version = this.requireVersion(versionId).version;
    return buildSevenoProfessionalAssessmentBankPrompt(toRuntimeVersion(version));
  }

  buildPreview(versionId: string, mode: SevenoAssessmentPreviewMode): SevenoAssessmentPreviewPayload {
    const version = this.requireVersion(versionId).version;
    const runtimeVersion = toRuntimeVersion(version);
    const previewPath = mode === 'complementary' ? 'extended' : mode;
    const questions = previewPath === 'essential'
      ? runtimeVersion.questions.filter((question) => question.path === 'essential')
      : runtimeVersion.questions;
    const responses = createPreviewResponses(questions, version.id);

    const outcome = calculateProfessionalAssessmentOutcome({
      version: runtimeVersion,
      completedPath: previewPath,
      questions,
      responses,
    });

    const report = outcome.report;

    return {
      mode,
      questionCount: questions.length,
      report,
      candidateProjection: projectAssessmentReportForCandidate(report),
      companyProjection: projectAssessmentReportForCompany(report),
    };
  }
}

type FirestoreAssessmentVersionDocument = Omit<SevenoAssessmentStoredVersion, 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt' | 'activatedAt'> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt: Timestamp | null;
  archivedAt: Timestamp | null;
  activatedAt: Timestamp | null;
};

function toTimestamp(value: SevenoAssessmentStoredDate) {
  if (!value) {
    return Timestamp.now();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Timestamp.now() : Timestamp.fromDate(date);
}

function fromFirestoreVersionDocument(data: unknown): SevenoAssessmentStoredVersion | null {
  if (!isPlainObject(data)) {
    return null;
  }

  const createdAt = toIsoDate(data.createdAt) ?? new Date().toISOString();
  const updatedAt = toIsoDate(data.updatedAt) ?? createdAt;
  const publishedAt = toIsoDate(data.publishedAt);
  const archivedAt = toIsoDate(data.archivedAt);
  const revisionNumber = isFiniteInteger(data.revisionNumber) && data.revisionNumber > 0 ? data.revisionNumber : 1;
  const schemaVersion = isFiniteInteger(data.schemaVersion) && data.schemaVersion > 0 ? data.schemaVersion : PROFESSIONAL_ASSESSMENT_SCHEMA_VERSION;

  return {
    id: cleanString(data.id),
    code: cleanString(data.code),
    version: cleanString(data.version),
    status: data.status === 'draft' || data.status === 'pilot' || data.status === 'active' || data.status === 'archived' ? data.status : 'draft',
    name: cleanString(data.name),
    description: cleanString(data.description),
    createdAt,
    updatedAt,
    publishedAt,
    archivedAt,
    createdBy: cleanString(data.createdBy),
    dimensions: Array.isArray(data.dimensions) ? cloneValue(data.dimensions) : [],
    questions: Array.isArray(data.questions) ? cloneValue(data.questions) : [],
    essentialQuestionCount: isFiniteInteger(data.essentialQuestionCount) ? data.essentialQuestionCount : 0,
    extendedQuestionCount: isFiniteInteger(data.extendedQuestionCount) ? data.extendedQuestionCount : 0,
    estimatedEssentialDurationMinutes: isFiniteInteger(data.estimatedEssentialDurationMinutes) ? data.estimatedEssentialDurationMinutes : 0,
    estimatedExtendedDurationMinutes: isFiniteInteger(data.estimatedExtendedDurationMinutes) ? data.estimatedExtendedDurationMinutes : 0,
    scoringEngineVersion: cleanString(data.scoringEngineVersion),
    interpretationEngineVersion: cleanString(data.interpretationEngineVersion),
    legalNoticeVersion: cleanString(data.legalNoticeVersion),
    activatedAt: toIsoDate(data.activatedAt),
    generatedPromptVersion: cleanNullableString(data.generatedPromptVersion) ?? 'seveno_professional_assessment_bank_v1',
    essentialPoolSize: isFiniteInteger(data.essentialPoolSize) ? data.essentialPoolSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
    extendedPoolSize: isFiniteInteger(data.extendedPoolSize) ? data.extendedPoolSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
    essentialDrawSize: isFiniteInteger(data.essentialDrawSize) ? data.essentialDrawSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
    extendedDrawSize: isFiniteInteger(data.extendedDrawSize) ? data.extendedDrawSize : SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
    revisionNotes: Array.isArray(data.revisionNotes) ? cleanStringArray(data.revisionNotes) : [],
    revisionNumber,
    schemaVersion,
    ...(isPlainObject(data.interviewQuestionCatalog) ? { interviewQuestionCatalog: cleanRecord(data.interviewQuestionCatalog) } : {}),
    ...(cleanNullableString(data.sourceVersionId) ? { sourceVersionId: cleanNullableString(data.sourceVersionId) } : {}),
    hasStartedSessions: typeof data.hasStartedSessions === 'boolean' ? data.hasStartedSessions : false,
  };
}

function toFirestoreVersionDocument(version: SevenoAssessmentStoredVersion): FirestoreAssessmentVersionDocument {
  return {
    ...cloneValue(version),
    createdAt: toTimestamp(version.createdAt),
    updatedAt: toTimestamp(version.updatedAt),
    publishedAt: version.publishedAt ? toTimestamp(version.publishedAt) : null,
    archivedAt: version.archivedAt ? toTimestamp(version.archivedAt) : null,
    activatedAt: version.activatedAt ? toTimestamp(version.activatedAt) : null,
    sourceVersionId: version.sourceVersionId ?? null,
    hasStartedSessions: Boolean(version.hasStartedSessions),
    revisionNumber: version.revisionNumber,
    schemaVersion: version.schemaVersion,
  };
}

function isSevenoProfessionalAssessmentFirestoreRepositoryEnabled() {
  assertLocalFirestoreRepositoryCanStart();
  return process.env[PROFESSIONAL_ASSESSMENT_REPOSITORY_STORE_ENV] === 'firestore'
    && isFirebaseAdminConfigured
    && Boolean(adminDb)
    && (process.env.NODE_ENV === 'production' || Boolean(getFirestoreEmulatorHost()));
}

export class FirestoreProfessionalAssessmentRepository implements ProfessionalAssessmentAdminRepository {
  private readonly db = adminDb;

  private readonly collectionRef = this.db ? this.db.collection(PROFESSIONAL_ASSESSMENT_VERSIONS_COLLECTION) : null;

  constructor() {
    assertLocalFirestoreRepositoryCanStart();
    if (!this.db || !this.collectionRef) {
      throw new SevenoProfessionalAssessmentRepositoryError(
        'firebase_admin_missing',
        500,
        'La persistance Firestore de l assessment professionnel n est pas configuree.',
      );
    }
  }

  private requireCollectionRef() {
    if (!this.collectionRef) {
      throw new SevenoProfessionalAssessmentRepositoryError(
        'firebase_admin_missing',
        500,
        'La persistance Firestore de l assessment professionnel n est pas configuree.',
      );
    }

    return this.collectionRef;
  }

  private async loadAllVersions(transaction?: Transaction) {
    const ref = this.requireCollectionRef();
    const snapshot = transaction
      ? await transaction.get(ref)
      : await ref.get();

    const versions: SevenoAssessmentStoredVersion[] = [];
    for (const document of snapshot.docs) {
      const version = fromFirestoreVersionDocument(document.data());
      if (!version) {
        throw new SevenoProfessionalAssessmentRepositoryError('invalid_firestore_document', 500, 'Un document Firestore de version est invalide.');
      }

      versions.push(version);
    }

    return versions;
  }

  private async loadVersion(versionId: string, transaction?: Transaction) {
    const ref = this.requireCollectionRef().doc(versionId);
    const snapshot = transaction ? await transaction.get(ref) : await ref.get();
    if (!snapshot.exists) {
      return null;
    }

    return fromFirestoreVersionDocument(snapshot.data());
  }

  private async persistVersions(transaction: Transaction, previousVersions: SevenoAssessmentStoredVersion[], nextVersions: SevenoAssessmentStoredVersion[]) {
    const ref = this.requireCollectionRef();
    const previousIds = new Set(previousVersions.map((version) => version.id));
    const nextIds = new Set(nextVersions.map((version) => version.id));

    for (const previousId of previousIds) {
      if (!nextIds.has(previousId)) {
        transaction.delete(ref.doc(previousId));
      }
    }

    for (const version of nextVersions) {
      transaction.set(ref.doc(version.id), toFirestoreVersionDocument(version));
    }
  }

  private async withRepository<T>(mutator: (repository: SevenoProfessionalAssessmentRepository) => MaybePromise<T>) {
    const db = this.db;
    if (!db) {
      throw new SevenoProfessionalAssessmentRepositoryError('firebase_admin_missing', 500, 'La persistance Firestore de l assessment professionnel n est pas configuree.');
    }

    return await db.runTransaction(async (transaction) => {
      const previousVersions = await this.loadAllVersions(transaction);
      const repository = new SevenoProfessionalAssessmentRepository(previousVersions);
      const result = await mutator(repository);
      const nextVersions = repository.listVersions();
      await this.persistVersions(transaction, previousVersions, nextVersions);
      return result;
    });
  }

  async listVersions() {
    const versions = await this.loadAllVersions();
    return [...versions].sort(sortVersions).map((version) => cloneValue(version));
  }

  async readVersion(versionId: string) {
    const version = await this.loadVersion(versionId);
    return version ? cloneValue(version) : null;
  }

  async getDefaultVersionId() {
    const versions = await this.listVersions();
    const draftVersions = versions.filter((version) => version.status === 'draft').sort(sortVersions);
    return draftVersions[0]?.id ?? versions[0]?.id ?? null;
  }

  async createDraft(options: { sourceVersionId?: string | null; blank?: boolean } = {}) {
    return await this.withRepository(async (repository) => repository.createDraft(options));
  }

  async duplicateVersion(versionId: string) {
    return await this.withRepository(async (repository) => repository.duplicateVersion(versionId));
  }

  async updateDraft(versionId: string, input: StoredVersionInput) {
    return await this.withRepository(async (repository) => repository.updateDraft(versionId, input));
  }

  async deleteUnusedDraft(versionId: string, expectedRevisionNumber?: number) {
    await this.withRepository(async (repository) => {
      repository.deleteUnusedDraft(versionId, expectedRevisionNumber);
      return null;
    });
  }

  async validateDraft(versionId: string) {
    const version = await this.readVersion(versionId);
    if (!version) {
      throw new SevenoProfessionalAssessmentRepositoryError('version_not_found', 404, 'Version introuvable.');
    }

    const repository = new SevenoProfessionalAssessmentRepository([version]);
    return repository.validateDraft(versionId);
  }

  async markAsPilot(versionId: string, expectedRevisionNumber?: number) {
    return await this.withRepository(async (repository) => repository.markAsPilot(versionId, expectedRevisionNumber));
  }

  async publishVersion(versionId: string, expectedRevisionNumber?: number) {
    return await this.withRepository(async (repository) => repository.publishVersion(versionId, expectedRevisionNumber));
  }

  async archiveVersion(versionId: string, expectedRevisionNumber?: number) {
    return await this.withRepository(async (repository) => repository.archiveVersion(versionId, expectedRevisionNumber));
  }

  async markVersionUsed(versionId: string) {
    return await this.withRepository(async (repository) => repository.markVersionUsed(versionId));
  }

  async importDraftFromJson(jsonText: string) {
    return await this.withRepository(async (repository) => repository.importDraftFromJson(jsonText));
  }

  async buildPrompt(versionId: string) {
    const version = await this.readVersion(versionId);
    if (!version) {
      throw new SevenoProfessionalAssessmentRepositoryError('version_not_found', 404, 'Version introuvable.');
    }

    return new SevenoProfessionalAssessmentRepository([version]).buildPrompt(versionId);
  }

  async buildPreview(versionId: string, mode: SevenoAssessmentPreviewMode) {
    const version = await this.readVersion(versionId);
    if (!version) {
      throw new SevenoProfessionalAssessmentRepositoryError('version_not_found', 404, 'Version introuvable.');
    }

    return new SevenoProfessionalAssessmentRepository([version]).buildPreview(versionId, mode);
  }
}

let defaultMemoryRepository: SevenoProfessionalAssessmentRepository | null = null;
let defaultFirestoreRepository: FirestoreProfessionalAssessmentRepository | null = null;

export function getSevenoProfessionalAssessmentRepository() {
  if (isSevenoProfessionalAssessmentFirestoreRepositoryEnabled()) {
    defaultFirestoreRepository ??= new FirestoreProfessionalAssessmentRepository();
    return defaultFirestoreRepository;
  }

  defaultMemoryRepository ??= new SevenoProfessionalAssessmentRepository([createStoredSeedVersion()]);
  return defaultMemoryRepository;
}

export function resetSevenoProfessionalAssessmentRepository(seedVersions: SevenoAssessmentStoredVersion[] = [createStoredSeedVersion()]) {
  defaultMemoryRepository = new SevenoProfessionalAssessmentRepository(seedVersions);
  return defaultMemoryRepository;
}

export function createSevenoProfessionalAssessmentSeedVersion() {
  return createStoredSeedVersion();
}

export function serializeSevenoProfessionalAssessmentVersionSummary(version: SevenoAssessmentStoredVersion): SevenoAssessmentVersionSummary {
  return buildSummary(version);
}

export function serializeSevenoProfessionalAssessmentStoredVersion(version: SevenoAssessmentStoredVersion) {
  return cloneValue(version);
}

export function buildSevenoProfessionalAssessmentPreview(
  repository: ProfessionalAssessmentAdminRepository,
  versionId: string,
  mode: SevenoAssessmentPreviewMode,
) {
  return repository.buildPreview(versionId, mode);
}

export function buildSevenoProfessionalAssessmentPrompt(
  repository: ProfessionalAssessmentAdminRepository,
  versionId: string,
) {
  return repository.buildPrompt(versionId);
}

export function isSevenoProfessionalAssessmentFirestoreRepositoryEnabledFlag() {
  return isSevenoProfessionalAssessmentFirestoreRepositoryEnabled();
}
