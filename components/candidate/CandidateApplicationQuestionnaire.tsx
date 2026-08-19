'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CandidatePrivacyNotice } from '@/components/candidate/CandidatePrivacyNotice';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { COMPANY_QUESTION_TIME_LIMIT_SECONDS } from '@/lib/seveno-company-questionnaire-constants';
import {
  getCandidateApplicationQuestionnaireClient,
  startCandidateApplicationQuestionnaireClient,
  submitCandidateApplicationQuestionnaireClient,
} from '@/lib/seveno-application-questionnaires';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type {
  CompanyApplicationQuestionnaireQuestion,
  CompanyApplicationQuestionnaireView,
} from '@/types/seveno-application-questionnaires';

type CandidateApplicationQuestionnaireProps = {
  applicationId: string;
};

type QuestionAnswerValue = string | string[] | boolean | number | null;

function formatDate(value: string | null | undefined) {
  if (!value) {
    return 'En attente';
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(parsed));
}

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return '0 s';
  }

  if (seconds < 60) {
    return `${seconds} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (remaining === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${remaining} s`;
}

function isQuestionAnswered(question: CompanyApplicationQuestionnaireQuestion, value: QuestionAnswerValue) {
  if (question.type === 'multiple_choice') {
    return Array.isArray(value) && value.length > 0;
  }

  if (question.type === 'short_text' || question.type === 'long_text') {
    return typeof value === 'string' && value.trim().length > 0;
  }

  return value !== null && value !== undefined && value !== '';
}

function defaultAnswerValue(question: CompanyApplicationQuestionnaireQuestion | null): QuestionAnswerValue {
  if (!question) {
    return null;
  }

  if (question.type === 'multiple_choice') {
    return [];
  }

  return null;
}

function questionFieldLabel(question: CompanyApplicationQuestionnaireQuestion) {
  if (question.type === 'single_choice') return 'Choix unique';
  if (question.type === 'multiple_choice') return 'Choix multiple';
  if (question.type === 'boolean') return 'Oui / Non';
  if (question.type === 'number') return 'Nombre';
  if (question.type === 'short_text') return 'Texte court';
  return 'Texte libre';
}

export default function CandidateApplicationQuestionnaire({ applicationId }: CandidateApplicationQuestionnaireProps) {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [view, setView] = useState<CompanyApplicationQuestionnaireView | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<QuestionAnswerValue>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientNow, setClientNow] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const timeoutHandledRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClientNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function loadQuestionnaire() {
    if (!authUser) {
      return;
    }

    setLoading(true);
    try {
      const payload = await getCandidateApplicationQuestionnaireClient(authUser, applicationId);
      setView(payload);
      setServerOffsetMs(Date.parse(payload.serverNow) - Date.now());
      timeoutHandledRef.current = false;
      setDraftAnswer(null);
      setError(null);
    } catch (thrownError) {
      setError(
        thrownError instanceof Error
          ? thrownError.message
          : 'Le questionnaire de la candidature n a pas pu etre charge.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let active = true;

    async function load() {
      if (!active) {
        return;
      }

      await loadQuestionnaire();
    }

    void load();

    return () => {
      active = false;
    };
    // The questionnaire is reloaded only when the authenticated candidate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, applicationId]);

  const questionnaire = view?.questionnaire ?? null;
  const assessment = view?.assessment ?? null;
  const attempt = view?.attempt ?? null;
  const currentQuestionIndex = questionnaire && attempt
    ? Math.min(Math.max(attempt.currentQuestionIndex ?? 0, 0), Math.max(questionnaire.questions.length - 1, 0))
    : 0;
  const currentQuestion = questionnaire?.questions[currentQuestionIndex] ?? null;
  const currentQuestionTimeSeconds = attempt?.questionTimeSeconds
    ?? questionnaire?.questionTimeSeconds
    ?? COMPANY_QUESTION_TIME_LIMIT_SECONDS;
  const isInProgress = attempt?.status === 'in_progress' || view?.access.status === 'in_progress';
  const isCompleted = assessment?.status === 'submitted' || assessment?.status === 'completed';
  const isExpired = assessment?.status === 'expired'
    || assessment?.status === 'abandoned'
    || attempt?.status === 'expired'
    || view?.access.reasonCode === 'questionnaire_expired';
  const canStart = Boolean(view?.access.available) || isExpired;
  const remainingSeconds = isInProgress && attempt?.currentQuestionExpiresAt
    ? Math.max(0, Math.ceil((Date.parse(attempt.currentQuestionExpiresAt) - (clientNow + serverOffsetMs)) / 1000))
    : null;
  const estimatedTotalSeconds = questionnaire ? questionnaire.questions.length * currentQuestionTimeSeconds : 0;
  const hasLowTime = remainingSeconds !== null && remainingSeconds <= 5;
  const canSubmit = currentQuestion
    ? !currentQuestion.required || isQuestionAnswered(currentQuestion, draftAnswer)
    : false;

  useEffect(() => {
    if (!currentQuestion) {
      return;
    }

    setDraftAnswer(defaultAnswerValue(currentQuestion));
  }, [currentQuestion]);

  useEffect(() => {
    if (!isInProgress || !currentQuestion || remainingSeconds === null || remainingSeconds > 0) {
      return;
    }

    if (timeoutHandledRef.current) {
      return;
    }

    timeoutHandledRef.current = true;
    void handleSubmit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInProgress, currentQuestion?.id, remainingSeconds]);

  async function handleStart() {
    if (!authUser) {
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const payload = await startCandidateApplicationQuestionnaireClient(authUser, applicationId);
      setView(payload);
      setServerOffsetMs(Date.parse(payload.serverNow) - Date.now());
      timeoutHandledRef.current = false;
      setDraftAnswer(defaultAnswerValue(
        payload.questionnaire?.questions[payload.attempt?.currentQuestionIndex ?? 0]
          ?? payload.questionnaire?.questions[0]
          ?? null,
      ));
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le questionnaire n a pas pu etre demarre.');
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit(timeout = false) {
    if (!authUser || !questionnaire || !currentQuestion || submitting) {
      return;
    }

    if (!timeout && currentQuestion.required && !isQuestionAnswered(currentQuestion, draftAnswer)) {
      if (!timeout) {
        setError('Complétez la réponse avant de passer à la question suivante.');
      }
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await submitCandidateApplicationQuestionnaireClient(authUser, applicationId, {
        sessionId: view?.attempt?.sessionId ?? '',
        questionId: currentQuestion.id,
        answer: timeout ? null : draftAnswer,
        timeout,
        finish: currentQuestionIndex >= questionnaire.questions.length - 1,
      });

      setView(response);
      setServerOffsetMs(Date.parse(response.serverNow) - Date.now());
      timeoutHandledRef.current = false;
      const nextQuestion = response.questionnaire?.questions[response.attempt?.currentQuestionIndex ?? currentQuestionIndex + 1] ?? null;
      setDraftAnswer(defaultAnswerValue(nextQuestion));
    } catch (thrownError) {
      const message = thrownError instanceof Error ? thrownError.message : 'La soumission a échoué.';
      setError(message);
      if (message.toLowerCase().includes('temps imparti')) {
        await loadQuestionnaire();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const prepButtonLabel = isExpired
    ? 'Recommencer le questionnaire'
    : 'Je suis pret, commencer le questionnaire';

  const currentQuestionLabel = currentQuestion
    ? `Question ${currentQuestionIndex + 1} sur ${questionnaire?.questions.length ?? 0}`
    : 'Questionnaire pret';

  return (
    <CandidateShell
      title="Questionnaire de la candidature"
      description="La version du questionnaire est figee pour cette candidature. Le serveur reste l autorite sur la tentative et l expiration."
      actions={(
        <Link
          href={`/candidat/candidatures/${applicationId}`}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          Retour a la candidature
        </Link>
      )}
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Candidat', href: '/candidat' },
            { label: 'Mes candidatures', href: '/candidat/candidatures' },
            { label: 'Questionnaire entreprise' },
          ]}
        />

        {sessionError || error ? (
          <SevenoPanel tone="orange">
            <p className="text-sm text-orange-100">{sessionError ?? error}</p>
          </SevenoPanel>
        ) : null}

        {(sessionLoading || loading) && !view ? (
          <SevenoPanel tone="neutral">
            <p className="text-sm text-slate-400">Chargement du questionnaire...</p>
          </SevenoPanel>
        ) : null}

        {view ? (
          <>
            <SevenoPanel tone="cyan" className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                    Questionnaire entreprise
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {questionnaire?.title ?? 'Questionnaire associe a votre candidature'}
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                    {questionnaire?.instructions
                      || 'Répondez aux questions de cette entreprise sur la version figée de votre candidature.'}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {questionnaire?.questions.length ?? 0} {(questionnaire?.questions.length ?? 0) > 1 ? 'questions' : 'question'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {currentQuestionTimeSeconds} s / question
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Temps max estime : {formatDuration(estimatedTotalSeconds)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      Version {questionnaire?.questionnaireVersion ?? 'n/a'}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                  <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">État</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {isCompleted
                        ? 'Termine'
                        : isExpired
                          ? 'Expire'
                          : isInProgress
                            ? 'En cours'
                            : 'Pret'}
                    </p>
                  </article>
                  <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Timer</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {remainingSeconds === null
                        ? `${currentQuestionTimeSeconds} s / question`
                        : `${remainingSeconds}s`}
                    </p>
                  </article>
                </div>
              </div>
            </SevenoPanel>

            {canStart && !isInProgress && !isCompleted && !isExpired ? (
              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Preparation</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Questionnaire pret</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  Ce questionnaire doit etre realise en une seule session. Chaque question dispose de {currentQuestionTimeSeconds} secondes.
                  Il n y a ni pause ni reprise. Si vous quittez la page ou depassez le temps imparti, vous devrez
                  recommencer depuis le debut.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                    {currentQuestionTimeSeconds
                      ? `Chaque question est chronométrée pendant ${currentQuestionTimeSeconds} ${currentQuestionTimeSeconds > 1 ? 'secondes' : 'seconde'}.`
                      : 'Chaque question est chronometree individuellement.'}
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                    {questionnaire?.questions.length
                      ? `${questionnaire.questions.length} ${questionnaire.questions.length > 1 ? 'questions seront présentées' : 'question sera présentée'} dans la même session.`
                      : 'Le questionnaire ne contient pas encore de questions.'}
                  </article>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleStart()}
                    disabled={starting}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {starting ? 'Demarrage...' : prepButtonLabel}
                  </button>
                  <Link
                    href={`/candidat/candidatures/${applicationId}`}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Retour a la candidature
                  </Link>
                </div>
              </SevenoPanel>
            ) : null}

            {isExpired ? (
              <SevenoPanel tone="orange" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-100/80">Tentative expiree</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Le temps imparti est depasse.</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-orange-50/90">
                  Vous devez recommencer le questionnaire. Cette tentative ne produit aucun score valide.
                </p>
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={starting}
                  className="mt-5 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {starting ? 'Reinitialisation...' : 'Recommencer le questionnaire'}
                </button>
              </SevenoPanel>
            ) : null}

            {isInProgress && questionnaire && currentQuestion ? (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit();
                }}
              >
                <SevenoPanel tone="neutral" className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                        Questionnaire en cours
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{currentQuestionLabel}</h3>
                      <p className="mt-2 text-sm text-slate-400">
                        Question suivante uniquement apres validation, aucune reprise possible.
                      </p>
                    </div>

                    {remainingSeconds !== null ? (
                      <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                        {remainingSeconds}s
                      </div>
                    ) : null}
                  </div>

                  {hasLowTime ? (
                    <p className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
                      Attention, le temps restant est tres faible. Le serveur reste l autorite au moment de l envoi.
                    </p>
                  ) : null}
                </SevenoPanel>

                <SevenoPanel tone="neutral" className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                        {currentQuestionLabel}
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-white">{currentQuestion.prompt}</h4>
                      {currentQuestion.help ? (
                        <p className="mt-2 text-sm leading-7 text-slate-400">{currentQuestion.help}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        {questionFieldLabel(currentQuestion)}
                      </span>
                      {currentQuestion.required ? (
                        <span className="rounded-full border border-orange-300/20 bg-orange-400/10 px-3 py-1 text-orange-100">
                          Obligatoire
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          Facultatif
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        {currentQuestion.points} {currentQuestion.points > 1 ? 'points' : 'point'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {currentQuestion.type === 'single_choice'
                      ? currentQuestion.options.map((option) => (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                              draftAnswer === option.id
                                ? 'border-cyan-300/40 bg-cyan-400/10 text-white'
                                : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            <input
                              type="radio"
                              name={currentQuestion.id}
                              checked={draftAnswer === option.id}
                              onChange={() => setDraftAnswer(option.id)}
                              className="h-4 w-4 border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                            />
                            <span className="font-medium">{option.label}</span>
                          </label>
                        ))
                      : null}

                    {currentQuestion.type === 'multiple_choice'
                      ? currentQuestion.options.map((option) => {
                          const selected = Array.isArray(draftAnswer) && draftAnswer.includes(option.id);
                          return (
                            <label
                              key={option.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                selected
                                  ? 'border-cyan-300/40 bg-cyan-400/10 text-white'
                                  : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => {
                                  setDraftAnswer((current) => {
                                    const currentValues = Array.isArray(current) ? current : [];
                                    const next = [...currentValues];

                                    if (event.target.checked) {
                                      if (!next.includes(option.id)) {
                                        next.push(option.id);
                                      }
                                    } else {
                                      const index = next.indexOf(option.id);
                                      if (index >= 0) {
                                        next.splice(index, 1);
                                      }
                                    }

                                    return next;
                                  });
                                }}
                                className="h-4 w-4 border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                              />
                              <span className="font-medium">{option.label}</span>
                            </label>
                          );
                        })
                      : null}

                    {currentQuestion.type === 'boolean' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { value: true, label: 'Oui' },
                          { value: false, label: 'Non' },
                        ].map((option) => {
                          const selected = draftAnswer === option.value;
                          return (
                            <label
                              key={option.label}
                              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                                selected
                                  ? 'border-cyan-300/40 bg-cyan-400/10 text-white'
                                  : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                              }`}
                            >
                              <input
                                type="radio"
                                name={currentQuestion.id}
                                checked={selected}
                                onChange={() => setDraftAnswer(option.value)}
                                className="h-4 w-4 border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                              />
                              <span className="font-medium">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}

                    {currentQuestion.type === 'number' ? (
                      <input
                        type="number"
                        value={typeof draftAnswer === 'number' ? draftAnswer : ''}
                        onChange={(event) => {
                          const nextValue = event.target.value === '' ? null : Number(event.target.value);
                          setDraftAnswer(Number.isFinite(nextValue) ? nextValue : null);
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    ) : null}

                    {currentQuestion.type === 'short_text' ? (
                      <input
                        type="text"
                        maxLength={currentQuestion.maxLength ?? 240}
                        value={typeof draftAnswer === 'string' ? draftAnswer : ''}
                        onChange={(event) => setDraftAnswer(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    ) : null}

                    {currentQuestion.type === 'long_text' ? (
                      <textarea
                        rows={5}
                        maxLength={currentQuestion.maxLength ?? 2000}
                        value={typeof draftAnswer === 'string' ? draftAnswer : ''}
                        onChange={(event) => setDraftAnswer(event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    ) : null}
                  </div>
                </SevenoPanel>

                <CandidatePrivacyNotice message="Vos réponses détaillées restent privées. Elles servent seulement au traitement de cette candidature et ne modifient pas votre profil anonyme." />

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={submitting || !canSubmit}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting
                      ? 'Envoi en cours...'
                      : currentQuestionIndex >= (questionnaire?.questions.length ?? 0) - 1
                        ? 'Terminer le questionnaire'
                        : 'Question suivante'}
                  </button>
                  <Link
                    href={`/candidat/candidatures/${applicationId}`}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Retour a la candidature
                  </Link>
                </div>
              </form>
            ) : null}

            {isCompleted ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CandidateStatusCard
                  tone="cyan"
                  label="État"
                  value={assessment?.status === 'completed' ? 'Termine' : 'En attente'}
                  note="Le questionnaire appartient a cette candidature uniquement."
                />
                <CandidateStatusCard
                  tone="blue"
                  label="Score automatique"
                  value={
                    assessment?.automaticScorePercent !== null && assessment?.automaticScorePercent !== undefined
                      ? `${Math.round(assessment.automaticScorePercent)}%`
                      : 'En attente'
                  }
                  note="Le calcul serveur reste distinct de votre profil anonyme."
                />
                <CandidateStatusCard
                  tone="orange"
                  label="Questions libres"
                  value={assessment?.manualQuestionsCount ?? 0}
                  note="Ces réponses attendent un examen manuel si l’entreprise les a prévues."
                />
                <CandidateStatusCard
                  tone="neutral"
                  label="Date de soumission"
                  value={formatDate(assessment?.submittedAt ?? null)}
                  note="La date est conservée côté serveur."
                />
              </div>
            ) : null}

            {!view.access.available && view.access.status === 'unavailable' ? (
              <SevenoPanel tone="orange" className="p-5">
                <p className="text-sm leading-7 text-orange-100">
                  {view.access.reason ?? 'Le questionnaire de cette candidature est indisponible.'}
                </p>
              </SevenoPanel>
            ) : null}
          </>
        ) : null}
      </div>
    </CandidateShell>
  );
}
