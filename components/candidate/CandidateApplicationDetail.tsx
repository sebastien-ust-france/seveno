'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { JobApplicationConversationThread } from '@/components/application/JobApplicationConversationThread';
import { CandidatePrivacyNotice } from '@/components/candidate/CandidatePrivacyNotice';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import {
  getApplicationClient,
  respondToJobApplicationInvitationClient,
} from '@/lib/seveno-job-applications';
import { getCandidateApplicationQuestionnaireClient } from '@/lib/seveno-application-questionnaires';
import { buildQuestionnaireScoreSummary } from '@/lib/seveno-company-questionnaire-thresholds';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type { CompanyApplicationQuestionnaireView } from '@/types/seveno-application-questionnaires';
import type { SerializedCandidateJobApplication } from '@/types/seveno-job-applications';

type CandidateApplicationDetailProps = {
  applicationId: string;
};

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  invited: 'Invitation reçue',
  prerequisites_in_progress: 'Réponses en cours',
  eligible: 'Prête à envoyer',
  ineligible: 'Prérequis incomplet',
  submitted: 'Envoyée',
  viewed: 'Consultée',
  questionnaire_pending: 'Questionnaire à remplir',
  questionnaire_completed: 'Questionnaire terminé',
  shortlisted: 'Sélectionnée',
  rejected: 'Refusée',
  contact_requested: 'Mise en relation proposée',
  conversation_open: 'Conversation ouverte',
  candidate_declined: 'Invitation refusée',
  company_declined: 'Relation refusée',
  candidate_withdrawn: 'Retrait candidat',
  offer_unavailable: 'Offre indisponible',
  withdrawn: 'Retirée',
  closed: 'Fermée',
};

function formatQuestionnaireState(view: CompanyApplicationQuestionnaireView | null) {
  if (!view) {
    return {
      label: 'Questionnaire indisponible',
      tone: 'text-slate-200',
      note: 'Le questionnaire de cette candidature n a pas pu etre charge.',
    };
  }

  if (view.assessment?.status === 'completed') {
    return {
      label: 'Questionnaire terminé',
      tone: 'text-emerald-100',
      note: view.assessment.manualReviewRequired
        ? `${view.assessment.manualQuestionsCount} ${view.assessment.manualQuestionsCount > 1 ? 'réponses attendent' : 'réponse attend'} un examen manuel.`
        : 'Toutes les réponses ont été traitées côté serveur.',
    };
  }

  if (view.assessment?.status === 'submitted') {
    return {
      label: 'Questionnaire en cours',
      tone: 'text-amber-100',
      note: view.assessment.manualReviewRequired
        ? `${view.assessment.manualQuestionsCount} ${view.assessment.manualQuestionsCount > 1 ? 'réponses attendent' : 'réponse attend'} un examen manuel.`
        : 'Le score automatique est déjà calculé.',
    };
  }

  if (view.access.status === 'in_progress') {
    return {
      label: 'Questionnaire en cours',
      tone: 'text-amber-100',
      note: 'Une tentative est déjà active pour cette candidature.',
    };
  }

  if (view.access.available) {
    return {
      label: 'Questionnaire disponible',
      tone: 'text-cyan-100',
      note: 'Vous pouvez répondre au questionnaire de cette entreprise.',
    };
  }

  return {
    label: 'Questionnaire indisponible',
    tone: 'text-slate-200',
    note: view.access.reason ?? 'Le questionnaire n est pas encore accessible.',
  };
}

export default function CandidateApplicationDetail({ applicationId }: CandidateApplicationDetailProps) {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [application, setApplication] = useState<SerializedCandidateJobApplication | null>(null);
  const [questionnaireView, setQuestionnaireView] = useState<CompanyApplicationQuestionnaireView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionLoading, setDecisionLoading] = useState<'accepted' | 'declined' | null>(null);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);

  useEffect(() => {
    const user = authUser;
    if (!user) {
      return;
    }

    let active = true;

    async function load(currentUser: NonNullable<typeof user>) {
      setLoading(true);
      setError(null);
      setDecisionMessage(null);
      setApplication(null);
      setQuestionnaireView(null);

      try {
        const applicationPayload = await getApplicationClient(currentUser, applicationId);
        if (!active) {
          return;
        }

        setApplication(applicationPayload.application);

        try {
          const questionnairePayload = await getCandidateApplicationQuestionnaireClient(currentUser, applicationId);
          if (active) {
            setQuestionnaireView(questionnairePayload);
          }
        } catch {
          if (active) {
            setQuestionnaireView(null);
          }
        }
      } catch (thrownError) {
        if (active) {
          setError(thrownError instanceof Error ? thrownError.message : 'La candidature n a pas pu etre chargee.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load(user);

    return () => {
      active = false;
    };
  }, [applicationId, authUser]);

  const questionnaireState = formatQuestionnaireState(questionnaireView);
  const assessment = questionnaireView?.assessment ?? application?.companyAssessment ?? null;
  const questionnaireScoreSummary = buildQuestionnaireScoreSummary(
    assessment?.finalScore ?? assessment?.automaticScorePercent ?? null,
    assessment?.minimumPassingScorePercent ?? null,
    'candidate',
  );
  const automaticScorePercent = assessment?.automaticScorePercent ?? null;
  const submittedAt = assessment?.submittedAt ?? null;
  const isInvitation = application?.origin === 'company' && application?.status === 'invited';
  const isProposal = application?.status === 'contact_requested';
  const canShowConversation = application?.conversationStatus === 'open';

  async function handleInvitationDecision(decision: 'accepted' | 'declined') {
    if (!authUser || !application || (!isInvitation && !isProposal)) {
      return;
    }

    if (
      !window.confirm(
        isProposal
          ? decision === 'accepted'
            ? 'Accepter cette mise en relation ouvre la conversation sécurisée avec l entreprise.'
            : 'Confirmez-vous le refus de cette mise en relation ?'
          : decision === 'accepted'
            ? 'Accepter cette invitation ouvre la suite du parcours. Vos coordonnées restent privées tant que la relation n est pas validée.'
            : 'Refuser cette invitation clôture cette proposition.',
      )
    ) {
      return;
    }

    setDecisionLoading(decision);
    setError(null);
    setDecisionMessage(null);

    try {
      const payload = await respondToJobApplicationInvitationClient(authUser, application.id, decision);
      setApplication(payload.application);
      setDecisionMessage(
        isProposal
          ? decision === 'accepted'
            ? 'Mise en relation acceptée. Vous pouvez maintenant ouvrir la conversation.'
            : 'Mise en relation refusée. Aucun échange n a été ouvert.'
          : decision === 'accepted'
            ? 'Invitation acceptée. Vous pouvez maintenant compléter les réponses liées à cette offre.'
            : 'Invitation refusée. Aucun échange n a été ouvert.',
      );
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La décision n a pas pu etre enregistrée.');
    } finally {
      setDecisionLoading(null);
    }
  }

  return (
    <CandidateShell
      title="Ma candidature"
      description="Suivez l état de votre candidature et accédez au questionnaire entreprise associé."
      actions={
        <Link
          href="/candidat/candidatures"
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          Retour aux candidatures
        </Link>
      }
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Candidat', href: '/candidat' },
            { label: 'Mes candidatures', href: '/candidat/candidatures' },
            { label: 'Candidature' },
          ]}
        />

        {sessionError || error ? (
          <SevenoPanel tone="orange">
            <p className="text-sm text-orange-100">{sessionError ?? error}</p>
          </SevenoPanel>
        ) : null}

        {decisionMessage ? (
          <SevenoPanel tone="cyan">
            <p className="text-sm text-cyan-100">{decisionMessage}</p>
          </SevenoPanel>
        ) : null}

        {(sessionLoading || loading) && !application ? (
          <SevenoPanel tone="neutral">
            <p className="text-sm text-slate-400">Chargement...</p>
          </SevenoPanel>
        ) : null}

        {application ? (
          <>
            <SevenoPanel tone="cyan" className="p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                    {application.origin === 'company' ? 'Invitation entreprise' : 'Candidature candidat'}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {application.offerSnapshot.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {application.companyNameSnapshot || application.offerSnapshot.companyName}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {application.offerSnapshot.jobRoleLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {application.offerSnapshot.sectorId}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {application.offerSnapshot.location}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {APPLICATION_STATUS_LABELS[application.status] ?? application.status}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                  <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Prérequis obligatoires</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {application.requiredResult.satisfied}/{application.requiredResult.total}
                    </p>
                  </article>
                  <article className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Valeurs ajoutées</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {application.preferredResult.satisfied}/{application.preferredResult.total}
                    </p>
                  </article>
                </div>
              </div>
            </SevenoPanel>

            <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                  Questionnaire entreprise
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">{questionnaireState.label}</h3>
                <p className={`mt-3 text-sm leading-7 ${questionnaireState.tone}`}>{questionnaireState.note}</p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">État</p>
                    <p className="mt-2 text-sm font-medium text-white">{assessment?.status ?? 'non commencé'}</p>
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Version</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {assessment?.questionnaireVersion ?? 'non définie'}
                    </p>
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Score auto</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {automaticScorePercent !== null ? `${Math.round(automaticScorePercent)}%` : 'En attente'}
                    </p>
                  </article>
                  <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Soumis le</p>
                    <p className="mt-2 text-sm font-medium text-white">{submittedAt ?? 'En attente'}</p>
                  </article>
                </div>

                {questionnaireScoreSummary ? (
                  <div className="mt-5 rounded-[22px] border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
                    <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Votre resultat</p>
                    <p className="mt-2 font-semibold text-white">{questionnaireScoreSummary.label}</p>
                    <p className="mt-2 text-xs text-cyan-50/80">
                      {questionnaireScoreSummary.scoreLabel} · {questionnaireScoreSummary.thresholdLabel}
                    </p>
                    <p className="mt-2 text-xs text-cyan-50/80">{questionnaireScoreSummary.note}</p>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  {questionnaireView?.access.available ||
                  questionnaireView?.access.status === 'in_progress' ||
                  questionnaireView?.access.status === 'completed' ? (
                    <Link
                      href={`/candidat/candidatures/${applicationId}/questionnaire`}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110"
                    >
                      {questionnaireView?.access.status === 'completed'
                        ? 'Voir le questionnaire'
                        : questionnaireView?.access.status === 'in_progress'
                          ? 'Questionnaire en cours'
                          : 'Répondre au questionnaire de l entreprise'}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300">
                      Questionnaire indisponible
                    </span>
                  )}

                  {isProposal ? (
                    <>
                      <button
                        type="button"
                        disabled={decisionLoading !== null}
                        onClick={() => void handleInvitationDecision('accepted')}
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {decisionLoading === 'accepted' ? 'Validation...' : 'Accepter la mise en relation'}
                      </button>
                      <button
                        type="button"
                        disabled={decisionLoading !== null}
                        onClick={() => void handleInvitationDecision('declined')}
                        className="inline-flex items-center justify-center rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {decisionLoading === 'declined' ? 'Refus...' : 'Refuser'}
                      </button>
                    </>
                  ) : isInvitation ? (
                    <>
                      <button
                        type="button"
                        disabled={decisionLoading !== null}
                        onClick={() => void handleInvitationDecision('accepted')}
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(34,211,238,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {decisionLoading === 'accepted' ? 'Validation...' : 'Accepter l invitation'}
                      </button>
                      <button
                        type="button"
                        disabled={decisionLoading !== null}
                        onClick={() => void handleInvitationDecision('declined')}
                        className="inline-flex items-center justify-center rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {decisionLoading === 'declined' ? 'Refus...' : 'Refuser'}
                      </button>
                    </>
                  ) : null}
                </div>

                {canShowConversation ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="#conversation-securisee"
                      className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                    >
                      Ouvrir la conversation
                    </Link>
                  </div>
                ) : null}
              </SevenoPanel>

              <CandidatePrivacyNotice
                title="Visibilité anonyme"
                message="Vos informations personnelles restent invisibles aux entreprises tant que vous n avez pas accepté une mise en relation."
              />
            </div>

            {canShowConversation && authUser ? (
              <div id="conversation-securisee">
                <JobApplicationConversationThread
                  authUser={authUser}
                  applicationId={application.id}
                  applicationStatus={application.status}
                  conversationStatus={application.conversationStatus}
                  title="Conversation avec l entreprise"
                  description="Les échanges deviennent disponibles une fois la relation ouverte des deux côtés."
                  emptyMessage="Aucun message n a encore été envoyé."
                  onApplicationChange={setApplication}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </CandidateShell>
  );
}
