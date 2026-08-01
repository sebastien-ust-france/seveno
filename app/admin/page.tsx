'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { formatDesiredContractTypeLabels } from '@/lib/seveno-desired-contract-types';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { AdminOverviewPayload } from '@/types/seveno-admin';

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

type OverviewCardProps = {
  label: string;
  value: string | number;
  note: string;
  tone: 'cyan' | 'violet' | 'orange' | 'neutral';
};

function formatSevenoAssessmentStatus(
  status: AdminOverviewPayload['latestCandidates'][number]['sevenoAssessment']['status'],
) {
  switch (status) {
    case 'completed':
      return 'Terminé';
    case 'in_progress':
      return 'En cours';
    case 'expired':
      return 'Expiré';
    case 'abandoned':
      return 'Abandonné';
    case 'unknown':
      return 'Statut inconnu';
    default:
      return 'Non commencé';
  }
}

function formatSevenoAssessmentScoreLabel(
  assessment: AdminOverviewPayload['latestCandidates'][number]['sevenoAssessment'],
) {
  if (assessment.status === 'completed') {
    return typeof assessment.overallScore === 'number'
      ? `${Math.round(assessment.overallScore)}%`
      : 'Non calculé';
  }

  return formatSevenoAssessmentStatus(assessment.status);
}

function formatSevenoAssessmentMeta(
  assessment: AdminOverviewPayload['latestCandidates'][number]['sevenoAssessment'],
) {
  const parts: string[] = [];

  if (assessment.questionnaireVersion) {
    parts.push(`Version ${assessment.questionnaireVersion}`);
  }

  if (assessment.professionalAssessmentVersionId) {
    parts.push(assessment.professionalAssessmentVersionId);
  }

  if (assessment.completedAt) {
    parts.push(`Terminé le ${formatDateTime(assessment.completedAt)}`);
  }

  return parts.join(' · ');
}

function OverviewCard({ label, value, note, tone }: OverviewCardProps) {
  return (
    <SevenoPanel tone={tone} className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{note}</p>
    </SevenoPanel>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAdminOverview = useCallback(async () => {
    const payload = await fetchSevenoAdminApi<AdminOverviewPayload>('/api/admin/overview');
    setData(payload);
    return payload;
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadAdminOverview();
        if (!active) {
          return;
        }

        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : "Le tableau de bord admin n a pas pu etre charge.");
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadAdminOverview]);

  async function handleRefresh() {
    if (loading || refreshing) {
      return;
    }

    setRefreshing(true);
    setError(null);

    try {
      await loadAdminOverview();
    } catch (thrownError) {
      setError(thrownError instanceof Error ? thrownError.message : "Le tableau de bord admin n a pas pu etre actualise.");
    } finally {
      setRefreshing(false);
    }
  }

  const counts = data?.counts;
  const latestCandidates = data?.latestCandidates ?? [];
  const latestCompanies = data?.latestCompanies ?? [];
  const latestTests = data?.latestTests ?? [];
  const latestMatchRequests = data?.latestMatchRequests ?? [];
  const latestLogs = data?.latestLogs ?? [];

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Tableau de bord de supervision"
      description="Vue d ensemble du socle MVP: comptes, profils anonymes, entreprises, tests, mises en relation et journal d actions."
      actions={
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={loading || refreshing}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? 'Actualisation...' : 'Actualiser les donnees'}
        </button>
      }
      footer={<p className="text-xs uppercase tracking-[0.24em] text-slate-500">Acces reserve aux comptes admin</p>}
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement du tableau de bord admin...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                tone="cyan"
                label="Profils candidats"
                value={counts?.candidateProfiles ?? 0}
                note={`${counts?.activeCandidates ?? 0} actifs, ${counts?.pausedCandidates ?? 0} en pause.`}
              />
              <OverviewCard
                tone="violet"
                label="Profils entreprises"
                value={counts?.companyProfiles ?? 0}
                note={`${counts?.verifiedCompanies ?? 0} verifies, ${counts?.pendingCompanies ?? 0} en attente.`}
              />
              <OverviewCard
                tone="orange"
                label="Tests"
                value={counts?.testSessions ?? 0}
                note={`${counts?.testResults ?? 0} resultats verifies dans la base.`}
              />
              <OverviewCard
                tone="neutral"
                label="Mises en relation"
                value={counts?.matchRequests ?? 0}
                note={`${counts?.pendingMatchRequests ?? 0} en attente, ${counts?.acceptedMatchRequests ?? 0} ${(counts?.acceptedMatchRequests ?? 0) > 1 ? 'acceptées' : 'acceptée'}.`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <SevenoPanel tone="cyan" className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Étude</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Collecte des réponses</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {counts?.studyResponses ?? 0} {(counts?.studyResponses ?? 0) > 1 ? 'réponses' : 'réponse'} dans `study_responses`. La structure reste compatible avec
                      l’existant.
                    </p>
                  </div>
                  <Link
                    href="/admin/etude"
                    className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/15"
                  >
                    Ouvrir l’étude
                  </Link>
                </div>
              </SevenoPanel>

              <SevenoPanel tone="violet" className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Journal</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Dernieres actions admin</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {counts?.adminLogs ?? 0} {(counts?.adminLogs ?? 0) > 1 ? 'entrées' : 'entrée'} dans le journal interne, avec traçabilité des accès sensibles.
                </p>
              </SevenoPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SevenoPanel tone="neutral" className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Candidats</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Profils recents</h2>
                  </div>
                  <Link href="/admin/candidats" className="text-sm font-medium text-cyan-100 transition hover:text-white">
                    Voir tout
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {latestCandidates.length > 0 ? (
                    latestCandidates.map((candidate) => (
                      <article key={candidate.uid} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{candidate.publicCandidateId}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                              {candidate.profileStatus}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {formatSevenoAssessmentScoreLabel(candidate.sevenoAssessment)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          {candidate.jobRoleId} - {candidate.locationArea}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          Contrats recherchés : {formatDesiredContractTypeLabels(candidate.desiredContractTypeCodes)}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                          Questionnaire Seven’O
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          {candidate.sevenoAssessment.status === 'completed'
                            ? `Terminé le ${formatDateTime(candidate.sevenoAssessment.completedAt)}`
                            : formatSevenoAssessmentStatus(candidate.sevenoAssessment.status)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatSevenoAssessmentMeta(candidate.sevenoAssessment) || 'Aucune synthèse finale disponible.'}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Mis a jour {formatDateTime(candidate.updatedAt)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Aucun profil candidat pour le moment.</p>
                  )}
                </div>
              </SevenoPanel>

              <SevenoPanel tone="neutral" className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Entreprises</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Profils recents</h2>
                  </div>
                  <Link href="/admin/entreprises" className="text-sm font-medium text-cyan-100 transition hover:text-white">
                    Voir tout
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {latestCompanies.length > 0 ? (
                    latestCompanies.map((company) => (
                      <article key={company.uid} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{company.companyName}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">
                              {company.verificationStatus}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {company.profileStatus}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          {company.companyType} - {company.businessSector}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Mis a jour {formatDateTime(company.updatedAt)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Aucun profil entreprise pour le moment.</p>
                  )}
                </div>
              </SevenoPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SevenoPanel tone="orange" className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Tests</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Dernieres sessions</h2>
                  </div>
                  <Link href="/admin/tests" className="text-sm font-medium text-cyan-100 transition hover:text-white">
                    Voir tout
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {latestTests.length > 0 ? (
                    latestTests.map((test) => (
                      <article key={test.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{test.publicCandidateId}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{test.status}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {test.score != null ? `${test.score}%` : 'En attente'}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          {test.questionBankCode} - {test.jobRoleId}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Debut {formatDateTime(test.startedAt)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Aucune session de test pour le moment.</p>
                  )}
                </div>
              </SevenoPanel>

              <SevenoPanel tone="orange" className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Mises en relation</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Dernieres demandes</h2>
                  </div>
                  <Link
                    href="/admin/mises-en-relation"
                    className="text-sm font-medium text-cyan-100 transition hover:text-white"
                  >
                    Voir tout
                  </Link>
                </div>

                <div className="mt-4 space-y-3">
                  {latestMatchRequests.length > 0 ? (
                    latestMatchRequests.map((request) => (
                      <article key={request.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{request.companyNameSnapshot}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{request.status}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                            {request.publicCandidateId}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">
                          {request.proposedJobTitle ?? request.jobRoleId} - {request.proposedLocation ?? 'A definir'}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">Créée {formatDateTime(request.createdAt)}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Aucune demande pour le moment.</p>
                  )}
                </div>
              </SevenoPanel>
            </div>

            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Journal</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Dernieres entrees</h2>
                </div>
                <Link href="/admin/journal" className="text-sm font-medium text-cyan-100 transition hover:text-white">
                  Voir tout
                </Link>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {latestLogs.length > 0 ? (
                  latestLogs.map((entry) => (
                    <article key={entry.id} className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{entry.action}</p>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{entry.actorRole ?? 'admin'}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {entry.targetCollection ?? 'collection'} {entry.targetId ? `#${entry.targetId}` : ''}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Aucune entree de journal pour le moment.</p>
                )}
              </div>
            </SevenoPanel>

            <SevenoPanel tone="neutral" className="p-5 text-sm leading-7 text-slate-300">
              <p className="font-medium text-white">Rappel de gouvernance</p>
              <p className="mt-3">
                Les donnees privees candidat ne doivent jamais apparaitre dans `candidate_profiles`. Elles restent
                traitees via `users/uid` et ne sont visibles que dans les vues admin securisees, avec journalisation.
              </p>
            </SevenoPanel>
          </>
        )}
      </div>
    </SevenoSurface>
  );
}
