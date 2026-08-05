'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { CandidateShell } from '@/components/candidate/CandidateShell';
import { SevenoPanel } from '@/components/seveno/SevenoLayout';
import { listApplicationsClient } from '@/lib/seveno-job-applications';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type {
  ImplementedJobApplicationStatus,
  SerializedCandidateJobApplication,
} from '@/types/seveno-job-applications';

const APPLICATION_STATUS_LABELS: Record<ImplementedJobApplicationStatus, string> = {
  draft: 'Brouillon',
  invited: 'Invitation reçue',
  prerequisites_in_progress: 'Prérequis en cours',
  eligible: 'Prête à envoyer',
  ineligible: 'Prérequis à vérifier',
  submitted: 'Envoyée',
  viewed: 'Consultée',
  questionnaire_pending: 'Questionnaire à compléter',
  questionnaire_completed: 'Questionnaire terminé',
  shortlisted: 'Présélectionnée',
  rejected: 'Non retenue',
  contact_requested: 'Mise en relation proposée',
  conversation_open: 'Échange en cours',
  candidate_declined: 'Invitation refusée',
  company_declined: 'Non retenue',
  candidate_withdrawn: 'Retirée',
  offer_unavailable: 'Offre indisponible',
  withdrawn: 'Retirée',
  closed: 'Clôturée',
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date indisponible'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

export function CandidateApplicationsList() {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [applications, setApplications] = useState<SerializedCandidateJobApplication[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) return;

    let active = true;

    async function loadInitialApplications() {
      setLoading(true);
      setError(null);

      try {
        const payload = await listApplicationsClient(authUser!);
        if (!active) return;
        setApplications(payload.applications);
        setNextCursor(payload.nextCursor);
      } catch (thrownError) {
        if (active) {
          setError(thrownError instanceof Error ? thrownError.message : 'Les candidatures n’ont pas pu être chargées.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitialApplications();
    return () => {
      active = false;
    };
  }, [authUser]);

  async function loadMore() {
    if (!authUser || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);

    try {
      const payload = await listApplicationsClient(authUser, nextCursor);
      setApplications((current) => {
        const knownIds = new Set(current.map((application) => application.id));
        return [...current, ...payload.applications.filter((application) => !knownIds.has(application.id))];
      });
      setNextCursor(payload.nextCursor);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Les candidatures suivantes n’ont pas pu être chargées.');
    } finally {
      setLoadingMore(false);
    }
  }

  const waiting = sessionLoading || loading;
  const visibleError = sessionError ?? error;

  return (
    <CandidateShell
      title="Mes candidatures"
      description="Suivez vos candidatures et accédez aux questionnaires transmis par les entreprises."
      actions={(
        <Link
          href="/candidat/offres"
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          Consulter les offres
        </Link>
      )}
    >
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Candidat', href: '/candidat' }, { label: 'Mes candidatures' }]} />

        {visibleError ? (
          <SevenoPanel tone="orange" role="alert">
            <p className="text-sm text-orange-100">{visibleError}</p>
          </SevenoPanel>
        ) : null}

        {waiting && applications.length === 0 ? (
          <SevenoPanel tone="neutral">
            <p className="text-sm text-slate-300" role="status">Chargement des candidatures…</p>
          </SevenoPanel>
        ) : null}

        {!waiting && !visibleError && applications.length === 0 ? (
          <SevenoPanel tone="neutral">
            <h2 className="text-xl font-semibold text-white">Aucune candidature pour le moment</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Les candidatures commencées ou envoyées apparaîtront ici.
            </p>
            <Link
              href="/candidat/offres"
              className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              Voir les offres
            </Link>
          </SevenoPanel>
        ) : null}

        {applications.length > 0 ? (
          <section aria-labelledby="candidate-applications-heading">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/75">Suivi des dossiers</p>
              <h2 id="candidate-applications-heading" className="mt-2 text-2xl font-semibold text-white">
                {applications.length} {applications.length > 1 ? 'candidatures' : 'candidature'}
              </h2>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {applications.map((application) => (
                <SevenoPanel key={application.id} tone="neutral" className="flex h-full flex-col">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/75">
                        {application.companyNameSnapshot || application.offerSnapshot.companyName}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{application.offerSnapshot.title}</h3>
                      <p className="mt-2 text-sm text-slate-300">{application.offerSnapshot.jobRoleLabel}</p>
                    </div>
                    <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-100">
                      {APPLICATION_STATUS_LABELS[application.status]}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Prérequis</p>
                      <p className="mt-1 font-semibold text-white">
                        {application.requiredResult.satisfied}/{application.requiredResult.total}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Mise à jour</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatDate(application.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-5">
                    <Link
                      href={`/candidat/candidatures/${encodeURIComponent(application.id)}`}
                      className="inline-flex rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                    >
                      Voir ma candidature
                    </Link>
                  </div>
                </SevenoPanel>
              ))}
            </div>
          </section>
        ) : null}

        {nextCursor ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 disabled:opacity-60"
            >
              {loadingMore ? 'Chargement…' : 'Afficher plus de candidatures'}
            </button>
          </div>
        ) : null}
      </div>
    </CandidateShell>
  );
}
