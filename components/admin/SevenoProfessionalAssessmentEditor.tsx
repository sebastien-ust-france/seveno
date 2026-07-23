'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminSectionNav from '@/components/admin/AdminSectionNav';
import ProfessionalAssessmentCandidatePreview from '@/components/admin/seveno-assessment-preview/ProfessionalAssessmentCandidatePreview';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { SevenoAdminApiError, fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import { SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES } from '@/lib/seveno-professional-assessment';
import { getReviewStatusLabel } from '@/lib/seveno-professional-assessment-review';
import type {
  SevenoAssessmentCandidatePreviewPayload,
  SevenoAssessmentActionResponse,
  SevenoAssessmentEditorPayload,
  SevenoAssessmentPreviewMode,
  SevenoAssessmentPreviewPayload,
  SevenoAssessmentStoredVersion,
  SevenoAssessmentVersionSummary,
} from '@/types/seveno-assessment-admin';
import type {
  AssessmentDimensionCode,
  AssessmentQuestion,
  AssessmentQuestionOption,
  AssessmentValidationIssue,
  AssessmentValidationResult,
} from '@/types/seveno-assessment';
import type { SevenoAssessmentReviewManifest } from '@/types/seveno-assessment-review';

const STEP_TABS = [
  { id: 'presentation', label: 'Présentation' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'questions', label: 'Questions' },
  { id: 'verification', label: 'Vérification' },
] as const;

const CONTRIBUTION_LEVELS = [
  { value: 0, label: 'Très faible' },
  { value: 1, label: 'Faible' },
  { value: 2, label: 'Intermédiaire' },
  { value: 3, label: 'Solide' },
  { value: 4, label: 'Forte' },
] as const;

const QUESTION_DIFFICULTIES = [
  { value: 'introductory', label: 'Introduction' },
  { value: 'standard', label: 'Standard' },
  { value: 'advanced', label: 'Avancée' },
] as const;

type EditorStep = (typeof STEP_TABS)[number]['id'];
type ReviewQuestionRecord = SevenoAssessmentReviewManifest['questions'][number];
type ReviewSeriesRecord = SevenoAssessmentReviewManifest['reviewSeries'][number];

function cloneVersion<T extends SevenoAssessmentStoredVersion | null | undefined>(value: T): T {
  if (!value) {
    return value;
  }

  return structuredClone(value);
}

function createTechnicalId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 11)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Non disponible';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Non disponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatStatusLabel(value: SevenoAssessmentVersionSummary['status']) {
  switch (value) {
    case 'draft':
      return 'Brouillon';
    case 'pilot':
      return 'Pilote';
    case 'active':
      return 'Active';
    case 'archived':
      return 'Archivée';
    default:
      return value;
  }
}

function formatValidationState(validation: AssessmentValidationResult | null) {
  if (!validation) {
    return { label: 'À vérifier', tone: 'neutral' as const };
  }

  const errors = validation.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning').length;

  if (errors === 0 && warnings === 0) {
    return { label: 'Prêt', tone: 'cyan' as const };
  }

  if (errors > 0) {
    return { label: 'À corriger', tone: 'orange' as const };
  }

  return { label: 'À vérifier', tone: 'violet' as const };
}

function contributionLabel(value: number | undefined) {
  return CONTRIBUTION_LEVELS.find((item) => item.value === value)?.label ?? 'Non défini';
}

function buildDefaultOption(questionId: string, optionIndex: number, primaryDimension: string, secondaryDimension?: string) {
  const scores: Record<string, number> = {};
  if (primaryDimension) {
    scores[primaryDimension] = optionIndex === 0 ? 0 : optionIndex === 1 ? 2 : optionIndex === 2 ? 3 : 4;
  }
  if (secondaryDimension) {
    scores[secondaryDimension] = optionIndex === 0 ? 1 : optionIndex === 1 ? 0 : optionIndex === 2 ? 2 : 3;
  }

  return {
    id: `${questionId}-option-${optionIndex + 1}-${createTechnicalId('opt').slice(-6)}`,
    label: `Réponse ${String.fromCharCode(65 + optionIndex)}`,
    position: optionIndex + 1,
    dimensionScores: scores,
    adminExplanation: `Explication interne de la réponse ${String.fromCharCode(65 + optionIndex)}.`,
  } satisfies AssessmentQuestionOption;
}

function buildNewQuestionTemplate(version: SevenoAssessmentStoredVersion): AssessmentQuestion {
  const activeDimensionCodes = version.dimensions.filter((dimension) => dimension.isActive).map((dimension) => dimension.code);
  const primaryDimension = activeDimensionCodes[0] ?? version.dimensions[0]?.code ?? '';
  const secondaryDimension = activeDimensionCodes[1] ?? activeDimensionCodes[0] ?? '';
  const questionId = `${version.id}-question-${version.questions.length + 1}-${createTechnicalId('q').slice(-6)}`;

  return {
    id: questionId,
    code: `q-${version.questions.length + 1}-${createTechnicalId('code').slice(-5)}`,
    assessmentVersionId: version.id,
    path: 'essential',
    position: version.questions.length + 1,
    situation: 'Situation professionnelle à compléter.',
    instruction: 'Instruction donnée au candidat.',
    options: [
      buildDefaultOption(questionId, 0, primaryDimension, secondaryDimension || undefined),
      buildDefaultOption(questionId, 1, primaryDimension, secondaryDimension || undefined),
      buildDefaultOption(questionId, 2, primaryDimension, secondaryDimension || undefined),
      buildDefaultOption(questionId, 3, primaryDimension, secondaryDimension || undefined),
    ],
    primaryDimensionCodes: primaryDimension ? [primaryDimension] : [],
    secondaryDimensionCodes: secondaryDimension && secondaryDimension !== primaryDimension ? [secondaryDimension] : [],
    difficulty: 'introductory',
    estimatedReadingSeconds: 30,
    adminRationale: 'Justification interne à compléter.',
    isActive: true,
  };
}

function buildNewOptionTemplate(question: AssessmentQuestion, index: number) {
  const dimensionCodes = [...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])];
  return buildDefaultOption(question.id, index, dimensionCodes[0] ?? '', dimensionCodes[1] ?? undefined);
}

function syncVersionCohesion(version: SevenoAssessmentStoredVersion) {
  const next = cloneVersion(version);
  if (!next) {
    return version;
  }

  const seenQuestionIds = new Set<string>();
  const seenQuestionCodes = new Set<string>();
  next.questions = next.questions.map((question, index) => {
    const questionId = question.id?.trim() || `${next.id}-question-${index + 1}-${createTechnicalId('q').slice(-6)}`;
    const uniqueQuestionId = seenQuestionIds.has(questionId)
      ? `${questionId}-${createTechnicalId('dup').slice(-4)}`
      : questionId;
    seenQuestionIds.add(uniqueQuestionId);

    const questionCode = question.code?.trim() || `q-${index + 1}-${createTechnicalId('code').slice(-5)}`;
    const uniqueQuestionCode = seenQuestionCodes.has(questionCode)
      ? `${questionCode}-${createTechnicalId('dup').slice(-4)}`
      : questionCode;
    seenQuestionCodes.add(uniqueQuestionCode);

    const questionOptions = (question.options ?? []).map((option, optionIndex) => {
      const optionId = option.id?.trim() || `${uniqueQuestionId}-option-${optionIndex + 1}-${createTechnicalId('o').slice(-5)}`;
      return {
        ...option,
        id: optionId,
        label: option.label?.trim() || `Réponse ${String.fromCharCode(65 + optionIndex)}`,
        position: optionIndex + 1,
        dimensionScores: option.dimensionScores ?? {},
        adminExplanation: option.adminExplanation?.trim() || '',
      };
    });

    return {
      ...question,
      id: uniqueQuestionId,
      code: uniqueQuestionCode,
      assessmentVersionId: next.id,
      position: index + 1,
      situation: question.situation?.trim() || '',
      instruction: question.instruction?.trim() || '',
      options: questionOptions.length > 0 ? questionOptions : [
        buildNewOptionTemplate(question, 0),
        buildNewOptionTemplate(question, 1),
      ],
      primaryDimensionCodes: (question.primaryDimensionCodes ?? []).filter(Boolean),
      secondaryDimensionCodes: (question.secondaryDimensionCodes ?? []).filter(Boolean),
      adminRationale: question.adminRationale?.trim() || '',
    };
  });

  next.essentialQuestionCount = next.questions.filter((question) => question.path === 'essential').length;
  next.extendedQuestionCount = next.questions.filter((question) => question.path === 'extended').length;

  const dimensionMap = new Map<string, string[]>();
  for (const dimension of next.dimensions) {
    dimensionMap.set(dimension.code, []);
  }

  for (const question of next.questions.filter((item) => item.isActive)) {
    const dimensionCodes = [...new Set([
      ...question.primaryDimensionCodes,
      ...(question.secondaryDimensionCodes ?? []),
    ].filter(Boolean))];
    for (const code of dimensionCodes) {
      const current = dimensionMap.get(code);
      if (!current) {
        continue;
      }

      if (!current.includes(question.id)) {
        current.push(question.id);
      }
    }
  }

  next.dimensions = next.dimensions.map((dimension) => {
    const questionIds = dimensionMap.get(dimension.code) ?? [];
    return {
      ...dimension,
      interviewQuestionIds: questionIds,
      interpretationThresholds: dimension.interpretationThresholds.map((threshold) => ({
        ...threshold,
        interviewQuestionIds: questionIds.length > 0 ? questionIds : [],
      })),
    };
  });

  if (!next.interviewQuestionCatalog || Object.keys(next.interviewQuestionCatalog).length === 0) {
    next.interviewQuestionCatalog = Object.fromEntries(
      next.questions.map((question) => [question.id, `Comment observer ${question.code} en entretien ?`] as const),
    );
  }

  return next;
}

function parseJsonInput(jsonText: string) {
  try {
    return { value: JSON.parse(jsonText) as unknown, error: null as string | null };
  } catch {
    return { value: null, error: 'Le JSON est invalide.' };
  }
}

function extractValidationSummary(validation: AssessmentValidationResult | null) {
  if (!validation) {
    return { errors: 0, warnings: 0 };
  }

  return {
    errors: validation.issues.filter((issue) => issue.severity === 'error').length,
    warnings: validation.issues.filter((issue) => issue.severity === 'warning').length,
  };
}

function getQuestionIssues(validation: AssessmentValidationResult | null, questionId: string) {
  if (!validation) {
    return [];
  }

  return validation.issues.filter((issue) => issue.path.includes(questionId));
}

function getDimensionIssues(validation: AssessmentValidationResult | null, dimensionCode: string) {
  if (!validation) {
    return [];
  }

  return validation.issues.filter((issue) => issue.path.includes(dimensionCode));
}

function unwrapActionResponse<T>(payload: T | SevenoAssessmentActionResponse) {
  if (payload && typeof payload === 'object' && 'payload' in payload) {
    return (payload as SevenoAssessmentActionResponse).payload;
  }

  return payload as T;
}

function toPromptFriendlyMode(mode: SevenoAssessmentPreviewMode) {
  switch (mode) {
    case 'essential':
      return 'Banque essentielle';
    case 'extended':
      return 'Banque approfondie';
    case 'complementary':
      return 'Banque complète';
    default:
      return mode;
  }
}

function isAssessmentValidationIssueList(value: unknown): value is AssessmentValidationIssue[] {
  return Array.isArray(value)
    && value.every((issue) => Boolean(issue)
      && typeof issue === 'object'
      && typeof (issue as { code?: unknown }).code === 'string'
      && typeof (issue as { path?: unknown }).path === 'string'
      && typeof (issue as { message?: unknown }).message === 'string'
      && ((issue as { severity?: unknown }).severity === 'error' || (issue as { severity?: unknown }).severity === 'warning'));
}

export default function SevenoProfessionalAssessmentEditor() {
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [versions, setVersions] = useState<SevenoAssessmentVersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<SevenoAssessmentStoredVersion | null>(null);
  const [savedVersion, setSavedVersion] = useState<SevenoAssessmentStoredVersion | null>(null);
  const [validation, setValidation] = useState<AssessmentValidationResult | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptCopyFeedback, setPromptCopyFeedback] = useState<string | null>(null);
  const [preview, setPreview] = useState<SevenoAssessmentPreviewPayload | null>(null);
  const [reviewManifest, setReviewManifest] = useState<SevenoAssessmentReviewManifest | null>(null);
  const [candidatePreview, setCandidatePreview] = useState<SevenoAssessmentCandidatePreviewPayload | null>(null);
  const [candidatePreviewSourceVersion, setCandidatePreviewSourceVersion] = useState<SevenoAssessmentStoredVersion | null>(null);
  const [candidatePreviewSourceLabel, setCandidatePreviewSourceLabel] = useState<string | null>(null);
  const [candidatePreviewLoading, setCandidatePreviewLoading] = useState(false);
  const [candidatePreviewError, setCandidatePreviewError] = useState<string | null>(null);
  const [step, setStep] = useState<EditorStep>('presentation');
  const [previewMode, setPreviewMode] = useState<SevenoAssessmentPreviewMode>('essential');
  const [importJsonText, setImportJsonText] = useState('');
  const [importDraft, setImportDraft] = useState<SevenoAssessmentStoredVersion | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [actionIssues, setActionIssues] = useState<AssessmentValidationIssue[] | null>(null);

  function resetActionFeedback() {
    setError(null);
    setNotice(null);
    setActionIssues(null);
  }

  function resetCandidatePreview() {
    setCandidatePreview(null);
    setCandidatePreviewSourceVersion(null);
    setCandidatePreviewSourceLabel(null);
    setCandidatePreviewLoading(false);
    setCandidatePreviewError(null);
  }

  function applyActionError(thrownError: unknown, fallbackMessage: string) {
    const message = thrownError instanceof SevenoAdminApiError
      ? thrownError.message
      : thrownError instanceof Error && thrownError.message.trim().length > 0
        ? thrownError.message
        : fallbackMessage;

    setError(message);
    setNotice(null);
    setActionIssues(
      thrownError instanceof SevenoAdminApiError && isAssessmentValidationIssueList(thrownError.issues)
        ? thrownError.issues
        : null,
    );
  }

  const loadEditorState = useCallback(async (versionId?: string | null) => {
    const query = versionId ? `?versionId=${encodeURIComponent(versionId)}` : '';
    const payload = await fetchSevenoAdminApi<SevenoAssessmentEditorPayload>(`/api/admin/evaluation-seveno${query}`);
    setVersions(payload.versions);
    setSelectedVersion(payload.selectedVersion ? syncVersionCohesion(payload.selectedVersion) : null);
    setSavedVersion(payload.selectedVersion ? syncVersionCohesion(payload.selectedVersion) : null);
    setValidation(payload.validation ?? null);
    setPrompt(payload.prompt ?? null);
    setPromptCopyFeedback(null);
    setPreview(payload.preview ?? null);
    setReviewManifest(payload.reviewManifest ?? null);
    setError(null);
    setNotice(null);
    resetActionFeedback();
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadEditorState();
      } catch (thrownError) {
        if (!active) {
          return;
        }

        applyActionError(thrownError, 'L’éditeur Seven’O n’a pas pu être chargé.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadEditorState]);

  const isDirty = useMemo(() => {
    if (!selectedVersion || !savedVersion) {
      return false;
    }

    return JSON.stringify(selectedVersion) !== JSON.stringify(savedVersion);
  }, [savedVersion, selectedVersion]);

  const validationSummary = extractValidationSummary(validation);
  const validationBadge = formatValidationState(validation);
  const editable = Boolean(selectedVersion && selectedVersion.status === 'draft' && !selectedVersion.hasStartedSessions);
  const reviewQuestionStatusById = useMemo(
    () => new Map(reviewManifest?.questions.map((question) => [question.questionId, question.humanReviewStatus] as const) ?? []),
    [reviewManifest],
  );
  const reviewSummary = reviewManifest?.humanReviewSummary ?? {
    totalQuestions: selectedVersion?.questions.length ?? 0,
    pending: selectedVersion?.questions.length ?? 0,
    reviewedWithChanges: 0,
    approvedForPilot: 0,
    rejected: 0,
  };
  const allQuestionsAcceptedForPilot = Boolean(selectedVersion && !isDirty && reviewSummary.approvedForPilot === selectedVersion.questions.length);
  const canPreviewVersion = Boolean(selectedVersion && validation?.valid);

  async function refreshCurrentVersion(versionId?: string | null) {
    try {
      await loadEditorState(versionId ?? selectedVersion?.id ?? null);
      return true;
    } catch (thrownError) {
      applyActionError(thrownError, 'La version sélectionnée n’a pas pu être rechargée.');
      return false;
    }
  }

  async function runAction(action: string, body: Record<string, unknown>, successMessage?: string) {
    setSavingAction(action);
    resetActionFeedback();

    try {
      const response = await fetchSevenoAdminApi<SevenoAssessmentEditorPayload | SevenoAssessmentActionResponse>('/api/admin/evaluation-seveno', {
        method: 'POST',
        body: JSON.stringify({
          action,
          ...body,
        }),
      });

      const payload = unwrapActionResponse<SevenoAssessmentEditorPayload>(response);
      setVersions(payload.versions);
      setSelectedVersion(payload.selectedVersion ? syncVersionCohesion(payload.selectedVersion) : null);
      setSavedVersion(payload.selectedVersion ? syncVersionCohesion(payload.selectedVersion) : null);
      setValidation(payload.validation ?? null);
      setPrompt(payload.prompt ?? null);
      setPromptCopyFeedback(null);
      setPreview(payload.preview ?? null);
      setReviewManifest(payload.reviewManifest ?? null);
      resetCandidatePreview();
      setImportDraft(null);
      setImportFeedback(null);
      setActionIssues(null);
      if (successMessage) {
        setNotice(successMessage);
      }
      return true;
    } catch (thrownError) {
      applyActionError(thrownError, 'L’action admin a échoué.');
      return false;
    } finally {
      setSavingAction(null);
    }
  }

  function updateSelectedVersion(mutator: (draft: SevenoAssessmentStoredVersion) => void) {
    setSelectedVersion((current) => {
      if (!current) {
        return current;
      }

      const next = syncVersionCohesion(cloneVersion(current)!);
      mutator(next);
      const synced = syncVersionCohesion(next);
      setValidation(null);
      setPrompt(null);
      setPromptCopyFeedback(null);
      setPreview(null);
      setNotice('Modifications non enregistrées.');
      return synced;
    });
  }

  function updatePresentationField(field: 'name' | 'description' | 'version' | 'estimatedEssentialDurationMinutes' | 'estimatedExtendedDurationMinutes' | 'revisionNotes', value: string) {
    updateSelectedVersion((draft) => {
      if (field === 'estimatedEssentialDurationMinutes' || field === 'estimatedExtendedDurationMinutes') {
        if (field === 'estimatedEssentialDurationMinutes') {
          draft.estimatedEssentialDurationMinutes = Number.isFinite(Number(value)) ? Number(value) : 0;
          return;
        }

        draft.estimatedExtendedDurationMinutes = Number.isFinite(Number(value)) ? Number(value) : 0;
        return;
      }

      if (field === 'revisionNotes') {
        draft.revisionNotes = value.split('\n').map((item) => item.trim()).filter(Boolean);
        return;
      }

      if (field === 'name') {
        draft.name = value;
        return;
      }

      if (field === 'description') {
        draft.description = value;
        return;
      }

      draft.version = value;
    });
  }

  function updateDimensionField(
    index: number,
    field: 'label' | 'description' | 'weight' | 'displayOrder' | 'minimumEssentialObservations' | 'minimumExtendedObservations' | 'isActive',
    value: string,
  ) {
    updateSelectedVersion((draft) => {
      const dimension = draft.dimensions[index];
      if (!dimension) {
        return;
      }

      if (field === 'weight' || field === 'displayOrder' || field === 'minimumEssentialObservations' || field === 'minimumExtendedObservations') {
        if (field === 'weight') {
          dimension.weight = Number.isFinite(Number(value)) ? Number(value) : 0;
          return;
        }

        if (field === 'displayOrder') {
          dimension.displayOrder = Number.isFinite(Number(value)) ? Number(value) : 0;
          return;
        }

        if (field === 'minimumEssentialObservations') {
          dimension.minimumEssentialObservations = Number.isFinite(Number(value)) ? Number(value) : 0;
          return;
        }

        dimension.minimumExtendedObservations = Number.isFinite(Number(value)) ? Number(value) : 0;
        return;
      }

      if (field === 'isActive') {
        dimension.isActive = value === 'true';
        return;
      }

      if (field === 'label') {
        dimension.label = value;
        return;
      }

      dimension.description = value;
    });
  }

  function updateQuestionField(
    index: number,
    field:
      | 'situation'
      | 'instruction'
      | 'path'
      | 'position'
      | 'difficulty'
      | 'primaryDimensionCodes'
      | 'secondaryDimensionCodes'
      | 'estimatedReadingSeconds'
      | 'adminRationale'
      | 'isActive',
    value: string,
  ) {
    updateSelectedVersion((draft) => {
      const question = draft.questions[index];
      if (!question) {
        return;
      }

      if (field === 'position' || field === 'estimatedReadingSeconds') {
        if (field === 'position') {
          question.position = Number.isFinite(Number(value)) ? Number(value) : 0;
          return;
        }

        question.estimatedReadingSeconds = Number.isFinite(Number(value)) ? Number(value) : 0;
        return;
      }

      if (field === 'isActive') {
        question.isActive = value === 'true';
        return;
      }

      if (field === 'path') {
        question.path = value === 'extended' ? 'extended' : 'essential';
        return;
      }

      if (field === 'difficulty') {
        question.difficulty = value === 'advanced' ? 'advanced' : value === 'standard' ? 'standard' : 'introductory';
        return;
      }

      if (field === 'primaryDimensionCodes' || field === 'secondaryDimensionCodes') {
        const items = value.split(',').map((item) => item.trim()).filter(Boolean);
        const dimensionCodes = items.filter((item): item is AssessmentDimensionCode => SEVENO_PROFESSIONAL_ASSESSMENT_DIMENSION_CODES.includes(item as AssessmentDimensionCode));
        if (field === 'primaryDimensionCodes') {
          question.primaryDimensionCodes = dimensionCodes;
          return;
        }

        question.secondaryDimensionCodes = dimensionCodes;
        return;
      }

      if (field === 'situation') {
        question.situation = value;
        return;
      }

      if (field === 'instruction') {
        question.instruction = value;
        return;
      }

      if (field === 'adminRationale') {
        question.adminRationale = value;
        return;
      }
    });
  }

  function updateQuestionOptionField(
    questionIndex: number,
    optionIndex: number,
    field: 'label' | 'position' | 'adminExplanation',
    value: string,
  ) {
    updateSelectedVersion((draft) => {
      const question = draft.questions[questionIndex];
      const option = question?.options[optionIndex];
      if (!question || !option) {
        return;
      }

      if (field === 'position') {
        option.position = Number.isFinite(Number(value)) ? Number(value) : option.position;
        return;
      }

      if (field === 'label') {
        option.label = value;
        return;
      }

      option.adminExplanation = value;
    });
  }

  function updateQuestionOptionScore(questionIndex: number, optionIndex: number, dimensionCode: string, rawValue: string) {
    updateSelectedVersion((draft) => {
      const question = draft.questions[questionIndex];
      const option = question?.options[optionIndex];
      if (!question || !option) {
        return;
      }

      const value = Number(rawValue);
      if (!Number.isFinite(value)) {
        return;
      }

      option.dimensionScores = {
        ...(option.dimensionScores ?? {}),
        [dimensionCode]: value,
      };
    });
  }

  async function handleVersionSelection(versionId: string) {
    if (isDirty && !window.confirm('Des modifications non enregistrées seront perdues. Continuer ?')) {
      return;
    }

    await refreshCurrentVersion(versionId);
  }

  async function handleCreateBlankDraft() {
    if (await runAction('create_blank_draft', {}, 'Brouillon créé.')) {
      setStep('presentation');
    }
  }

  async function handleDuplicateVersion(versionId: string) {
    if (await runAction('duplicate_version', { versionId }, 'Version dupliquée.')) {
      setStep('presentation');
    }
  }

  async function handleSaveDraft() {
    if (!selectedVersion) {
      return;
    }

    const payloadVersion = syncVersionCohesion(cloneVersion(selectedVersion)!);
    await runAction('update_draft', { versionId: payloadVersion.id, version: payloadVersion, revisionNumber: payloadVersion.revisionNumber }, 'Brouillon enregistré.');
  }

  async function analyzeImportedJsonDraft() {
    const parsed = parseJsonInput(importJsonText);
    if (parsed.error || !parsed.value || typeof parsed.value !== 'object') {
      setImportFeedback(parsed.error ?? 'Le JSON importé doit être un objet.');
      setActionIssues(null);
      return null;
    }

    const response = await fetchSevenoAdminApi<SevenoAssessmentActionResponse>('/api/admin/evaluation-seveno', {
      method: 'POST',
      body: JSON.stringify({
        action: 'analyze_import_json',
        jsonText: importJsonText,
      }),
    });

    const payloadVersion = response.payload.selectedVersion ? cloneVersion(response.payload.selectedVersion) : null;
    if (!payloadVersion) {
      setImportFeedback('Le JSON importé ne produit aucun brouillon interne.');
      setActionIssues(null);
      return null;
    }

    setImportDraft(payloadVersion);
    setImportFeedback(
      response.payload.validation?.issues.some((item) => item.severity === 'error')
        ? 'Le JSON contient encore des erreurs à corriger.'
        : 'Le JSON est compatible avec le modèle Phase 2.',
    );
    setValidation(response.payload.validation ?? null);
    setPrompt(response.payload.prompt ?? null);
    setPromptCopyFeedback(null);
    setPreview(response.payload.preview ?? null);
    setReviewManifest(response.payload.reviewManifest ?? null);
    setError(null);
    setActionIssues(null);
    resetCandidatePreview();

    return payloadVersion;
  }

  async function handleValidateDraft() {
    if (!selectedVersion) {
      return;
    }

    try {
      const payloadVersion = syncVersionCohesion(cloneVersion(selectedVersion)!);
      const response = await fetchSevenoAdminApi<SevenoAssessmentActionResponse>('/api/admin/evaluation-seveno', {
        method: 'POST',
        body: JSON.stringify({
          action: 'validate_draft',
          version: payloadVersion,
        }),
      });

      const payload = response.payload;
      setValidation(payload.validation ?? null);
      setPrompt(payload.prompt ?? null);
      setPromptCopyFeedback(null);
      setPreview(payload.preview ?? null);
      setReviewManifest(payload.reviewManifest ?? null);
      setNotice(response.message ?? 'Brouillon vérifié.');
      setError(null);
      setActionIssues(null);
    } catch (thrownError) {
      applyActionError(thrownError, 'La vérification du brouillon a échoué.');
    }
  }

  async function handleGeneratePrompt() {
    if (!selectedVersion) {
      return;
    }

    try {
      const payloadVersion = syncVersionCohesion(cloneVersion(selectedVersion)!);
      const response = await fetchSevenoAdminApi<SevenoAssessmentActionResponse>('/api/admin/evaluation-seveno', {
        method: 'POST',
        body: JSON.stringify({
          action: 'generate_prompt',
          version: payloadVersion,
        }),
      });

      setValidation(response.payload.validation ?? null);
      setPrompt(response.payload.prompt ?? null);
      setPromptCopyFeedback(null);
      setPreview(response.payload.preview ?? null);
      setReviewManifest(response.payload.reviewManifest ?? null);
      setNotice('Prompt généré et prêt à copier.');
      setError(null);
      setActionIssues(null);
    } catch (thrownError) {
      applyActionError(thrownError, 'La génération du prompt a échoué.');
    }
  }

  async function handlePreviewVersion() {
    if (!selectedVersion) {
      return;
    }

    if (!canPreviewVersion) {
      setNotice('La prévisualisation est bloquée tant que la banque contient des erreurs.');
      return;
    }

    try {
      const payloadVersion = syncVersionCohesion(cloneVersion(selectedVersion)!);
      const response = await fetchSevenoAdminApi<SevenoAssessmentActionResponse>('/api/admin/evaluation-seveno', {
        method: 'POST',
        body: JSON.stringify({
          action: 'preview_version',
          version: payloadVersion,
          mode: previewMode,
        }),
      });

      setValidation(response.payload.validation ?? null);
      setPrompt(response.payload.prompt ?? null);
      setPromptCopyFeedback(null);
      setPreview(response.payload.preview ?? null);
      setReviewManifest(response.payload.reviewManifest ?? null);
      setNotice(`Prévisualisation ${toPromptFriendlyMode(previewMode).toLowerCase()} prête.`);
      setError(null);
      setActionIssues(null);
    } catch (thrownError) {
      applyActionError(thrownError, 'La prévisualisation de la banque a échoué.');
    }
  }

  async function handleCopyPrompt() {
    if (!prompt) {
      return;
    }

    const promptText = prompt.trim();
    if (!promptText) {
      setPromptCopyFeedback('Le prompt est vide.');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const fallbackTextarea = document.createElement('textarea');
        fallbackTextarea.value = promptText;
        fallbackTextarea.setAttribute('readonly', 'true');
        fallbackTextarea.style.position = 'fixed';
        fallbackTextarea.style.top = '-9999px';
        fallbackTextarea.style.opacity = '0';
        document.body.appendChild(fallbackTextarea);
        fallbackTextarea.focus();
        fallbackTextarea.select();
        fallbackTextarea.setSelectionRange(0, fallbackTextarea.value.length);
        const copied = document.execCommand('copy');
        document.body.removeChild(fallbackTextarea);
        if (!copied) {
          throw new Error('Clipboard fallback unavailable');
        }
      }
      setPromptCopyFeedback('Prompt copié');
      setNotice('Prompt copié');
      setError(null);
      setActionIssues(null);
    } catch (thrownError) {
      setPromptCopyFeedback('Sélectionnez le texte puis copiez-le manuellement.');
      applyActionError(thrownError, 'La copie du prompt a échoué.');
    }
  }

  async function handlePilotVersion() {
    if (!selectedVersion) {
      return;
    }

    await runAction('mark_as_pilot', { versionId: selectedVersion.id, revisionNumber: selectedVersion.revisionNumber }, 'Version passée en pilote.');
  }

  async function handlePublishVersion() {
    if (!selectedVersion) {
      return;
    }

    if (!window.confirm('Publier cette version pour les nouveaux candidats ?')) {
      return;
    }

    await runAction('publish_version', { versionId: selectedVersion.id, revisionNumber: selectedVersion.revisionNumber }, 'Version publiée.');
  }

  async function handleArchiveVersion() {
    if (!selectedVersion) {
      return;
    }

    if (!window.confirm('Archiver cette version ?')) {
      return;
    }

    await runAction('archive_version', { versionId: selectedVersion.id, revisionNumber: selectedVersion.revisionNumber }, 'Version archivée.');
  }

  async function handleImportJson() {
    if (!importJsonText.trim()) {
      setImportFeedback('Collez un JSON avant de l’importer.');
      setActionIssues(null);
      return;
    }

    if (await runAction('import_json', { jsonText: importJsonText }, 'JSON importé dans un nouveau brouillon.')) {
      setImportJsonText('');
    }
  }

  async function handleAnalyzeImportJson() {
    try {
      await analyzeImportedJsonDraft();
    } catch (thrownError) {
      applyActionError(thrownError, 'L’analyse du JSON a échoué.');
    }
  }

  async function handlePreviewImportJson() {
    try {
      const payloadVersion = await analyzeImportedJsonDraft();
      if (!payloadVersion) {
        return;
      }

      const response = await fetchSevenoAdminApi<SevenoAssessmentActionResponse>('/api/admin/evaluation-seveno', {
        method: 'POST',
        body: JSON.stringify({
          action: 'preview_version',
          version: payloadVersion,
          mode: previewMode,
        }),
      });

      setImportDraft(payloadVersion);
      setPreview(response.payload.preview ?? null);
      setValidation(response.payload.validation ?? null);
      setPrompt(response.payload.prompt ?? null);
      setPromptCopyFeedback(null);
      setReviewManifest(response.payload.reviewManifest ?? null);
      setImportFeedback('Prévisualisation du JSON prête.');
      setError(null);
      setActionIssues(null);
    } catch (thrownError) {
      applyActionError(thrownError, 'La prévisualisation du JSON a échoué.');
    }
  }

  async function openCandidatePreview(version: SevenoAssessmentStoredVersion, sourceLabel: string) {
    const payloadVersion = syncVersionCohesion(cloneVersion(version)!);
    const seed = createTechnicalId(`candidate-preview-${payloadVersion.id}`);

    setCandidatePreviewSourceVersion(payloadVersion);
    setCandidatePreviewSourceLabel(sourceLabel);
    setCandidatePreviewLoading(true);
    setCandidatePreviewError(null);
    setCandidatePreview(null);
    setError(null);
    setNotice(null);

    try {
      const response = await fetchSevenoAdminApi<{ preview: SevenoAssessmentCandidatePreviewPayload }>('/api/admin/evaluation-seveno', {
        method: 'POST',
        body: JSON.stringify({
          action: 'preview_candidate_version',
          version: payloadVersion,
          seed,
        }),
      });

      if (!response.preview) {
        throw new Error('Le tirage candidat n’a pas pu être généré.');
      }

      setCandidatePreview(response.preview);
      setNotice(`Prévisualisation candidat prête (${sourceLabel}).`);
    } catch (thrownError) {
      const message = thrownError instanceof Error && thrownError.message.trim().length > 0
        ? thrownError.message
        : 'La prévisualisation candidat a échoué.';
      setCandidatePreviewError(message);
    } finally {
      setCandidatePreviewLoading(false);
    }
  }

  function closeCandidatePreview() {
    resetCandidatePreview();
  }

  async function handlePreviewCandidateVersion() {
    if (!selectedVersion) {
      setCandidatePreviewError('Sélectionnez un brouillon avant de prévisualiser le questionnaire candidat.');
      setCandidatePreviewSourceVersion(null);
      return;
    }

    await openCandidatePreview(selectedVersion, 'brouillon courant');
  }

  async function handlePreviewCandidateImportJson() {
    if (!importDraft) {
      setImportFeedback('Analysez d’abord le JSON avant de prévisualiser le questionnaire candidat.');
      return;
    }

    await openCandidatePreview(importDraft, 'JSON analysé');
  }

  function renderValidationIssues(issues: AssessmentValidationIssue[]) {
    if (issues.length === 0) {
      return (
        <p className="text-sm text-emerald-200">
          Aucun point bloquant. La version peut passer en pilote puis en publication lorsque la revue humaine est confirmée.
        </p>
      );
    }

    return (
      <ul className="space-y-2 text-sm leading-6 text-slate-200">
        {issues.map((issue) => (
          <li key={`${issue.path}-${issue.code}`} className={`rounded-2xl border p-3 ${issue.severity === 'error' ? 'border-orange-400/20 bg-orange-400/10 text-orange-50' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-50'}`}>
            <p className="font-medium">{issue.path || 'Version'}</p>
            <p className="mt-1">{issue.message}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/60">{issue.severity === 'error' ? 'Erreur bloquante' : 'Avertissement'}</p>
          </li>
        ))}
      </ul>
    );
  }

  function renderSummaryCard(summary: SevenoAssessmentVersionSummary) {
    const isSelected = summary.id === selectedVersion?.id;
    return (
      <button
        key={summary.id}
        type="button"
        onClick={() => void handleVersionSelection(summary.id)}
        className={`w-full rounded-[20px] border p-4 text-left transition ${
          isSelected
            ? 'border-cyan-300/30 bg-cyan-400/10'
            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{summary.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
              Version {summary.version} · {formatStatusLabel(summary.status)}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
            summary.validationStatus === 'ready'
              ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50'
              : 'border-orange-300/20 bg-orange-400/10 text-orange-50'
          }`}>
            {summary.validationStatus === 'ready' ? 'Prêt' : 'À corriger'}
          </span>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <p>Questions: {summary.questionCount}</p>
          <p>Modifiée: {formatDateTime(summary.updatedAt)}</p>
          <p>Publiée: {formatDateTime(summary.publishedAt)}</p>
          <p>Erreurs: {summary.errorCount} · Avertissements: {summary.warningCount}</p>
        </div>
      </button>
    );
  }

  function renderDimensionCard(dimension: SevenoAssessmentStoredVersion['dimensions'][number], index: number) {
    const issues = getDimensionIssues(validation, dimension.code);
    const statusTone = issues.some((issue) => issue.severity === 'error') ? 'orange' : 'neutral';

    return (
      <SevenoPanel key={dimension.code} tone={statusTone} className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Dimension {index + 1}</p>
            <h3 className="mt-2 text-lg font-semibold text-white">{dimension.label || 'Dimension à compléter'}</h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {issues.length > 0 ? 'À vérifier' : 'Prête'}
          </span>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Libellé</span>
            <input
              value={dimension.label}
              disabled={!editable}
              onChange={(event) => updateDimensionField(index, 'label', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-200 md:col-span-2">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Description</span>
            <textarea
              value={dimension.description}
              disabled={!editable}
              onChange={(event) => updateDimensionField(index, 'description', event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Poids</span>
            <input
              type="number"
              min={1}
              max={100}
              value={dimension.weight}
              disabled={!editable}
              onChange={(event) => updateDimensionField(index, 'weight', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Ordre</span>
            <input
              type="number"
              min={1}
              value={dimension.displayOrder}
              disabled={!editable}
              onChange={(event) => updateDimensionField(index, 'displayOrder', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Observations essentielles</span>
            <input
              type="number"
              min={1}
              value={dimension.minimumEssentialObservations}
              disabled={!editable}
              onChange={(event) => updateDimensionField(index, 'minimumEssentialObservations', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Observations approfondies</span>
            <input
              type="number"
              min={1}
              value={dimension.minimumExtendedObservations}
              disabled={!editable}
              onChange={(event) => updateDimensionField(index, 'minimumExtendedObservations', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Questions essentielles: {dimension.interviewQuestionIds.filter((id) => id).length}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Questions approfondies: {dimension.interviewQuestionIds.filter((id) => id).length}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Minimum d’observations: {dimension.minimumEssentialObservations}/{dimension.minimumExtendedObservations}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            Code technique: {dimension.code}
          </span>
        </div>
      </SevenoPanel>
    );
  }

  function renderQuestionCard(question: AssessmentQuestion, index: number) {
    const issues = getQuestionIssues(validation, question.id);
    const answerCount = question.options.length;
    const reviewStatus = reviewQuestionStatusById.get(question.id) ?? 'pending';

    return (
      <SevenoPanel key={question.id} tone={issues.some((issue) => issue.severity === 'error') ? 'orange' : 'neutral'} className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Question {index + 1}</p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              {question.situation ? question.situation.slice(0, 90) : 'Situation à compléter'}
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {question.path === 'essential' ? 'Parcours essentiel' : 'Parcours approfondi'} · {answerCount} réponse(s)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
              {getReviewStatusLabel(reviewStatus)}
            </span>
            <button
              type="button"
              disabled={!editable}
              onClick={() => {
                updateSelectedVersion((draft) => {
                  const nextQuestion = syncVersionCohesion(draft).questions[index];
                  if (!nextQuestion) {
                    return;
                  }
                  const duplicateQuestion = structuredClone(nextQuestion);
                  draft.questions.splice(index + 1, 0, duplicateQuestion);
                });
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Dupliquer
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => {
                updateSelectedVersion((draft) => {
                  if (index <= 0) {
                    return;
                  }
                  const [item] = draft.questions.splice(index, 1);
                  draft.questions.splice(index - 1, 0, item);
                });
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Monter
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => {
                updateSelectedVersion((draft) => {
                  if (index >= draft.questions.length - 1) {
                    return;
                  }
                  const [item] = draft.questions.splice(index, 1);
                  draft.questions.splice(index + 1, 0, item);
                });
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Descendre
            </button>
            <button
              type="button"
              disabled={!editable}
              onClick={() => {
                if (!window.confirm('Supprimer cette question du brouillon ? Cette action n’affectera aucune version déjà publiée.')) {
                  return;
                }
                updateSelectedVersion((draft) => {
                  draft.questions.splice(index, 1);
                });
              }}
              className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-50 transition hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Supprimer
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Situation professionnelle</span>
            <textarea
              value={question.situation}
              disabled={!editable}
              onChange={(event) => updateQuestionField(index, 'situation', event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Instruction donnée</span>
            <textarea
              value={question.instruction}
              disabled={!editable}
              onChange={(event) => updateQuestionField(index, 'instruction', event.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Parcours</span>
            <select
              value={question.path}
              disabled={!editable}
              onChange={(event) => updateQuestionField(index, 'path', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="essential">Essentiel</option>
              <option value="extended">Approfondi</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Difficulté</span>
            <select
              value={question.difficulty}
              disabled={!editable}
              onChange={(event) => updateQuestionField(index, 'difficulty', event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {QUESTION_DIFFICULTIES.map((difficulty) => (
                <option key={difficulty.value} value={difficulty.value}>
                  {difficulty.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-200 md:col-span-2">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Dimensions principalement observées</span>
            <input
              value={[...question.primaryDimensionCodes, ...(question.secondaryDimensionCodes ?? [])].join(', ')}
              disabled={!editable}
              onChange={(event) => updateQuestionField(index, 'primaryDimensionCodes', event.target.value)}
              placeholder="Séparez les codes par une virgule"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-200">
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Réponses</span>
            <input
              type="number"
              min={2}
              max={4}
              value={question.options.length}
              disabled
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          {question.options.map((option, optionIndex) => (
            <article key={option.id} className="rounded-[20px] border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    Réponse {optionIndex + 1}
                  </p>
                  <h4 className="mt-2 text-sm font-semibold text-white">{option.label || 'Réponse à compléter'}</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!editable || question.options.length <= 2}
                    onClick={() => {
                      if (!editable || question.options.length <= 2) {
                        return;
                      }
                      updateSelectedVersion((draft) => {
                        draft.questions[index]?.options.splice(optionIndex, 1);
                      });
                    }}
                    className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs font-medium text-orange-50 transition hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Texte</span>
                  <input
                    value={option.label}
                    disabled={!editable}
                    onChange={(event) => updateQuestionOptionField(index, optionIndex, 'label', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Ordre</span>
                  <input
                    type="number"
                    min={1}
                    value={option.position}
                    disabled={!editable}
                    onChange={(event) => updateQuestionOptionField(index, optionIndex, 'position', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Explication interne</span>
                  <input
                    value={option.adminExplanation}
                    disabled={!editable}
                    onChange={(event) => updateQuestionOptionField(index, optionIndex, 'adminExplanation', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <div className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Niveau</span>
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                    {contributionLabel(
                      Object.values(option.dimensionScores ?? {}).reduce<number>((max, value) => Math.max(max, Number(value) || 0), 0),
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.24em] text-slate-400">
                      <th className="px-2 py-1">Dimension</th>
                      <th className="px-2 py-1">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedVersion?.dimensions.map((dimension) => (
                      <tr key={dimension.code} className="rounded-2xl bg-white/5">
                        <td className="px-2 py-2 text-slate-200">{dimension.label}</td>
                        <td className="px-2 py-2">
                          <select
                            value={option.dimensionScores?.[dimension.code] ?? 0}
                            disabled={!editable}
                            onChange={(event) => updateQuestionOptionScore(index, optionIndex, dimension.code, event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {CONTRIBUTION_LEVELS.map((contribution) => (
                              <option key={contribution.value} value={contribution.value}>
                                {contribution.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}

          <button
            type="button"
            disabled={!editable || question.options.length >= 4}
            onClick={() => {
              updateSelectedVersion((draft) => {
                const questionDraft = draft.questions[index];
                if (!questionDraft || questionDraft.options.length >= 4) {
                  return;
                }
                questionDraft.options.push(buildNewOptionTemplate(questionDraft, questionDraft.options.length));
              });
            }}
            className="inline-flex w-fit items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ajouter une réponse
          </button>
        </div>
      </SevenoPanel>
    );
  }

  function renderReviewQuestionCard(question: ReviewQuestionRecord) {
    return (
      <article key={question.questionId} className="rounded-[22px] border border-white/10 bg-slate-950/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{question.code}</p>
            <h4 className="mt-2 text-base font-semibold text-white">{question.situation}</h4>
            <p className="mt-2 text-sm text-slate-300">{question.instruction}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-400">
              Dimensions: {question.primaryDimensionCodes.join(', ')}
              {question.secondaryDimensionCode ? ` / ${question.secondaryDimensionCode}` : ''}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            question.decisionFinal === 'approved_for_pilot'
              ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50'
              : question.decisionFinal === 'rejected'
                ? 'border-rose-300/20 bg-rose-400/10 text-rose-50'
                : question.decisionFinal === 'reviewed_with_changes'
                  ? 'border-amber-300/20 bg-amber-400/10 text-amber-50'
                  : 'border-white/10 bg-white/5 text-slate-200'
          }`}>
            {getReviewStatusLabel(question.humanReviewStatus)} · {question.decisionFinal}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {question.options.map((option) => (
            <div key={option.id} className="rounded-[18px] border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  {option.order}. {option.label}
                </p>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-50">
                  {Object.values(option.dimensionScores).map((score) => String(score)).join(' / ')}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{option.adminExplanation}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                {Object.entries(option.dimensionScores).map(([code, score]) => `${code}=${score}`).join(' · ')}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[18px] border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Commentaires humains</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">{question.reviewComments.join(' ')}</p>
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Corrections proposées</p>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              {question.proposedCorrections.length > 0 ? question.proposedCorrections.join(' ; ') : 'Aucune'}
            </p>
          </div>
        </div>
      </article>
    );
  }

  function renderReviewSeries(series: ReviewSeriesRecord) {
    return (
      <SevenoPanel key={series.seriesNumber} tone="neutral" className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{series.title}</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Série {series.seriesNumber}</h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {series.questionCodes.join(' · ')}
          </span>
        </div>
        <div className="mt-4 space-y-4">
          {series.questions.map((question) => renderReviewQuestionCard(question))}
        </div>
      </SevenoPanel>
    );
  }

  function renderPreview(previewPayload: SevenoAssessmentPreviewPayload | null) {
    if (!previewPayload) {
      return (
        <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
          Lancez une prévisualisation pour voir le parcours candidat et le rapport entreprise sans écrire dans Firestore.
        </SevenoPanel>
      );
    }

    const report = previewPayload.report;
    return (
      <div className="space-y-4">
        <SevenoPanel tone="cyan" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Mode prévisualisation administrateur</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Aucune réponse ni aucun résultat ne sera enregistré. Cette vue prévisualise {toPromptFriendlyMode(previewPayload.mode).toLowerCase()} avec le moteur de la phase 2.
          </p>
        </SevenoPanel>

        <div className="grid gap-4 lg:grid-cols-2">
          <SevenoPanel tone="neutral" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Projection candidat</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{report.candidateSummary}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{report.limitations.join(' ')}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">
              Précision: {report.precisionLevel} · Parcours prévisualisé: {report.completedPath}
            </p>
          </SevenoPanel>

          <SevenoPanel tone="neutral" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Projection entreprise</p>
            <h3 className="mt-2 text-xl font-semibold text-white">{report.companySummary}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{report.limitations.join(' ')}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">
              Version: {report.assessmentVersion.version} · Volume prévisualisé: {previewPayload.questionCount} question(s)
            </p>
          </SevenoPanel>
        </div>

        <SevenoPanel tone="neutral" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Scores par dimension</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {report.dimensionResults.map((dimension) => (
              <article key={dimension.dimensionCode} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{dimension.dimensionCode}</p>
                <p className="mt-2 text-sm text-slate-300">Statut: {dimension.status}</p>
                <p className="mt-1 text-sm text-slate-300">Précision: {dimension.precisionLevel}</p>
                <p className="mt-1 text-sm text-slate-300">Limites: {dimension.limitations.join(' ') || 'Aucune'}</p>
              </article>
            ))}
          </div>
        </SevenoPanel>
      </div>
    );
  }

  if (loading) {
    return (
      <SevenoSurface
        eyebrow="Administration Seven’O"
        title="Analyse professionnelle Seven’O"
        description="Chargement de l’éditeur admin simple..."
        containerClassName="max-w-7xl"
      >
        <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
          Chargement de la version en cours...
        </SevenoPanel>
      </SevenoSurface>
    );
  }

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Analyse professionnelle Seven’O"
      description="Gérez ici les situations proposées aux candidats et préparez les versions essentielles et approfondies de l’analyse professionnelle."
      actions={<Link href="/admin" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">Retour au tableau de bord</Link>}
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        <AdminSectionNav />

        <SevenoPanel tone="neutral" className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">État du brouillon</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {selectedVersion ? selectedVersion.name : 'Aucune version sélectionnée'}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {selectedVersion
                  ? `Version ${selectedVersion.version} · ${formatStatusLabel(selectedVersion.status)} · ${selectedVersion.questions.length} question(s)`
                  : 'Créez ou chargez une version pour commencer.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                validationBadge.tone === 'cyan'
                  ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50'
                  : validationBadge.tone === 'orange'
                    ? 'border-orange-300/20 bg-orange-400/10 text-orange-50'
                    : 'border-white/10 bg-white/5 text-slate-200'
              }`}>
                {validationBadge.label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                {isDirty ? 'Modifications non enregistrées' : 'Brouillon enregistré'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                {savingAction ? 'Enregistrement…' : 'Prêt'}
              </span>
            </div>
          </div>
          {error ? (
            <p className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-400/10 p-4 text-sm leading-7 text-orange-50">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-50">
              {notice}
            </p>
          ) : null}
          {prompt ? (
            <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-50/80">Prompt à transmettre à votre IA</p>
                  <h2 className="mt-2 text-xl font-semibold text-cyan-50">Prompt complet à copier</h2>
                  <p className="mt-2 text-sm leading-7 text-cyan-50/90">
                    Copiez ce prompt dans l’IA de votre choix. Collez ensuite uniquement la réponse JSON de l’IA dans la zone d’import ci-dessous.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyPrompt()}
                  className="rounded-full border border-cyan-100/20 bg-cyan-950/20 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-950/30"
                >
                  Copier le prompt
                </button>
              </div>
              <textarea
                value={prompt}
                readOnly
                rows={12}
                spellCheck={false}
                className="mt-4 w-full rounded-2xl border border-cyan-100/20 bg-slate-950/80 px-4 py-3 font-mono text-xs leading-6 text-slate-100 outline-none"
              />
              <div className="mt-3 space-y-2">
                <p className="text-sm leading-7 text-cyan-50/90">
                  Le prompt reste affiché tant qu’un nouveau prompt n’est pas généré.
                </p>
                {promptCopyFeedback ? (
                  <p className="rounded-2xl border border-cyan-100/20 bg-cyan-950/20 p-3 text-sm leading-7 text-cyan-50" aria-live="polite">
                    {promptCopyFeedback}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {actionIssues?.length ? (
            <div className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-400/10 p-4">
              <p className="text-sm font-semibold text-orange-50">Détails de validation renvoyés par l’API</p>
              <div className="mt-3">
                {renderValidationIssues(actionIssues)}
              </div>
            </div>
          ) : null}
        </SevenoPanel>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <SevenoPanel tone="neutral" className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Versions</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Liste des versions</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateBlankDraft()}
                  className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Créer un brouillon vide
                </button>
                <button
                  type="button"
                  onClick={() => void handleDuplicateVersion(selectedVersion?.id ?? versions[0]?.id ?? '')}
                  disabled={!selectedVersion}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Dupliquer la version
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {versions.length > 0 ? versions.map((summary) => renderSummaryCard(summary)) : (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                  Aucune version disponible.
                </p>
              )}
            </div>
          </SevenoPanel>

          <SevenoPanel tone="neutral" className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Actions principales</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Éditeur simplifié</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {STEP_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStep(tab.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      step === tab.id
                        ? 'border border-cyan-300/25 bg-cyan-400/12 text-cyan-50'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={!editable || !isDirty}
                className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Enregistrer le brouillon
              </button>
              <button
                type="button"
                onClick={() => void handleValidateDraft()}
                disabled={!selectedVersion}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Vérifier
              </button>
              <button
                type="button"
                onClick={() => void handleGeneratePrompt()}
                disabled={!selectedVersion}
                className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Générer le prompt IA
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewVersion()}
                disabled={!canPreviewVersion}
                title={canPreviewVersion ? undefined : 'La prévisualisation nécessite une banque valide importée.'}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Prévisualiser la banque
              </button>
              <button
                type="button"
                onClick={() => void handlePreviewCandidateVersion()}
                disabled={!selectedVersion}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Prévisualiser le questionnaire candidat
              </button>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Le prompt IA peut être généré sans prévisualisation. La prévisualisation reste bloquée tant que la banque contient des erreurs bloquantes.
            </p>
          </SevenoPanel>
        </div>

        {step === 'presentation' ? (
          <SevenoPanel tone="neutral" className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Présentation</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Informations administratives de la version</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Ces informations servent à identifier la version dans l’administration. Elles ne sont pas toutes affichées aux candidats.
                </p>
              </div>
            </div>

            {selectedVersion ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Nom de la version</span>
                  <input
                    value={selectedVersion.name}
                    disabled={!editable}
                    onChange={(event) => updatePresentationField('name', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200 md:col-span-2">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Description interne</span>
                  <textarea
                    value={selectedVersion.description}
                    disabled={!editable}
                    onChange={(event) => updatePresentationField('description', event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Numéro de version</span>
                  <input
                    value={selectedVersion.version}
                    readOnly
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Durée essentielle</span>
                  <input
                    type="number"
                    min={1}
                    value={selectedVersion.estimatedEssentialDurationMinutes}
                    disabled={!editable}
                    onChange={(event) => updatePresentationField('estimatedEssentialDurationMinutes', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Durée approfondie</span>
                  <input
                    type="number"
                    min={1}
                    value={selectedVersion.estimatedExtendedDurationMinutes}
                    disabled={!editable}
                    onChange={(event) => updatePresentationField('estimatedExtendedDurationMinutes', event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-200 md:col-span-2">
                  <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">Notes de révision</span>
                  <textarea
                    value={selectedVersion.revisionNotes.join('\n')}
                    disabled={!editable}
                    onChange={(event) => updatePresentationField('revisionNotes', event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>
            ) : null}

            <details className="mt-5 rounded-[20px] border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-white">Paramètres avancés</summary>
              {selectedVersion ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <p className="text-sm text-slate-300">Code interne: {selectedVersion.code}</p>
                  <p className="text-sm text-slate-300">Créé par: {selectedVersion.createdBy}</p>
                  <p className="text-sm text-slate-300">Créé le: {formatDateTime(selectedVersion.createdAt)}</p>
                  <p className="text-sm text-slate-300">Mis à jour le: {formatDateTime(selectedVersion.updatedAt)}</p>
                  <p className="text-sm text-slate-300">Publié le: {formatDateTime(selectedVersion.publishedAt)}</p>
                  <p className="text-sm text-slate-300">Archivé le: {formatDateTime(selectedVersion.archivedAt)}</p>
                  <p className="text-sm text-slate-300">Moteur de calcul: {selectedVersion.scoringEngineVersion}</p>
                  <p className="text-sm text-slate-300">Moteur d’interprétation: {selectedVersion.interpretationEngineVersion}</p>
                  <p className="text-sm text-slate-300">Mention légale: {selectedVersion.legalNoticeVersion}</p>
                  <p className="text-sm text-slate-300">Source: {selectedVersion.sourceVersionId ?? 'Aucune'}</p>
                  <p className="text-sm text-slate-300">Utilisée: {selectedVersion.hasStartedSessions ? 'Oui' : 'Non'}</p>
                </div>
              ) : null}
            </details>
          </SevenoPanel>
        ) : null}

        {step === 'dimensions' ? (
          <div className="space-y-4">
            <SevenoPanel tone="neutral" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Dimensions</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Les sept dimensions professionnelles</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Cette répartition organise le modèle interne. Elle ne représente pas le pourcentage de personnalité du candidat et ne produit aucun score global.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  Répartition totale: {selectedVersion?.dimensions.reduce((sum, dimension) => sum + (dimension.weight ?? 0), 0) ?? 0} %
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  Questions essentielles: {selectedVersion?.essentialQuestionCount ?? 0}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  Questions approfondies: {selectedVersion?.extendedQuestionCount ?? 0}
                </span>
              </div>
            </SevenoPanel>

            <div className="grid gap-4 xl:grid-cols-2">
              {selectedVersion?.dimensions.map((dimension, index) => renderDimensionCard(dimension, index))}
            </div>
          </div>
        ) : null}

        {step === 'questions' ? (
          <div className="space-y-4">
            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Questions</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Parcours essentiel et approfondi</h2>
                </div>
              <button
                type="button"
                disabled={!editable}
                onClick={() => {
                  if (!selectedVersion) {
                      return;
                    }
                    updateSelectedVersion((draft) => {
                      draft.questions.push(buildNewQuestionTemplate(draft));
                    });
                  }}
                  className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ajouter une question
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Essentiel — {selectedVersion?.essentialQuestionCount ?? 0} questions importées sur {selectedVersion?.essentialPoolSize ?? selectedVersion?.essentialQuestionCount ?? 0}. Approfondi — {selectedVersion?.extendedQuestionCount ?? 0} questions importées sur {selectedVersion?.extendedPoolSize ?? selectedVersion?.extendedQuestionCount ?? 0}.
              </p>
            </SevenoPanel>

            <div className="space-y-4">
              {selectedVersion?.questions.map((question, index) => renderQuestionCard(question, index))}
            </div>
          </div>
        ) : null}

        {step === 'verification' ? (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-3">
              <SevenoPanel tone="cyan" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Contrôles</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {reviewSummary.approvedForPilot}/{reviewSummary.totalQuestions}
                </p>
                <p className="mt-2 text-sm text-slate-300">Revue humaine : questions acceptées pour pilote.</p>
              </SevenoPanel>
              <SevenoPanel tone="violet" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Avertissements</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{validationSummary.warnings}</p>
                <p className="mt-2 text-sm text-slate-300">Points à vérifier avant passage en pilote.</p>
              </SevenoPanel>
              <SevenoPanel tone="orange" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Erreurs bloquantes</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{validationSummary.errors}</p>
                <p className="mt-2 text-sm text-slate-300">La publication est bloquée tant qu’il reste des erreurs.</p>
              </SevenoPanel>
            </div>

            {reviewManifest?.reviewSeries?.length ? (
              <div className="space-y-4">
                <SevenoPanel tone="neutral" className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Séries de revue</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Lecture par groupes de cinq questions</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-300">
                    Chaque série affiche les situations, les options, les scores, les explications administrateur et les commentaires humains. La première série regroupe bien les cinq questions d’ouverture attendues.
                  </p>
                </SevenoPanel>
                <div className="space-y-4">
                  {reviewManifest.reviewSeries.map((series) => renderReviewSeries(series))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <SevenoPanel tone="neutral" className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Vérification</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Contrôle de la version</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePilotVersion()}
                      disabled={!selectedVersion || !editable || validationSummary.errors > 0 || !allQuestionsAcceptedForPilot}
                      className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Passer en pilote
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePublishVersion()}
                      disabled={!selectedVersion || selectedVersion?.status !== 'pilot' || validationSummary.errors > 0}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Publier
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleArchiveVersion()}
                      disabled={!selectedVersion}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Archiver
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-sm text-slate-300">
                    Questions essentielles: {selectedVersion?.essentialQuestionCount ?? 0}/{selectedVersion?.essentialPoolSize ?? selectedVersion?.essentialQuestionCount ?? 0} attendues
                  </p>
                  <p className="text-sm text-slate-300">
                    Questions approfondies: {selectedVersion?.extendedQuestionCount ?? 0}/{selectedVersion?.extendedPoolSize ?? selectedVersion?.extendedQuestionCount ?? 0} complémentaires attendues
                  </p>
                  <p className="text-sm text-slate-300">
                    Revue humaine : {reviewSummary.approvedForPilot}/{reviewSummary.totalQuestions} questions acceptées pour pilote
                  </p>
                  <p className="text-sm text-slate-300">
                    Dimensions couvertes: {selectedVersion?.dimensions.filter((dimension) => dimension.isActive).length ?? 0}/7
                  </p>
                  <p className="text-sm text-slate-300">
                    Répartition des poids: {selectedVersion?.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0) ?? 0}/100
                  </p>
                  <p className="text-sm text-slate-300">
                    Version du moteur: {selectedVersion?.scoringEngineVersion ?? 'Non disponible'}
                  </p>
                </div>
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Réponse JSON générée par l’IA</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Analyser, prévisualiser et importer</h2>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Collez ici uniquement le JSON renvoyé par l’IA, pas le prompt. Les identifiants techniques seront générés si nécessaire.
                </p>

                <div className="mt-4 space-y-3">
                  <textarea
                    value={importJsonText}
                    onChange={(event) => setImportJsonText(event.target.value)}
                    rows={10}
                    placeholder='Collez ici uniquement le JSON renvoyé par l’IA.'
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleAnalyzeImportJson()}
                      className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Analyser
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePreviewImportJson()}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      Prévisualiser
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePreviewCandidateImportJson()}
                      disabled={!importDraft}
                      className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Prévisualiser le questionnaire candidat
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleImportJson()}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      Importer dans le brouillon
                    </button>
                    <label className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
                      Choisir un fichier
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) {
                            return;
                          }
                          const text = await file.text();
                          setImportJsonText(text);
                        }}
                      />
                    </label>
                  </div>
                  {importFeedback ? (
                    <p className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-50">
                      {importFeedback}
                    </p>
                  ) : null}
                {importDraft ? (
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Brouillon préparé: {importDraft.name}
                  </p>
                ) : null}
              </div>
            </SevenoPanel>
          </div>

            <SevenoPanel tone="neutral" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Contrôles détaillés</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Erreurs et avertissements</h2>
              <div className="mt-4">
                {renderValidationIssues(validation?.issues ?? [])}
              </div>
            </SevenoPanel>

            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Prévisualisation</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Banque et rapport</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['essential', 'extended', 'complementary'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                        previewMode === mode
                          ? 'border border-cyan-300/25 bg-cyan-400/12 text-cyan-50'
                          : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {toPromptFriendlyMode(mode)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Sélectionnez une vue de banque puis lancez la prévisualisation sans écriture pour vérifier les projections candidat et entreprise.
              </p>
              <div className="mt-4">
                {renderPreview(preview)}
              </div>
            </SevenoPanel>

          </div>
        ) : null}
      </div>
      {candidatePreviewSourceVersion ? (
        <ProfessionalAssessmentCandidatePreview
          sourceVersion={candidatePreviewSourceVersion}
          preview={candidatePreview}
          reviewManifest={reviewManifest}
          loading={candidatePreviewLoading}
          error={candidatePreviewError}
          onClose={closeCandidatePreview}
          onGenerateAnotherDraw={() => {
            if (candidatePreviewSourceVersion && candidatePreviewSourceLabel) {
              void openCandidatePreview(candidatePreviewSourceVersion, candidatePreviewSourceLabel);
            }
          }}
        />
      ) : null}
    </SevenoSurface>
  );
}
