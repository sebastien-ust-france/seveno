'use client';

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SevenoPanel, SevenoSurface } from '@/components/seveno/SevenoLayout';
import { getAcquisitionChannelLabel, studyAcquisitionChannelOptions } from '@/lib/study-acquisition';
import {
  countByValue,
  formatStudyAnswerValue,
  getProfileLabel,
  type StudyBreakdownItem,
  type StudyStats,
} from '@/lib/study-analytics';
import { fetchSevenoAdminApi } from '@/lib/seveno-admin-api';
import type { RespondentType, StudyAnswerValue } from '@/types/study';

type FilterValue = 'all' | 'yes' | 'no';
type AdminView = 'overview' | 'responses';

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

const profileOptions: Array<{ value: 'all' | RespondentType; label: string }> = [
  { value: 'all', label: 'Tous les profils' },
  { value: 'professional_available', label: 'Professionnel disponible' },
  { value: 'professional_employed', label: 'Professionnel déjà en poste' },
  { value: 'company', label: 'Entreprise' },
  { value: 'agency', label: 'Agence / cabinet RH' },
];

const yesNoOptions: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'yes', label: 'Oui' },
  { value: 'no', label: 'Non' },
];

const toneStyles = {
  cyan: {
    panel: 'border-cyan-400/20 bg-cyan-400/10',
    border: 'border-cyan-400/20',
    accent: 'bg-cyan-400',
    badge: 'bg-cyan-400/12 text-cyan-100 ring-1 ring-inset ring-cyan-400/20',
    chip: 'bg-cyan-400/12 text-cyan-100 ring-1 ring-inset ring-cyan-400/20',
    tableHead: 'bg-cyan-400/10 text-cyan-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-cyan-100/70',
    statValue: 'text-white',
  },
  violet: {
    panel: 'border-violet-400/20 bg-violet-400/10',
    border: 'border-violet-400/20',
    accent: 'bg-violet-400',
    badge: 'bg-violet-400/12 text-violet-100 ring-1 ring-inset ring-violet-400/20',
    chip: 'bg-violet-400/12 text-violet-100 ring-1 ring-inset ring-violet-400/20',
    tableHead: 'bg-violet-400/10 text-violet-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-violet-100/70',
    statValue: 'text-white',
  },
  green: {
    panel: 'border-emerald-400/20 bg-emerald-400/10',
    border: 'border-emerald-400/20',
    accent: 'bg-emerald-400',
    badge: 'bg-emerald-400/12 text-emerald-100 ring-1 ring-inset ring-emerald-400/20',
    chip: 'bg-emerald-400/12 text-emerald-100 ring-1 ring-inset ring-emerald-400/20',
    tableHead: 'bg-emerald-400/10 text-emerald-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-emerald-100/70',
    statValue: 'text-white',
  },
  orange: {
    panel: 'border-orange-400/20 bg-orange-400/10',
    border: 'border-orange-400/20',
    accent: 'bg-orange-400',
    badge: 'bg-orange-400/12 text-orange-100 ring-1 ring-inset ring-orange-400/20',
    chip: 'bg-orange-400/12 text-orange-100 ring-1 ring-inset ring-orange-400/20',
    tableHead: 'bg-orange-400/10 text-orange-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-orange-100/70',
    statValue: 'text-white',
  },
  amber: {
    panel: 'border-amber-400/20 bg-amber-400/10',
    border: 'border-amber-400/20',
    accent: 'bg-amber-400',
    badge: 'bg-amber-400/12 text-amber-100 ring-1 ring-inset ring-amber-400/20',
    chip: 'bg-amber-400/12 text-amber-100 ring-1 ring-inset ring-amber-400/20',
    tableHead: 'bg-amber-400/10 text-amber-100',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-amber-100/70',
    statValue: 'text-white',
  },
  teal: {
    panel: 'border-cyan-300/20 bg-cyan-300/10',
    border: 'border-cyan-300/20',
    accent: 'bg-cyan-300',
    badge: 'bg-cyan-300/12 text-cyan-50 ring-1 ring-inset ring-cyan-300/20',
    chip: 'bg-cyan-300/12 text-cyan-50 ring-1 ring-inset ring-cyan-300/20',
    tableHead: 'bg-cyan-300/10 text-cyan-50',
    tableRow: 'odd:bg-slate-900/60 even:bg-slate-950/50',
    statLabel: 'text-cyan-50/75',
    statValue: 'text-white',
  },
  slate: {
    panel: 'border-white/10 bg-white/5',
    border: 'border-white/10',
    accent: 'bg-slate-400',
    badge: 'bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10',
    chip: 'bg-white/5 text-slate-200 ring-1 ring-inset ring-white/10',
    tableHead: 'bg-white/5 text-slate-200',
    tableRow: 'odd:bg-white/[0.03] even:bg-white/[0.05]',
    statLabel: 'text-slate-300/75',
    statValue: 'text-white',
  },
} as const;

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

function formatShare(count: number, total: number) {
  if (total <= 0) {
    return '0 %';
  }

  return formatPercent(count / total);
}

function sortBreakdown(items: StudyBreakdownItem[]) {
  return [...items].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.label.localeCompare(right.label, 'fr');
  });
}

function normalizeBreakdown(items: StudyBreakdownItem[], total: number) {
  return items.map((item) => ({
    ...item,
    rate: total > 0 ? item.count / total : 0,
  }));
}

function ToneBadge({ tone, children }: { tone: keyof typeof toneStyles; children: ReactNode }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide',
        toneStyles[tone].badge,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function SectionCard({
  tone,
  eyebrow,
  title,
  description,
  children,
  className = '',
}: {
  tone: keyof typeof toneStyles;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <section
      className={[
        'rounded-3xl border bg-slate-900/75 p-5 shadow-[0_24px_80px_-40px_rgba(2,6,23,0.95)] backdrop-blur',
        styles.panel,
        className,
      ].join(' ')}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <ToneBadge tone={tone}>{eyebrow}</ToneBadge>
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function KpiCard({
  tone,
  label,
  value,
  detail,
}: {
  tone: keyof typeof toneStyles;
  label: string;
  value: string | number;
  detail?: ReactNode;
}) {
  const styles = toneStyles[tone];

  return (
    <article className={['relative overflow-hidden rounded-2xl border p-5', styles.panel, styles.border].join(' ')}>
      <span className={['absolute inset-x-0 top-0 h-1', styles.accent].join(' ')} />
      <p className={['text-sm font-medium', styles.statLabel].join(' ')}>{label}</p>
      <p className={['mt-3 text-3xl font-semibold tracking-tight', styles.statValue].join(' ')}>{value}</p>
      {detail ? <div className="mt-2 text-sm leading-6 text-slate-300">{detail}</div> : null}
    </article>
  );
}

function BreakdownTable({
  tone,
  title,
  items,
  total,
  highlightThreshold,
  highlightLabel = 'À vérifier',
}: {
  tone: keyof typeof toneStyles;
  title: string;
  items: StudyBreakdownItem[];
  total: number;
  highlightThreshold?: number;
  highlightLabel?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <article className={['rounded-2xl border p-5', styles.panel, styles.border].join(' ')}>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <ToneBadge tone={tone}>{title}</ToneBadge>
          <p className="text-sm text-slate-300">{items.length} valeur(s)</p>
        </div>
        <p className="text-sm text-slate-400">Base: {total}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className={styles.tableHead}>
            <tr>
              <th className="px-4 py-3 text-left font-medium">Valeur</th>
              <th className="px-4 py-3 text-right font-medium">Réponses</th>
              <th className="px-4 py-3 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-slate-950/65">
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.value} className={styles.tableRow}>
                  <td className="px-4 py-3 text-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.label}</span>
                      {highlightThreshold !== undefined && item.count >= highlightThreshold ? (
                        <span className="inline-flex rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100 ring-1 ring-inset ring-emerald-400/25">
                          {highlightLabel}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-100">{item.count}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatShare(item.count, total)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                  Aucune donnée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function ProfileBreakdownList({
  items,
  total,
}: {
  items: StudyBreakdownItem[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.value} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-white">{item.label}</p>
              <p className="mt-1 text-sm text-slate-400">{formatShare(item.count, total)} des réponses</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold text-white">{item.count}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.value}</p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
              style={{ width: `${Math.min(100, Math.max(0, (item.rate ?? 0) * 100))}%` }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition',
        active
          ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 text-white shadow-[0_18px_40px_rgba(34,211,238,0.18)]'
          : 'border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10',
      ].join(' ')}
    >
      {children}
    </button>
  );
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
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const responses = useMemo(() => data?.responses ?? [], [data?.responses]);

  const loadStudyDashboard = useCallback(
    async (nextPage = 1) => {
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
        setRespondentsError(thrownError instanceof Error ? thrownError.message : 'Le chargement des réponses a échoué.');
      } finally {
        setLoadingResponses(false);
      }
    },
    [beta, launch, profile, search],
  );

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await loadStudyDashboard(1);
        if (!active) {
          return;
        }

        setLoading(false);
      } catch (thrownError) {
        if (!active) {
          return;
        }

        setError(thrownError instanceof Error ? thrownError.message : "L'étude n'a pas pu être chargée.");
        setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadStudyDashboard]);

  async function handleFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setActiveView('responses');
    await loadStudyDashboard(1);
  }

  async function handlePageChange(nextPage: number) {
    if (nextPage < 1) {
      return;
    }

    setPage(nextPage);
    setActiveView('responses');
    await loadStudyDashboard(nextPage);
  }

  const metrics = data?.metrics;
  const studyStats = data?.studyStats;
  const qualityStats = data?.qualityStats;
  const totalResponses = studyStats?.totalResponses ?? metrics?.totalResponses ?? 0;
  const responseCount = data?.responseCount ?? responses.length;
  const responsePage = data?.responsePage ?? page;
  const responseTotalPages = data?.responseTotalPages ?? 1;

  const profileBreakdown = useMemo(
    () =>
      normalizeBreakdown(
        sortBreakdown([
          {
            value: 'professional_available',
            label: getProfileLabel('professional_available'),
            count: studyStats?.byProfile.professional_available ?? 0,
            rate: 0,
          },
          {
            value: 'professional_employed',
            label: getProfileLabel('professional_employed'),
            count: studyStats?.byProfile.professional_employed ?? 0,
            rate: 0,
          },
          {
            value: 'company',
            label: getProfileLabel('company'),
            count: studyStats?.byProfile.company ?? 0,
            rate: 0,
          },
          {
            value: 'agency',
            label: getProfileLabel('agency'),
            count: studyStats?.byProfile.agency ?? 0,
            rate: 0,
          },
        ]),
        totalResponses,
      ),
    [studyStats, totalResponses],
  );

  const acquisitionBreakdown = useMemo(() => {
    const counts = new Map((studyStats?.byAcquisitionChannel ?? []).map((item) => [item.value, item.count]));
    return studyAcquisitionChannelOptions.map((option) => {
      const count = counts.get(option.value) ?? 0;
      return {
        value: option.value,
        label: getAcquisitionChannelLabel(option.value),
        count,
        rate: totalResponses > 0 ? count / totalResponses : 0,
      };
    });
  }, [studyStats, totalResponses]);

  const availabilityNowCounts = useMemo(
    () => countByValue(responses.map((response) => response.answers?.availabilityNow as string | undefined)),
    [responses],
  );
  const availabilityNowBreakdown = useMemo<StudyBreakdownItem[]>(
    () => [
      {
        value: 'yes',
        label: 'Oui',
        count: availabilityNowCounts.yes ?? 0,
        rate: totalResponses > 0 ? (availabilityNowCounts.yes ?? 0) / totalResponses : 0,
      },
      {
        value: 'no',
        label: 'Non',
        count: availabilityNowCounts.no ?? 0,
        rate: totalResponses > 0 ? (availabilityNowCounts.no ?? 0) / totalResponses : 0,
      },
    ],
    [availabilityNowCounts, totalResponses],
  );
  const availabilityNowAnsweredCount = (availabilityNowCounts.yes ?? 0) + (availabilityNowCounts.no ?? 0);
  const availabilityNowRate = availabilityNowAnsweredCount > 0 ? (availabilityNowCounts.yes ?? 0) / availabilityNowAnsweredCount : 0;

  const currentRoleOtherBreakdown = studyStats?.currentRoleOtherBreakdown ?? [];
  const currentRoleOtherTopCount = currentRoleOtherBreakdown[0]?.count ?? 0;

  const selectedViewSummary = activeView === 'overview'
    ? 'La synthèse analytique complète est affichée par défaut.'
    : 'La liste filtrable des réponses individuelles est disponible en complément.';

  return (
    <SevenoSurface
      eyebrow="Administration Seven’O"
      title="Étude"
      description="Conservez ici la vue analytique complète et la liste filtrable des réponses individuelles, sans toucher à la page publique."
      containerClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading ? (
          <SevenoPanel tone="neutral" className="p-5 text-sm text-slate-300">
            Chargement de l’étude...
          </SevenoPanel>
        ) : error ? (
          <SevenoPanel tone="orange" className="p-5 text-sm leading-7 text-amber-100">
            {error}
          </SevenoPanel>
        ) : data ? (
          <>
            <SevenoPanel tone="neutral" className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Navigation interne</p>
                  <h1 className="text-2xl font-semibold text-white">Tableau de bord de l’étude</h1>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300">{selectedViewSummary}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <TabButton active={activeView === 'overview'} onClick={() => setActiveView('overview')}>
                    Vue d&apos;ensemble
                  </TabButton>
                  <TabButton active={activeView === 'responses'} onClick={() => setActiveView('responses')}>
                    Réponses individuelles
                  </TabButton>
                </div>
              </div>
            </SevenoPanel>

            {activeView === 'overview' ? (
              <div className="space-y-6">
                <SectionCard
                  tone="cyan"
                  eyebrow="Résultats de l’étude"
                  title="Vue d’ensemble des réponses"
                  description="Agrégation réalisée uniquement côté admin, sans exposer les contacts dans les statistiques."
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <KpiCard
                      tone="cyan"
                      label="Réponses collectées"
                      value={totalResponses}
                      detail="Volume total de participation."
                    />
                    <KpiCard
                      tone="cyan"
                      label="Prévenus du lancement"
                      value={metrics?.launchCount ?? 0}
                      detail={
                        <span>
                          {totalResponses ? formatPercent((metrics?.launchCount ?? 0) / totalResponses) : '0 %'} oui
                          {' / '}
                          {totalResponses ? formatPercent((totalResponses - (metrics?.launchCount ?? 0)) / totalResponses) : '0 %'} non
                        </span>
                      }
                    />
                    <KpiCard
                      tone="cyan"
                      label="Bêta intéressés"
                      value={metrics?.betaCount ?? 0}
                      detail={
                        <span>
                          {totalResponses ? formatPercent((metrics?.betaCount ?? 0) / totalResponses) : '0 %'} oui
                          {' / '}
                          {totalResponses ? formatPercent((totalResponses - (metrics?.betaCount ?? 0)) / totalResponses) : '0 %'} non
                        </span>
                      }
                    />
                    <KpiCard
                      tone="teal"
                      label="Disponibilité immédiate"
                      value={formatPercent(availabilityNowRate)}
                      detail={`${availabilityNowCounts.yes ?? 0} oui · ${availabilityNowCounts.no ?? 0} non`}
                    />
                    <KpiCard
                      tone="violet"
                      label="Confirmation quotidienne"
                      value={studyStats ? formatPercent(studyStats.dailyAvailabilityAcceptanceRate) : '0 %'}
                      detail={`${studyStats?.dailyAvailabilityAcceptanceCount ?? 0} réponses acceptées`}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm text-slate-300">Taux de conversion lancement</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{metrics ? formatPercent(metrics.launchRate) : '0 %'}</p>
                      <p className="mt-2 text-sm text-slate-400">{metrics?.launchCount ?? 0} personnes</p>
                    </article>
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm text-slate-300">Taux de conversion bêta</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{metrics ? formatPercent(metrics.betaRate) : '0 %'}</p>
                      <p className="mt-2 text-sm text-slate-400">{metrics?.betaCount ?? 0} personnes</p>
                    </article>
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm text-slate-300">Niveau d’intérêt global</p>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-2 py-3">
                          <div className="font-semibold text-white">{metrics?.intentCounts.high ?? 0}</div>
                          <div className="mt-1 text-slate-400">Élevé</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-2 py-3">
                          <div className="font-semibold text-white">{metrics?.intentCounts.medium ?? 0}</div>
                          <div className="mt-1 text-slate-400">Moyen</div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-2 py-3">
                          <div className="font-semibold text-white">{metrics?.intentCounts.low ?? 0}</div>
                          <div className="mt-1 text-slate-400">Faible</div>
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <KpiCard
                      tone="orange"
                      label="Intérêt recruteurs"
                      value={metrics ? formatPercent(metrics.projectUpdatesRate) : '0 %'}
                      detail={
                        <span>
                          {metrics?.projectUpdatesYesCount ?? 0} oui / {metrics?.projectUpdatesNoCount ?? 0} non
                          {' · '}
                          base {metrics?.projectUpdatesBaseCount ?? 0}
                        </span>
                      }
                    />
                    <KpiCard
                      tone="amber"
                      label="Avis favorable sur le logo"
                      value={metrics ? formatPercent(metrics.logoFeedbackRate) : '0 %'}
                      detail={
                        <span>
                          {metrics?.logoFeedbackYesCount ?? 0} oui / {metrics?.logoFeedbackNoCount ?? 0} non
                          {' · '}
                          base {metrics?.logoFeedbackBaseCount ?? 0}
                        </span>
                      }
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  tone="cyan"
                  eyebrow="Acquisition"
                  title="Origine des répondants"
                  description="Répartition réelle par canal d’acquisition, avec les canaux à zéro conservés."
                >
                  <BreakdownTable
                    tone="cyan"
                    title="Canaux d’acquisition"
                    items={acquisitionBreakdown}
                    total={totalResponses}
                  />
                </SectionCard>

                <SectionCard
                  tone="teal"
                  eyebrow="Disponibilité fraîche"
                  title="Disponibilité immédiate ou actuelle"
                  description="Lecture de la disponibilité déclarée sur la question dédiée du questionnaire."
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                    <BreakdownTable
                      tone="teal"
                      title="Disponibilité"
                      items={availabilityNowBreakdown}
                      total={availabilityNowAnsweredCount || totalResponses}
                    />
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm text-slate-300">Taux de disponibilité immédiate</p>
                      <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
                        {availabilityNowAnsweredCount > 0 ? formatPercent(availabilityNowRate) : '0 %'}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        Calculé à partir des réponses oui / non sur la disponibilité actuelle.
                      </p>
                      <div className="mt-5 space-y-3">
                        <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3">
                          <span className="text-sm text-slate-300">Réponses oui</span>
                          <span className="text-sm font-medium text-white">{availabilityNowCounts.yes ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3">
                          <span className="text-sm text-slate-300">Réponses non</span>
                          <span className="text-sm font-medium text-white">{availabilityNowCounts.no ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <div className="grid gap-6 xl:grid-cols-2">
                  <SectionCard
                    tone="violet"
                    eyebrow="Segmentation profils"
                    title="Répartition par profil"
                    description="Lecture des profils répondants pour comparer les segments principaux."
                  >
                    <ProfileBreakdownList items={profileBreakdown} total={totalResponses} />
                  </SectionCard>

                  <SectionCard
                    tone="green"
                    eyebrow="Marché / secteurs / zone"
                    title="Lecture du marché"
                    description="Répartition des secteurs, zones et habitudes de travail les plus déclarées."
                  >
                    <div className="grid gap-4">
                      <BreakdownTable tone="green" title="Secteurs" items={studyStats?.bySectorCode ?? []} total={totalResponses} />
                      <BreakdownTable
                        tone="green"
                        title="Zones géographiques"
                        items={studyStats?.byActiveZoneCode ?? []}
                        total={totalResponses}
                      />
                      <BreakdownTable
                        tone="green"
                        title="Types de contrat"
                        items={studyStats?.topContractTypeCodes ?? []}
                        total={totalResponses}
                      />
                      <BreakdownTable
                        tone="green"
                        title="Modes de travail"
                        items={studyStats?.topWorkModePreferenceCodes ?? []}
                        total={totalResponses}
                      />
                    </div>
                  </SectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <SectionCard
                    tone="orange"
                    eyebrow="Freins / problèmes"
                    title="Ce qui bloque le plus"
                    description="Lecture synthétique des freins exprimés et des difficultés de marché."
                  >
                    <div className="grid gap-4">
                      <BreakdownTable
                        tone="orange"
                        title="Freins à la recherche"
                        items={studyStats?.topSearchBlockerCodes ?? []}
                        total={totalResponses}
                      />
                      <BreakdownTable
                        tone="orange"
                        title="Ce qui manque au marché"
                        items={studyStats?.topMarketMissingCodes ?? []}
                        total={totalResponses}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    tone="amber"
                    eyebrow="Attentes / valeur"
                    title="Valeur perçue et attente produit"
                    description="Ce que les répondants attendent réellement de Seven’O et du marché en général."
                  >
                    <div className="grid gap-4">
                      <BreakdownTable
                        tone="amber"
                        title="Valeur attendue"
                        items={studyStats?.topValueExpectationCodes ?? []}
                        total={totalResponses}
                      />
                      <BreakdownTable
                        tone="amber"
                        title="Canal de contact préféré"
                        items={studyStats?.preferredContactChannel ?? []}
                        total={totalResponses}
                      />
                    </div>
                  </SectionCard>
                </div>

                <SectionCard
                  tone="teal"
                  eyebrow="Disponibilité fraîche"
                  title="Acceptation de la confirmation quotidienne"
                  description="Le taux d’acceptation mesure la disposition à confirmer sa disponibilité une fois par jour."
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                    <BreakdownTable
                      tone="teal"
                      title="Confirmation quotidienne"
                      items={studyStats?.dailyAvailabilityConfirmation ?? []}
                      total={totalResponses}
                    />

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm text-slate-300">Taux d’acceptation quotidienne</p>
                      <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
                        {studyStats ? formatPercent(studyStats.dailyAvailabilityAcceptanceRate) : '0 %'}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        Calculé à partir des réponses favorables à une confirmation quotidienne, sans exposer les contacts.
                      </p>

                      <div className="mt-5 space-y-3">
                        <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3">
                          <span className="text-sm text-slate-300">Réponses acceptées</span>
                          <span className="text-sm font-medium text-white">{studyStats?.dailyAvailabilityAcceptanceCount ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-slate-950/70 px-4 py-3">
                          <span className="text-sm text-slate-300">Base totale</span>
                          <span className="text-sm font-medium text-white">{totalResponses}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  tone="orange"
                  eyebrow="Contrôle qualité des réponses"
                  title="Détection des réponses suspectes"
                  description="Alerte uniquement, sans exposer d’emails, de téléphones ni d’identifiants."
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      tone="orange"
                      label="Emails uniques"
                      value={qualityStats?.uniqueEmails ?? 0}
                      detail="Valeurs non vides détectées."
                    />
                    <KpiCard
                      tone="orange"
                      label="Téléphones uniques"
                      value={qualityStats?.uniquePhones ?? 0}
                      detail="Valeurs normalisées détectées."
                    />
                    <KpiCard
                      tone="orange"
                      label="Fingerprints uniques"
                      value={qualityStats?.uniqueFingerprints ?? 0}
                      detail="Empreintes navigateur distinctes."
                    />
                    <KpiCard
                      tone="orange"
                      label="Réponses suspectes"
                      value={qualityStats?.suspectResponses ?? 0}
                      detail="Doublons ou rafales de soumission."
                    />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-slate-300">Doublons email</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.duplicateEmailResponses ?? 0}</p>
                    </article>
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-slate-300">Doublons téléphone</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.duplicatePhoneResponses ?? 0}</p>
                    </article>
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-slate-300">Doublons fingerprint</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.duplicateFingerprintResponses ?? 0}</p>
                    </article>
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-slate-300">Rafales &lt; 10 min</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{qualityStats?.burstResponses ?? 0}</p>
                    </article>
                  </div>
                </SectionCard>

                <SectionCard
                  tone="amber"
                  eyebrow="Enrichissement de taxonomie"
                  title="Métiers non listés"
                  description="Métiers saisis librement par les répondants lorsqu’ils n’ont pas trouvé leur poste dans la taxonomie actuelle."
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      tone="amber"
                      label="Métiers libres distincts"
                      value={studyStats?.currentRoleOtherDistinctCount ?? 0}
                      detail="Libellés normalisés avant agrégation."
                    />
                    <KpiCard
                      tone="amber"
                      label="Réponses concernées"
                      value={studyStats?.currentRoleOtherResponseCount ?? 0}
                      detail="Réponses contenant currentRoleOther."
                    />
                    <KpiCard
                      tone="amber"
                      label="Occurrence maximale"
                      value={currentRoleOtherTopCount}
                      detail="Pic de fréquence d’un même libellé."
                    />
                    <KpiCard
                      tone="amber"
                      label="Résumé"
                      value="Top 10"
                      detail="Métiers libres les plus fréquents."
                    />
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
                    <BreakdownTable
                      tone="amber"
                      title="Top 10 des métiers libres les plus fréquents"
                      items={currentRoleOtherBreakdown}
                      total={studyStats?.currentRoleOtherResponseCount ?? 0}
                      highlightThreshold={3}
                    />

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-sm text-slate-300">Lecture rapide</p>
                      <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                        <p>Les libellés sont normalisés par trim, espaces multiples et casse avant agrégation.</p>
                        <p>Les entrées répétées signalées ici sont des candidates à une validation admin.</p>
                        <p>Le seuil d’alerte est fixé à 3 occurrences.</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>
            ) : (
              <SevenoPanel tone="neutral" className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Filtres</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Réponses individuelles</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                    <span>{responseCount} réponse(s) trouvée(s)</span>
                    <span>Page {responsePage} sur {responseTotalPages}</span>
                  </div>
                </div>

                <form onSubmit={(event) => void handleFilters(event)} className="mt-4 grid gap-3 xl:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto]">
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Recherche
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Email, réponse, source..."
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
                      {profileOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Lancement
                    <select
                      value={launch}
                      onChange={(event) => setLaunch(event.target.value as FilterValue)}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                    >
                      {yesNoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Bêta
                    <select
                      value={beta}
                      onChange={(event) => setBeta(event.target.value as FilterValue)}
                      className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                    >
                      {yesNoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
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
                                  {response.acquisitionChannelLabel ||
                                    getAcquisitionChannelLabel(response.acquisitionChannel) ||
                                    'Canal'}
                                </span>
                              ) : null}
                              {response.logoFeedback ? (
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                  Logo {response.logoFeedback === 'yes' ? 'Oui' : 'Non'}
                                </span>
                              ) : null}
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Lancement {response.wantsLaunchNotification ? 'Oui' : 'Non'}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                                Bêta {response.wantsBetaAccess ? 'Oui' : 'Non'}
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
                                  {key}: {formatStudyAnswerValue(key, value ?? null)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-4 text-sm text-slate-400">Aucune réponse détaillée disponible.</p>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
                      Aucune réponse ne correspond aux filtres.
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
                    Précédent
                  </button>
                  <p className="text-sm text-slate-400">{respondentsPageSize} réponses par page</p>
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
            )}
          </>
        ) : null}
      </div>
    </SevenoSurface>
  );
}
