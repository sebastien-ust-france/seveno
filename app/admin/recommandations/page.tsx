'use client';

import { useEffect, useState } from 'react';
import AdminSectionNav from '@/components/admin/AdminSectionNav';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { loadAdminRecommendations, verifyAdminRecommendation } from '@/lib/seveno-recommendations';
import type {
  CandidateRecommendation,
  CandidateRecommendationRequest,
} from '@/types/seveno';

function formatDateTime(value: unknown) {
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    }
  }

  if (!value || typeof value !== 'object') {
    return 'Non disponible';
  }

  if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format((value as { toDate: () => Date }).toDate());
  }

  const record = value as { _seconds?: unknown; _nanoseconds?: unknown; seconds?: unknown; nanoseconds?: unknown };
  const seconds = typeof record._seconds === 'number'
    ? record._seconds
    : typeof record.seconds === 'number'
      ? record.seconds
      : null;
  const nanoseconds = typeof record._nanoseconds === 'number'
    ? record._nanoseconds
    : typeof record.nanoseconds === 'number'
      ? record.nanoseconds
      : 0;

  if (seconds === null) {
    return 'Non disponible';
  }

  const date = new Date((seconds * 1000) + Math.round(nanoseconds / 1_000_000));
  if (Number.isNaN(date.getTime())) {
    return 'Non disponible';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function recommendationStatusLabel(value: CandidateRecommendation['verificationStatus']) {
  switch (value) {
    case 'verified':
      return 'Vérifiée';
    case 'verification_rejected':
      return 'Refusée';
    case 'verification_pending':
      return 'En attente';
    default:
      return 'Non démarrée';
  }
}

function invitationStatusLabel(value: CandidateRecommendationRequest['status']) {
  switch (value) {
    case 'sent':
      return 'Envoyée';
    case 'viewed':
      return 'Consultée';
    case 'submitted':
      return 'Soumise';
    case 'expired':
      return 'Expirée';
    case 'revoked':
      return 'Révoquée';
    default:
      return 'Brouillon';
  }
}

export default function AdminRecommendationsPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<CandidateRecommendationRequest[]>([]);
  const [recommendations, setRecommendations] = useState<CandidateRecommendation[]>([]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const payload = await loadAdminRecommendations();
        if (!active) {
          return;
        }

        setRequests(payload.requests);
        setRecommendations(payload.recommendations);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : 'Les recommandations admin n’ont pas pu être chargées.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    const payload = await loadAdminRecommendations();
    setRequests(payload.requests);
    setRecommendations(payload.recommendations);
  }

  async function moderateRecommendation(recommendationId: string, action: 'verify' | 'reject') {
    setSavingId(recommendationId);
    setError(null);

    try {
      const reason = action === 'reject'
        ? window.prompt('Motif du refus (facultatif)') ?? undefined
        : undefined;
      await verifyAdminRecommendation(recommendationId, action, reason);
      await refresh();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : 'La moderation a echoue.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Recommandations"
      description="Vérifiez les avis professionnels transmis par les anciens employeurs ou managers avant leur visibilité côté entreprise."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        <AdminSectionNav />

        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement des recommandations...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SevenoPanel tone="cyan" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Demandes</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{requests.length}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Invitations préparées côté candidat.</p>
              </SevenoPanel>
              <SevenoPanel tone="blue" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">À vérifier</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {recommendations.filter((item) => item.verificationStatus === 'verification_pending').length}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Avis soumis mais pas encore arbitrés.</p>
              </SevenoPanel>
              <SevenoPanel tone="orange" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Vérifiées</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {recommendations.filter((item) => item.verificationStatus === 'verified').length}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Recommandations rendues visibles si autorisées.</p>
              </SevenoPanel>
              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Refusées</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  {recommendations.filter((item) => item.verificationStatus === 'verification_rejected').length}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Avis écartés après contrôle administratif.</p>
              </SevenoPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Invitations</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Demandes préparées</h2>
                <div className="mt-5 space-y-3">
                  {requests.length > 0 ? (
                    requests.map((request) => (
                      <article key={request.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {request.respondentFirstName} {request.respondentLastName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                              {request.respondentTitle} · {request.respondentCompanyName}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                              {invitationStatusLabel(request.status)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                              {request.verificationStatus === 'verified'
                                ? 'Vérifiée'
                                : request.verificationStatus === 'verification_rejected'
                                  ? 'Refusée'
                                  : 'En attente'}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-300">
                          {request.candidateJobTitle} · {request.collaborationPeriodLabel}
                        </p>
                        {request.respondentWebsite ? (
                          <p className="mt-2 text-xs text-slate-400">{request.respondentWebsite}</p>
                        ) : null}
                        {request.respondentSiret ? (
                          <p className="mt-1 text-xs text-slate-400">SIRET: {request.respondentSiret}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">
                          Créée {formatDateTime(request.createdAt)} · Échéance {formatDateTime(request.tokenExpiresAt)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                      Aucune invitation enregistrée.
                    </p>
                  )}
                </div>
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Avis</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Recommandations à contrôler</h2>
                <div className="mt-5 space-y-3">
                  {recommendations.length > 0 ? (
                    recommendations.map((recommendation) => (
                      <article key={recommendation.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {recommendation.respondentFirstName} {recommendation.respondentLastName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                              {recommendation.respondentTitle} · {recommendation.respondentCompanyName}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                              {recommendationStatusLabel(recommendation.verificationStatus)}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                              {recommendation.candidateVisibility === 'visible' ? 'Visible' : 'Masquée'}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-sm text-slate-300">
                          {recommendation.candidateJobTitle} · {recommendation.collaborationPeriodLabel}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Soumise {formatDateTime(recommendation.createdAt)} · Vérifiée {formatDateTime(recommendation.verifiedAt)}
                        </p>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Qualités</p>
                            <p className="mt-2 text-sm text-white">{recommendation.qualities.join(', ')}</p>
                          </article>
                          <article className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Recommandation</p>
                            <p className="mt-2 text-sm text-white">
                              {recommendation.wouldRehire === 'yes'
                                ? 'Oui'
                                : recommendation.wouldRehire === 'depends_on_position'
                                  ? 'Selon le poste'
                                  : recommendation.wouldRehire === 'no'
                                    ? 'Non'
                                    : 'Je préfère ne pas répondre'}
                            </p>
                          </article>
                        </div>

                        {recommendation.comment ? (
                          <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3 text-sm leading-7 text-slate-300">
                            {recommendation.comment}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void moderateRecommendation(recommendation.id, 'verify')}
                            disabled={savingId === recommendation.id || recommendation.verificationStatus === 'verified'}
                            className="rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Vérifier
                          </button>
                          <button
                            type="button"
                            onClick={() => void moderateRecommendation(recommendation.id, 'reject')}
                            disabled={savingId === recommendation.id || recommendation.verificationStatus === 'verification_rejected'}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Refuser
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-400">
                      Aucune recommandation à contrôler.
                    </p>
                  )}
                </div>
              </SevenoPanel>
            </div>
          </>
        )}
      </div>
    </SevenoSurface>
  );
}
