'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { CandidateStatusCard } from '@/components/candidate/CandidateStatusCard';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { findFamilyLabel, findRoleLabel, findSectorLabel } from '@/lib/job-taxonomy';
import { listApplicationsClient } from '@/lib/seveno-job-applications';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type { SerializedCandidateJobApplication } from '@/types/seveno-job-applications';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  invited: 'Invitation reçue',
  prerequisites_in_progress: 'Réponses en cours',
  eligible: 'Prête à envoyer',
  ineligible: 'Non éligible',
  submitted: 'Envoyée',
  viewed: 'Consultée',
  questionnaire_pending: 'Questionnaire à remplir',
  questionnaire_completed: 'Questionnaire terminé',
  shortlisted: 'Sélectionnée',
  rejected: 'Refusée',
  contact_requested: 'Contact demandé',
  conversation_open: 'Conversation ouverte',
  candidate_declined: 'Invitation refusée',
  company_declined: 'Relation refusée',
  candidate_withdrawn: 'Retrait candidat',
  offer_unavailable: 'Offre indisponible',
  withdrawn: 'Retirée',
  closed: 'Fermée',
};

function isActiveApplication(application: SerializedCandidateJobApplication) {
  return ['invited', 'prerequisites_in_progress', 'eligible', 'ineligible', 'submitted', 'questionnaire_pending', 'questionnaire_completed', 'conversation_open'].includes(application.status);
}

function formatCompanyLabel(application: SerializedCandidateJobApplication) {
  return application.companyNameSnapshot || application.offerSnapshot.companyName;
}

function formatApplicationKind(application: SerializedCandidateJobApplication) {
  return application.origin === 'company' ? 'Invitation entreprise' : 'Candidature candidat';
}

function formatQuestionnaireLabel(application: SerializedCandidateJobApplication) {
  if (application.companyAssessment?.status === 'completed') return 'Terminé';
  if (application.companyAssessment?.status === 'submitted') return 'En cours';
  if (application.companyAssessment?.status === 'in_progress') return 'En cours';
  if (application.companyAssessment?.status === 'expired') return 'Expiré';
  if (application.companyAssessment?.status === 'abandoned') return 'Abandonné';
  return 'Non démarré';
}

function ApplicationCard({ application }: { application: SerializedCandidateJobApplication }) {
  const callToAction =
    application.origin === 'company' && application.status === 'invited'
      ? 'Répondre à l invitation'
      : application.conversationStatus === 'open'
        ? 'Ouvrir la conversation'
        : 'Voir le dossier';

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">{formatApplicationKind(application)}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{application.offerSnapshot.title}</h3>
          <p className="mt-2 text-sm text-slate-400">{formatCompanyLabel(application)}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
          {STATUS_LABELS[application.status] ?? application.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
        <span>{application.offerSnapshot.jobRoleLabel}</span>
        <span>{findSectorLabel(application.offerSnapshot.sectorId) ?? application.offerSnapshot.sectorId}</span>
        <span>{application.offerSnapshot.location}</span>
        <span>Questionnaire : {formatQuestionnaireLabel(application)}</span>
        <span>Conversation : {application.conversationStatus === 'open' ? 'Ouverte' : 'Fermée'}</span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Prérequis obligatoires</p>
          <p className="mt-2 font-medium text-white">
            {application.requiredResult.satisfied}/{application.requiredResult.total}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Valeurs ajoutées</p>
          <p className="mt-2 font-medium text-white">
            {application.preferredResult.satisfied}/{application.preferredResult.total}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Identifiant public</p>
          <p className="mt-2 break-all font-medium text-white">{application.publicCandidateId}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/candidat/candidatures/${application.id}`}
          className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
        >
          {callToAction}
        </Link>
      </div>
    </article>
  );
}

export default function CandidateRequestsPage() {
  const { authUser, profile, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [applications, setApplications] = useState<SerializedCandidateJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(append = false, cursor?: string | null) {
    if (!authUser) {
      return;
    }

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const payload = await listApplicationsClient(authUser, cursor);
      setApplications((current) => (append ? [...current, ...payload.applications] : payload.applications));
      setNextCursor(payload.nextCursor);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Les dossiers n ont pas pu etre charges.');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (authUser) {
      void load();
    }
    // Authentication is the only automatic loading trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const groups = useMemo(() => {
    const invitations = applications.filter((application) => application.origin === 'company' && application.status === 'invited');
    const active = applications.filter((application) => isActiveApplication(application) && !invitations.includes(application));
    const closed = applications.filter((application) => !invitations.includes(application) && !active.includes(application));
    return { invitations, active, closed };
  }, [applications]);

  const profileSummary = profile
    ? [
        findSectorLabel(profile.sectorId) ?? profile.sectorId,
        findFamilyLabel(profile.jobFamilyId) ?? profile.jobFamilyId,
        findRoleLabel(profile.jobRoleId) ?? profile.jobRoleId,
      ]
    : [];

  return (
    <CandidateShell
      title="Mises en relation"
      description="Retrouvez vos invitations reçues et vos dossiers liés aux offres."
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        {sessionError || error ? (
          <SevenoPanel tone="orange">
            <p className="text-sm text-orange-100">{sessionError ?? error}</p>
          </SevenoPanel>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <CandidateStatusCard
            tone="violet"
            label="Dossiers totaux"
            value={applications.length}
            note="Toutes vos candidatures et invitations liées aux offres."
          />
          <CandidateStatusCard
            tone="orange"
            label="Invitations"
            value={groups.invitations.length}
            note="Les entreprises peuvent vous proposer une relation directe."
          />
          <CandidateStatusCard
            tone="cyan"
            label="Ouverts"
            value={groups.active.length}
            note="Les dossiers en cours, y compris les conversations ouvertes."
          />
        </div>

        <SevenoPanel tone="neutral" className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Votre profil anonyme</p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {profile?.publicCandidateId ?? 'Profil anonyme'}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {profileSummary.length > 0
                  ? `Métier recherché : ${profileSummary.join(' - ')}`
                  : 'Profil métier non renseigné.'}
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Statut du profil</p>
              <p className="mt-2 font-medium text-white">{profile?.profileStatus ?? 'Inconnu'}</p>
            </div>
          </div>
        </SevenoPanel>

        {loading || sessionLoading ? (
          <SevenoPanel tone="neutral" className="px-4 py-4 text-sm text-slate-300">
            Chargement des dossiers...
          </SevenoPanel>
        ) : null}

        {!loading && !sessionLoading && applications.length === 0 ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm leading-7 text-slate-300">
            <p className="font-medium text-white">Aucun dossier pour le moment</p>
            <p className="mt-3">
              Les candidatures depuis les offres et les invitations envoyées par les entreprises apparaîtront ici.
            </p>
          </SevenoPanel>
        ) : null}

        {groups.invitations.length > 0 ? (
          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/80">Invitations reçues</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Relations à traiter</h3>
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
              <h3 className="mt-2 text-xl font-semibold text-white">Candidatures en cours</h3>
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
    </CandidateShell>
  );
}
