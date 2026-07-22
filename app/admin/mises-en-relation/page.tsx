'use client';

import { useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { AdminMatchRequestSummary } from '@/types/seveno-admin';

type MatchRequestsPayload = {
  matchRequests: AdminMatchRequestSummary[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'Non disponible';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Non disponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function AdminMatchRequestsPage() {
  const [matchRequests, setMatchRequests] = useState<AdminMatchRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMatchRequests() {
    const payload = await fetchSevenoAdminApi<MatchRequestsPayload>('/api/admin/mises-en-relation');
    setMatchRequests(payload.matchRequests);
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadMatchRequests();
        if (!active) {
          return;
        }

        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Les demandes de mise en relation n ont pas pu etre chargees.');
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function handleModeration(id: string, status: 'cancelled' | 'expired') {
    setSavingId(id);
    setError(null);

    try {
      await fetchSevenoAdminApi<AdminMatchRequestSummary>(`/api/admin/mises-en-relation/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadMatchRequests();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La moderation de la demande a echoue.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Mises en relation"
      description="Vue de moderation des demandes de contact. L admin peut fermer une demande sans jamais devenir partie prenante du message."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement des mises en relation...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <div className="space-y-4">
            {matchRequests.length > 0 ? (
              matchRequests.map((request) => (
                <SevenoPanel key={request.id} tone="neutral" className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Entreprise</p>
                        <h2 className="mt-2 text-xl font-semibold text-white">{request.companyNameSnapshot}</h2>
                      </div>
                      <p className="text-sm leading-6 text-slate-300">
                        Candidat anonyme: {request.publicCandidateId} - Statut: {request.status}
                      </p>
                      <p className="text-sm leading-6 text-slate-300">
                        {request.proposedJobTitle ?? request.jobRoleId} - {request.proposedLocation ?? 'A definir'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        Créée {formatDateTime(request.createdAt)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        Echeance {formatDateTime(request.expiresAt)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Secteur</p>
                      <p className="mt-2 text-sm font-medium text-white">{request.sectorId}</p>
                    </article>
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Famille</p>
                      <p className="mt-2 text-sm font-medium text-white">{request.jobFamilyId}</p>
                    </article>
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Contrat</p>
                      <p className="mt-2 text-sm font-medium text-white">{request.contractType ?? 'Non renseigne'}</p>
                    </article>
                    <article className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Decision candidat</p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {request.candidateDecisionAt ? formatDateTime(request.candidateDecisionAt) : 'En attente'}
                      </p>
                    </article>
                  </div>

                  {request.message ? (
                    <div className="mt-5 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Message</p>
                      <p className="mt-3 whitespace-pre-wrap">{request.message}</p>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleModeration(request.id, 'cancelled')}
                      disabled={savingId === request.id || request.status === 'cancelled'}
                      className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === request.id && request.status !== 'cancelled' ? 'Mise à jour...' : 'Annuler'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleModeration(request.id, 'expired')}
                      disabled={savingId === request.id || request.status === 'expired'}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === request.id && request.status !== 'expired' ? 'Mise à jour...' : 'Marquer expirée'}
                    </button>
                  </div>
                </SevenoPanel>
              ))
            ) : (
              <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
                Aucune demande de mise en relation disponible.
              </SevenoPanel>
            )}
          </div>
        )}
      </div>
    </SevenoSurface>
  );
}
