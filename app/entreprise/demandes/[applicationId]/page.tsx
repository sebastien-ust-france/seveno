'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { JobApplicationConversationThread } from '@/components/application/JobApplicationConversationThread';
import { CompanyApplicationQuestionnaireReview } from '@/components/entreprise/CompanyApplicationQuestionnaireReview';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import {
  getJobApplicationConversationClient,
  reviewCompanyJobApplicationClient,
} from '@/lib/seveno-job-applications';
import { getCompanyJobOffer } from '@/lib/seveno-job-offers';
import {
  activateCompanyQuestionnaireClient,
  getCompanyQuestionnaireClient,
} from '@/lib/seveno-company-questionnaires';
import { buildQuestionnaireScoreSummary } from '@/lib/seveno-company-questionnaire-thresholds';
import { getCompanyApplicationQuestionnaireReviewClient } from '@/lib/seveno-application-questionnaires';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import type { CompanyApplicationQuestionnaireReviewView } from '@/types/seveno-application-questionnaires';
import type { CompanyQuestionnaireEditorProjection } from '@/types/seveno-company-questionnaires';
import type { SerializedCandidateJobApplication } from '@/types/seveno-job-applications';
import type { SerializedJobOffer } from '@/types/seveno-job-offers';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  invited: 'Invitation envoyée',
  prerequisites_in_progress: 'Réponses en cours',
  eligible: 'Prête à soumettre',
  ineligible: 'Non éligible',
  submitted: 'Soumise',
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

function formatCompanyLabel(application: SerializedCandidateJobApplication) {
  return application.companyNameSnapshot || application.offerSnapshot.companyName;
}

function formatQuestionnaireSummary(
  assessment: SerializedCandidateJobApplication['companyAssessment'],
) {
  if (!assessment) {
    return null;
  }

  const score = assessment.finalScore ?? assessment.automaticScorePercent;
  if (assessment.status === 'not_started' && score === null) {
    return null;
  }
  const scoreSummary = buildQuestionnaireScoreSummary(
    score,
    assessment.minimumPassingScorePercent ?? null,
    'company',
  );
  const statusLabel = assessment.status === 'completed'
    ? 'Termine'
    : assessment.status === 'submitted'
      ? 'En attente de validation'
      : assessment.status === 'in_progress'
        ? 'En cours'
        : assessment.status === 'expired'
          ? 'Expire'
          : assessment.status === 'abandoned'
            ? 'Abandonne'
            : 'Non demarre';

  return {
    label: scoreSummary?.label ?? (score !== null ? `Résultat : ${Math.round(score)} %` : statusLabel),
    note: scoreSummary
      ? `${scoreSummary.scoreLabel} · ${scoreSummary.thresholdLabel}`
      : assessment.manualReviewRequired
        ? assessment.manualReviewStatus === 'completed'
          ? 'Validation manuelle terminée.'
          : 'Correction manuelle requise avant validation finale.'
        : assessment.status === 'completed'
          ? 'Résultat validé par le serveur.'
          : assessment.status === 'submitted' || assessment.status === 'in_progress'
          ? 'Le questionnaire a été transmis au candidat.'
            : 'Aucun résultat disponible.',
  };
}

export default function CompanyApplicationDetailPage() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const params = useParams<{ applicationId: string }>();
  const applicationId =
    typeof params?.applicationId === 'string'
      ? params.applicationId
      : Array.isArray(params?.applicationId)
        ? params.applicationId[0]
        : '';
  const [application, setApplication] = useState<SerializedCandidateJobApplication | null>(null);
  const [offer, setOffer] = useState<SerializedJobOffer | null>(null);
  const [questionnaire, setQuestionnaire] = useState<CompanyQuestionnaireEditorProjection | null>(null);
  const [questionnaireReview, setQuestionnaireReview] = useState<CompanyApplicationQuestionnaireReviewView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionLoading, setDecisionLoading] = useState<'interested' | 'declined' | null>(null);
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
  const [questionnaireReviewLoading, setQuestionnaireReviewLoading] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = authUser;
    if (!currentUser || !applicationId) {
      return;
    }
    const firebaseUser = currentUser as NonNullable<typeof currentUser>;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setDecisionMessage(null);
      setOffer(null);
      setQuestionnaire(null);
      setQuestionnaireReview(null);
      setQuestionnaireReviewLoading(false);

      try {
        const payload = await getJobApplicationConversationClient(firebaseUser, applicationId);
        if (active) {
          setApplication(payload.application);
        }
        try {
          const shouldLoadReview = payload.application.companyAssessment?.status === 'submitted'
            || payload.application.companyAssessment?.status === 'completed';
          if (active) {
            setQuestionnaireReviewLoading(shouldLoadReview);
          }
          const reviewPromise = shouldLoadReview
            ? getCompanyApplicationQuestionnaireReviewClient(firebaseUser, payload.application.id).catch(() => null)
            : Promise.resolve(null);
          const [offerPayload, questionnairePayload, reviewPayload] = await Promise.all([
            getCompanyJobOffer(firebaseUser, payload.application.offerId),
            getCompanyQuestionnaireClient(firebaseUser, payload.application.offerId).catch(() => null),
            reviewPromise,
          ]);
          if (!active) {
            return;
          }
          setOffer(offerPayload.offer);
          setQuestionnaire(questionnairePayload?.questionnaire ?? null);
          setQuestionnaireReview(reviewPayload ?? null);
        } catch {
          if (active) {
            setOffer(null);
            setQuestionnaire(null);
            setQuestionnaireReview(null);
          }
        }
      } catch (thrownError) {
        if (active) {
        setError(thrownError instanceof Error ? thrownError.message : 'Le dossier n’a pas pu être chargé.');
        }
      } finally {
        if (active) {
          setQuestionnaireReviewLoading(false);
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [applicationId, authUser]);

  async function review(decision: 'interested' | 'declined') {
    if (!authUser || !application) {
      return;
    }

    if (
      !window.confirm(
        decision === 'interested'
          ? 'Proposer la mise en relation enverra une demande de confirmation au candidat.'
          : 'Refuser ce dossier clôturera la relation.',
      )
    ) {
      return;
    }

    setDecisionLoading(decision);
    setError(null);
    setDecisionMessage(null);

    try {
      const payload = await reviewCompanyJobApplicationClient(authUser, application.id, decision);
      setApplication(payload.application);
      setDecisionMessage(
        decision === 'interested'
          ? 'Proposition envoyée. En attente de la réponse du candidat.'
          : 'Dossier refusé. La relation est maintenant clôturée.',
      );
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La décision n’a pas pu être enregistrée.');
    } finally {
      setDecisionLoading(null);
    }
  }

  async function sendQuestionnaire() {
    if (!authUser || !application || !questionnaire) {
      return;
    }

    setQuestionnaireLoading(true);
    setError(null);
    setDecisionMessage(null);

    try {
      const payload = await activateCompanyQuestionnaireClient(authUser, application.offerId);
      setQuestionnaire(payload.questionnaire);
      setDecisionMessage('Questionnaire enregistré et envoyé au candidat.');
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : "L’envoi du questionnaire a échoué.");
    } finally {
      setQuestionnaireLoading(false);
    }
  }

  const questionnaireRequired = application?.offerSnapshot.questionnaireRequired === true
    || offer?.questionnaireRequired === true
    || Boolean(offer?.questionnaireId)
    || Boolean(application?.offerSnapshot.questionnaireId);
  const questionnaireCompleted = application?.companyAssessment?.status === 'completed';
  const questionnaireAnswered = application?.companyAssessment?.status === 'submitted' || questionnaireCompleted;
  const questionnaireTitle = questionnaire?.title || offer?.questionnaireTitleSnapshot || 'Questionnaire sans titre';
  const questionnaireQuestionCount = questionnaire?.questions.length
    ?? offer?.questionnaireQuestionCountSnapshot
    ?? 0;
  const questionnaireAttached = Boolean(questionnaire || offer?.questionnaireId);
  const questionnaireHasData = Boolean(questionnaire);
  const questionnaireEditorLink = application ? `/entreprise/offres/${application.offerId}/questionnaire` : null;
  const questionnaireSummary = formatQuestionnaireSummary(application?.companyAssessment ?? null);
  const questionnaireSendLabel = questionnaire?.status === 'active'
    ? 'Renvoyer le questionnaire'
    : 'Envoyer le questionnaire';
  const questionnaireActionHref = questionnaireAnswered
    ? '#questionnaire-candidat'
    : questionnaireEditorLink;
  const questionnaireActionLabel = questionnaireAnswered
    ? 'Voir les réponses'
    : questionnaireAttached
      ? 'Modifier le questionnaire'
      : 'Créer le questionnaire';
  const questionnaireStateLabel = questionnaireCompleted
    ? 'Terminé'
    : questionnaireAnswered
      ? 'Réponses reçues'
      : questionnaireAttached
        ? questionnaire?.status === 'active'
          ? 'Envoyé au candidat'
          : 'Enregistré'
        : 'À créer avant validation';
  const canReview = application
    ? (application.status === 'submitted' || application.status === 'questionnaire_completed')
      && (!questionnaireRequired || questionnaireCompleted)
    : false;
  const canShowConversation = application?.conversationStatus === 'open';
  const proposalPending = application?.status === 'contact_requested';
  const proposalRefused = application?.status === 'candidate_declined';

  return (
    <SevenoSurface
      eyebrow="Mise en relation"
      title="Détail du dossier"
      description="Examinez le dossier, proposez la mise en relation si nécessaire puis poursuivez la discussion dans la conversation sécurisée."
      footer={profile ? <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Entreprise : {profile.companyName}</p> : null}
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/entreprise/demandes"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Retour aux dossiers
          </Link>
        </div>

        {sessionError || error ? (
          <SevenoPanel tone="orange" className="p-4">
            <p className="text-sm text-orange-100">{sessionError ?? error}</p>
          </SevenoPanel>
        ) : null}

        {decisionMessage ? (
          <SevenoPanel tone="cyan" className="p-4">
            <p className="text-sm text-cyan-100">{decisionMessage}</p>
          </SevenoPanel>
        ) : null}

        {loading || sessionLoading ? (
          <SevenoPanel tone="neutral" className="px-4 py-4 text-sm text-slate-300">
            Chargement du dossier...
          </SevenoPanel>
        ) : null}

        {application ? (
          <>
            <SevenoPanel tone="cyan" className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    {application.origin === 'company' ? 'Invitation entreprise' : 'Candidature candidat'}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{application.offerSnapshot.title}</h2>
                  <p className="mt-3 text-sm text-slate-300">{formatCompanyLabel(application)}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  {STATUS_LABELS[application.status] ?? application.status}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Candidat anonyme</p>
                  <p className="mt-2 break-all text-sm font-medium text-white">{application.publicCandidateId}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Secteur</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {findSectorLabel(application.offerSnapshot.sectorId) ?? application.offerSnapshot.sectorId}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Famille</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {findFamilyLabel(application.offerSnapshot.jobFamilyId) ?? application.offerSnapshot.jobFamilyId}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Métier</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {findRoleLabel(application.offerSnapshot.jobRoleId) ?? application.offerSnapshot.jobRoleId}
                  </p>
                </article>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Prérequis obligatoires</p>
                  <p className="mt-2 font-medium text-white">
                    {application.requiredResult.satisfied}/{application.requiredResult.total}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Valeurs ajoutées</p>
                  <p className="mt-2 font-medium text-white">
                    {application.preferredResult.satisfied}/{application.preferredResult.total}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Questionnaire</p>
                  <p className="mt-2 font-medium text-white">
                    {questionnaireRequired ? questionnaireStateLabel : 'Non requis'}
                  </p>
                  {questionnaireSummary ? (
                    <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                      <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Résultat du questionnaire</p>
                      <p className="mt-2 font-semibold text-white">{questionnaireSummary.label}</p>
                      <p className="mt-1 text-xs text-emerald-100/80">{questionnaireSummary.note}</p>
                    </div>
                  ) : null}
                  {questionnaireRequired && questionnaireActionHref ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-400">
                        {questionnaireAttached
                          ? `${questionnaireTitle} · ${questionnaireQuestionCount} question(s)`
                          : 'Aucun questionnaire enregistré pour cette offre.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {questionnaireHasData ? (
                          <button
                            type="button"
                            onClick={() => void sendQuestionnaire()}
                            disabled={questionnaireLoading}
                            className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {questionnaireLoading ? 'Envoi...' : questionnaireSendLabel}
                          </button>
                        ) : null}
                        <Link
                          href={questionnaireActionHref}
                          className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/15"
                        >
                          {questionnaireActionLabel}
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </article>
              </div>

              {questionnaireAnswered ? (
                questionnaireReviewLoading ? (
                  <SevenoPanel tone="neutral" className="mt-6 p-5" id="questionnaire-candidat">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Questionnaire du candidat</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Chargement des réponses</h3>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
                      Les réponses du candidat sont en cours de chargement.
                    </p>
                  </SevenoPanel>
                ) : questionnaireReview ? (
                  <div className="mt-6">
                    <CompanyApplicationQuestionnaireReview review={questionnaireReview} />
                  </div>
                ) : (
                  <SevenoPanel tone="neutral" className="mt-6 p-5" id="questionnaire-candidat">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Questionnaire du candidat</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Réponses indisponibles</h3>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
                      Le questionnaire a été traité, mais la restitution détaillée n’est pas disponible pour le moment.
                    </p>
                  </SevenoPanel>
                )
              ) : null}

              {questionnaireRequired && !questionnaireCompleted ? (
                <div className="mt-6 rounded-2xl border border-orange-300/20 bg-orange-400/10 px-4 py-4 text-sm leading-7 text-orange-100">
                  Le questionnaire associé à cette offre doit être renseigné puis envoyé au candidat avant la validation
                  du dossier. Ouvrez-le ci-dessus, puis revenez ici pour proposer la mise en relation.
                </div>
              ) : null}

              {proposalPending ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-4 text-sm leading-7 text-cyan-100">
                    Proposition envoyée. En attente de la réponse du candidat.
                  </div>
                  <button
                    type="button"
                    disabled
                    className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white opacity-50"
                  >
                    En attente de la réponse du candidat
                  </button>
                </div>
              ) : null}

              {canReview ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={decisionLoading !== null}
                    onClick={() => void review('interested')}
                    className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {decisionLoading === 'interested' ? 'Validation...' : 'Proposer la mise en relation'}
                  </button>
                  <button
                    type="button"
                    disabled={decisionLoading !== null}
                    onClick={() => void review('declined')}
                    className="rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {decisionLoading === 'declined' ? 'Refus...' : 'Refuser'}
                  </button>
                </div>
              ) : questionnaireRequired && !questionnaireCompleted ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled
                    className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white opacity-50"
                  >
                    Proposer la mise en relation
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 opacity-50"
                  >
                    Refuser
                  </button>
                </div>
              ) : null}

              {proposalRefused ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-300">
                  <p className="font-medium text-white">Mise en relation refusée par le candidat.</p>
                  <p className="mt-2">La relation est clôturée sans ouverture de conversation.</p>
                </div>
              ) : null}

              {canShowConversation ? (
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="#conversation-securisee"
                    className="inline-flex items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    Ouvrir la conversation
                  </Link>
                </div>
              ) : null}
            </SevenoPanel>

            {canShowConversation && authUser ? (
              <div id="conversation-securisee">
                <JobApplicationConversationThread
                  authUser={authUser}
                  applicationId={application.id}
                  applicationStatus={application.status}
                  conversationStatus={application.conversationStatus}
                  title="Conversation sécurisée"
                  description="Les échanges deviennent disponibles après acceptation explicite du dossier."
                  emptyMessage="Aucun message n’a encore été envoyé."
                  onApplicationChange={setApplication}
                />
              </div>
            ) : (
              <SevenoPanel tone="neutral" className="p-5 text-sm leading-7 text-slate-300">
                <p className="font-medium text-white">Conversation fermée</p>
                <p className="mt-3">
                  {application.status === 'contact_requested'
                    ? 'En attente de la réponse du candidat.'
                    : application.status === 'candidate_declined'
                      ? 'Le candidat n’a pas souhaité poursuivre cette mise en relation.'
                      : application.status === 'invited'
                        ? 'Le candidat doit d’abord accepter votre invitation avant l’ouverture de la conversation.'
                        : 'La relation n’est pas encore ouverte à la discussion sécurisée.'}
                </p>
              </SevenoPanel>
            )}
          </>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
