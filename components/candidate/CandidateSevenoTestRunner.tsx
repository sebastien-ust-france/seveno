'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { buildProfessionalAssessmentCandidateBehavioralProfile } from '@/lib/seveno-professional-assessment';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import {
  getCandidateSevenoTestStateClient,
  startCandidateSevenoTestSessionClient,
  submitCandidateSevenoTestSessionClient,
} from '@/lib/seveno-tests-client';
import type { SevenoAssessmentScores, SevenoTestStartState } from '@/types/seveno';

const SEVENO_TEST_QUESTION_TIME_SECONDS = 30;

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Non renseigné';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Non renseigné';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
  }

  return `${minutes} min ${remainingSeconds.toString().padStart(2, '0')} s`;
}

function getQuestionnaireStateLabel(state: SevenoTestStartState | null) {
  if (state?.assessment?.status === 'completed') {
    return 'Terminé';
  }

  if (state?.session) {
    return 'Session en cours';
  }

  return 'À démarrer';
}

function getQuestionnaireStateNote(state: SevenoTestStartState | null) {
  if (state?.assessment?.status === 'completed') {
    return 'Votre analyse professionnelle Seven’O est enregistrée. Vous pouvez relire votre résultat ou revenir au tableau de bord.';
  }

  if (state?.session) {
    return 'Une session réelle est déjà active. Elle se recharge ici sans recréer un nouveau parcours.';
  }

  return 'Lancez la session réelle depuis cet écran. Le questionnaire reste chronométré du début à la soumission.';
}

function getDimensionLabel(scoresByDimension?: SevenoAssessmentScores | null) {
  if (!scoresByDimension) {
    return [];
  }

  return Object.entries(scoresByDimension).map(([dimension, score]) => ({
    dimension,
    score,
  }));
}

export function CandidateSevenoTestRunner() {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [state, setState] = useState<SevenoTestStartState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [clientNow, setClientNow] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const autoAdvanceHandledRef = useRef<string | null>(null);

  const activeSession = state?.session ?? null;
  const questionnaireCompleted = state?.assessment?.status === 'completed';
  const preparation = state?.preparation ?? null;
  const questionnaire = activeSession?.questions ?? [];
  const questionCount = questionnaire.length;
  const currentQuestionIndex = activeSession?.currentQuestionIndex ?? 0;
  const currentQuestion = activeSession
    ? questionnaire[Math.min(Math.max(currentQuestionIndex, 0), Math.max(questionCount - 1, 0))] ?? null
    : null;
  const questionTimeSeconds = activeSession?.questionTimeSeconds ?? SEVENO_TEST_QUESTION_TIME_SECONDS;
  const remainingQuestionSeconds = activeSession?.questionExpiresAt
    ? Math.max(0, Math.ceil((Date.parse(activeSession.questionExpiresAt) - (clientNow + serverOffsetMs)) / 1000))
    : null;
  const questionnaireStatusLabel = getQuestionnaireStateLabel(state);
  const questionnaireStatusNote = getQuestionnaireStateNote(state);
  const finalScore = state?.assessment?.overallScore ?? null;
  const dimensionScores = getDimensionLabel(state?.assessment?.scoresByDimension);
  const completedAssessment = state?.assessment ?? null;
  const completedBehavioralProfile = completedAssessment?.behavioralProfile ?? null;
  const completedAssessmentSchemaVersion = completedAssessment?.professionalAssessmentSchemaVersion ?? null;
  const completedBehavioralProfileV2 = completedAssessmentSchemaVersion === 2;
  const completedBehavioralPresentation = completedBehavioralProfileV2 && completedBehavioralProfile
    ? buildProfessionalAssessmentCandidateBehavioralProfile(completedBehavioralProfile.axisResults)
    : null;
  const completedBehavioralNarrativeParagraphs = completedBehavioralPresentation?.candidateNarrativeParagraphs ?? [];
  const completedBehavioralThemeGroups = completedBehavioralPresentation?.candidateThemeGroups ?? [];
  const completedBehavioralDisclaimer = completedBehavioralPresentation?.disclaimer
    ?? completedBehavioralProfile?.disclaimer
    ?? completedAssessment?.disclaimer
    ?? null;

  const preparationCardItems = state
    ? [
        {
          tone: 'cyan' as const,
          label: 'État',
          value: questionnaireStatusLabel,
          note: questionnaireStatusNote,
        },
        {
          tone: 'violet' as const,
          label: 'Questions',
          value: String(preparation?.totalQuestions ?? 0),
          note: preparation ? `${preparation.questionBankCode} · version ${preparation.questionnaireVersion}` : 'Non renseigné',
        },
        {
          tone: 'orange' as const,
          label: 'Durée',
          value: preparation ? formatCountdown(preparation.durationSeconds) : 'Non renseigné',
          note: 'Session réelle, chronométrée et sans pause.',
        },
      ]
    : [];

  useEffect(() => {
    let active = true;

    async function loadState() {
      if (!authUser) {
        return;
      }

      setLoadingState(true);
      setError(null);

      try {
        const payload = await getCandidateSevenoTestStateClient(authUser);
        if (!active) {
          return;
        }

        setState(payload);
        setCurrentAnswer('');
        setServerOffsetMs(payload.session ? Date.parse(payload.session.serverNow) - Date.now() : 0);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire Seven’O est indisponible.');
      } finally {
        if (active) {
          setLoadingState(false);
        }
      }
    }

    void loadState();

    return () => {
      active = false;
    };
  }, [authUser]);

  useEffect(() => {
    if (!activeSession || questionnaireCompleted) {
      return;
    }

    const timer = window.setInterval(() => {
      setClientNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeSession, questionnaireCompleted]);

  useEffect(() => {
    if (!activeSession) {
      autoAdvanceHandledRef.current = null;
      return;
    }

    autoAdvanceHandledRef.current = null;
  }, [activeSession, currentQuestionIndex]);

  useEffect(() => {
    if (!activeSession || questionnaireCompleted || !currentQuestion || remainingQuestionSeconds === null) {
      return;
    }

    if (remainingQuestionSeconds !== 0) {
      return;
    }

    const autoAdvanceKey = `${activeSession.sessionId}:${currentQuestion.id}:${currentQuestionIndex}`;
    if (autoAdvanceHandledRef.current === autoAdvanceKey) {
      return;
    }

    autoAdvanceHandledRef.current = autoAdvanceKey;
    void handleAdvanceQuestion(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.sessionId, questionnaireCompleted, currentQuestion?.id, currentQuestionIndex, remainingQuestionSeconds]);

  async function handleStartSession() {
    if (!authUser) {
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const session = await startCandidateSevenoTestSessionClient(authUser);
      setState((current) => {
        const preparationState = current?.preparation ?? {
          questionBankCode: session.questionBankCode,
          questionnaireVersion: '1.0.0',
          durationSeconds: session.durationSeconds,
          totalQuestions: session.totalQuestions,
        };

        return {
          preparation: preparationState,
          assessment: null,
          session,
        };
      });
      setCurrentAnswer('');
      setServerOffsetMs(Date.parse(session.serverNow) - Date.now());
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire Seven’O n’a pas pu être lancé.');
    } finally {
      setStarting(false);
    }
  }

  async function handleAdvanceQuestion(timeout = false) {
    const session = activeSession;
    const question = currentQuestion;
    if (!authUser || !session || !question || submitting) {
      return;
    }

    setSubmitting(true);

    try {
      if (!timeout && !currentAnswer) {
        setError('Répondez à la question avant de passer à la suivante.');
        return;
      }

      setError(null);
      const nextState = await submitCandidateSevenoTestSessionClient(authUser, {
        sessionId: session.sessionId,
        questionId: question.id,
        answer: timeout ? null : currentAnswer,
        timeout,
      });

      setState(nextState);
      setCurrentAnswer('');
      setServerOffsetMs(nextState.session ? Date.parse(nextState.session.serverNow) - Date.now() : 0);
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionLoading || loadingState) {
    return (
      <CandidateShell
        title="Questionnaire général Seven’O"
        description="Cette page ouvre la session réelle du moteur Seven’O. Elle conserve la durée, l’état actif et le résultat final du candidat."
        actions={(
          <Link
            href="/candidat"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Retour au tableau de bord candidat
          </Link>
        )}
      >
        <SevenoPanel tone="neutral" className="p-5">
          <p className="text-sm text-slate-300">Chargement de votre session Seven’O…</p>
        </SevenoPanel>
      </CandidateShell>
    );
  }

  if (sessionError || error) {
    return (
      <CandidateShell
        title="Questionnaire général Seven’O"
        description="Cette page ouvre la session réelle du moteur Seven’O. Elle conserve la durée, l’état actif et le résultat final du candidat."
        actions={(
          <Link
            href="/candidat"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Retour au tableau de bord candidat
          </Link>
        )}
      >
        <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
          {sessionError ?? error}
        </SevenoPanel>
      </CandidateShell>
    );
  }

  if (questionnaireCompleted && state?.assessment) {
    if (completedBehavioralProfileV2) {
      return (
        <CandidateShell
          title="Questionnaire général Seven’O"
          description="Cette page ouvre la session réelle du moteur Seven’O. Elle conserve la durée, l’état actif et le résultat final du candidat."
          actions={(
            <Link
              href="/candidat"
              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Retour au tableau de bord candidat
            </Link>
          )}
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {preparationCardItems.map((card) => (
                <CandidateStatusCard
                  key={card.label}
                  tone={card.tone}
                  label={card.label}
                  value={card.value}
                  note={card.note}
                />
              ))}
            </div>

            <SevenoPanel tone="cyan" className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">PROFIL COMPORTEMENTAL</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Votre profil de tendances professionnelles</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Voici les principales tendances qui ressortent de vos réponses.
              </p>

              {completedBehavioralNarrativeParagraphs.length > 0 ? (
                <div className="mt-5 space-y-3 rounded-[20px] border border-cyan-300/15 bg-cyan-400/10 px-4 py-4 text-sm leading-7 text-cyan-50">
                  {completedBehavioralNarrativeParagraphs.map((paragraph, index) => (
                    <p key={`${index}-${paragraph}`}>{paragraph}</p>
                  ))}
                </div>
              ) : null}

              {completedBehavioralThemeGroups.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  {completedBehavioralThemeGroups.map((group) => (
                    <article key={group.code} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{group.title}</p>
                      <div className="mt-3 space-y-2">
                        {group.items.map((item, index) => (
                          <p key={`${group.code}-${index}`} className="text-sm leading-7 text-slate-200">{item}</p>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              {completedBehavioralDisclaimer ? (
                <p className="mt-5 text-sm leading-7 text-slate-300">{completedBehavioralDisclaimer}</p>
              ) : null}
            </SevenoPanel>
          </div>
        </CandidateShell>
      );
    }

    return (
      <CandidateShell
        title="Questionnaire général Seven’O"
        description="Cette page ouvre la session réelle du moteur Seven’O. Elle conserve la durée, l’état actif et le résultat final du candidat."
        actions={(
          <Link
            href="/candidat"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Retour au tableau de bord candidat
          </Link>
        )}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {preparationCardItems.map((card) => (
              <CandidateStatusCard
                key={card.label}
                tone={card.tone}
                label={card.label}
                value={card.value}
                note={card.note}
              />
            ))}
          </div>

          <SevenoPanel tone="cyan" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Résultat</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Votre session Seven’O est terminée</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Vous pouvez relire votre score et revenir au tableau de bord candidat quand vous le souhaitez.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <CandidateStatusCard
                tone="cyan"
                label="Score final"
                value={finalScore !== null ? `${finalScore} %` : 'Non disponible'}
                note="Score global calculé par le moteur Seven’O."
              />
              <CandidateStatusCard
                tone="violet"
                label="Version"
                value={state.assessment.questionnaireVersion}
                note={`Terminé le ${formatDateTime(state.assessment.completedAt as unknown as string | null)}`}
              />
              <CandidateStatusCard
                tone="orange"
                label="Statut"
                value="Validé"
                note="Le parcours candidat conserve la session terminée en lecture."
              />
            </div>

            {dimensionScores.length > 0 ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {dimensionScores.map((entry) => (
                  <article key={entry.dimension} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{entry.dimension}</p>
                    <p className="mt-2 text-sm font-medium text-white">{entry.score} %</p>
                  </article>
                ))}
              </div>
            ) : null}
          </SevenoPanel>
        </div>
      </CandidateShell>
    );
  }

  return (
    <CandidateShell
      title="Questionnaire général Seven’O"
      description="Cette page ouvre la session réelle du moteur Seven’O. Elle conserve la durée, l’état actif et le résultat final du candidat."
      actions={(
        <Link
          href="/candidat"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
        >
          Retour au tableau de bord candidat
        </Link>
      )}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {preparationCardItems.map((card) => (
            <CandidateStatusCard
              key={card.label}
              tone={card.tone}
              label={card.label}
              value={card.value}
              note={card.note}
            />
          ))}
        </div>

        <SevenoPanel tone="violet" className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Session réelle</p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {activeSession ? 'Session chronométrée en cours' : 'Lancer le questionnaire'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {activeSession
                  ? 'Une seule question est affichée à la fois. Répondez ou laissez le temps expirer pour passer à la suivante.'
                  : 'Le moteur Seven’O ouvre une session réelle et chronométrée. Vous répondez question par question avant la soumission finale.'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => void handleStartSession()}
                disabled={starting || Boolean(state?.session)}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {activeSession ? 'Continuer la session' : starting ? 'Ouverture…' : 'Commencer le questionnaire'}
              </button>
            </div>
          </div>
        </SevenoPanel>

        {activeSession && currentQuestion ? (
          <form className="space-y-5" onSubmit={(event) => void event.preventDefault()}>
            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Question courante</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Session active Seven’O</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Version {preparation?.questionnaireVersion ?? 'Non renseigné'} · {questionCount} questions · durée estimée {preparation ? formatCountdown(preparation.durationSeconds) : 'Non renseigné'}.
                  </p>
                </div>

                <div className="space-y-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300 lg:min-w-[18rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Question courante</p>
                  <p className="font-medium text-white">
                    {Math.min(currentQuestionIndex + 1, questionCount)} / {questionCount}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Temps restant</p>
                  <p className="font-medium text-white">
                    {remainingQuestionSeconds !== null ? formatCountdown(remainingQuestionSeconds) : `${questionTimeSeconds} s / question`}
                  </p>
                  <p>Session : {activeSession.sessionId}</p>
                  <p>Début question : {formatDateTime(activeSession.questionStartedAt as unknown as string | null)}</p>
                </div>
              </div>
            </SevenoPanel>

            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    Question {Math.min(currentQuestionIndex + 1, questionCount)} / {questionCount}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{currentQuestion.question}</h3>
                  {currentQuestion.dimension ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">{currentQuestion.dimension}</p>
                  ) : null}
                </div>

                <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                  {remainingQuestionSeconds !== null ? formatCountdown(remainingQuestionSeconds) : `${questionTimeSeconds} s / question`}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {currentQuestion.options.map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                      currentAnswer === option.id
                        ? 'border-cyan-300/40 bg-cyan-400/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="radio"
                      name={currentQuestion.id}
                      value={option.id}
                      checked={currentAnswer === option.id}
                      onChange={() => {
                        setCurrentAnswer(option.id);
                        setError(null);
                      }}
                      className="mt-1 accent-cyan-400"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </SevenoPanel>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleAdvanceQuestion(false)}
                disabled={submitting || !currentAnswer}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting
                  ? 'Soumission…'
                  : currentQuestionIndex >= questionCount - 1
                    ? 'Soumettre mes réponses'
                    : 'Question suivante'}
              </button>
              <Link
                href="/candidat"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Retour au tableau de bord
              </Link>
            </div>
          </form>
        ) : (
          <SevenoPanel tone="neutral" className="p-5">
            <p className="text-sm leading-7 text-slate-300">
              {questionnaireCompleted
                ? 'Votre questionnaire est terminé. Le résultat est consultable ci-dessus et le tableau de bord candidat est à jour.'
                : 'Aucune session n’est active pour le moment. Lancez le questionnaire pour ouvrir la version réelle du moteur Seven’O.'}
            </p>
          </SevenoPanel>
        )}
      </div>
    </CandidateShell>
  );
}
