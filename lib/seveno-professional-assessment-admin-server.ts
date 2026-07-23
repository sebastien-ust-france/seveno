import 'server-only';

import {
  buildSevenoAssessmentDraftFromJson,
  getSevenoProfessionalAssessmentRepository,
  SevenoProfessionalAssessmentRepository,
  SevenoProfessionalAssessmentRepositoryError,
  serializeSevenoProfessionalAssessmentStoredVersion,
  serializeSevenoProfessionalAssessmentVersionSummary,
} from '@/lib/seveno-professional-assessment-admin-repository';
import { AssessmentModelError } from '@/lib/seveno-professional-assessment';
import { buildSevenoAssessmentReviewManifest } from '@/lib/seveno-professional-assessment-review';
import {
  buildSevenoProfessionalAssessmentBankDraw,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
  SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
} from '@/lib/seveno-professional-assessment-bank';
import type {
  SevenoAssessmentCandidatePreviewPayload,
  SevenoAssessmentActionResponse,
  SevenoAssessmentEditorPayload,
  SevenoAssessmentPreviewMode,
  SevenoAssessmentStoredVersion,
} from '@/types/seveno-assessment-admin';
import type { AssessmentVersionDescriptor } from '@/types/seveno-assessment';
import type {
  SevenoProfessionalAssessmentBankDocument,
  SevenoProfessionalAssessmentBankQuestion,
} from '@/lib/seveno-professional-assessment-bank';
import type { SevenoAdminSession } from '@/lib/seveno-admin-auth';
import type { ProfessionalAssessmentAdminRepository } from '@/lib/seveno-professional-assessment-admin-repository';

export class SevenoAssessmentAdminError extends Error {
  code: string;

  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'SevenoAssessmentAdminError';
    this.code = code;
    this.status = status;
  }
}

function assertAdminSession(session: SevenoAdminSession | null | undefined) {
  if (!session) {
    throw new SevenoAssessmentAdminError('auth_required', 401, 'Connexion admin requise.');
  }

  if (session.user.role !== 'admin') {
    throw new SevenoAssessmentAdminError('forbidden_role', 403, 'Acces admin refuse.');
  }

  return session;
}

function getRepository(repository?: ProfessionalAssessmentAdminRepository) {
  return repository ?? getSevenoProfessionalAssessmentRepository();
}

async function buildPayload(
  repository: ProfessionalAssessmentAdminRepository,
  selectedVersionId?: string | null,
): Promise<SevenoAssessmentEditorPayload> {
  const versions = (await repository.listVersions()).map((version) => serializeSevenoProfessionalAssessmentVersionSummary(version));
  const selectedId = selectedVersionId ?? await repository.getDefaultVersionId();
  const selectedVersion = selectedId ? await repository.readVersion(selectedId) : null;
  const validation = selectedVersion ? await repository.validateDraft(selectedVersion.id) : null;
  const prompt = selectedVersion ? await repository.buildPrompt(selectedVersion.id) : null;
  const reviewManifest = selectedVersion ? buildSevenoAssessmentReviewManifest(toReviewManifestVersion(selectedVersion)) : null;

  return {
    versions,
    selectedVersion: selectedVersion ? serializeSevenoProfessionalAssessmentStoredVersion(selectedVersion) : null,
    validation,
    prompt,
    preview: null,
    reviewManifest,
  };
}

function wrapResponse(payload: SevenoAssessmentEditorPayload, message?: string): SevenoAssessmentActionResponse {
  return {
    payload,
    ...(message ? { message } : {}),
  };
}

function createRepositoryFromVersion(version: SevenoAssessmentStoredVersion) {
  return new SevenoProfessionalAssessmentRepository([version]);
}

function toPreviewBankQuestion(question: SevenoAssessmentStoredVersion['questions'][number]): SevenoProfessionalAssessmentBankQuestion {
  return {
    questionId: question.id,
    path: question.path,
    situation: question.situation,
    instruction: question.instruction,
    primaryDimensionCodes: [...question.primaryDimensionCodes],
    ...(question.secondaryDimensionCodes?.length ? { secondaryDimensionCode: question.secondaryDimensionCodes[0] } : {}),
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      order: option.position,
      dimensionScores: { ...option.dimensionScores },
      adminExplanation: option.adminExplanation,
    })),
    adminRationale: question.adminRationale,
    difficulty: question.difficulty,
  };
}

function buildPreviewBankDocumentFromVersion(version: SevenoAssessmentStoredVersion): SevenoProfessionalAssessmentBankDocument {
  return {
    versionMetadata: {
      name: version.name,
      version: version.version,
      description: version.description,
      generatedPromptVersion: version.generatedPromptVersion ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_PROMPT_VERSION,
      essentialPoolSize: version.essentialPoolSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_POOL_SIZE,
      extendedPoolSize: version.extendedPoolSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_POOL_SIZE,
      essentialDrawSize: version.essentialDrawSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_ESSENTIAL_DRAW_SIZE,
      extendedDrawSize: version.extendedDrawSize ?? SEVENO_PROFESSIONAL_ASSESSMENT_BANK_DEFAULT_EXTENDED_DRAW_SIZE,
    },
    essentialQuestionPool: version.questions.filter((question) => question.path === 'essential' && question.isActive !== false).map((question) => toPreviewBankQuestion(question)),
    extendedQuestionPool: version.questions.filter((question) => question.path === 'extended' && question.isActive !== false).map((question) => toPreviewBankQuestion(question)),
    dimensionConfigurations: version.dimensions.map((dimension) => ({
      code: dimension.code,
      label: dimension.label,
      description: dimension.description,
      weight: dimension.weight,
      displayOrder: dimension.displayOrder,
      minimumEssentialObservations: dimension.minimumEssentialObservations,
      minimumExtendedObservations: dimension.minimumExtendedObservations,
      isActive: dimension.isActive,
    })),
    interpretationBlocks: [],
    interviewQuestions: [],
  };
}

function toReviewManifestVersion(version: SevenoAssessmentStoredVersion): AssessmentVersionDescriptor {
  return version as unknown as AssessmentVersionDescriptor;
}

export async function loadSevenoAssessmentEditorState(
  session: SevenoAdminSession | null | undefined,
  selectedVersionId?: string | null,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  return await buildPayload(getRepository(repository), selectedVersionId);
}

export async function readSevenoAssessmentVersion(
  session: SevenoAdminSession | null | undefined,
  versionId: string,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  return await buildPayload(getRepository(repository), versionId);
}

export async function createSevenoAssessmentBlankDraft(
  session: SevenoAdminSession | null | undefined,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  const version = await repo.createDraft({ blank: true });
  return await buildPayload(repo, version.id);
}

export async function duplicateSevenoAssessmentVersion(
  session: SevenoAdminSession | null | undefined,
  versionId: string,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  const version = await repo.duplicateVersion(versionId);
  return await buildPayload(repo, version.id);
}

export async function updateSevenoAssessmentDraft(
  session: SevenoAdminSession | null | undefined,
  versionId: string,
  version: SevenoAssessmentStoredVersion,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  const savedVersion = await repo.updateDraft(versionId, version);
  return await buildPayload(repo, savedVersion.id);
}

export async function deleteSevenoAssessmentUnusedDraft(
  session: SevenoAdminSession | null | undefined,
  versionId: string,
  expectedRevisionNumber?: number,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  await repo.deleteUnusedDraft(versionId, expectedRevisionNumber);
  return await buildPayload(repo, null);
}

export async function validateSevenoAssessmentDraft(
  session: SevenoAdminSession | null | undefined,
  version: SevenoAssessmentStoredVersion,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = createRepositoryFromVersion(version);
  return wrapResponse({
    versions: (await getRepository(repository).listVersions()).map((item) => serializeSevenoProfessionalAssessmentVersionSummary(item)),
    selectedVersion: serializeSevenoProfessionalAssessmentStoredVersion(version),
    validation: await repo.validateDraft(version.id),
    prompt: await repo.buildPrompt(version.id),
    preview: null,
    reviewManifest: buildSevenoAssessmentReviewManifest(toReviewManifestVersion(version)),
  }, 'Brouillon vérifié.');
}

export async function generateSevenoAssessmentPrompt(
  session: SevenoAdminSession | null | undefined,
  version: SevenoAssessmentStoredVersion,
) {
  assertAdminSession(session);
  const repo = createRepositoryFromVersion(version);
  return wrapResponse({
    versions: [],
    selectedVersion: serializeSevenoProfessionalAssessmentStoredVersion(version),
    validation: await repo.validateDraft(version.id),
    prompt: await repo.buildPrompt(version.id),
    preview: null,
    reviewManifest: buildSevenoAssessmentReviewManifest(toReviewManifestVersion(version)),
  });
}

export async function previewSevenoAssessmentVersion(
  session: SevenoAdminSession | null | undefined,
  version: SevenoAssessmentStoredVersion,
  mode: SevenoAssessmentPreviewMode,
) {
  assertAdminSession(session);
  const repo = createRepositoryFromVersion(version);
  const preview = await repo.buildPreview(version.id, mode);
  return wrapResponse({
    versions: [],
    selectedVersion: serializeSevenoProfessionalAssessmentStoredVersion(version),
    validation: await repo.validateDraft(version.id),
    prompt: await repo.buildPrompt(version.id),
    preview,
    reviewManifest: buildSevenoAssessmentReviewManifest(toReviewManifestVersion(version)),
  });
}

export async function previewSevenoAssessmentCandidateVersion(
  session: SevenoAdminSession | null | undefined,
  version: SevenoAssessmentStoredVersion,
  drawSeed?: string | null,
) {
  assertAdminSession(session);
  const bankDocument = buildPreviewBankDocumentFromVersion(version);
  const seed = drawSeed?.trim() || `${version.code}:${version.version}:${version.revisionNumber}:${version.id}`;
  const draw = buildSevenoProfessionalAssessmentBankDraw(bankDocument, seed);

  const preview: SevenoAssessmentCandidatePreviewPayload = {
    versionId: version.id,
    versionCode: version.code,
    versionName: version.name,
    drawSeed: seed,
    questionCount: draw.essentialQuestions.length + draw.extendedQuestions.length,
    essentialQuestionCount: draw.essentialQuestions.length,
    extendedQuestionCount: draw.extendedQuestions.length,
    essentialQuestionIds: [...draw.essentialQuestionIds],
    extendedQuestionIds: [...draw.extendedQuestionIds],
  };

  return { preview };
}

export async function markSevenoAssessmentAsPilot(
  session: SevenoAdminSession | null | undefined,
  versionId: string,
  expectedRevisionNumber?: number,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  await repo.markAsPilot(versionId, expectedRevisionNumber);
  return await buildPayload(repo, versionId);
}

export async function publishSevenoAssessmentVersion(
  session: SevenoAdminSession | null | undefined,
  versionId: string,
  expectedRevisionNumber?: number,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  await repo.publishVersion(versionId, expectedRevisionNumber);
  return await buildPayload(repo, versionId);
}

export async function archiveSevenoAssessmentVersion(
  session: SevenoAdminSession | null | undefined,
  versionId: string,
  expectedRevisionNumber?: number,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  await repo.archiveVersion(versionId, expectedRevisionNumber);
  return await buildPayload(repo, versionId);
}

export async function importSevenoAssessmentVersion(
  session: SevenoAdminSession | null | undefined,
  jsonText: string,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  const version = await repo.importDraftFromJson(jsonText);
  return await buildPayload(repo, version.id);
}

export async function analyzeSevenoAssessmentImportJson(
  session: SevenoAdminSession | null | undefined,
  jsonText: string,
  repository?: ProfessionalAssessmentAdminRepository,
) {
  assertAdminSession(session);
  const repo = getRepository(repository);
  const version = buildSevenoAssessmentDraftFromJson(jsonText);
  const temporaryRepository = new SevenoProfessionalAssessmentRepository([version]);

  return wrapResponse({
    versions: (await repo.listVersions()).map((item) => serializeSevenoProfessionalAssessmentVersionSummary(item)),
    selectedVersion: serializeSevenoProfessionalAssessmentStoredVersion(version),
    validation: await temporaryRepository.validateDraft(version.id),
    prompt: await temporaryRepository.buildPrompt(version.id),
    preview: null,
    reviewManifest: buildSevenoAssessmentReviewManifest(toReviewManifestVersion(version)),
  }, 'JSON analysé.');
}

export function handleSevenoAssessmentRepositoryError(error: unknown) {
  if (error instanceof AssessmentModelError) {
    return {
      status: 422,
      body: {
        error: 'invalid_json',
        message: error.message,
        issues: error.issues,
      },
    } as const;
  }

  if (error instanceof SevenoAssessmentAdminError || error instanceof SevenoProfessionalAssessmentRepositoryError) {
    return {
      status: error.status,
      body: {
        error: error.code,
        message: error.message,
      },
    } as const;
  }

  return {
    status: 500,
    body: {
      error: 'unexpected_error',
      message: 'Une erreur inattendue est survenue.',
    },
  } as const;
}
