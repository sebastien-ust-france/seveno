'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { Select } from '@/components/ui/Select';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { getCandidateAvailabilityView } from '@/lib/seveno-candidate-availability';
import {
  MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER,
  buildOfferCapacityLabel,
  buildOfferCapacityReminderMessage,
} from '@/lib/seveno-active-candidate-files';
import { listCompanyJobOffers } from '@/lib/seveno-job-offers';
import {
  createCompanyInvitationClient,
  listCompanyApplicationsClient,
} from '@/lib/seveno-job-applications';
import { buildQuestionnaireScoreSummary } from '@/lib/seveno-company-questionnaire-thresholds';
import { getVisibleCandidateProfileByPublicId } from '@/lib/seveno-company-candidates';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import type { CandidateRecommendationPublicBundle, PublicCandidateRecommendationSummary } from '@/types/seveno';
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

type PublicCandidateProfile = CandidateRecommendationPublicBundle['candidate'];

function formatTargetJobs(profile: PublicCandidateProfile) {
  if (!profile || profile.targetJobs.length === 0) {
    return 'Non renseignés';
  }

  return profile.targetJobs.map((job) => job.label).join(', ');
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
    label: score !== null ? `Resultat : ${Math.round(score)} %` : statusLabel,
    note: assessment.manualReviewRequired
      ? assessment.manualReviewStatus === 'completed'
        ? 'Validation manuelle terminee.'
        : 'Correction manuelle requise avant validation finale.'
      : assessment.status === 'completed'
        ? 'Resultat valide par le serveur.'
        : assessment.status === 'submitted' || assessment.status === 'in_progress'
          ? 'Le questionnaire a ete transmis au candidat.'
          : 'Aucun resultat disponible.',
  };
}

function ApplicationCard({ application }: { application: SerializedCandidateJobApplication }) {
  const questionnaireSummary = formatQuestionnaireSummary(application.companyAssessment ?? null);
  const primaryAction = application.status === 'contact_requested'
    ? 'En attente du candidat'
    : application.conversationStatus === 'open'
      ? 'Ouvrir la conversation'
      : application.status === 'submitted' || application.status === 'questionnaire_completed'
        ? 'Évaluer le dossier'
        : 'Voir le dossier';

  return (
    <article className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
            {application.origin === 'company' ? 'Invitation entreprise' : 'Candidature candidat'}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">{application.offerSnapshot.title}</h3>
          <p className="mt-2 text-sm text-slate-400">{application.companyNameSnapshot || application.offerSnapshot.companyName}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
          {STATUS_LABELS[application.status] ?? application.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Statut</p>
          <p className="mt-2 font-medium text-white">{STATUS_LABELS[application.status] ?? application.status}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Questionnaire</p>
          <p className="mt-2 font-medium text-white">
            {application.companyAssessment?.status === 'completed'
              ? 'Terminé'
              : application.companyAssessment?.status === 'submitted' || application.companyAssessment?.status === 'in_progress'
                ? 'En cours'
                : application.companyAssessment?.status === 'expired'
                  ? 'Expiré'
                  : 'Non démarré'}
          </p>
          {questionnaireSummary ? (
            <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Resultat du questionnaire</p>
              <p className="mt-2 font-medium text-white">{questionnaireSummary.label}</p>
              <p className="mt-1 text-xs text-emerald-100/80">{questionnaireSummary.note}</p>
            </div>
          ) : null}
          <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">Seuil minimum</p>
            <p className="mt-2 font-medium text-white">
              {buildQuestionnaireScoreSummary(
                application.companyAssessment?.finalScore ?? application.companyAssessment?.automaticScorePercent ?? null,
                application.companyAssessment?.minimumPassingScorePercent ?? null,
                'company',
              )?.label ?? 'En attente'}
            </p>
          </div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Conversation</p>
          <p className="mt-2 font-medium text-white">
            {application.conversationStatus === 'open'
              ? `Ouverte · ${application.conversationUnreadCompanyCount} non lus`
              : 'Fermée'}
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Offre</p>
          <p className="mt-2 text-sm font-medium text-white">{application.offerSnapshot.jobRoleLabel}</p>
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

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/entreprise/demandes/${application.id}`}
          className="rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          {primaryAction}
        </Link>
      </div>
    </article>
  );
}

export default function CompanyCandidateDetailPage() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const params = useParams<{ publicCandidateId: string }>();
  const publicCandidateId =
    typeof params?.publicCandidateId === 'string'
      ? params.publicCandidateId
      : Array.isArray(params?.publicCandidateId)
        ? params.publicCandidateId[0]
        : '';

  const [candidateProfile, setCandidateProfile] = useState<CandidateRecommendationPublicBundle['candidate']>(null);
  const [recommendations, setRecommendations] = useState<PublicCandidateRecommendationSummary[]>([]);
  const [offers, setOffers] = useState<SerializedJobOffer[]>([]);
  const [applications, setApplications] = useState<SerializedCandidateJobApplication[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const currentUser = authUser;
    if (!currentUser || !publicCandidateId) {
      return;
    }
    const firebaseUser = currentUser as NonNullable<typeof currentUser>;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [candidatePayload, offersPayload, applicationsPayload] = await Promise.all([
          getVisibleCandidateProfileByPublicId(firebaseUser, publicCandidateId),
          listCompanyJobOffers(firebaseUser, { status: 'published' }),
          listCompanyApplicationsClient(firebaseUser, undefined, publicCandidateId),
        ]);

        if (!active) {
          return;
        }

        if (!candidatePayload) {
          setCandidateProfile(null);
          setRecommendations([]);
          setOffers([]);
          setApplications([]);
          setError('Profil anonyme introuvable.');
          return;
        }

        setCandidateProfile(candidatePayload.candidate);
        setRecommendations(candidatePayload.recommendations);
        setOffers(offersPayload.offers);
        setApplications(applicationsPayload.applications);
        setSelectedOfferId((current) => current || offersPayload.offers[0]?.id || '');
      } catch (thrownError) {
        if (active) {
          setError(thrownError instanceof Error ? thrownError.message : 'Le profil anonyme n a pas pu etre charge.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [authUser, publicCandidateId]);

  const publishedOffers = useMemo(() => offers.filter((offer) => offer.status === 'published'), [offers]);
  const selectedOffer = useMemo(
    () => publishedOffers.find((offer) => offer.id === selectedOfferId) ?? null,
    [publishedOffers, selectedOfferId],
  );
  const selectedOfferActiveFilesCount = selectedOffer?.activeCandidateFilesCount ?? 0;
  const selectedOfferCapacityReached = selectedOfferActiveFilesCount >= MAX_ACTIVE_CANDIDATE_FILES_PER_OFFER;
  const selectedOfferCapacityReminder = buildOfferCapacityReminderMessage(selectedOfferActiveFilesCount);
  const selectedOfferCapacityLabel = buildOfferCapacityLabel(selectedOfferActiveFilesCount);
  const availabilityView = candidateProfile ? getCandidateAvailabilityView(candidateProfile) : null;
  const activeApplications = applications.filter((application) => application.status === 'invited' || application.status === 'contact_requested' || application.status === 'submitted' || application.status === 'questionnaire_pending' || application.status === 'questionnaire_completed' || application.status === 'conversation_open');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser || !candidateProfile || !selectedOfferId) {
      return;
    }
    if (selectedOfferCapacityReached) {
      setError('Finalisez une candidature en cours avant d engager un nouveau candidat.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = await createCompanyInvitationClient(authUser, {
        offerId: selectedOfferId,
        publicCandidateId: candidateProfile.publicCandidateId,
        message: message.trim() || undefined,
      });

      setNotice(`Invitation envoyée. Dossier ${payload.application.id}.`);
      setMessage('');

      const refreshed = await listCompanyApplicationsClient(authUser, undefined, publicCandidateId);
      setApplications(refreshed.applications);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La demande de relation a échoué.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Entreprise"
      title="Profil candidat anonyme"
      description="Sélectionnez une offre publiée pour envoyer une invitation au candidat. Aucune donnée privée n est exposée ici."
      footer={profile ? <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Entreprise : {profile.companyName}</p> : null}
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Entreprise', href: '/entreprise' },
            { label: 'Profils candidats', href: '/entreprise' },
            { label: candidateProfile?.publicCandidateId ?? 'Profil candidat' },
          ]}
        />

        {sessionError || error ? (
          <SevenoPanel tone="orange" className="p-4">
            <p className="text-sm text-orange-100">{sessionError ?? error}</p>
          </SevenoPanel>
        ) : null}

        {notice ? (
          <SevenoPanel tone="cyan" className="p-4">
            <p className="text-sm text-cyan-100">{notice}</p>
          </SevenoPanel>
        ) : null}

        {loading || sessionLoading ? (
          <SevenoPanel tone="neutral" className="px-4 py-4 text-sm text-slate-300">
            Chargement du profil...
          </SevenoPanel>
        ) : null}

        {candidateProfile ? (
          <>
            <SevenoPanel tone="cyan" className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                    Identifiant public
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{candidateProfile.publicCandidateId}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {formatTargetJobs(candidateProfile)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Analyse professionnelle Seven&apos;O</p>
                  <p className="mt-2 font-medium text-white">Nouvelle version en préparation</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Le score global historique n&apos;est plus utilisé pour valider un profil candidat.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Secteur</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {findSectorLabel(candidateProfile.sectorId) ?? candidateProfile.sectorId}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Famille métier</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {findFamilyLabel(candidateProfile.jobFamilyId) ?? candidateProfile.jobFamilyId}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Métier</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {findRoleLabel(candidateProfile.jobRoleId) ?? candidateProfile.jobRoleId}
                  </p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Localisation</p>
                  <p className="mt-2 text-sm font-medium text-white">{candidateProfile.locationArea}</p>
                </article>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Disponibilité</p>
                  <p className="mt-2 text-sm font-medium text-white">{availabilityView?.label ?? candidateProfile.availability}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{availabilityView?.detail ?? 'Non disponible'}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Expérience</p>
                  <p className="mt-2 text-sm font-medium text-white">{candidateProfile.experienceLevel}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Dossiers liés</p>
                  <p className="mt-2 text-sm font-medium text-white">{activeApplications.length}</p>
                </article>
              </div>
            </SevenoPanel>

            <SevenoPanel tone="violet" className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Présentation professionnelle</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">Ce que le candidat met en avant</h3>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  {recommendations.length} recommandation(s) visible(s)
                </span>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ce que vous diriez de vous</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    {candidateProfile?.professionalSelfDescription ?? 'Aucune présentation publiée pour le moment.'}
                  </p>
                </article>
                <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Ce que les autres disent de vous</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">
                    {candidateProfile?.professionalReputationDescription ?? 'Aucune recommandation rédigée pour le moment.'}
                  </p>
                </article>
              </div>

              <div className="mt-5 space-y-3">
                {recommendations.length > 0 ? (
                  recommendations.map((recommendation) => (
                    <article key={recommendation.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{recommendation.relationLabel}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                            {recommendation.candidateJobTitle} · {recommendation.collaborationPeriodLabel}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                          {recommendation.badgeLabel}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {recommendation.qualities.map((quality) => (
                          <span key={quality} className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                            {quality}
                          </span>
                        ))}
                      </div>

                      {recommendation.comment ? (
                        <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm leading-7 text-slate-300">
                          {recommendation.comment}
                        </p>
                      ) : null}

                      <p className="mt-3 text-xs text-slate-400">
                        Recommandation à nouveau: {recommendation.wouldRehire === 'yes'
                          ? 'Oui'
                          : recommendation.wouldRehire === 'depends_on_position'
                            ? 'Selon le poste'
                            : recommendation.wouldRehire === 'no'
                              ? 'Non'
                              : 'Je préfère ne pas répondre'}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                    Aucune recommandation visible pour le moment.
                  </p>
                )}
              </div>
            </SevenoPanel>

            <div className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                  Envoyer une invitation
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">Choisir une offre publiée</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  La proposition est créée à partir d une offre publiée et du profil anonyme du candidat.
                </p>

                <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-200">Offre publiée</span>
                    <Select
                      value={selectedOfferId}
                      onChange={(event) => setSelectedOfferId(event.target.value)}
                    >
                      <option value="">Sélectionner une offre</option>
                      {publishedOffers.map((offer) => (
                        <option key={offer.id} value={offer.id}>
                          {offer.title} · {offer.jobRoleLabel}
                        </option>
                      ))}
                    </Select>
                  </label>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">
                      File active de l offre
                    </p>
                    <p className="mt-2 font-medium text-white">{selectedOfferCapacityLabel}</p>
                    {selectedOfferCapacityReminder ? (
                      <p className="mt-2 text-xs leading-5 text-slate-400">{selectedOfferCapacityReminder}</p>
                    ) : null}
                    {selectedOfferId ? (
                      <Link
                        href={`/entreprise/demandes?offerId=${encodeURIComponent(selectedOfferId)}`}
                        className="mt-3 inline-flex rounded-full border border-white/10 bg-slate-950/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                      >
                        Traiter les candidatures en cours
                      </Link>
                    ) : null}
                  </div>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-200">Message optionnel</span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={5}
                      maxLength={500}
                      placeholder="Présentez brièvement l opportunité..."
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300/40"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={saving || !selectedOfferId || selectedOfferCapacityReached}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_rgba(139,92,246,0.18)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? 'Envoi en cours...'
                        : selectedOfferCapacityReached
                          ? 'Candidatures en cours à traiter'
                          : 'Envoyer l invitation'}
                    </button>
                    <Link
                      href="/entreprise/offres"
                      className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      Gérer mes offres
                    </Link>
                  </div>
                </form>
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                  Dossiers liés à ce candidat
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">Historique des relations</h3>

                <div className="mt-5 space-y-4">
                  {applications.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                      Aucun dossier pour le moment.
                    </p>
                  ) : (
                    applications.map((application) => (
                      <ApplicationCard key={application.id} application={application} />
                    ))
                  )}
                </div>
              </SevenoPanel>
            </div>
          </>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
