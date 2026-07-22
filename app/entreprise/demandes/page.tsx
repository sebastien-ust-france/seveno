'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { buildQuestionnaireScoreSummary } from '@/lib/seveno-company-questionnaire-thresholds';
import { listCompanyApplicationsClient } from '@/lib/seveno-job-applications';
import { useSevenoCompanySession } from '@/lib/use-seveno-company-session';
import type { CompanyApplicationPrioritySelection, SerializedCandidateJobApplication } from '@/types/seveno-job-applications';

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

function isActiveApplication(application: SerializedCandidateJobApplication) {
  return [
    'prerequisites_in_progress',
    'eligible',
    'ineligible',
    'submitted',
    'questionnaire_pending',
    'questionnaire_completed',
    'contact_requested',
    'conversation_open',
  ].includes(application.status);
}

function formatCompanyLabel(application: SerializedCandidateJobApplication) {
  return application.companyNameSnapshot || application.offerSnapshot.companyName;
}

function ApplicationCard({ application }: { application: SerializedCandidateJobApplication }) {
  const primaryAction = application.status === 'contact_requested'
    ? 'En attente du candidat'
    : application.conversationStatus === 'open'
      ? 'Ouvrir la conversation'
      : application.status === 'submitted' || application.status === 'questionnaire_completed'
        ? 'Évaluer le dossier'
        : 'Voir le dossier';

  return (
    <SevenoPanel tone="neutral" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
            {application.origin === 'company' ? 'Invitation entreprise' : 'Candidature candidat'}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">{application.offerSnapshot.title}</h3>
          <p className="mt-2 text-sm text-slate-300">
            {formatCompanyLabel(application)} · {application.offerSnapshot.jobRoleLabel}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
          {STATUS_LABELS[application.status] ?? application.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
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

      <div className="mt-4 grid gap-3 md:grid-cols-3">
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
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Conversation</p>
          <p className="mt-2 font-medium text-white">
            {application.conversationStatus === 'open'
              ? `Ouverte · ${application.conversationUnreadCompanyCount} non lus`
              : 'Fermée'}
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
    </SevenoPanel>
  );
}

export default function CompanyApplicationsPage() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCompanySession();
  const [applications, setApplications] = useState<SerializedCandidateJobApplication[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prioritySelection, setPrioritySelection] = useState<CompanyApplicationPrioritySelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerFilter, setOfferFilter] = useState('');

  async function load(append = false, cursor?: string | null, offerId: string | null = offerFilter) {
    if (!authUser) {
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const payload = await listCompanyApplicationsClient(authUser, cursor, undefined, offerId || undefined);
      setApplications((current) => (append ? [...current, ...payload.applications] : payload.applications));
      setNextCursor(payload.nextCursor);
      if (!append) {
        setPrioritySelection(payload.prioritySelection ?? null);
      }
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Les dossiers entreprise n ont pas pu etre charges.');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const parsedOfferFilter = new URLSearchParams(window.location.search).get('offerId')?.trim() ?? '';
    setOfferFilter(parsedOfferFilter);
    setPrioritySelection(null);
    if (authUser) {
      void load(false, undefined, parsedOfferFilter);
    }
    // Authentication is the only automatic loading trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const groups = useMemo(() => {
    const invitations = applications.filter((application) => application.origin === 'company' && application.status === 'invited');
    const active = applications.filter((application) => isActiveApplication(application));
    const closed = applications.filter((application) => !invitations.includes(application) && !active.includes(application));
    return { invitations, active, closed };
  }, [applications]);

  return (
    <SevenoSurface
      eyebrow="Mise en relation"
      title="Dossiers liés aux offres"
      description="Cette vue centralise les invitations envoyées aux candidats et les candidatures reçues. Les coordonnées ne sont visibles qu après accord explicite du candidat."
      footer={profile ? <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Entreprise : {profile.companyName}</p> : null}
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        {sessionError || error ? (
          <SevenoPanel tone="orange" className="p-4">
            <p className="text-sm text-orange-100">{sessionError ?? error}</p>
          </SevenoPanel>
        ) : null}

        {offerFilter ? (
          <SevenoPanel tone="cyan" className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                  Filtre actif
                </p>
                <p className="mt-2 text-sm text-cyan-100">
                  Cette liste affiche les candidatures liées à l offre selectionnee.
                </p>
              </div>
              <Link
                href="/entreprise/demandes"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
              >
                Voir toutes les candidatures
              </Link>
            </div>
          </SevenoPanel>
        ) : null}

        {offerFilter && prioritySelection ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Sélection prioritaire</p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                {prioritySelection.applications.length > 0
                  ? `${prioritySelection.applications.length} profil(s) à prioriser`
                  : 'Aucun profil à prioriser'}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {prioritySelection.eligibleCount > 0
                  ? 'Les profils atteignant le seuil apparaissent en priorité. Les profils proches du seuil ne complètent la sélection que si moins de 5 profils qualifiés sont disponibles. La liste complète des candidatures reste affichée plus bas.'
                  : 'Aucun dossier ne dépasse le seuil minimum pour cette offre.'}
              </p>
            </div>
            <div className="space-y-4">
              {prioritySelection.applications.map((item) => {
                const scoreSummary = buildQuestionnaireScoreSummary(
                  item.application.companyAssessment?.finalScore ?? item.application.companyAssessment?.automaticScorePercent ?? null,
                  item.application.companyAssessment?.minimumPassingScorePercent ?? null,
                  'company',
                );
                return (
                  <div key={`priority-${item.application.id}`} className="space-y-3">
                    {scoreSummary ? (
                      <SevenoPanel tone="neutral" className="p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Profil prioritaire</p>
                        <p className="mt-2 text-base font-semibold text-white">{scoreSummary.label}</p>
                        <p className="mt-2 text-xs text-slate-300">
                          {scoreSummary.scoreLabel} · {scoreSummary.thresholdLabel}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">{scoreSummary.note}</p>
                      </SevenoPanel>
                    ) : null}
                    <ApplicationCard application={item.application} />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <SevenoPanel tone="violet" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Dossiers totaux</p>
            <p className="mt-3 text-3xl font-semibold text-white">{applications.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Toutes les relations liées à vos offres.</p>
          </SevenoPanel>

          <SevenoPanel tone="orange" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Invitations</p>
            <p className="mt-3 text-3xl font-semibold text-white">{groups.invitations.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Propositions déjà envoyées aux candidats.</p>
          </SevenoPanel>

          <SevenoPanel tone="cyan" className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Ouverts</p>
            <p className="mt-3 text-3xl font-semibold text-white">{groups.active.length}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">Dossiers actifs et conversations disponibles.</p>
          </SevenoPanel>
        </div>

        {loading || sessionLoading ? (
          <SevenoPanel tone="neutral" className="px-4 py-4 text-sm text-slate-300">
            Chargement des dossiers...
          </SevenoPanel>
        ) : null}

        {!loading && !sessionLoading && applications.length === 0 ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm leading-7 text-slate-300">
            <p className="font-medium text-white">Aucun dossier pour le moment</p>
            <p className="mt-3">
              Les invitations envoyées et les candidatures reçues s afficheront ici dès qu une relation liée à une
              offre existe.
            </p>
          </SevenoPanel>
        ) : null}

        {groups.invitations.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/80">Invitations envoyées</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Propositions aux candidats</h3>
            </div>
            <div className="space-y-4">
              {groups.invitations.map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
            </div>
          </section>
        ) : null}

        {groups.active.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Dossiers actifs</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Candidatures à examiner</h3>
            </div>
            <div className="space-y-4">
              {groups.active.map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
            </div>
          </section>
        ) : null}

        {groups.closed.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Dossiers fermés</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Historique</h3>
            </div>
            <div className="space-y-4">
              {groups.closed.map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
            </div>
          </section>
        ) : null}

        {nextCursor ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void load(true, nextCursor)}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'Chargement...' : 'Charger la suite'}
          </button>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
