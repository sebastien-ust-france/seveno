'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { listApplicationsClient, withdrawApplicationClient } from '@/lib/seveno-job-applications';
import { useSevenoCandidateSession } from '@/lib/use-seveno-candidate-session';
import type { SerializedCandidateJobApplication } from '@/types/seveno-job-applications';

const LABELS: Record<string, string> = {
  draft: 'Brouillon',
  invited: 'Invitation reçue',
  prerequisites_in_progress: 'Réponses en cours',
  eligible: 'Prête à envoyer',
  ineligible: 'Non éligible actuellement',
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

export default function CandidateApplicationsPage() {
  const { authUser, loading: sessionLoading, error: sessionError } = useSevenoCandidateSession();
  const [applications, setApplications] = useState<SerializedCandidateJobApplication[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(append = false, cursor?: string | null) {
    if (!authUser) {
      return;
    }

    setLoading(true);
    try {
      const payload = await listApplicationsClient(authUser, cursor);
      setApplications((current) => (append ? [...current, ...payload.applications] : payload.applications));
      setNextCursor(payload.nextCursor);
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Les candidatures n’ont pas pu être chargées.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authUser) {
      void load();
    }
    // Authentication is the only automatic loading trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  async function withdraw(applicationId: string) {
    if (!authUser || !window.confirm('Retirer cette candidature ?')) {
      return;
    }

    try {
      const payload = await withdrawApplicationClient(authUser, applicationId);
      setApplications((current) => current.map((item) => (item.id === applicationId ? payload.application : item)));
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'Le retrait a échoué.');
    }
  }

  return (
    <SevenoSurface
      eyebrow="Espace candidat"
      title="Mes candidatures"
      description="Suivez vos brouillons, candidatures envoyées et retraits."
      containerClassName="max-w-[86.4rem]"
    >
      <div className="space-y-6">
        {sessionError || error ? (
          <SevenoPanel tone="orange">
            <p className="text-sm text-orange-100">{sessionError ?? error}</p>
          </SevenoPanel>
        ) : null}

        <SevenoPanel tone="neutral">
          <div className="space-y-4">
            {(sessionLoading || loading) && applications.length === 0 ? (
              <p className="text-sm text-slate-400">Chargement...</p>
            ) : null}

            {!sessionLoading && !loading && applications.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune candidature pour le moment.</p>
            ) : null}

            {applications.map((application) => (
              <article
                key={application.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                      {application.offerSnapshot.companyName}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">{application.offerSnapshot.title}</h2>
                    <p className="mt-2 text-sm text-slate-400">{application.offerSnapshot.jobRoleLabel}</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
                    {LABELS[application.status] ?? application.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
                  <span>
                    Obligatoires : {application.requiredResult.satisfied}/{application.requiredResult.total}
                  </span>
                  <span>
                    Valeurs ajoutées : {application.preferredResult.satisfied}/{application.preferredResult.total}
                  </span>
                  <span>
                    Questionnaire :{' '}
                    {application.companyAssessment?.status === 'completed'
                      ? 'Terminé'
                      : application.companyAssessment?.status === 'submitted'
                        ? 'En cours'
                        : application.companyAssessment?.status === 'in_progress'
                          ? 'En cours'
                          : application.companyAssessment?.status === 'expired'
                            ? 'Expiré'
                            : 'Non démarré'}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/candidat/candidatures/${application.id}`}
                    className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100"
                  >
                    {application.origin === 'company' && application.status === 'invited'
                      ? 'Répondre à l invitation'
                      : application.companyAssessment?.status === 'completed'
                      ? 'Voir le questionnaire'
                      : application.companyAssessment?.status === 'submitted' ||
                          application.companyAssessment?.status === 'in_progress'
                        ? 'Questionnaire en cours'
                        : application.companyAssessment?.status === 'expired' ||
                            application.companyAssessment?.status === 'abandoned'
                          ? 'Questionnaire expiré'
                          : application.status === 'submitted' || application.status === 'withdrawn'
                            ? 'Voir ma candidature'
                            : 'Continuer mes réponses'}
                  </Link>

                  {application.status === 'submitted' ? (
                    <button
                      type="button"
                      onClick={() => void withdraw(application.id)}
                      className="rounded-full border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-100"
                    >
                      Retirer
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {nextCursor ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load(true, nextCursor)}
              className="mt-5 rounded-full border border-white/10 px-4 py-2 text-sm text-white"
            >
              Charger la suite
            </button>
          ) : null}
        </SevenoPanel>
      </div>
    </SevenoSurface>
  );
}
