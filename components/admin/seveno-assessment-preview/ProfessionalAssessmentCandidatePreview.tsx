'use client';

import { useEffect, useMemo, useState } from 'react';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { getReviewStatusLabel } from '@/lib/seveno-professional-assessment-review';
import type { AssessmentDimensionCode, AssessmentQuestion } from '@/types/seveno-assessment';
import type {
  SevenoAssessmentCandidatePreviewPayload,
  SevenoAssessmentStoredVersion,
} from '@/types/seveno-assessment-admin';
import type { SevenoAssessmentReviewManifest } from '@/types/seveno-assessment-review';
import ProfessionalAssessmentNavigation from '@/components/admin/seveno-assessment-preview/ProfessionalAssessmentNavigation';
import ProfessionalAssessmentProgress from '@/components/admin/seveno-assessment-preview/ProfessionalAssessmentProgress';
import ProfessionalAssessmentQuestionView from '@/components/admin/seveno-assessment-preview/ProfessionalAssessmentQuestionView';

type PreviewMode = 'review' | 'simulation';
type ViewportMode = 'desktop' | 'mobile';
type ReviewFilter = 'all' | 'essential' | 'extended' | 'dimension' | 'pending' | 'validated';

interface ProfessionalAssessmentCandidatePreviewProps {
  sourceVersion: SevenoAssessmentStoredVersion;
  preview: SevenoAssessmentCandidatePreviewPayload | null;
  reviewManifest: SevenoAssessmentReviewManifest | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onGenerateAnotherDraw: () => void;
}

interface ReviewQuestionViewModel {
  question: AssessmentQuestion;
  humanReviewStatus: NonNullable<SevenoAssessmentReviewManifest['questions'][number]['humanReviewStatus']>;
  reviewComments: string[];
  proposedCorrections: string[];
  decisionFinal: NonNullable<SevenoAssessmentReviewManifest['questions'][number]['decisionFinal']>;
  automatedCheckStatus: NonNullable<SevenoAssessmentReviewManifest['questions'][number]['automatedCheckStatus']>;
}

const REVIEW_FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'essential', label: 'Essentielles' },
  { value: 'extended', label: 'Approfondies' },
  { value: 'dimension', label: 'Par dimension' },
  { value: 'pending', label: 'À relire' },
  { value: 'validated', label: 'Validées' },
];

const GENERIC_CONTENT_PATTERNS = [
  /Situation professionnelle\s*\d+/i,
  /^Réponse [A-D]$/i,
  /Option montrant une contribution intermédiaire/i,
  /Question de test/i,
];

function formatDifficultyLabel(value: AssessmentQuestion['difficulty']) {
  switch (value) {
    case 'introductory':
      return 'Introduction';
    case 'standard':
      return 'Standard';
    case 'advanced':
      return 'Avancée';
    default:
      return value;
  }
}

function detectGenericContent(question: AssessmentQuestion) {
  const texts = [
    question.situation,
    question.instruction,
    question.adminRationale,
    ...question.options.map((option) => option.label),
    ...question.options.map((option) => option.adminExplanation),
  ].filter(Boolean);

  return texts.some((text) => GENERIC_CONTENT_PATTERNS.some((pattern) => pattern.test(text)))
    ? 'Contenu générique détecté — cette question doit être réécrite avant validation.'
    : null;
}

function toReviewQuestionViewModel(
  question: AssessmentQuestion,
  reviewManifest: SevenoAssessmentReviewManifest | null,
): ReviewQuestionViewModel {
  const reviewQuestion = reviewManifest?.questions.find((item) => item.questionId === question.id);

  return {
    question,
    humanReviewStatus: reviewQuestion?.humanReviewStatus ?? 'pending',
    reviewComments: reviewQuestion?.reviewComments ?? [],
    proposedCorrections: reviewQuestion?.proposedCorrections ?? [],
    decisionFinal: reviewQuestion?.decisionFinal ?? 'pending',
    automatedCheckStatus: reviewQuestion?.automatedCheckStatus ?? 'warning',
  };
}

function getQuestionPathLabel(question: AssessmentQuestion) {
  return question.path === 'essential' ? 'Parcours essentiel' : 'Parcours approfondi';
}

function getQuestionReadingLabel(question: AssessmentQuestion) {
  return `Lecture estimée: ${Math.max(1, question.estimatedReadingSeconds)} s`;
}

function buildSimulationQuestions(
  sourceVersion: SevenoAssessmentStoredVersion,
  preview: SevenoAssessmentCandidatePreviewPayload | null,
) {
  if (!preview) {
    return [];
  }

  const questionById = new Map(sourceVersion.questions.map((question) => [question.id, question] as const));
  return [
    ...preview.essentialQuestionIds.map((questionId) => questionById.get(questionId)).filter((question): question is AssessmentQuestion => Boolean(question)),
    ...preview.extendedQuestionIds.map((questionId) => questionById.get(questionId)).filter((question): question is AssessmentQuestion => Boolean(question)),
  ];
}

export default function ProfessionalAssessmentCandidatePreview({
  sourceVersion,
  preview,
  reviewManifest,
  loading,
  error,
  onClose,
  onGenerateAnotherDraw,
}: ProfessionalAssessmentCandidatePreviewProps) {
  const [mode, setMode] = useState<PreviewMode>('simulation');
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [reviewDimensionCode, setReviewDimensionCode] = useState<AssessmentDimensionCode | 'all'>(
    sourceVersion.dimensions.find((dimension) => dimension.isActive)?.code ?? sourceVersion.dimensions[0]?.code ?? 'all',
  );
  const [selectedReviewQuestionId, setSelectedReviewQuestionId] = useState<string | null>(sourceVersion.questions[0]?.id ?? null);
  const [selectedSimulationIndex, setSelectedSimulationIndex] = useState(0);
  const [selectedAnswerByQuestionId, setSelectedAnswerByQuestionId] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelectedReviewQuestionId(sourceVersion.questions[0]?.id ?? null);
    setReviewFilter('all');
    setReviewDimensionCode(sourceVersion.dimensions.find((dimension) => dimension.isActive)?.code ?? sourceVersion.dimensions[0]?.code ?? 'all');
    setSelectedSimulationIndex(0);
    setSelectedAnswerByQuestionId({});
    setViewport('desktop');
    setMode('simulation');
  }, [sourceVersion.dimensions, sourceVersion.id, sourceVersion.questions]);

  useEffect(() => {
    setSelectedSimulationIndex(0);
    setSelectedAnswerByQuestionId({});
  }, [preview?.drawSeed]);

  const reviewQuestionViewModels = useMemo(
    () => sourceVersion.questions.map((question) => toReviewQuestionViewModel(question, reviewManifest)),
    [reviewManifest, sourceVersion.questions],
  );

  const reviewById = useMemo(
    () => new Map(reviewQuestionViewModels.map((item) => [item.question.id, item] as const)),
    [reviewQuestionViewModels],
  );

  const reviewSummary = reviewManifest?.humanReviewSummary ?? {
    totalQuestions: sourceVersion.questions.length,
    pending: sourceVersion.questions.length,
    reviewedWithChanges: 0,
    approvedForPilot: 0,
    rejected: 0,
    pendingHumanReviewCount: sourceVersion.questions.length,
    reviewedWithChangesCount: 0,
    approvedForPilotCount: 0,
    rejectedCount: 0,
  };

  const filteredReviewQuestions = useMemo(() => {
    return reviewQuestionViewModels.filter((record) => {
      switch (reviewFilter) {
        case 'essential':
          return record.question.path === 'essential';
        case 'extended':
          return record.question.path === 'extended';
        case 'dimension':
          if (reviewDimensionCode === 'all') {
            return true;
          }

          return record.question.primaryDimensionCodes.includes(reviewDimensionCode)
            || (record.question.secondaryDimensionCodes ?? []).includes(reviewDimensionCode);
        case 'pending':
          return record.humanReviewStatus !== 'approved_for_pilot';
        case 'validated':
          return record.humanReviewStatus === 'approved_for_pilot';
        case 'all':
        default:
          return true;
      }
    });
  }, [reviewDimensionCode, reviewFilter, reviewQuestionViewModels]);

  const resolvedReviewQuestionId = useMemo(() => {
    if (selectedReviewQuestionId && filteredReviewQuestions.some((record) => record.question.id === selectedReviewQuestionId)) {
      return selectedReviewQuestionId;
    }

    return filteredReviewQuestions[0]?.question.id ?? reviewQuestionViewModels[0]?.question.id ?? null;
  }, [filteredReviewQuestions, reviewQuestionViewModels, selectedReviewQuestionId]);

  const selectedReviewQuestion = resolvedReviewQuestionId ? reviewById.get(resolvedReviewQuestionId) ?? null : null;
  const selectedReviewQuestionGlobalIndex = selectedReviewQuestion
    ? sourceVersion.questions.findIndex((question) => question.id === selectedReviewQuestion.question.id)
    : -1;

  const simulationQuestions = useMemo(() => buildSimulationQuestions(sourceVersion, preview), [preview, sourceVersion]);
  const essentialDrawSize = preview?.essentialQuestionCount ?? 20;
  const extendedDrawSize = preview?.extendedQuestionCount ?? 20;
  const currentSimulationIndex = Math.min(selectedSimulationIndex, Math.max(0, simulationQuestions.length - 1));
  const currentSimulationQuestion = simulationQuestions[currentSimulationIndex] ?? simulationQuestions[0] ?? null;
  const currentSimulationSectionLabel = currentSimulationQuestion
    ? currentSimulationIndex < essentialDrawSize
      ? 'Parcours essentiel'
      : 'Parcours approfondi'
    : 'Prévisualisation administrateur';

  const viewportClassName = viewport === 'mobile'
    ? 'mx-auto w-full max-w-[430px]'
    : 'mx-auto w-full max-w-[1200px]';

  const selectedReviewQuestionCount = filteredReviewQuestions.length;

  function updateReviewQuestionByFilter(index: number) {
    const question = filteredReviewQuestions[index];
    if (!question) {
      return;
    }

    setSelectedReviewQuestionId(question.question.id);
  }

  function updateSimulationQuestion(index: number) {
    if (index < 0 || index >= simulationQuestions.length) {
      return;
    }

    setSelectedSimulationIndex(index);
  }

  function handleSelectAnswer(questionId: string, optionId: string) {
    setSelectedAnswerByQuestionId((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  }

  const selectedSimulationQuestion = currentSimulationQuestion;
  const currentSimulationAnswer = selectedSimulationQuestion ? selectedAnswerByQuestionId[selectedSimulationQuestion.id] ?? null : null;
  const showTransitionToExtended = currentSimulationQuestion ? currentSimulationIndex === essentialDrawSize : false;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fermer la prévisualisation"
        className="absolute inset-0 cursor-default bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex h-full items-stretch justify-center p-3 sm:p-5">
        <div className="flex h-full w-full max-w-[1440px] items-stretch justify-center">
          <div className="flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-white/10 bg-slate-950/95 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
            <div className="border-b border-white/10 bg-slate-950/90 px-5 py-4 backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    Prévisualisation administrateur
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    Questionnaire candidat Seven’O
                  </h2>
                  <p className="max-w-3xl text-sm leading-7 text-slate-300">
                    {sourceVersion.name} · version {sourceVersion.version}. Cette vue reste read-only et n’écrit aucune session, aucun résultat ni aucun brouillon.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('review')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === 'review'
                        ? 'border border-cyan-300/30 bg-cyan-400/12 text-cyan-50'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Examiner les 60 questions
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('simulation')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === 'simulation'
                        ? 'border border-cyan-300/30 bg-cyan-400/12 text-cyan-50'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Simuler un tirage candidat
                  </button>
                  <button
                    type="button"
                    onClick={onGenerateAnotherDraw}
                    disabled={mode !== 'simulation' || loading}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Générer un autre tirage
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Fermer
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewport('desktop')}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    viewport === 'desktop'
                      ? 'border border-cyan-300/30 bg-cyan-400/12 text-cyan-50'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Ordinateur
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('mobile')}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    viewport === 'mobile'
                      ? 'border border-cyan-300/30 bg-cyan-400/12 text-cyan-50'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Mobile
                </button>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  {sourceVersion.questions.length} {sourceVersion.questions.length > 1 ? 'questions' : 'question'} dans le brouillon
                </span>
                {preview ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    Tirage {preview.essentialQuestionCount} + {preview.extendedQuestionCount}
                  </span>
                ) : null}
                {error ? (
                  <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-xs text-orange-50">
                    {error}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className={viewportClassName}>
                {mode === 'review' ? (
                  <div className="space-y-4">
                    <SevenoPanel tone="neutral" className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Relecture éditoriale</p>
                          <p className="text-sm leading-7 text-slate-300">
                            Parcourez le brouillon complet pour vérifier la forme des 60 questions, les 4 réponses par question, la progression et les contenus génériques éventuels.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {REVIEW_FILTER_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setReviewFilter(option.value)}
                                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                                  reviewFilter === option.value
                                    ? 'border border-cyan-300/30 bg-cyan-400/12 text-cyan-50'
                                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {selectedReviewQuestionCount} {selectedReviewQuestionCount > 1 ? 'questions visibles' : 'question visible'}
                          </span>
                          <span className="block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            Relecture: {reviewSummary.approvedForPilot}/{reviewSummary.totalQuestions} acceptées
                          </span>
                        </div>
                      </div>

                      {reviewFilter === 'dimension' ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                            <span className="text-xs uppercase tracking-[0.24em] text-slate-400">Dimension</span>
                            <select
                              value={reviewDimensionCode}
                              onChange={(event) => setReviewDimensionCode(event.target.value as AssessmentDimensionCode | 'all')}
                              className="bg-transparent text-sm text-white outline-none"
                            >
                              <option value="all">Toutes</option>
                              {sourceVersion.dimensions.map((dimension) => (
                                <option key={dimension.code} value={dimension.code}>
                                  {dimension.code}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </SevenoPanel>

                    <ProfessionalAssessmentNavigation
                      currentIndex={Math.max(0, filteredReviewQuestions.findIndex((record) => record.question.id === resolvedReviewQuestionId))}
                      total={filteredReviewQuestions.length}
                      canGoPrevious={filteredReviewQuestions.length > 0}
                      canGoNext={filteredReviewQuestions.length > 0}
                      onPrevious={() => {
                        const currentIndex = filteredReviewQuestions.findIndex((record) => record.question.id === resolvedReviewQuestionId);
                        const nextIndex = Math.max(0, currentIndex - 1);
                        updateReviewQuestionByFilter(nextIndex);
                      }}
                      onNext={() => {
                        const currentIndex = filteredReviewQuestions.findIndex((record) => record.question.id === resolvedReviewQuestionId);
                        const nextIndex = Math.min(filteredReviewQuestions.length - 1, currentIndex + 1);
                        updateReviewQuestionByFilter(nextIndex);
                      }}
                      onJump={updateReviewQuestionByFilter}
                    />

                    {selectedReviewQuestion ? (
                      <>
                        <ProfessionalAssessmentQuestionView
                          question={selectedReviewQuestion.question}
                          displayIndex={selectedReviewQuestionGlobalIndex + 1}
                          totalQuestions={sourceVersion.questions.length}
                          sectionLabel="Examiner les 60 questions"
                          pathLabel={getQuestionPathLabel(selectedReviewQuestion.question)}
                          difficultyLabel={formatDifficultyLabel(selectedReviewQuestion.question.difficulty)}
                          readingLabel={getQuestionReadingLabel(selectedReviewQuestion.question)}
                          statusLabel={getReviewStatusLabel(selectedReviewQuestion.humanReviewStatus)}
                          warning={detectGenericContent(selectedReviewQuestion.question)}
                        />

                        <SevenoPanel tone="neutral" className="p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Relecture humaine</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              Statut: {getReviewStatusLabel(selectedReviewQuestion.humanReviewStatus)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              Décision finale: {getReviewStatusLabel(selectedReviewQuestion.decisionFinal)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              Contrôle automatique: {selectedReviewQuestion.automatedCheckStatus}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Commentaires</p>
                              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                                {selectedReviewQuestion.reviewComments.length > 0 ? (
                                  selectedReviewQuestion.reviewComments.map((comment) => <li key={comment}>• {comment}</li>)
                                ) : (
                                  <li>Aucun commentaire.</li>
                                )}
                              </ul>
                            </div>
                            <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Corrections proposées</p>
                              <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
                                {selectedReviewQuestion.proposedCorrections.length > 0 ? (
                                  selectedReviewQuestion.proposedCorrections.map((correction) => <li key={correction}>• {correction}</li>)
                                ) : (
                                  <li>Aucune correction proposée.</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </SevenoPanel>
                      </>
                    ) : (
                      <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                        Aucune question ne correspond au filtre courant.
                      </SevenoPanel>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <SevenoPanel tone="neutral" className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Prévisualisation candidat</p>
                          <p className="text-sm leading-7 text-slate-300">
                            Cette simulation utilise le moteur réel de tirage pour produire une séquence locale de 20 questions essentielles et 20 questions approfondies.
                          </p>
                          {loading && !preview ? (
                            <p className="text-sm text-slate-300">Génération du tirage en cours…</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {preview?.essentialQuestionCount ?? essentialDrawSize} essentielles
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {preview?.extendedQuestionCount ?? extendedDrawSize} approfondies
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            Tirage local uniquement
                          </span>
                        </div>
                      </div>
                    </SevenoPanel>

                    {simulationQuestions.length > 0 && selectedSimulationQuestion ? (
                      <>
                        <ProfessionalAssessmentProgress
                          currentIndex={currentSimulationIndex}
                          total={simulationQuestions.length}
                          sectionLabel={currentSimulationSectionLabel}
                        />

                        {showTransitionToExtended ? (
                          <SevenoPanel tone="blue" className="p-4 text-sm leading-7 text-slate-200">
                            Transition visible entre le parcours essentiel et le parcours approfondi.
                          </SevenoPanel>
                        ) : null}

                        <ProfessionalAssessmentNavigation
                          currentIndex={currentSimulationIndex}
                          total={simulationQuestions.length}
                          canGoPrevious={currentSimulationIndex > 0}
                          canGoNext={currentSimulationIndex < simulationQuestions.length - 1}
                          onPrevious={() => updateSimulationQuestion(Math.max(0, currentSimulationIndex - 1))}
                          onNext={() => updateSimulationQuestion(Math.min(simulationQuestions.length - 1, currentSimulationIndex + 1))}
                          onJump={updateSimulationQuestion}
                        />

                        <ProfessionalAssessmentQuestionView
                          question={selectedSimulationQuestion}
                          displayIndex={currentSimulationIndex + 1}
                          totalQuestions={simulationQuestions.length}
                          sectionLabel="Mode prévisualisation administrateur"
                          pathLabel={currentSimulationSectionLabel}
                          difficultyLabel={formatDifficultyLabel(selectedSimulationQuestion.difficulty)}
                          readingLabel={getQuestionReadingLabel(selectedSimulationQuestion)}
                          selectedOptionId={currentSimulationAnswer}
                          onSelectOption={(optionId) => handleSelectAnswer(selectedSimulationQuestion.id, optionId)}
                          footer={(
                            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-slate-300">
                              Les réponses restent locales au navigateur. Aucun enregistrement de session ou de résultat n’est créé dans cette prévisualisation.
                            </p>
                          )}
                        />

                        <details className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-white">
                            Voir les informations internes
                          </summary>
                          <div className="mt-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              <p className="text-sm text-slate-300">Identifiant de la question: {selectedSimulationQuestion.id}</p>
                              <p className="text-sm text-slate-300">Code de la question: {selectedSimulationQuestion.code}</p>
                              <p className="text-sm text-slate-300">Parcours: {selectedSimulationQuestion.path}</p>
                              <p className="text-sm text-slate-300">Difficulté: {selectedSimulationQuestion.difficulty}</p>
                              <p className="text-sm text-slate-300">Dimensions principales: {selectedSimulationQuestion.primaryDimensionCodes.join(', ')}</p>
                              <p className="text-sm text-slate-300">
                                Dimension secondaire: {selectedSimulationQuestion.secondaryDimensionCodes?.join(', ') || 'Aucune'}
                              </p>
                              <p className="text-sm text-slate-300">Rationalité admin: {selectedSimulationQuestion.adminRationale}</p>
                              <p className="text-sm text-slate-300">Statut de relecture: {getReviewStatusLabel(reviewById.get(selectedSimulationQuestion.id)?.humanReviewStatus ?? 'pending')}</p>
                              {preview ? (
                                <p className="text-sm text-slate-300">Seed local: {preview.drawSeed}</p>
                              ) : null}
                            </div>

                            <ProfessionalAssessmentQuestionView
                              question={selectedSimulationQuestion}
                              displayIndex={currentSimulationIndex + 1}
                              totalQuestions={simulationQuestions.length}
                              sectionLabel="Informations internes"
                              pathLabel={currentSimulationSectionLabel}
                              difficultyLabel={formatDifficultyLabel(selectedSimulationQuestion.difficulty)}
                              readingLabel={getQuestionReadingLabel(selectedSimulationQuestion)}
                              selectedOptionId={currentSimulationAnswer}
                              onSelectOption={undefined}
                              showInternalDetails
                            />
                          </div>
                        </details>
                      </>
                    ) : (
                      <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                        {loading ? 'Préparation du tirage candidat…' : 'Aucun tirage candidat n’est disponible pour le moment.'}
                      </SevenoPanel>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
