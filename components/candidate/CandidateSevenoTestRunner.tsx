'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import {
  getCandidateSevenoTestStateClient,
  startCandidateSevenoTestSessionClient,
  submitCandidateSevenoTestSessionClient,
} from '@/lib/seveno-tests-client';
import type { PublicTestQuestion, SevenoAssessmentScores, SevenoTestStartState } from '@/types/seveno';

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

function getDefaultAnswers(questions: PublicTestQuestion[]) {
  const answers: Record<string, string> = {};
  for (const question of questions) {
    if (question.options.length > 0) {
      answers[question.id] = '';
    }
  }
  return answers;
}

export function CandidateSevenoTestRunner() {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [state, setState] = useState<SevenoTestStartState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [clientNow, setClientNow] = useState(() => Date.now());
  const activeSession = state?.session ?? null;

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
        setAnswers(payload.session ? getDefaultAnswers(payload.session.questions) : {});
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
    if (!activeSession) {
      return;
    }

    const timer = window.setInterval(() => {
      setClientNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    setServerOffsetMs(Date.parse(activeSession.serverNow) - Date.now());
  }, [activeSession]);

  const questionnaire = state?.session?.questions ?? [];
  const questionnaireStatusLabel = getQuestionnaireStateLabel(state);
  const questionnaireStatusNote = getQuestionnaireStateNote(state);
  const questionnaireCompleted = state?.assessment?.status === 'completed';
  const preparation = state?.preparation ?? null;
  const hasActiveSession = Boolean(activeSession);
  const remainingSeconds = activeSession
    ? Math.max(0, Math.ceil((Date.parse(activeSession.expiresAt) - (clientNow + serverOffsetMs)) / 1000))
    : null;
  const allQuestionsAnswered = hasActiveSession
    ? questionnaire.every((question) => typeof answers[question.id] === 'string' && answers[question.id].trim().length > 0)
    : false;
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

  async function handleStartSession() {
    if (!authUser) {
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const session = await startCandidateSevenoTestSessionClient(authUser);
        setState((current) => {
          const preparation = current?.preparation ?? {
            questionBankCode: session.questionBankCode,
            questionnaireVersion: '1.0.0',
            durationSeconds: session.durationSeconds,
            totalQuestions: session.totalQuestions,
        };

        return {
          preparation,
          assessment: null,
          session,
        };
      });
      setAnswers(getDefaultAnswers(session.questions));
      setServerOffsetMs(Date.parse(session.serverNow) - Date.now());
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire Seven’O n’a pas pu être lancé.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const session = activeSession;
    if (!authUser || !session || submitting) {
      return;
    }

    if (!allQuestionsAnswered) {
      setError('Répondez à toutes les questions avant de soumettre la session.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitCandidateSevenoTestSessionClient(authUser, {
        sessionId: session.sessionId,
        answers,
      });

      const refreshed = await getCandidateSevenoTestStateClient(authUser);
      setState(refreshed);
      setAnswers(refreshed.session ? getDefaultAnswers(refreshed.session.questions) : {});
      setServerOffsetMs(refreshed.session ? Date.parse(refreshed.session.serverNow) - Date.now() : 0);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La soumission du questionnaire a échoué.');
    } finally {
      setSubmitting(false);
    }
  }

  const finalScore = state?.assessment?.overallScore ?? null;
  const dimensionScores = getDimensionLabel(state?.assessment?.scoresByDimension);

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
      {sessionLoading || loadingState ? (
        <SevenoPanel tone="neutral" className="p-5">
          <p className="text-sm text-slate-300">Chargement de votre session Seven’O…</p>
        </SevenoPanel>
      ) : sessionError || error ? (
        <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
          {sessionError ?? error}
        </SevenoPanel>
      ) : questionnaireCompleted && state?.assessment ? (
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
      ) : (
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
                  {hasActiveSession ? 'Reprendre la session chronométrée' : 'Lancer le questionnaire'}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {hasActiveSession
                    ? 'Votre session en cours se recharge ici sans être recréée. Chaque soumission reste liée à la même tentative.'
                    : 'Le moteur Seven’O ouvre une session réelle et chronométrée. Vous répondez à toutes les questions avant la soumission finale.'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartSession()}
                  disabled={starting || Boolean(state?.session)}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {hasActiveSession ? 'Continuer la session' : starting ? 'Ouverture…' : 'Commencer le questionnaire'}
                </button>
              </div>
            </div>
          </SevenoPanel>

          {hasActiveSession && activeSession ? (
            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <SevenoPanel tone="neutral" className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Chronomètre</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Session active Seven’O</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      Version {preparation?.questionnaireVersion ?? 'Non renseigné'} · {preparation?.totalQuestions ?? 0} questions · durée estimée {preparation ? formatCountdown(preparation.durationSeconds) : 'Non renseigné'}.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300 lg:min-w-[18rem]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Temps restant</p>
                    <p className="font-medium text-white">{remainingSeconds !== null ? formatCountdown(remainingSeconds) : 'Non disponible'}</p>
                    <p>Session : {activeSession.sessionId}</p>
                    <p>Début : {formatDateTime(activeSession.startedAt)}</p>
                    <p>Fin : {formatDateTime(activeSession.expiresAt)}</p>
                  </div>
                </div>
              </SevenoPanel>

              <div className="space-y-4">
                {questionnaire.map((question, index) => (
                  <SevenoPanel key={question.id} tone="neutral" className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                      Question {index + 1} / {questionnaire.length}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{question.question}</h3>
                    {question.dimension ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">{question.dimension}</p>
                    ) : null}

                    <div className="mt-4 grid gap-3">
                      {question.options.map((option) => (
                        <label
                          key={option.id}
                          className="flex cursor-pointer items-start gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={(answers[question.id] ?? '') === option.id}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                            className="mt-1 accent-cyan-400"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </SevenoPanel>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={submitting || !allQuestionsAnswered}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Soumission…' : 'Soumettre mes réponses'}
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
      )}
    </CandidateShell>
  );
}
