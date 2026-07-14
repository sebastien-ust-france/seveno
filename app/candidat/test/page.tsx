'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser } from '@/lib/auth';
import { ensureSevenoUser, resolveSevenoRedirect } from '@/lib/seveno-users';
import { CandidatePrivacyNotice } from '@/components/candidate/CandidatePrivacyNotice';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel, type SevenoTone } from '@/components/seveno/SevenoLayout';
import type {
  SevenoUser,
  SevenoAssessmentPreparation,
  SevenoAssessmentSummary,
  TestSessionStartResult,
  TestSessionSubmitResult,
} from '@/types/seveno';

type TestStage = 'intro' | 'in_progress' | 'expired' | 'result';

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function getScoreTone(passed: boolean) {
  return passed
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
    : 'border-amber-400/20 bg-amber-400/10 text-amber-100';
}

function getQuestionTone(index: number): SevenoTone {
  if (index % 3 === 0) {
    return 'cyan';
  }

  if (index % 3 === 1) {
    return 'violet';
  }

  return 'orange';
}

export default function CandidateTestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<TestStage>('intro');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SevenoUser | null>(null);
  const [preparation, setPreparation] = useState<SevenoAssessmentPreparation | null>(null);
  const [assessmentSummary, setAssessmentSummary] = useState<SevenoAssessmentSummary | null>(null);
  const [session, setSession] = useState<TestSessionStartResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitResult, setSubmitResult] = useState<TestSessionSubmitResult | null>(null);

  const answersRef = useRef<Record<string, string>>({});
  const sessionRef = useRef<TestSessionStartResult | null>(null);
  const submitResultRef = useRef<TestSessionSubmitResult | null>(null);
  const submittingRef = useRef(false);
  const startingRef = useRef(false);
  const authTokenRef = useRef<string | null>(null);
  const stageRef = useRef<TestStage>('intro');

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    submitResultRef.current = submitResult;
  }, [submitResult]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    startingRef.current = starting;
  }, [starting]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    let active = true;

    async function loadPreparation() {
      try {
        const authUser = await getCurrentAuthUser();
        if (!active) {
          return;
        }

        if (!authUser) {
          router.replace('/connexion');
          return;
        }

        const sevenoUser = await ensureSevenoUser(authUser);
        if (!active) {
          return;
        }

        if (!sevenoUser.role) {
          router.replace('/onboarding');
          return;
        }

        if (sevenoUser.role !== 'candidate') {
          router.replace(resolveSevenoRedirect(sevenoUser));
          return;
        }

        const token = await authUser.getIdToken();
        authTokenRef.current = token;
        const response = await fetch('/api/seveno/tests/start', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json()) as
          | { preparation?: SevenoAssessmentPreparation; assessment?: SevenoAssessmentSummary | null }
          | { error?: string; message?: string };
        if (!response.ok) {
          const errorPayload = payload as { message?: string };
          throw new Error(errorPayload.message ?? "La préparation du questionnaire Seven'O a échoué.");
        }

        const preparationPayload = (payload as { preparation?: SevenoAssessmentPreparation }).preparation;
        if (!preparationPayload) {
          throw new Error("Les informations de préparation du questionnaire sont absentes.");
        }
        setUser(sevenoUser);
        setPreparation(preparationPayload);
        setAssessmentSummary((payload as { assessment?: SevenoAssessmentSummary | null }).assessment ?? null);
        setSession(null);
        setRemainingSeconds(0);
        setStage('intro');
        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : "Le questionnaire Seven'O n'a pas pu être chargé.");
        setLoading(false);
      }
    }

    void loadPreparation();

    return () => {
      active = false;
    };
  }, [router]);

  const abandonSession = useCallback(async (sessionId: string) => {
    const token = authTokenRef.current;
    if (!token) return;
    await fetch('/api/seveno/tests/abandon', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (!session || stage !== 'in_progress') {
      return;
    }

    const serverRemainingMs = Math.max(0, Date.parse(session.expiresAt) - Date.parse(session.serverNow));
    const localDeadlineMs = Date.now() + serverRemainingMs;
    const sessionId = session.sessionId;

    function updateCountdown() {
      const nextRemaining = Math.max(0, Math.ceil((localDeadlineMs - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);

      if (nextRemaining === 0 && !submitResultRef.current && stageRef.current === 'in_progress') {
        stageRef.current = 'expired';
        setStage('expired');
        setError('Le temps imparti est dépassé. Vous devez recommencer le questionnaire.');
        void abandonSession(sessionId);
      }
    }

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [abandonSession, session, stage]);

  const submitAnswers = useCallback(
    async () => {
      if (submittingRef.current || submitResultRef.current) {
        return;
      }

      const currentSession = sessionRef.current;
      if (!currentSession) {
        return;
      }

      const currentAnswers = answersRef.current;
      if (Object.keys(currentAnswers).length !== currentSession.totalQuestions) {
        setError("Répondez à toutes les questions avant d'envoyer le questionnaire.");
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        const authUser = await getCurrentAuthUser();
        if (!authUser) {
          router.replace('/connexion');
          return;
        }

        const token = await authUser.getIdToken();
        const response = await fetch('/api/seveno/tests/submit', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: currentSession.sessionId,
            answers: currentAnswers,
          }),
        });

        const payload = (await response.json()) as TestSessionSubmitResult | { error?: string; message?: string };
        if (!response.ok) {
          const errorPayload = payload as { error?: string; message?: string };
          if (errorPayload.error === 'session_expired') {
            setStage('expired');
            setRemainingSeconds(0);
          }
          throw new Error(errorPayload.message ?? 'La soumission du test a echoue.');
        }

        setSubmitResult(payload as TestSessionSubmitResult);
        setStage('result');
        setRemainingSeconds(0);
      } catch (thrownError) {
        setError(thrownError instanceof Error ? thrownError.message : 'La soumission du test a echoue.');
      } finally {
        setSubmitting(false);
      }
    },
    [router],
  );

  useEffect(() => {
    function closeInterruptedSession() {
      const currentSession = sessionRef.current;
      if (stageRef.current === 'in_progress' && currentSession) {
        stageRef.current = 'expired';
        void abandonSession(currentSession.sessionId);
      }
    }

    window.addEventListener('pagehide', closeInterruptedSession);
    window.addEventListener('beforeunload', closeInterruptedSession);
    return () => {
      window.removeEventListener('pagehide', closeInterruptedSession);
      window.removeEventListener('beforeunload', closeInterruptedSession);
      closeInterruptedSession();
    };
  }, [abandonSession]);

  function handleQuestionAnswer(questionId: string, optionId: string) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionId,
    }));
  }

  async function handleStartTest() {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setSubmitResult(null);

    try {
      const authUser = await getCurrentAuthUser();
      if (!authUser) {
        router.replace('/connexion');
        return;
      }
      const token = await authUser.getIdToken();
      authTokenRef.current = token;
      const response = await fetch('/api/seveno/tests/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as TestSessionStartResult | { error?: string; message?: string };
      if (!response.ok) {
        throw new Error((payload as { message?: string }).message ?? "Le questionnaire Seven'O n'a pas pu être lancé.");
      }

      const nextSession = payload as TestSessionStartResult;
      const serverRemainingSeconds = Math.max(
        0,
        Math.ceil((Date.parse(nextSession.expiresAt) - Date.parse(nextSession.serverNow)) / 1000),
      );
      sessionRef.current = nextSession;
      stageRef.current = 'in_progress';
      setSession(nextSession);
      setRemainingSeconds(serverRemainingSeconds);
      setStage('in_progress');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : "Le questionnaire Seven'O n'a pas pu être lancé.");
      setStage('intro');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  async function handleRestartTest() {
    const currentSession = sessionRef.current;
    if (currentSession) {
      await abandonSession(currentSession.sessionId);
    }
    sessionRef.current = null;
    setSession(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setError(null);
    await handleStartTest();
  }

  function handlePreviousQuestion() {
    setCurrentQuestionIndex((current) => Math.max(0, current - 1));
  }

  function handleNextQuestion() {
    if (!session) {
      return;
    }

    const lastIndex = Math.max(0, session.questions.length - 1);
    if (currentQuestionIndex >= lastIndex) {
      void submitAnswers();
      return;
    }

    setCurrentQuestionIndex((current) => Math.min(lastIndex, current + 1));
  }

  const answerCount = Object.keys(answers).length;
  const totalQuestions = session?.totalQuestions ?? preparation?.totalQuestions ?? 0;
  const currentQuestion = session?.questions[currentQuestionIndex] ?? null;
  const progressRatio = totalQuestions > 0 ? Math.min(1, (currentQuestionIndex + 1) / totalQuestions) : 0;
  const lowTime = remainingSeconds > 0 && remainingSeconds <= 180;
  const questionnaireCompleted = assessmentSummary?.status === 'completed';

  return (
    <CandidateShell
      title="Évaluation Seven'O"
      description="Ce questionnaire général évalue votre manière de travailler. Il ne constitue pas une preuve technique liée à un métier."
      footer={user ? <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session: {user.uid}</p> : null}
    >
      {loading ? (
        <SevenoPanel tone="neutral" className="px-4 py-4 text-sm text-slate-300">
          Chargement du questionnaire Seven&apos;O...
        </SevenoPanel>
      ) : !preparation ? (
        <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">{error}</SevenoPanel>
      ) : (
        <div className="space-y-6">
          <Breadcrumbs
            items={[
              { label: 'Candidat', href: '/candidat' },
              { label: "Questionnaire Seven'O" },
            ]}
          />

          {stage === 'intro' ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CandidateStatusCard
                  tone="cyan"
                  label="Évaluation"
                  value="Générale Seven'O"
                  note={questionnaireCompleted ? 'Questionnaire déjà terminé.' : 'Elle reste indépendante de vos métiers recherchés.'}
                />
                <CandidateStatusCard
                  tone="violet"
                  label="Questions"
                  value={totalQuestions}
                  note={questionnaireCompleted ? 'Aucune nouvelle tentative possible.' : 'Toutes les questions sont à terminer dans la même session.'}
                />
                <CandidateStatusCard
                  tone="orange"
                  label="Durée approximative"
                  value={formatCountdown(preparation.durationSeconds)}
                  note={questionnaireCompleted ? 'Chronomètre désactivé.' : 'Le chronomètre démarre uniquement après votre clic.'}
                />
                <CandidateStatusCard
                  tone="neutral"
                  label="Résultat"
                  value={questionnaireCompleted ? 'Terminé' : "Indice Seven'O"}
                  note={questionnaireCompleted ? 'Ce questionnaire ne peut plus être relancé.' : 'La synthèse est calculée côté serveur.'}
                />
              </div>

              <SevenoPanel tone="cyan" className="p-5">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Avant de commencer</p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {questionnaireCompleted ? "Questionnaire Seven'O déjà terminé." : "Questionnaire Seven'O prêt."}
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      {questionnaireCompleted
                        ? 'Vous avez déjà terminé ce questionnaire. Il ne peut être lancé qu\'une seule fois.'
                        : 'À faire en une seule fois. Pas de pause. Si vous quittez la page ou dépassez le temps imparti, il faudra recommencer.'}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {questionnaireCompleted ? 'Consultez votre profil pour revoir votre état.' : 'Prévoyez un endroit calme avant de démarrer.'}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{preparation.questionBankCode}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        {formatCountdown(preparation.durationSeconds)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{totalQuestions} questions</span>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      {questionnaireCompleted ? null : (
                        <button
                          type="button"
                          onClick={() => void handleStartTest()}
                          disabled={starting}
                          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110"
                        >
                        {starting ? 'Démarrage...' : 'Je suis prêt, commencer le questionnaire'}
                        </button>
                      )}
                      <Link
                        href="/candidat"
                        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                      >
                        Retour au profil
                      </Link>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                    <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">État</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {questionnaireCompleted ? 'Questionnaire terminé' : 'Questionnaire en attente'}
                      </p>
                    </article>
                    <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Timer</p>
                      <p className="mt-2 text-lg font-semibold text-white">{questionnaireCompleted ? 'Terminé' : 'Non démarré'}</p>
                    </article>
                  </div>
                </div>
              </SevenoPanel>

              <CandidatePrivacyNotice
                message="Vos réponses détaillées restent privées. Les entreprises ne reçoivent que la synthèse explicitement prévue dans votre profil anonyme."
              />

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Règles simples</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                    Répondez question par question, puis validez le questionnaire quand vous êtes prêt.
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                    Si le temps expire, aucune réponse ne produit de score et une nouvelle tentative est nécessaire.
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                    Cette évaluation décrit vos atouts professionnels et votre manière de travailler.
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                    Votre Indice Seven&apos;O sera visible sur votre profil anonyme après calcul serveur.
                  </article>
                </div>
              </SevenoPanel>
            </>
          ) : stage === 'in_progress' ? (
            <form
              className="space-y-5"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                void submitAnswers();
              }}
            >
              <SevenoPanel tone="neutral" className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                      Question {currentQuestionIndex + 1} sur {totalQuestions}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Votre manière de travailler</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      {answerCount} réponse(s) saisie(s) sur {totalQuestions}.
                    </p>
                  </div>
                  <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${getScoreTone(false)}`}>
                    {formatCountdown(remainingSeconds)}
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 transition-all duration-300"
                    style={{ width: `${Math.max(2, progressRatio * 100)}%` }}
                  />
                </div>

                {lowTime ? (
                  <p className="mt-4 rounded-2xl border border-orange-300/20 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
                    Attention, le temps devient faible. À la fin du chronomètre, la tentative expirera sans produire de score.
                  </p>
                ) : null}
              </SevenoPanel>

              {currentQuestion ? (
                <SevenoPanel tone={getQuestionTone(currentQuestionIndex)} className="p-5">
                  <fieldset>
                    <legend className="px-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                      Question {currentQuestionIndex + 1} sur {totalQuestions}
                    </legend>

                    <p className="mt-3 text-lg font-semibold leading-8 text-white">{currentQuestion.question}</p>

                    <div className="mt-4 grid gap-3">
                      {currentQuestion.options.map((option) => {
                        const isSelected = answers[currentQuestion.id] === option.id;

                        return (
                          <label
                            key={option.id}
                            className={
                              'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ' +
                              (isSelected
                                ? 'border-cyan-300/40 bg-cyan-400/10 text-white'
                                : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10')
                            }
                          >
                            <input
                              type="radio"
                              name={currentQuestion.id}
                              value={option.id}
                              checked={isSelected}
                              onChange={() => handleQuestionAnswer(currentQuestion.id, option.id)}
                              className="h-4 w-4 border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                            />
                            <span className="font-medium">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </SevenoPanel>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                  type="button"
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex <= 0}
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Question précédente
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {currentQuestionIndex >= totalQuestions - 1
                    ? submitting
                      ? 'Envoi du questionnaire...'
                      : 'Envoyer mes réponses'
                    : 'Question suivante'}
                </button>
              </div>

              <CandidatePrivacyNotice message="Vos réponses détaillées restent privées et ne sont jamais placées dans votre profil anonyme." />
            </form>
          ) : stage === 'expired' ? (
            <SevenoPanel tone="orange" className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-100/80">Tentative expirée</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Le temps imparti est dépassé.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-orange-50/90">
                Vous devez recommencer le questionnaire. Cette tentative ne produit aucun score et ne met pas à jour votre profil.
              </p>
              <button
                type="button"
                onClick={() => void handleRestartTest()}
                disabled={starting}
                className="mt-6 inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? 'Redémarrage...' : 'Recommencer le questionnaire'}
              </button>
            </SevenoPanel>
          ) : (
            <div className="space-y-5">
              {submitResult ? (
                <SevenoPanel tone="violet" className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/80">
                        Résultat enregistré
                      </p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">Votre Indice Seven&apos;O est prêt</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/90">
                        La synthèse est enregistrée côté serveur. Vos réponses détaillées restent privées.
                      </p>
                    </div>

                    <p
                      className={
                        'inline-flex rounded-full border px-4 py-2 text-sm font-semibold border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                      }
                    >
                      Questionnaire terminé
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <CandidateStatusCard tone="neutral" label="Indice Seven'O" value={`${submitResult.overallScore ?? submitResult.score}%`} note="Synthèse générale calculée côté serveur." />
                    <CandidateStatusCard
                      tone="neutral"
                      label="Questions"
                      value={submitResult.totalQuestions}
                      note="Toutes les réponses ont été traitées côté serveur."
                    />
                    <CandidateStatusCard
                      tone="neutral"
                      label="Dimensions"
                      value={Object.keys(submitResult.scoresByDimension ?? {}).length}
                      note="Vos atouts professionnels sont présentés séparément."
                    />
                    <CandidateStatusCard
                      tone="neutral"
                      label="Vérifié le"
                      value={new Date(submitResult.verifiedAt).toLocaleString('fr-FR')}
                      note="Le résultat a été enregistré."
                    />
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/candidat"
                      className="inline-flex rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Voir mon profil
                    </Link>
                    <Link
                      href="/candidat/demandes"
                      className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                    >
                      Voir mes demandes
                    </Link>
                  </div>
                </SevenoPanel>
              ) : null}

              <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                Le questionnaire a été envoyé et votre synthèse Seven&apos;O a été enregistrée côté serveur.
              </SevenoPanel>
            </div>
          )}
        </div>
      )}

      {error ? (
        <p className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
    </CandidateShell>
  );
}
