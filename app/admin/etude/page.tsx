'use client';

import { FormEvent, useEffect, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { formatStudyAnswerValue, getProfileLabel } from '@/lib/study-analytics';
import type { StudyStats } from '@/lib/study-analytics';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { RespondentType, StudyAnswerValue } from '@/types/study';

type FilterValue = 'all' | 'yes' | 'no';

type StudyResponseItem = {
  id: string;
  respondentType?: RespondentType;
  answers?: Partial<Record<string, StudyAnswerValue>>;
  wantsLaunchNotification?: boolean;
  wantsBetaAccess?: boolean;
  wantsProjectUpdates?: boolean;
  email?: string;
  phone?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  acquisitionChannel?: string;
  acquisitionChannelLabel?: string;
  discoverySource?: string;
  logoFeedback?: 'yes' | 'no';
  visitorFingerprint?: string;
  createdAtMs: number | null;
};

type StudyAdminPayload = {
  metrics: {
    totalResponses: number;
    byProfile: Record<RespondentType, number>;
    launchCount: number;
    betaCount: number;
    launchRate: number;
    betaRate: number;
    intentCounts: Record<'high' | 'medium' | 'low', number>;
    projectUpdatesYesCount: number;
    projectUpdatesNoCount: number;
    projectUpdatesBaseCount: number;
    projectUpdatesRate: number;
    logoFeedbackYesCount: number;
    logoFeedbackNoCount: number;
    logoFeedbackBaseCount: number;
    logoFeedbackRate: number;
  };
  studyStats: StudyStats;
  qualityStats: {
    totalResponses: number;
    uniqueEmails: number;
    uniquePhones: number;
    uniqueFingerprints: number;
    duplicateEmailResponses: number;
    duplicatePhoneResponses: number;
    duplicateFingerprintResponses: number;
    burstResponses: number;
    suspectResponses: number;
  };
  responses?: StudyResponseItem[];
  responseCount?: number;
  responsePage?: number;
  responsePageSize?: number;
  responseTotalPages?: number;
};

const respondentsPageSize = 10;

function formatPercent(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: number | null) {
  if (!value) {
    return 'Date inconnue';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StudyMetricCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone: 'cyan' | 'violet' | 'orange' | 'neutral';
}) {
  return (
    <SevenoPanel tone={tone} className="p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{note}</p>
    </SevenoPanel>
  );
}

function formatResponseValue(key: string, value: StudyAnswerValue | null | undefined) {
  return formatStudyAnswerValue(key, value ?? null);
}

export default function AdminStudyPage() {
  const [data, setData] = useState<StudyAdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondentsError, setRespondentsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<'all' | RespondentType>('all');
  const [launch, setLaunch] = useState<FilterValue>('all');
  const [beta, setBeta] = useState<FilterValue>('all');
  const [page, setPage] = useState(1);

  async function loadStudyDashboard(nextPage = page) {
    setLoadingResponses(true);
    setRespondentsError(null);

    try {
      const params = new URLSearchParams({
        includeResponses: '1',
        page: String(nextPage),
        pageSize: String(respondentsPageSize),
        search: search.trim(),
        profile,
        launch,
        beta,
      });

      const payload = await fetchSevenoAdminApi<StudyAdminPayload>(`/api/admin/study-responses?${params.toString()}`);
      setData(payload);
      setPage(payload.responsePage ?? nextPage);
    } catch (thrownError) {
      setRespondentsError(thrownError instanceof Error ? thrownError.message : 'Le chargement des reponses a echoue.');
    } finally {
      setLoadingResponses(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const params = new URLSearchParams({
          includeResponses: '1',
          page: String(1),
          pageSize: String(respondentsPageSize),
          search: '',
          profile: 'all',
          launch: 'all',
          beta: 'all',
        });

        const payload = await fetchSevenoAdminApi<StudyAdminPayload>(`/api/admin/study-responses?${params.toString()}`);
        if (!active) {
          return;
        }

        setData(payload);
        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : "L etude n a pas pu etre chargee.");
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function handleFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    await loadStudyDashboard(1);
  }

  async function handlePageChange(nextPage: number) {
    if (nextPage < 1) {
      return;
    }

    setPage(nextPage);
    await loadStudyDashboard(nextPage);
  }

  const metrics = data?.metrics;
  const qualityStats = data?.qualityStats;
  const responses = data?.responses ?? [];
  const responseCount = data?.responseCount ?? responses.length;
  const responsePage = data?.responsePage ?? page;
  const responseTotalPages = data?.responseTotalPages ?? 1;

  return (
    <SevenoSurface
      eyebrow="Administration Seven'O"
      title="Etude"
      description="Conservation du questionnaire et de la lecture admin existante, avec filtre, pagination et indicateurs de qualite."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement de l etude...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StudyMetricCard
                tone="cyan"
                label="Reponses"
                value={metrics?.totalResponses ?? 0}
                note="Volume total de la collecte study_responses."
              />
              <StudyMetricCard
                tone="violet"
                label="Interet lancement"
                value={formatPercent(metrics?.launchRate ?? 0)}
                note={`${metrics?.launchCount ?? 0} reponse(s) positives.`}
              />
              <StudyMetricCard
                tone="orange"
                label="Interet beta"
                value={formatPercent(metrics?.betaRate ?? 0)}
                note={`${metrics?.betaCount ?? 0} reponse(s) positives.`}
              />
              <StudyMetricCard
                tone="neutral"
                label="Reponses suspectes"
                value={qualityStats?.suspectResponses ?? 0}
                note="Doublons ou rafales de soumission detectes."
              />
            </div>

            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Filtres</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Reponses individuelles</h2>
                </div>
                <p className="text-sm text-slate-400">
                  {responseCount} reponse(s) trouvee(s) - page {responsePage} sur {responseTotalPages}
                </p>
              </div>

              <form onSubmit={(event) => void handleFilters(event)} className="mt-4 grid gap-3 xl:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto]">
                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Recherche
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Email, reponse, source..."
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Profil
                  <select
                    value={profile}
                    onChange={(event) => setProfile(event.target.value as 'all' | RespondentType)}
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    <option value="all">Tous les profils</option>
                    <option value="professional_available">Professionnel disponible</option>
                    <option value="professional_employed">Professionnel en poste</option>
                    <option value="company">Entreprise</option>
                    <option value="agency">Agence / cabinet RH</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Lancement
                  <select
                    value={launch}
                    onChange={(event) => setLaunch(event.target.value as FilterValue)}
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    <option value="all">Tous</option>
                    <option value="yes">Oui</option>
                    <option value="no">Non</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm text-slate-300">
                  Beta
                  <select
                    value={beta}
                    onChange={(event) => setBeta(event.target.value as FilterValue)}
                    className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    <option value="all">Tous</option>
                    <option value="yes">Oui</option>
                    <option value="no">Non</option>
                  </select>
                </label>

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={loadingResponses}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingResponses ? 'Chargement...' : 'Appliquer'}
                  </button>
                </div>
              </form>

              {respondentsError ? (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {respondentsError}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {responses.length > 0 ? (
                  responses.map((response) => {
                    const contactLines = [response.email, response.phone].filter(Boolean);
                    const answerEntries = Object.entries(response.answers ?? {}).slice(0, 8);

                    return (
                      <article
                        key={response.id}
                        className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_16px_60px_-36px_rgba(2,6,23,0.85)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{getProfileLabel(response.respondentType)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                              {formatDateTime(response.createdAtMs)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                            {response.acquisitionChannel || response.acquisitionChannelLabel ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                {response.acquisitionChannelLabel ?? response.acquisitionChannel ?? 'Canal'}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              Lancement {response.wantsLaunchNotification ? 'Oui' : 'Non'}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                              Beta {response.wantsBetaAccess ? 'Oui' : 'Non'}
                            </span>
                          </div>
                        </div>

                        {contactLines.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
                            {response.email ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{response.email}</span> : null}
                            {response.phone ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{response.phone}</span> : null}
                          </div>
                        ) : null}

                        {answerEntries.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {answerEntries.map(([key, value]) => (
                              <span
                                key={key}
                                className="inline-flex rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-200"
                              >
                                {key}: {formatResponseValue(key, value)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-slate-400">Aucune reponse detaillee disponible.</p>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                    Aucune reponse ne correspond aux filtres.
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => void handlePageChange(Math.max(1, responsePage - 1))}
                  disabled={loadingResponses || responsePage <= 1}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Precedent
                </button>
                <p className="text-sm text-slate-400">{respondentsPageSize} reponses par page</p>
                <button
                  type="button"
                  onClick={() => void handlePageChange(Math.min(responseTotalPages, responsePage + 1))}
                  disabled={loadingResponses || responsePage >= responseTotalPages}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </SevenoPanel>
          </>
        )}
      </div>
    </SevenoSurface>
  );
}
